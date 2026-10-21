
import os
import logging
import math
from pathlib import Path

import joblib
import psycopg2

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field, field_validator

try:
    import pandas as pd
except ImportError:
    pd = None


# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_HOST = os.getenv("DB_HOST")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_SSLMODE = os.getenv("DB_SSLMODE", "require")

MODEL_PATH = Path(os.getenv("MODEL_PATH", "model.pkl"))
if not MODEL_PATH.is_absolute():
    MODEL_PATH = BASE_DIR / MODEL_PATH


# ============================================================
# FASTAPI APPLICATION AND CORS
# ============================================================

app = FastAPI(
    title="Loan AI Management System",
    description="AI-powered Loan Management and Prediction API",
    version="2.1"
)

CORS_ORIGINS = [
    "https://smartlend-ai.netlify.app",
    "http://localhost:63342",
    "http://127.0.0.1:63342",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]

for origin in os.getenv("CORS_ORIGINS", "").split(","):
    origin = origin.strip().rstrip("/")
    if origin and origin not in CORS_ORIGINS:
        CORS_ORIGINS.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================
# LOAD MODEL
# ============================================================

try:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

    model = joblib.load(MODEL_PATH)

    if not hasattr(model, "predict") or not hasattr(model, "predict_proba"):
        raise ValueError("Model must support predict() and predict_proba().")

    logger.info("ML model loaded successfully.")

except Exception:
    logger.exception("Could not load model.")
    raise


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_connection():
    missing = [
        key for key, value in {
            "DB_HOST": DB_HOST,
            "DB_USER": DB_USER,
            "DB_PASSWORD": DB_PASSWORD,
        }.items()
        if not value
    ]

    if missing:
        logger.error("Missing database configuration: %s", ", ".join(missing))
        raise HTTPException(
            status_code=500,
            detail="Database configuration is incomplete."
        )

    try:
        return psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            sslmode=DB_SSLMODE,
            connect_timeout=10,
        )
    except psycopg2.Error:
        logger.exception("Database connection failed.")
        raise HTTPException(
            status_code=503,
            detail="Database connection is unavailable."
        )


# ============================================================
# REQUEST VALIDATION
# ============================================================

class LoanApplication(BaseModel):
    applicant_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=30)
    income: float = Field(ge=0, lt=1_000_000_000_000)
    age: int = Field(ge=18, le=120)
    loan_amount: float = Field(gt=0, lt=1_000_000_000_000)
    credit_score: int = Field(ge=0, le=1000)

    @field_validator("income", "loan_amount")
    @classmethod
    def validate_finite_amount(cls, value):
        if not math.isfinite(value):
            raise ValueError("Amount must be a finite number.")
        return value


# ============================================================
# DATABASE ERROR DIAGNOSTICS
# ============================================================

def log_database_diagnostics(connection):
    """Log schema details without exposing applicant personal data."""

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT current_database(), current_schema(),
                       current_setting('search_path')
            """)
            logger.error("Database context: %s", cursor.fetchone())

            cursor.execute("""
                SELECT column_name,
                       format_type(a.atttypid, a.atttypmod) AS column_type
                FROM pg_attribute a
                WHERE a.attrelid = 'public.loan_applications'::regclass
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                ORDER BY a.attnum
            """)
            logger.error(
                "Actual public.loan_applications column types: %s",
                cursor.fetchall()
            )

            cursor.execute("""
                SELECT trigger_name, action_statement
                FROM information_schema.triggers
                WHERE event_object_schema = 'public'
                  AND event_object_table = 'loan_applications'
            """)
            logger.error("Application table triggers: %s", cursor.fetchall())

    except Exception:
        logger.exception("Could not collect database diagnostics.")


# ============================================================
# HEALTH AND HOME
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Loan AI Management System is running",
        "version": "2.1",
        "status": "online"
    }


@app.get("/health")
def health():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()

        return {"status": "healthy", "database": "connected"}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Health check failed.")
        raise HTTPException(status_code=503, detail="Database health check failed.")
    finally:
        if connection is not None:
            connection.close()


# ============================================================
# MODEL INPUT AND PROBABILITIES
# ============================================================

def prepare_model_input(application):
    values = {
        "income": application.income,
        "age": application.age,
        "loan_amount": application.loan_amount,
        "credit_score": application.credit_score,
    }

    feature_names = getattr(model, "feature_names_in_", None)

    if feature_names is not None and pd is not None:
        return pd.DataFrame([values])[list(feature_names)]

    return [[
        application.income,
        application.age,
        application.loan_amount,
        application.credit_score
    ]]


def get_probabilities(input_data):
    probabilities = model.predict_proba(input_data)[0]
    classes = list(model.classes_)

    if 0 not in classes or 1 not in classes:
        raise ValueError("Model must contain class 0 and class 1.")

    approved = round(float(probabilities[classes.index(1)]) * 100, 2)
    rejected = round(float(probabilities[classes.index(0)]) * 100, 2)

    return approved, rejected


# ============================================================
# CREATE AND SAVE LOAN APPLICATION
# ============================================================

@app.post("/predict")
def predict(application: LoanApplication):
    connection = None
    cursor = None

    try:
        input_data = prepare_model_input(application)

        prediction = int(model.predict(input_data)[0])
        if prediction not in (0, 1):
            raise ValueError("Unexpected model prediction.")

        approved_probability, rejected_probability = get_probabilities(input_data)

        result = "Loan Approved" if prediction == 1 else "Loan Rejected"

        if approved_probability >= 80:
            risk_level = "LOW"
        elif approved_probability >= 50:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        # Validate calculated values before attempting the database insert.
        numeric_values = {
            "income": application.income,
            "loan_amount": application.loan_amount,
            "approved_probability": approved_probability,
            "rejected_probability": rejected_probability,
        }

        for field_name, value in numeric_values.items():
            if not math.isfinite(value):
                raise ValueError(f"Invalid numeric value for {field_name}.")

        if not (0 <= approved_probability <= 100 and
                0 <= rejected_probability <= 100):
            raise ValueError("Model probabilities are outside the 0-100 range.")

        connection = get_connection()
        connection.autocommit = False
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO public.loan_applications (
                applicant_name,
                email,
                phone,
                income,
                age,
                loan_amount,
                credit_score,
                prediction,
                result,
                approved_probability,
                rejected_probability
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, created_at
        """, (
            application.applicant_name,
            str(application.email),
            application.phone,
            application.income,
            application.age,
            application.loan_amount,
            application.credit_score,
            prediction,
            result,
            approved_probability,
            rejected_probability,
        ))

        saved_row = cursor.fetchone()
        connection.commit()

        logger.info(
            "Application saved successfully. application_id=%s",
            saved_row[0]
        )

        return {
            "id": saved_row[0],
            "created_at": saved_row[1].isoformat() if saved_row[1] else None,
            "prediction": prediction,
            "result": result,
            "approved_probability": approved_probability,
            "rejected_probability": rejected_probability,
            "risk_level": risk_level,
            "applicant_name": application.applicant_name,
            "message": "Application saved successfully."
        }

    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise

    except Exception as exc:
        if connection is not None:
            connection.rollback()

        # Log numeric inputs only, never applicant contact details.
        logger.error(
            "Application processing failed. Numeric inputs: "
            "income=%s, age=%s, loan_amount=%s, credit_score=%s",
            application.income,
            application.age,
            application.loan_amount,
            application.credit_score,
        )

        if isinstance(exc, psycopg2.Error):
            logger.error(
                "PostgreSQL error code=%s, detail=%s",
                exc.pgcode,
                getattr(exc, "pgerror", None)
            )
            if connection is not None:
                log_database_diagnostics(connection)

        logger.exception("Prediction or database save failed.")

        raise HTTPException(
            status_code=500,
            detail="Prediction could not be completed or saved. Please try again."
        )

    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


# ============================================================
# STATISTICS
# ============================================================

@app.get("/statistics")
def get_statistics():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                COUNT(*),
                COUNT(*) FILTER (WHERE prediction = 1),
                COUNT(*) FILTER (WHERE prediction = 0),
                COALESCE(ROUND(AVG(income)::numeric, 2), 0),
                COALESCE(ROUND(AVG(credit_score)::numeric, 2), 0),
                COALESCE(ROUND(AVG(loan_amount)::numeric, 2), 0)
            FROM public.loan_applications
        """)

        row = cursor.fetchone()
        total, approved, rejected = row[0], row[1], row[2]

        return {
            "total_applications": total,
            "approved": approved,
            "rejected": rejected,
            "approval_rate": round(approved / total * 100, 2) if total else 0,
            "average_income": float(row[3]),
            "average_credit_score": float(row[4]),
            "average_loan_amount": float(row[5]),
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Statistics request failed.")
        raise HTTPException(status_code=500, detail="Could not retrieve statistics.")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


# ============================================================
# ANALYTICS
# ============================================================

@app.get("/analytics")
def get_analytics():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT prediction, COUNT(*)
            FROM public.loan_applications
            GROUP BY prediction
            ORDER BY prediction
        """)

        return [
            {
                "result": "Loan Approved" if prediction == 1 else "Loan Rejected",
                "total": total,
            }
            for prediction, total in cursor.fetchall()
        ]

    except HTTPException:
        raise
    except Exception:
        logger.exception("Analytics request failed.")
        raise HTTPException(status_code=500, detail="Could not retrieve analytics.")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


# ============================================================
# APPLICATION HISTORY
# ============================================================

def application_to_dict(row):
    return {
        "id": row[0],
        "applicant_name": row[1],
        "email": row[2],
        "phone": row[3],
        "income": float(row[4]) if row[4] is not None else None,
        "age": row[5],
        "loan_amount": float(row[6]) if row[6] is not None else None,
        "credit_score": row[7],
        "prediction": row[8],
        "result": row[9],
        "approved_probability": float(row[10]) if row[10] is not None else None,
        "rejected_probability": float(row[11]) if row[11] is not None else None,
        "created_at": row[12].isoformat() if row[12] else None,
    }


APPLICATION_COLUMNS = """
    id, applicant_name, email, phone, income, age, loan_amount,
    credit_score, prediction, result, approved_probability,
    rejected_probability, created_at
"""


@app.get("/applications")
def get_applications():
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(f"""
            SELECT {APPLICATION_COLUMNS}
            FROM public.loan_applications
            ORDER BY id DESC
        """)
        return [application_to_dict(row) for row in cursor.fetchall()]

    except HTTPException:
        raise
    except Exception:
        logger.exception("Application history request failed.")
        raise HTTPException(status_code=500, detail="Could not retrieve applications.")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()


@app.get("/applications/{application_id}")
def get_application(application_id: int):
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute(f"""
            SELECT {APPLICATION_COLUMNS}
            FROM public.loan_applications
            WHERE id = %s
        """, (application_id,))

        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Application not found.")

        return application_to_dict(row)

    except HTTPException:
        raise
    except Exception:
        logger.exception("Single application request failed.")
        raise HTTPException(status_code=500, detail="Could not retrieve the application.")
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None:
            connection.close()
