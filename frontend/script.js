// ============================================================
// LOAN AI MANAGEMENT SYSTEM
// Secure Frontend JavaScript
// ============================================================

// API CONFIGURATION
const API_URL = "https://loan-ai-management-system.onrender.com";

// Admin credentials stay in memory only.
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

    const loginForm = document.getElementById("adminLoginForm");
    const logoutButton = document.getElementById("adminLogoutButton");
    const status = document.getElementById("adminAuthStatus");

    if (loginForm) loginForm.hidden = isAdmin;
    if (logoutButton) logoutButton.hidden = !isAdmin;

    if (status) {
        status.textContent = isAdmin
            ? "Admin authenticated"
            : "Admin dashboard locked";
    }
}

function clearAdminLogin(message = "Admin dashboard locked") {
    adminAuthorization = null;
    setAdminView(false);

    const status = document.getElementById("adminAuthStatus");
    if (status) status.textContent = message;
}

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

            const loginButton =
                document.getElementById("adminLoginButton");

            const status =
                document.getElementById("adminAuthStatus");

            adminAuthorization =
                "Basic " +
                btoa(unescape(encodeURIComponent(username + ":" + password)));

            if (loginButton) loginButton.disabled = true;

            if (status) {
                status.textContent = "Checking admin credentials...";
            }

            try {
                const response = await fetch(`${API_URL}/statistics`, {
                    headers: getAdminHeaders()
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error("Invalid admin username or password.");
                    }

                    if (response.status === 503) {
                        throw new Error(
                            "Admin access is not configured in Render."
                        );
                    }

                    throw new Error(
                        `Login failed. Server returned ${response.status}.`
                    );
                }

                setAdminView(true);
                loginForm.reset();

                await refreshDashboard();

            } catch (error) {
                clearAdminLogin(error.message);
                alert(error.message);

            } finally {
                if (loginButton) loginButton.disabled = false;
            }
        });
    }

    const logoutButton =
        document.getElementById("adminLogoutButton");

    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            clearAdminLogin("You have logged out.");

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

            const table =
                document.getElementById("applicationsTable");

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
        });
    }
});


// ============================================================
// LOAD DASHBOARD STATISTICS
// ============================================================

async function loadStatistics() {
    if (!adminAuthorization) return;

    try {
        const response = await fetch(`${API_URL}/statistics`, {
            headers: getAdminHeaders()
        });

        if (response.status === 401) {
            clearAdminLogin("Your admin session is no longer valid.");
            throw new Error("Admin authentication failed.");
        }

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        setText("totalApplications", data.total_applications);
        setText("approvedLoans", data.approved);
        setText("rejectedLoans", data.rejected);
        setText("approvalRate", `${data.approval_rate}%`);

        setText("averageIncome", formatNumber(data.average_income));
        setText("averageCredit", data.average_credit_score);
        setText("averageLoan", formatNumber(data.average_loan_amount));

    } catch (error) {
        console.error("Statistics error:", error);
    }
}


// ============================================================
// LOAD APPLICATION HISTORY
// ============================================================

async function loadApplications() {
    if (!adminAuthorization) return;

    const table = document.getElementById("applicationsTable");
    if (!table) return;

    try {
        const response = await fetch(`${API_URL}/applications`, {
            headers: getAdminHeaders()
        });

        if (response.status === 401) {
            clearAdminLogin("Your admin session is no longer valid.");
            throw new Error("Admin authentication failed.");
        }

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const applications = await response.json();

        if (!Array.isArray(applications)) {
            throw new Error("Invalid application data received.");
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

            const prediction = Number(application.prediction);
            const probability = Number(application.approved_probability);

            const badgeClass =
                prediction === 1 ? "approved-badge" : "rejected-badge";

            let riskLevel = "HIGH";
            let riskClass = "risk-high";

            if (probability >= 80) {
                riskLevel = "LOW";
                riskClass = "risk-low";
            } else if (probability >= 50) {
                riskLevel = "MEDIUM";
                riskClass = "risk-medium";
            }

            row.innerHTML = `
                <td>#${escapeHTML(application.id)}</td>

                <td>
                    <strong>${escapeHTML(application.applicant_name)}</strong>
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

                <td>${formatNumber(application.approved_probability)}%</td>

                <td>${formatDate(application.created_at)}</td>
            `;

            table.appendChild(row);
        });

    } catch (error) {
        console.error("Applications error:", error);

        if (table && adminAuthorization) {
            table.innerHTML = `
                <tr>
                    <td colspan="10" class="loading">
                        Unable to load applications. Check the backend logs.
                    </td>
                </tr>
            `;
        }
    }
}


// ============================================================
// LOAD ANALYTICS CHARTS
// ============================================================

async function loadAnalytics() {
    if (!adminAuthorization) return;

    try {
        const response = await fetch(`${API_URL}/analytics`, {
            headers: getAdminHeaders()
        });

        if (response.status === 401) {
            clearAdminLogin("Your admin session is no longer valid.");
            throw new Error("Admin authentication failed.");
        }

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid analytics data received.");
        }

        const labels = data.map(item => item.result);
        const totals = data.map(item => Number(item.total));

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
// LOAN APPLICATION AND AI PREDICTION
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

        // Validate the form.
        if (!applicantName || !email || !phone) {
            alert("Please enter the applicant's name, email, and phone.");
            return;
        }

        if (!Number.isFinite(income) || income <= 0) {
            alert("Income must be greater than zero.");
            return;
        }

        if (!Number.isFinite(age) || age < 18) {
            alert("Applicant must be at least 18 years old.");
            return;
        }

        if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
            alert("Loan amount must be greater than zero.");
            return;
        }

        if (
            !Number.isFinite(creditScore) ||
            creditScore < 300 ||
            creditScore > 850
        ) {
            alert("Credit score must be between 300 and 850.");
            return;
        }

        button.disabled = true;
        button.textContent = "AI Assessing...";

        resultCard.innerHTML = `
            <div class="result-placeholder">
                <div class="result-icon">AI</div>
                <h3>Assessing Application</h3>
                <p>
                    The AI model is analyzing the applicant's financial profile.
                </p>
            </div>
        `;

        try {
            const response = await fetch(`${API_URL}/predict`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    applicant_name: applicantName,
                    email,
                    phone,
                    income,
                    age,
                    loan_amount: loanAmount,
                    credit_score: creditScore
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                    data.error ||
                    `Server returned ${response.status}`
                );
            }

            if (data.error) {
                throw new Error(data.error);
            }

            const prediction = Number(data.prediction);

            const resultClass =
                prediction === 1 ? "success-message" : "failure-message";

            let riskClass = "risk-high";

            if (data.risk_level === "LOW") {
                riskClass = "risk-low";
            } else if (data.risk_level === "MEDIUM") {
                riskClass = "risk-medium";
            }

            const approvedProbability =
                Number(data.approved_probability) || 0;

            const rejectedProbability =
                Number(data.rejected_probability) || 0;

            resultCard.innerHTML = `
                <div class="prediction-result">

                    <div class="result-icon">AI</div>

                    <p class="section-label">AI ASSESSMENT</p>

                    <h2 class="${resultClass}">
                        ${escapeHTML(data.result)}
                    </h2>

                    <div class="applicant-summary">
                        <h3>${escapeHTML(data.applicant_name || applicantName)}</h3>
                        <p>Application successfully assessed and stored.</p>
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
                                style="width:${Math.max(0, Math.min(100, approvedProbability))}%">
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
                                style="width:${Math.max(0, Math.min(100, rejectedProbability))}%">
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
                        ✓ Application stored in PostgreSQL
                    </p>

                </div>
            `;

            // Refresh private dashboard only if an admin is logged in.
            if (adminAuthorization) {
                await refreshDashboard();
            }

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
                        check the backend service.
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
// REFRESH ADMIN DASHBOARD
// ============================================================

async function refreshDashboard() {
    if (!adminAuthorization) return;

    await Promise.all([
        load