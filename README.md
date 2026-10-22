# Loan AI Management System

An AI-powered loan assessment application that combines Machine Learning, a FastAPI backend, and a PostgreSQL database to support loan risk assessment and application management.

The system allows applicants to submit their personal and financial information for an AI-assisted assessment. It generates prediction results and estimated approval and rejection probabilities, while authorized administrators can access application records and analytics.

**Live Demo:** https://smartlend-ai.netlify.app/

**Backend API:** https://loan-ai-management-system.onrender.com/

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Application Workflow](#application-workflow)
- [Machine Learning](#machine-learning)
- [Database Design](#database-design)
- [Security](#security)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Future Improvements](#future-improvements)
- [Disclaimer](#disclaimer)
- [Author](#author)

## Overview

The Loan AI Management System demonstrates how machine learning can be integrated into a web application to support data-driven loan assessment.

The application connects a responsive web interface to a Python backend, loads a trained machine learning model, processes applicant information, and stores application records in a PostgreSQL database.

The project also includes administrator authentication for protected application-management and analytics endpoints.

## Key Features

### Applicant Interface
- Responsive interface for desktop and mobile devices.
- Loan application form for collecting applicant and financial information.
- Input validation for supported fields, including Kenyan mobile phone number formats.
- AI-assisted loan assessment results.
- Estimated approval and rejection probabilities.
- Clear application workflow for ordinary users.

### Machine Learning
- Integration of a trained classification model.
- Model inference through the FastAPI backend.
- Processing of financial and applicant attributes.
- Prediction results and probability-based outputs.

### Backend and Database
- REST API developed with FastAPI.
- PostgreSQL database hosted on Supabase.
- Storage of loan application records.
- Database connectivity through environment-based configuration.
- Endpoints for application retrieval and analytics.

### Administrator Features
- Separate administrator login interface.
- HTTP Basic authentication for protected endpoints.
- Access to application records and individual application details.
- Access to application statistics and analytics.

### Deployment
- Frontend hosted on Netlify.
- Backend hosted on Render.
- PostgreSQL database hosted on Supabase.
- GitHub used for source-code management.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Python, FastAPI |
| Machine Learning | scikit-learn, trained model serialized with Joblib |
| Database | PostgreSQL, Supabase |
| Authentication | HTTP Basic authentication for administrator endpoints |
| API Server | Uvicorn |
| Deployment | Netlify, Render |
| Version Control | Git, GitHub |

## System Architecture

```text
                  Applicant / Administrator
                            |
                            v
                 Frontend — Netlify
                    HTML, CSS, JS
                            |
                            v
                  FastAPI Backend
                     Render
                    /        \
                   v          v
          Machine Learning   PostgreSQL
               Model         Supabase
                   \          /
                    v        v
                  Assessment
                  and Records
```

The frontend communicates with the backend API over HTTP. The backend processes requests, performs model inference where required, and interacts with PostgreSQL to store or retrieve application data.

Administrator endpoints require authentication.

## Application Workflow

1. An applicant opens the web application.
2. The applicant enters the required personal and financial details.
3. The frontend sends the application to the FastAPI backend.
4. The backend validates the submitted data.
5. The trained model generates an assessment prediction and probability estimates.
6. The backend stores the application record in PostgreSQL.
7. The application displays the assessment results.
8. An authenticated administrator can retrieve application records and analytics through the protected endpoints.

## Machine Learning

The application integrates a previously trained machine learning model for loan assessment.

The backend loads the serialized model and uses it to generate predictions from the applicant's submitted features.

The assessment can include:
- Predicted loan assessment outcome.
- Estimated approval probability.
- Estimated rejection probability.
- A risk-level classification, where provided by the backend.

**Important:** The model's outputs are estimates based on its training data and learned patterns. They are not guarantees of repayment, creditworthiness, or actual loan approval.

For reproducible predictions, the model's training and inference environments should use compatible versions of scikit-learn and any other relevant dependencies.

## Database Design

The application uses PostgreSQL through Supabase.

Loan application records are stored in the `loan_applications` table. Depending on the deployed database schema, records can include applicant information, financial attributes, prediction outputs, and other application metadata.

Database credentials are configured through environment variables rather than being embedded in frontend code.

## Security

The project incorporates several security practices:

- Environment variables for sensitive backend configuration.
- Administrator authentication for protected API endpoints.
- Separation of the public applicant interface from administrative access.
- Server-side handling of database credentials.
- Input validation on application fields.

### Security considerations

- Never commit `.env` files, database passwords, or secret keys to GitHub.
- Configure production secrets in Render's environment settings.
- Use HTTPS for deployed services.
- Restrict database permissions to the minimum required by the application.
- Consider rate limiting, audit logging, stronger administrator authentication, and additional protections against automated requests before production use.
- Avoid exposing unnecessary personal or financial information in logs or API responses.

## Deployment

The application is deployed using the following services:

| Service | Purpose |
|---|---|
| Netlify | Hosts the frontend |
| Render | Hosts the FastAPI backend |
| Supabase | Provides the PostgreSQL database |
| GitHub | Stores and manages source code |

### Live application

- **Frontend:** https://smartlend-ai.netlify.app/
- **Backend health check:** https://loan-ai-management-system.onrender.com/

The backend root endpoint can be used to confirm that the service is responding.

## Project Structure

The project is organized into frontend and backend components. A typical structure is shown below; adjust the filenames to match the actual contents of your repository.

```text
LoanAI/
├── backend/
│   ├── main.py
│   ├── model.pkl
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── .gitignore
└── README.md
```

- `main.py` — defines the FastAPI application, API endpoints, model inference, and database interactions.
- `model.pkl` — contains the serialized trained machine learning model.
- `requirements.txt` — lists the Python dependencies required by the backend.
- `index.html` — defines the frontend structure.
- `style.css` — controls the interface styling and responsive layout.
- `script.js` — manages frontend interactions and API communication.
- `.gitignore` — excludes local files and sensitive configuration from version control.

## Getting Started

### Prerequisites

Install or prepare the following:

- Python 3.10 or a compatible version supported by your dependencies.
- Git.
- A PostgreSQL database or Supabase project.
- The trained model file required by the backend.
- A modern web browser.

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd LoanAI
```

Replace the placeholder with your actual repository URL.

### 2. Set up the backend

```bash
cd backend
python -m venv venv
```

On Windows:

```powershell
venv\Scripts\activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a local `.env` file in the location expected by your backend configuration. Use the variable names required by your actual `main.py`.

For example:

```env
DATABASE_URL=your_database_connection_string
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_strong_admin_password
```

If your application uses separate PostgreSQL connection variables or an additional secret key, configure those as required by the backend.

**Do not use these example values as production credentials or commit your real `.env` file.**

### 4. Run the backend

From the backend directory:

```bash
uvicorn main:app --reload
```

Open the interactive API documentation at:

http://127.0.0.1:8000/docs

### 5. Run the frontend

Open `frontend/index.html` in a browser or use a local development server.

Ensure the frontend's API base URL points to the local backend when testing locally. For production, it should point to the deployed Render service.

## API Endpoints

The following endpoints are part of the application's API workflow. Protected endpoints require valid administrator credentials.

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/` | Check backend service status | Public |
| POST | `/predict` | Submit a loan application and obtain an assessment | Public |
| GET | `/statistics` | Retrieve application statistics | Admin |
| GET | `/analytics` | Retrieve analytics data | Admin |
| GET | `/applications` | Retrieve application records | Admin |
| GET | `/applications/{application_id}` | Retrieve a specific application | Admin |

Authentication and authorization should always be enforced by the backend, not just by hiding or showing controls in the frontend.

## Future Improvements

Potential areas for further development include:

- Model evaluation using precision, recall, F1-score, ROC-AUC, and a confusion matrix.
- Explainable AI to help interpret prediction results.
- Improved applicant identity verification and data validation.
- Application status tracking and notifications.
- Enhanced administrator dashboard visualizations.
- Audit logs and more detailed role-based access control.
- Automated model monitoring and retraining workflows.
- Unit tests, API integration tests, and continuous integration.
- Docker-based development and deployment.
- Improved accessibility and user experience.

## Disclaimer

This project is intended for educational, demonstration, and portfolio purposes. Its predictions should not be treated as professional financial advice or as the sole basis for approving or rejecting real loan applications.

Any real-world deployment would require appropriate model validation, fairness testing, data protection measures, security reviews, and compliance with applicable financial and privacy regulations.

## Author

**Sylvester Ojwang**

BBIT Student | Data Science | Machine Learning | Backend Development | Database Systems

This project demonstrates practical experience integrating machine learning, APIs, databases, frontend development, and cloud deployment into one application.

- GitHub: https://github.com/sylvester513/loan-ai-management-system.git
- LinkedIn:https://www.linkedin.com/in/sylvester-ojwang-123546443 

---

*Built as a practical project exploring the integration of machine learning and web technologies for loan assessment and application management.*
