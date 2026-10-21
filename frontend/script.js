
// ============================================================
// LOAN AI MANAGEMENT SYSTEM
// ADVANCED FRONTEND JAVASCRIPT
// ============================================================


// ============================================================
// API CONFIGURATION
// ============================================================

const API_URL = "https://loan-ai-management-system.onrender.com";


// ============================================================
// CHART VARIABLES
// ============================================================

let approvalChart = null;
let predictionChart = null;


// ============================================================
// LOAD STATISTICS
// ============================================================

async function loadStatistics() {

    try {

        const response = await fetch(
            `${API_URL}/statistics`
        );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        const data = await response.json();


        if (data.error) {

            throw new Error(data.error);

        }


        // ----------------------------------------------------
        // MAIN STATISTICS
        // ----------------------------------------------------

        document.getElementById(
            "totalApplications"
        ).textContent =
            data.total_applications;


        document.getElementById(
            "approvedLoans"
        ).textContent =
            data.approved;


        document.getElementById(
            "rejectedLoans"
        ).textContent =
            data.rejected;


        document.getElementById(
            "approvalRate"
        ).textContent =
            `${data.approval_rate}%`;


        // ----------------------------------------------------
        // ADDITIONAL STATISTICS
        // ----------------------------------------------------

        document.getElementById(
            "averageIncome"
        ).textContent =
            formatNumber(data.average_income);


        document.getElementById(
            "averageCredit"
        ).textContent =
            data.average_credit_score;


        document.getElementById(
            "averageLoan"
        ).textContent =
            formatNumber(data.average_loan_amount);


    }

    catch (error) {

        console.error(
            "Statistics error:",
            error
        );

    }

}


// ============================================================
// LOAD APPLICATION HISTORY
// ============================================================

async function loadApplications() {

    const table =
        document.getElementById(
            "applicationsTable"
        );


    try {

        const response = await fetch(
            `${API_URL}/applications`
        );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        const applications =
            await response.json();


        if (!Array.isArray(applications)) {

            throw new Error(
                applications.error ||
                "Invalid application data"
            );

        }


        table.innerHTML = "";


        // ----------------------------------------------------
        // NO APPLICATIONS
        // ----------------------------------------------------

        if (applications.length === 0) {

            table.innerHTML = `

                <tr>

                    <td colspan="10"
                        class="loading">

                        No loan applications found.

                    </td>

                </tr>

            `;

            return;

        }


        // ----------------------------------------------------
        // CREATE TABLE ROWS
        // ----------------------------------------------------

        applications.forEach(
            application => {


                const row =
                    document.createElement("tr");


                // ------------------------------------------------
                // RESULT BADGE
                // ------------------------------------------------

                const badgeClass =
                    application.prediction === 1
                        ? "approved-badge"
                        : "rejected-badge";


                // ------------------------------------------------
                // RISK LEVEL
                // ------------------------------------------------

                let riskLevel = "HIGH";

                let riskClass = "risk-high";


                const probability =
                    Number(
                        application.approved_probability
                    );


                if (probability >= 80) {

                    riskLevel = "LOW";

                    riskClass = "risk-low";

                }

                else if (probability >= 50) {

                    riskLevel = "MEDIUM";

                    riskClass = "risk-medium";

                }


                // ------------------------------------------------
                // TABLE ROW
                // ------------------------------------------------

                row.innerHTML = `

                    <td>
                        #${application.id}
                    </td>


                    <td>

                        <strong>
                            ${escapeHTML(
                                application.applicant_name
                            )}
                        </strong>

                    </td>


                    <td>

                        <div>
                            ${escapeHTML(
                                application.email
                            )}
                        </div>

                        <small>
                            ${escapeHTML(
                                application.phone
                            )}
                        </small>

                    </td>


                    <td>
                        ${formatNumber(
                            application.income
                        )}
                    </td>


                    <td>
                        ${formatNumber(
                            application.loan_amount
                        )}
                    </td>


                    <td>
                        ${application.credit_score}
                    </td>


                    <td>

                        <span class="${badgeClass}">

                            ${escapeHTML(
                                application.result
                            )}

                        </span>

                    </td>


                    <td>

                        <span class="${riskClass}">

                            ${riskLevel}

                        </span>

                    </td>


                    <td>

                        ${application.approved_probability}%

                    </td>


                    <td>

                        ${formatDate(
                            application.created_at
                        )}

                    </td>

                `;


                table.appendChild(row);

            }
        );


    }

    catch (error) {

        console.error(
            "Applications error:",
            error
        );


        table.innerHTML = `

            <tr>

                <td colspan="10"
                    class="loading">

                    Unable to load applications.

                    <br><br>

                    Make sure FastAPI is running.

                </td>

            </tr>

        `;

    }

}


// ============================================================
// LOAD ANALYTICS
// ============================================================

async function loadAnalytics() {

    try {

        const response = await fetch(
            `${API_URL}/analytics`
        );


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );

        }


        const data =
            await response.json();


        if (!Array.isArray(data)) {

            throw new Error(
                data.error ||
                "Invalid analytics data"
            );

        }


        // ----------------------------------------------------
        // LABELS
        // ----------------------------------------------------

        const labels =
            data.map(
                item => item.result
            );


        // ----------------------------------------------------
        // TOTALS
        // ----------------------------------------------------

        const totals =
            data.map(
                item => item.total
            );


        // ----------------------------------------------------
        // DESTROY OLD CHARTS
        // ----------------------------------------------------

        if (approvalChart) {

            approvalChart.destroy();

        }


        if (predictionChart) {

            predictionChart.destroy();

        }


        // ----------------------------------------------------
        // DOUGHNUT CHART
        // ----------------------------------------------------

        const approvalCanvas =
            document.getElementById(
                "approvalChart"
            );


        if (approvalCanvas) {

            approvalChart =
                new Chart(
                    approvalCanvas,
                    {

                        type: "doughnut",

                        data: {

                            labels: labels,

                            datasets: [{

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

                    }
                );

        }


        // ----------------------------------------------------
        // BAR CHART
        // ----------------------------------------------------

        const predictionCanvas =
            document.getElementById(
                "predictionChart"
            );


        if (predictionCanvas) {

            predictionChart =
                new Chart(
                    predictionCanvas,
                    {

                        type: "bar",

                        data: {

                            labels: labels,

                            datasets: [{

                                label:
                                    "Applications",

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

                    }
                );

        }

    }

    catch (error) {

        console.error(
            "Analytics error:",
            error
        );

    }

}


// ============================================================
// LOAN PREDICTION
// ============================================================

document
    .getElementById("loanForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            // ------------------------------------------------
            // ELEMENTS
            // ------------------------------------------------

            const button =
                document.getElementById(
                    "predictButton"
                );


            const resultCard =
                document.getElementById(
                    "resultCard"
                );


            // ------------------------------------------------
            // GET APPLICANT DATA
            // ------------------------------------------------

            const applicantName =
                document.getElementById(
                    "applicant_name"
                ).value.trim();


            const email =
                document.getElementById(
                    "email"
                ).value.trim();


            const phone =
                document.getElementById(
                    "phone"
                ).value.trim();


            // ------------------------------------------------
            // GET FINANCIAL DATA
            // ------------------------------------------------

            const income =
                Number(
                    document.getElementById(
                        "income"
                    ).value
                );


            const age =
                Number(
                    document.getElementById(
                        "age"
                    ).value
                );


            const loanAmount =
                Number(
                    document.getElementById(
                        "loan_amount"
                    ).value
                );


            const creditScore =
                Number(
                    document.getElementById(
                        "credit_score"
                    ).value
                );


            // ------------------------------------------------
            // VALIDATION
            // ------------------------------------------------

            if (!applicantName) {

                alert(
                    "Please enter the applicant's name."
                );

                return;

            }


            if (!email) {

                alert(
                    "Please enter an email address."
                );

                return;

            }


            if (!phone) {

                alert(
                    "Please enter a phone number."
                );

                return;

            }


            if (income <= 0) {

                alert(
                    "Income must be greater than zero."
                );

                return;

            }


            if (age < 18) {

                alert(
                    "Applicant must be at least 18 years old."
                );

                return;

            }


            if (loanAmount <= 0) {

                alert(
                    "Loan amount must be greater than zero."
                );

                return;

            }


            if (
                creditScore < 300 ||
                creditScore > 850
            ) {

                alert(
                    "Credit score must be between 300 and 850."
                );

                return;

            }


            // ------------------------------------------------
            // DISABLE BUTTON
            // ------------------------------------------------

            button.disabled = true;

            button.textContent =
                "AI Assessing...";


            // ------------------------------------------------
            // LOADING CARD
            // ------------------------------------------------

            resultCard.innerHTML = `

                <div class="result-placeholder">

                    <div class="result-icon">
                        AI
                    </div>

                    <h3>
                        Assessing Application
                    </h3>

                    <p>
                        The AI model is analyzing
                        the applicant's financial profile.
                    </p>

                </div>

            `;


            try {

                // ------------------------------------------------
                // SEND REQUEST
                // ------------------------------------------------

                const response =
                    await fetch(
                        `${API_URL}/predict`,
                        {

                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body: JSON.stringify({

                                applicant_name:
                                    applicantName,

                                email:
                                    email,

                                phone:
                                    phone,

                                income:
                                    income,

                                age:
                                    age,

                                loan_amount:
                                    loanAmount,

                                credit_score:
                                    creditScore

                            })

                        }
                    );


                // ------------------------------------------------
                // CHECK SERVER RESPONSE
                // ------------------------------------------------

                if (!response.ok) {

                    throw new Error(
                        `Server returned ${response.status}`
                    );

                }


                const data =
                    await response.json();


                // ------------------------------------------------
                // API ERROR
                // ------------------------------------------------

                if (data.error) {

                    throw new Error(
                        data.error
                    );

                }


                // ------------------------------------------------
                // RESULT CLASS
                // ------------------------------------------------

                const resultClass =
                    data.prediction === 1
                        ? "success-message"
                        : "failure-message";


                // ------------------------------------------------
                // RISK CLASS
                // ------------------------------------------------

                let riskClass =
                    "risk-high";


                if (
                    data.risk_level === "LOW"
                ) {

                    riskClass =
                        "risk-low";

                }

                else if (
                    data.risk_level === "MEDIUM"
                ) {

                    riskClass =
                        "risk-medium";

                }


                // ------------------------------------------------
                // DISPLAY RESULT
                // ------------------------------------------------

                resultCard.innerHTML = `

                    <div class="prediction-result">


                        <div class="result-icon">
                            AI
                        </div>


                        <p class="section-label">
                            AI ASSESSMENT
                        </p>


                        <h2 class="${resultClass}">

                            ${escapeHTML(
                                data.result
                            )}

                        </h2>


                        <div class="applicant-summary">

                            <h3>
                                ${escapeHTML(
                                    data.applicant_name
                                )}
                            </h3>

                            <p>
                                Application successfully
                                assessed and stored.
                            </p>

                        </div>


                        <div class="risk-display">

                            <span>
                                Risk Level
                            </span>

                            <strong
                                class="${riskClass}">

                                ${escapeHTML(
                                    data.risk_level
                                )}

                            </strong>

                        </div>


                        <div class="probability">


                            <div class="probability-label">

                                <span>
                                    Approval Probability
                                </span>

                                <strong>
                                    ${data.approved_probability}%
                                </strong>

                            </div>


                            <div class="progress">

                                <div
                                    class="progress-bar"
                                    style="
                                    width:
                                    ${data.approved_probability}%;
                                    ">
                                </div>

                            </div>


                        </div>



                        <div class="probability">


                            <div class="probability-label">

                                <span>
                                    Rejection Probability
                                </span>

                                <strong>
                                    ${data.rejected_probability}%
                                </strong>

                            </div>


                            <div class="progress">

                                <div
                                    class="progress-bar"
                                    style="
                                    width:
                                    ${data.rejected_probability}%;
                                    ">
                                </div>

                            </div>


                        </div>


                        <div class="assessment-details">


                            <div>

                                <span>
                                    Income
                                </span>

                                <strong>
                                    ${formatNumber(
                                        income
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Loan Amount
                                </span>

                                <strong>
                                    ${formatNumber(
                                        loanAmount
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Credit Score
                                </span>

                                <strong>
                                    ${creditScore}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Age
                                </span>

                                <strong>
                                    ${age}
                                </strong>

                            </div>


                        </div>


                        <p class="storage-message">

                            ✓ Application stored in PostgreSQL

                        </p>


                    </div>

                `;


                // ------------------------------------------------
                // REFRESH DASHBOARD
                // ------------------------------------------------

                await refreshDashboard();


                // ------------------------------------------------
                // RESET FORM
                // ------------------------------------------------

                document
                    .getElementById("loanForm")
                    .reset();

            }


            catch (error) {

                console.error(
                    "Prediction error:",
                    error
                );


                resultCard.innerHTML = `

                    <div class="result-placeholder">

                        <div class="result-icon">
                            !
                        </div>

                        <h3 class="failure-message">
                            Prediction Failed
                        </h3>

                        <p>
                            ${escapeHTML(
                                error.message
                            )}
                        </p>

                        <p>
                            Make sure FastAPI and
                            PostgreSQL are running.
                        </p>

                    </div>

                `;

            }


            finally {

                button.disabled = false;

                button.textContent =
                    "Assess Loan Application";

            }

        }
    );


// ============================================================
// REFRESH DASHBOARD
// ============================================================

async function refreshDashboard() {

    await Promise.all([

        loadStatistics(),

        loadApplications(),

        loadAnalytics()

    ]);

}


// ============================================================
// FORMAT NUMBER
// ============================================================

function formatNumber(number) {

    const value =
        Number(number);


    if (isNaN(value)) {

        return "0";

    }


    return value.toLocaleString(
        "en-KE",
        {
            maximumFractionDigits: 2
        }
    );

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(dateString) {

    if (!dateString) {

        return "-";

    }


    const date =
        new Date(dateString);


    if (isNaN(date.getTime())) {

        return "-";

    }


    return date.toLocaleString(
        "en-KE",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    if (value === null ||
        value === undefined) {

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
// INITIAL LOAD
// ============================================================

refreshDashboard();
