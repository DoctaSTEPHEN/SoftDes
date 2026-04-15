// =============================
// BASE URL (AUTO)
// =============================
const BASE_URL = window.location.origin;

// =============================
// NOTIFICATION SYSTEM
// =============================
function notify(msg, type = "success") {
    const div = document.createElement("div");
    div.innerText = msg;

    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 18px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 999;
        background: ${type === "error" ? "#e74c3c" : "#2ecc71"};
    `;

    document.body.appendChild(div);

    setTimeout(() => div.remove(), 2500);
}

// =============================
// ADD RECORD
// =============================
async function addRecord() {
    const data = {
        Year: parseInt(document.getElementById("year").value),
        Month: parseInt(document.getElementById("month").value),
        Consumption: parseFloat(document.getElementById("consumption").value),
        Bill: parseFloat(document.getElementById("bill").value)
    };

    if (!data.Year || !data.Month || !data.Consumption || !data.Bill) {
        notify("Fill all fields", "error");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/add`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.error) {
            notify(result.error, "error");
            return;
        }

        notify("Record added");
        clearInputs();
        refreshAll();

    } catch (err) {
        notify("Network error", "error");
    }
}

// =============================
// CLEAR INPUTS
// =============================
function clearInputs() {
    ["year","month","consumption","bill"].forEach(id => {
        document.getElementById(id).value = "";
    });
}

// =============================
// FILE UPLOAD
// =============================
async function uploadFile() {
    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];

    if (!file) {
        notify("Select a file", "error");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    notify("Uploading...");

    try {
        const res = await fetch(`${BASE_URL}/api/upload`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (data.error) {
            notify(data.error, "error");
        } else {
            notify(`Uploaded ${data.rows_added || data.rows}`);
            fileInput.value = "";
            refreshAll();
        }

    } catch (err) {
        notify("Upload failed", "error");
    }
}

// =============================
// DASHBOARD
// =============================
async function loadDashboard() {
    try {
        const res = await fetch(`${BASE_URL}/api/dashboard`);
        const data = await res.json();

        document.getElementById("total").innerText = data.total?.toFixed(1) || 0;
        document.getElementById("avg").innerText = data.avg?.toFixed(1) || 0;
        document.getElementById("bill_total").innerText = data.bill?.toFixed(1) || 0;

    } catch {
        console.log("Dashboard error");
    }
}

// =============================
// FORECAST
// =============================
async function loadForecast() {
    try {
        const res = await fetch(`${BASE_URL}/api/forecast`);
        const data = await res.json();

        if (data.error) {
            document.getElementById("forecast").innerHTML = data.error;
            return;
        }

        document.getElementById("forecast").innerHTML =
            `<b>${data.future_3_months.map(v => v.toFixed(1)).join(" → ")} m³</b>`;

    } catch {
        document.getElementById("forecast").innerText = "Error loading";
    }
}

// =============================
// CHART
// =============================
let chart;
let chartInstance;

async function loadChart() {
    try {
        const res = await fetch("/api/forecast");
        const data = await res.json();

        if (data.error || !data.history_actual.length) return;

        const ctx = document.getElementById("chart").getContext("2d");

        if (chartInstance) chartInstance.destroy();

        const history = data.history_actual;
        const forecast = data.future_3_months;
        const labels = data.labels;

        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Actual",
                        data: history.concat(Array(forecast.length).fill(null)),
                        borderColor: "#2196F3",
                        tension: 0.4
                    },
                    {
                        label: "Predicted",
                        data: data.history_predicted.concat(Array(forecast.length).fill(null)),
                        borderColor: "#4CAF50",
                        tension: 0.4
                    },
                    {
                        label: "Forecast",
                        data: Array(history.length).fill(null).concat(forecast),
                        borderColor: "#FF5722",
                        borderDash: [5, 5],
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });

    } catch (e) {
        console.error("Chart error:", e);
    }
}
// =============================
// ANOMALY
// =============================
async function checkAnomaly() {
    try {
        const res = await fetch(`${BASE_URL}/api/anomaly`);
        const data = await res.json();

        const anomalies = data.filter(d => d.status === "ANOMALY");

        const el = document.getElementById("anomaly");

        if (!anomalies.length) {
            el.innerHTML = "No anomalies";
            return;
        }

        el.innerHTML = anomalies.map(a =>
            `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
        ).join("<br>");

    } catch {
        document.getElementById("anomaly").innerText = "Error";
    }
}

// =============================
// REPORTS TABLE
// =============================
async function loadReports() {
    try {
        const res = await fetch(`${BASE_URL}/api/data`);
        const data = await res.json();

        const table = document.getElementById("reportTable");
        table.innerHTML = "";

        data.forEach(d => {
            table.innerHTML += `
                <tr>
                    <td>${d.Month}</td>
                    <td>${d.Consumption}</td>
                    <td>${d.Bill}</td>
                </tr>
            `;
        });

    } catch {
        console.log("Report error");
    }
}

// =============================
// GLOBAL REFRESH
// =============================
async function refreshAll() {
    await loadDashboard();
    await loadForecast();
    await loadChart();
    await checkAnomaly();
    await loadReports();
}

// =============================
// AUTO LOAD
// =============================
window.onload = () => {
    refreshAll();
    setInterval(refreshAll, 30000);
};
