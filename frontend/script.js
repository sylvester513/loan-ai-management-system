"use strict";

// ============================================================
// CONFIGURATION
// ============================================================

const API_URL = "https://loan-ai-management-system.onrender.com";

let adminAuthorization = null;
let approvalChart = null;
let predictionChart = null;


// ============================================================
// ADMIN AUTHENTICATION
// ============================================================

function getAdminHeaders() {
    return adminAuthorization
        ? { Authorization: adminAuthorization }
        : {};
}

function setAdminView(isAdmin) {
    document.querySelectorAll("[data-admin-only]").forEach(element => {
        element.hidden = !isAdmin;
    });

    const status = document.getElementById("adminAuthStatus");
    const loginForm = document.getElementById("adminLoginForm");
    const logoutButton = document.getElementById("adminLogoutButton");

    if (status) {
        status.textContent = isAdmin
            ? "Admin authenticated"
            : "Admin dashboard locked";
    }

    if (loginForm) loginForm.hidden = isAdmin;
    if (logoutButton) logoutButton.hidden = !isAdmin;
}

function clearAdminLogin(message = "Admin dashboard locked") {
    adminAuthorization = null;
    setAdminView(false);

    const status = document.getElementById("adminAuthStatus");
    if (status) status.textContent = message;

    // Clear private information from the visible dashboard.
    [
        "totalApplications",
        "approvedLoans",
        "rejectedLoans",
        "approvalRate",
        "averageIncome",
        "averageCredit",
        "averageLoan"
    ].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = "—";
    });

    const table = document.getElementById("applicationsTable");

    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="10" class="loading">
                    Admin login required.
                </td>
            </tr>
        `;
    }

    if (approvalChart) {
        approvalChart.destroy();
        approvalChart = null;
    }

    if (predictionChart) {
        predictionChart.destroy();
        predictionChart = null;
    }
}

async function adminFetch(endpoint) {
    if (!adminAuthorization) {
        throw new Error("Please log in as administrator.");
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: getAdminHeaders()
    });

    if (response.status === 401) {
        clearAdminLogin("Admin authentication failed. Please log in again.");
        throw new Error("Your admin credentials are invalid or expired.");
    }

    if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}.`);
    }

    return response;
}


// ============================================================
// LOGIN AND LOGOUT EVENTS
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    setAdminView(false);

    const loginForm = document.getElementById("adminLoginForm");

    if (loginForm) {
        loginForm.addEventListener("submit", async event => {
            event.preventDefault();

            const username =
                document.getElementById("adminUsername").value.trim();

            const password =
                document.getElementById("adminPassword").value;

            const button =
                document.getElementById("adminLoginButton");

            const status =
                document.getElementById("adminAuthStatus");

            if (!username || !password) {
                alert("Enter your admin username and password.");
                return;
            }

            // HTTP Basic credentials are encoded, not encrypted.
            // HTTPS protects them while they travel to the backend.
            // They are held in memory and not saved in localStorage.
            adminAuthorization =
                "Basic " +
                btoa(unescape(encodeURIComponent(username + ":" + password)));

            if (button) button.disabled = true;
            if (status) status.textContent = "Checking credentials...";

            try {
                // Successful access to this protected endpoint verifies login.
                const response = await fetch(`${API_URL}/statistics`, {
                    headers: getAdminHeaders()
                });

                if (response.status === 401) {
                    throw new Error("Incorrect admin username or password.");
                }

                if (response.status === 503) {
                    throw new Error(
                        "Admin access is not configured in Render."
                    );
                }

                if (!response.ok) {
                    throw new Error(
                        `Login failed. Server returned HTTP ${response.status}.`
                    );
                }

                setAdminView(true);
                loginForm.reset();

                await refreshDashboard();

            } catch (error) {
                clearAdminLogin(error.message);
                alert(error.message);

            } finally {
                if (button) button.disabled = false;
            }
        });
    }

    const logoutButton =
        document.getElementById("adminLogoutButton");

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearAdminLogin("You have logged out.");
        });
    }
});


// ============================================================
// LOAD ADMIN STATISTICS
// ============================================================

async function loadStatistics() {
    if (!adminAuthorization) return;

    try {
        const response = await adminFetch("/statistics");
        const data = await response.json();

        setText("totalApplications", data.total_applications);
        setText("approvedLoans", data.approved);
        setText("rejectedLoans", data.rejected);
        setText("approvalRate", `${data.approval_rate}%`);

        setText("averageIncome", formatNumber(data.average_income));
        setText("averageCredit", formatNumber(data.average_credit_score));
        setText("averageLoan", formatNumber(data.average_loan_amount));

    } catch (error) {
        console.error("Statistics error:", error);
    }
}


// ============================================================
// LOAD ALL APPLICATIONS FOR ADMIN
// ============================================================

async function loadApplications() {
    if (!adminAuthorization) return;

    const table = document.getElementById("applicationsTable");

    if (!table) return;

    try {
        const response = await adminFetch("/applications");
        const applications = await response.json();

        if (!Array.isArray(applications)) {
            throw new Error("The server returned invalid application data.");
        }

        table.innerHTML = "";

        if (applications.length === 0) {
            table.innerHTML = `
                <tr>
                    <td colspan="10" class="loading">
                        No loan applications found.
                    </td>
                </tr>
            `;
            return;
        }

        applications.forEach(application => {
            const row = document.createElement("tr");

            const approvedProbability =
                Number(application.approved_probability) || 0;

            const prediction = Number(application.prediction);

            const badgeClass =
                prediction === 1 ? "approved-badge" : "rejected-badge";

            let riskLevel = "HIGH";
            let riskClass = "risk-high";

            if (approvedProbability >= 80) {
                riskLevel = "LOW";
                riskClass = "risk-low";
            } else if (approvedProbability >= 50) {
                riskLevel = "MEDIUM";
                riskClass = "risk-medium";
            }

            row.innerHTML = `
                <td>#${escapeHTML(application.id)}</td>

                <td>
                    <strong>
                        ${escapeHTML(application.applicant_name)}
                    </strong>
                </td>

                <td>
                    <div>${escapeHTML(application.email)}</div>
                    <small>${escapeHTML(application.phone)}</small>
                </td>

                <td>${formatNumber(application.income)}</td>

                <td>${formatNumber(application.loan_amount)}</td>

                <td>${escapeHTML(application.credit_score)}</td>

                <td>
                    <span class="${badgeClass}">
                        ${escapeHTML(application.result)}
                    </span>
                </td>

                <td>
                    <span class="${riskClass}">
                        ${riskLevel}
                    </span>
                </td>

                <td>${formatNumber(approvedProbability)}%</td>

                <td>${formatDate(application.created_at)}</td>
            `;

            table.appendChild(row);
        });

    } catch (error) {
        console.error("Application history error:", error);

        if (adminAuthorization && table) {
            table.innerHTML = `
                <tr>
                    <td colspan="10" class="loading">
                        Could not load applications. Please refresh.
                    </td>
                </tr>
            `;
        }
    }
}


// ============================================================
// LOAD ADMIN ANALYTICS
// ============================================================

async function loadAnalytics() {
    if (!adminAuthorization) return;

    try {
        const response = await adminFetch("/analytics");
        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("The server returned invalid analytics data.");
        }

        const labels = data.map(item => item.result);
        const totals = data.map(item => Number(item.total));

        // Recreate charts to prevent duplicates after refreshing.
        if (approvalChart) {
            approvalChart.destroy();
            approvalChart = null;
        }

        if (predictionChart) {
            predictionChart.destroy();
            predictionChart = null;
        }

        const approvalCanvas =
            document.getElementById("approvalChart");

        if (approvalCanvas && typeof Chart !== "undefined") {
            approvalChart = new Chart(approvalCanvas, {
                type: "doughnut",

                data: {
                    labels,
                    datasets: [{
                        label: "Applications",
                        data: totals
                    }]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            position: "bottom"
                        }
                    }
                }
            });
        }

        const predictionCanvas =
            document.getElementById("predictionChart");

        if (predictionCanvas && typeof Chart !== "undefined") {
            predictionChart = new Chart(predictionCanvas, {
                type: "bar",

                data: {
                    labels,
                    datasets: [{
                        label: "Applications",
                        data: totals
                    }]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }

    } catch (error) {
        console.error("Analytics error:", error);
    }
}


// ============================================================
// REFRESH ADMIN DASHBOARD
// ============================================================

async function refreshDashboard() {
    if (!adminAuthorization) {
        return;
    }

    await Promise.all([
        loadStatistics(),
        loadApplications(),
        loadAnalytics()
    ]);
}


// ============================================================
// PUBLIC LOAN APPLICATION AND AI PREDICTION
// ============================================================

const loanForm = document.getElementById("loanForm");

if (loanForm) {
    loanForm.addEventListener("submit", async event => {
        event.preventDefault();

        const button = document.getElementById("predictButton");
        const resultCard = document.getElementById("resultCard");

        const applicantName =
            document.getElementById("applicant_name").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const phone =
            document.getElementById("phone").value.trim();

        const income =
            Number(document.getElementById("income").value);

        const age =
            Number(document.getElementById("age").value);

        const loanAmount =
            Number(document.getElementById("loan_amount").value);

        const creditScore =
            Number(document.getElementById("credit_score").value);


        // ----------------------------------------------------
        // VALIDATE INPUTS
        // ----------------------------------------------------

        if (!applicantName || !email || !phone) {
            alert("Please complete the applicant information.");
            return;
        }

        if (!Number.isFinite(income) || income < 0) {
            alert("Enter a valid income.");
            return;
        }

        if (
            !Number.isInteger(age) ||
            age < 18 ||
            age > 120
        ) {
            alert("Age must be between 18 and 120.");
            return;
        }

        if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
            alert("Loan amount must be greater than zero.");
            return;
        }

        if (
            !Number.isInteger(creditScore) ||
            creditScore < 0 ||
            creditScore > 1000
        ) {
            alert("Enter a valid credit score.");
            return;
        }


        // ----------------------------------------------------
        // SHOW LOADING STATE
        // ----------------------------------------------------

        button.disabled = true;
        button.textContent = "AI Assessing...";

        resultCard.innerHTML = `
            <div class="result-placeholder">
                <div class="result-icon">AI</div>

                <h3>Assessing Application</h3>

                <p>
                    The AI model is analyzing the applicant's
                    financial information.
                </p>
            </div>
        `;


        // ----------------------------------------------------
        // SEND PREDICTION REQUEST
        // ----------------------------------------------------

        try {
            const response = await fetch(`${API_URL}/predict`, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    applicant_name: applicantName,
                    email: email,
                    phone: phone,
                    income: income,
                    age: age,
                    loan_amount: loanAmount,
                    credit_score: creditScore
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message =
                    data.detail ||
                    data.error ||
                    `Server returned HTTP ${response.status}.`;

                throw new Error(message);
            }

            const prediction = Number(data.prediction);

            const approvedProbability =
                Number(data.approved_probability) || 0;

            const rejectedProbability =
                Number(data.rejected_probability) || 0;

            const resultClass =
                prediction === 1
                    ? "success-message"
                    : "failure-message";

            let riskClass = "risk-high";

            if (data.risk_level === "LOW") {
                riskClass = "risk-low";
            } else if (data.risk_level === "MEDIUM") {
                riskClass = "risk-medium";
            }


            // ------------------------------------------------
            // DISPLAY PREDICTION
            // ------------------------------------------------

            resultCard.innerHTML = `
                <div class="prediction-result">

                    <div class="result-icon">AI</div>

                    <p class="section-label">
                        AI ASSESSMENT
                    </p>

                    <h2 class="${resultClass}">
                        ${escapeHTML(data.result)}
                    </h2>

                    <div class="applicant-summary">
                        <h3>
                            ${escapeHTML(data.applicant_name || applicantName)}
                        </h3>

                        <p>
                            Your application has been assessed and saved.
                        </p>
                    </div>

                    <div class="risk-display">
                        <span>Risk Level</span>

                        <strong class="${riskClass}">
                            ${escapeHTML(data.risk_level || "N/A")}
                        </strong>
                    </div>

                    <div class="probability">

                        <div class="probability-label">
                            <span>Approval Probability</span>

                            <strong>${approvedProbability}%</strong>
                        </div>

                        <div class="progress">
                            <div
                                class="progress-bar"
                                style="width:${clampPercentage(approvedProbability)}%">
                            </div>
                        </div>

                    </div>

                    <div class="probability">

                        <div class="probability-label">
                            <span>Rejection Probability</span>

                            <strong>${rejectedProbability}%</strong>
                        </div>

                        <div class="progress">
                            <div
                                class="progress-bar"
                                style="width:${clampPercentage(rejectedProbability)}%">
                            </div>
                        </div>

                    </div>

                    <div class="assessment-details">

                        <div>
                            <span>Income</span>
                            <strong>${formatNumber(income)}</strong>
                        </div>

                        <div>
                            <span>Loan Amount</span>
                            <strong>${formatNumber(loanAmount)}</strong>
                        </div>

                        <div>
                            <span>Credit Score</span>
                            <strong>${creditScore}</strong>
                        </div>

                        <div>
                            <span>Age</span>
                            <strong>${age}</strong>
                        </div>

                    </div>

                    <p class="storage-message">
                        ✓ Application saved in PostgreSQL
                    </p>

                    <p>
                        This is an AI model prediction, not a guarantee
                        of a lender's final decision.
                    </p>

                </div>
            `;


            // Refresh the private dashboard only for an authenticated admin.
            if (adminAuthorization) {
                await refreshDashboard();
            }

            // Clear the form after a successful submission.
            loanForm.reset();

        } catch (error) {
            console.error("Prediction error:", error);

            resultCard.innerHTML = `
                <div class="result-placeholder">

                    <div class="result-icon">!</div>

                    <h3 class="failure-message">
                        Prediction Failed
                    </h3>

                    <p>${escapeHTML(error.message)}</p>

                    <p>
                        Please try again. If the issue continues,
                        check the Render service logs.
                    </p>

                </div>
            `;

        } finally {
            button.disabled = false;
            button.textContent = "Assess Loan Application";
        }
    });
}


// ============================================================
// HELPER: UPDATE TEXT SAFELY
// ============================================================

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent =
            value === null || value === undefined
                ? "—"
                : value;
    }
}


// ============================================================
// HELPER: FORMAT NUMBERS
// ============================================================

function formatNumber(number) {
    const value = Number(number);

    if (!Number.isFinite(value)) {
        return "0";
    }

    return value.toLocaleString("en-KE", {
        maximumFractionDigits: 2
    });
}


// ============================================================
// HELPER: FORMAT DATES
// ============================================================

function formatDate(dateString) {
    if (!dateString) {
        return "-";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("en-KE", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


// ============================================================
// HELPER: ESCAPE HTML
// ============================================================

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// HELPER: KEEP PROGRESS BAR BETWEEN 0 AND 100
// ============================================================

function clampPercentage(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return 0;
    }

    return Math.max(0, Math.min(100, number));
}


// ============================================================
// END OF SCRIPT
// Private dashboard data is not loaded automatically.
// ============================================================