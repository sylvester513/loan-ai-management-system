
import os
import logging
from pathlib import Path

import joblib
import psycopg2

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field


# ============================================================
# ENVIRONMENT CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

# Load local environment variables from backend/.env.
# On Render, variables are configured in the dashboard.
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
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Loan AI Management System",
    description="AI-powered Loan Management and Prediction API",
    version="2.0"
)


# ============================================================
# TEMPORARY CORS CONFIGURATION
# We will restrict this after deploying the backend.
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================
# LOAD MACHINE LEARNING MODEL
# ============================================================

try:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model file not found: {MODEL_PATH}"
        )

    model = joblib.load(MODEL_PATH)

    if not hasattr(model, "predict"):
        raise ValueError("Model does not support predict().")

    if not hasattr(model, "predict_proba"):
        raise ValueError(
            "Model does not support predict_proba()."
        )

    logger.info("ML model loaded successfully.")

except Exception:
    logger.exception("Could not load model.pkl.")
    raise


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_connection():
    """Connect to the existing Supabase PostgreSQL database."""

    missing = [
        key
        for key, value in {
            "DB_HOST": DB_HOST,
            "DB_USER": DB_USER,
            "DB_PASSWORD": DB_PASSWORD,
        }.items()
        if not value
    ]

    if missing:
        raise RuntimeError(
            "Missing database environment variables: "
            + ", ".join(missing)
        )

    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode=DB_SSLMODE,
        connect_timeout=10,
    )


# ============================================================
# REQUEST MODEL
# ============================================================

class LoanApplication(BaseModel):
    applicant_name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    phone: str = Field(min_length=1, max_length=30)

    income: float = Field(ge=0)
    age: int = Field(ge=18, le=120)
    loan_amount: float = Field(gt=0)
    credit_score: int = Field(ge=0, le=1000)


# ============================================================
# HOME / STATUS
# ============================================================

@app.get("/")
def home():
    return {
        "message": "Loan AI Management System is running",
        "version": "2.0",
        "status": "online"
    }


@app.get("/health")
def health():
    """Check whether the API can connect to PostgreSQL."""

    try:
        connection = get_connection()

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        finally:
            connection.close()

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception:
        logger.exception("Health check failed.")

        raise HTTPException(
            status_code=503,
            detail="Database connection is unavailable."
        )


# ============================================================
# HELPER: GET APPROVAL AND REJECTION PROBABILITIES
# ============================================================

def get_probabilities(input_data):
    probabilities = model.predict_proba(input_data)[0]

    # Use the model's actual class ordering.
    classes = list(model.classes_)

    if 0 not in classes or 1 not in classes:
        raise ValueError(
            "The model must contain class 0 (rejected) "
            "and class 1 (approved)."
        )

    rejected_probability = float(
        probabilities[classes.index(0)]
    )

    approved_probability = float(
        probabilities[classes.index(1)]
    )

    return (
        round(approved_probability * 100, 2),
        round(rejected_probability * 100, 2)
    )


# ============================================================
# PREDICT LOAN APPLICATION
# ============================================================

@app.post("/predict")
def predict(application: LoanApplication):

    connection = None
    cursor = None

    try:
        # Keep the same feature order used during model training.
        input_data = [[
            application.income,
            application.age,
            application.loan_amount,
            application.credit_score
        ]]

        prediction = int(model.predict(input_data)[0])

        if prediction not in (0, 1):
            raise ValueError("Unexpected model prediction.")

        approved_probability, rejected_probability = (
            get_probabilities(input_data)
        )

        result = (
            "Loan Approved"
            if prediction == 1
            else "Loan Rejected"
        )

        if approved_probability >= 80:
            risk_level = "LOW"
        elif approved_probability >= 50:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        # Save the application to Supabase PostgreSQL.
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO loan_applications (
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
            VALUES (%s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s)
            """,
            (
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
                rejected_probability
            )
        )

        connection.commit()

        return {
            "prediction": prediction,
            "result": result,
            "approved_probability": approved_probability,
            "rejected_probability": rejected_probability,
            "risk_level": risk_level,
            "applicant_name": application.applicant_name
        }

    except Exception:
        if connection is not None:
            connection.rollback()

        logger.exception("Prediction or database save failed.")

        raise HTTPException(
            status_code=500,
            detail="Prediction could not be completed."
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

        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_applications,

                COUNT(*) FILTER (
                    WHERE prediction = 1
                ) AS approved,

                COUNT(*) FILTER (
                    WHERE prediction = 0
                ) AS rejected,

                COALESCE(
                    ROUND(AVG(income)::numeric, 2), 0
                ) AS average_income,

                COALESCE(
                    ROUND(AVG(credit_score)::numeric, 2), 0
                ) AS average_credit_score,

                COALESCE(
                    ROUND(AVG(loan_amount)::numeric, 2), 0
                ) AS average_loan_amount

            FROM loan_applications
            """
        )

        row = cursor.fetchone()

        total = row[0]
        approved = row[1]
        rejected = row[2]

        approval_rate = (
            round(approved / total * 100, 2)
            if total > 0
            else 0
        )

        return {
            "total_applications": total,
            "approved": approved,
            "rejected": rejected,
            "approval_rate": approval_rate,
            "average_income": float(row[3]),
            "average_credit_score": float(row[4]),
            "average_loan_amount": float(row[5])
        }

    except Exception:
        logger.exception("Statistics request failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve statistics."
        )

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

        cursor.execute(
            """
            SELECT prediction, COUNT(*) AS total
            FROM loan_applications
            GROUP BY prediction
            ORDER BY prediction
            """
        )

        rows = cursor.fetchall()

        return [
            {
                "result": (
                    "Loan Approved"
                    if prediction == 1
                    else "Loan Rejected"
                ),
                "total": total
            }
            for prediction, total in rows
        ]

    except Exception:
        logger.exception("Analytics request failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve analytics."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


# ============================================================
# APPLICATION HISTORY
# ============================================================

@app.get("/applications")
def get_applications():

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
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
                rejected_probability,
                created_at
            FROM loan_applications
            ORDER BY id DESC
            """
        )

        rows = cursor.fetchall()

        return [
            {
                "id": row[0],
                "applicant_name": row[1],
                "email": row[2],
                "phone": row[3],
                "income": row[4],
                "age": row[5],
                "loan_amount": row[6],
                "credit_score": row[7],
                "prediction": row[8],
                "result": row[9],
                "approved_probability": row[10],
                "rejected_probability": row[11],
                "created_at": row[12]
            }
            for row in rows
        ]

    except Exception:
        logger.exception("Application history request failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve applications."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()


# ============================================================
# GET ONE APPLICATION
# ============================================================

@app.get("/applications/{application_id}")
def get_application(application_id: int):

    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
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
                rejected_probability,
                created_at
            FROM loan_applications
            WHERE id = %s
            """,
            (application_id,)
        )

        row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Application not found."
            )

        return {
            "id": row[0],
            "applicant_name": row[1],
            "email": row[2],
            "phone": row[3],
            "income": row[4],
            "age": row[5],
            "loan_amount": row[6],
            "credit_score": row[7],
            "prediction": row[8],
            "result": row[9],
            "approved_probability": row[10],
            "rejected_probability": row[11],
            "created_at": row[12]
        }

    except HTTPException:
        raise

    except Exception:
        logger.exception("Single application request failed.")

        raise HTTPException(
            status_code=500,
            detail="Could not retrieve the application."
        )

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None:
            connection.close()
