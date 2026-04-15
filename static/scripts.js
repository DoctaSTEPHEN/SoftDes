const BASE_URL = window.location.origin;

// =============================
// NOTIFICATION
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
        z-index: 9999;
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

    if (Object.values(data).some(v => isNaN(v))) {
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

    } catch {
        notify("Network error", "error");
    }
}

// =============================
// CLEAR
// =============================
function clearInputs() {
    ["year","consumption","bill"].forEach(id => {
        document.getElementById(id).value = "";
    });
}

// =============================
// DASHBOARD
// =============================
async function loadDashboard() {
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    const data = await res.json();

    document.getElementById("total").innerText = (data.total || 0).toFixed(1);
    document.getElementById("avg").innerText = (data.avg || 0).toFixed(1);
    document.getElementById("bill_total").innerText = (data.bill || 0).toFixed(1);
}

// =============================
// FORECAST (UPDATED: BILL + CONSUMPTION)
// =============================
async function loadForecast() {
    const res = await fetch(`${BASE_URL}/api/forecast`);
    const data = await res.json();

    if (data.error) {
        document.getElementById("forecast").innerText = data.error;
        return;
    }

    document.getElementById("forecast").innerHTML =
        `<b>Bill Forecast:</b> ₱${data.future_bill.map(v => v.toFixed(2)).join(" → ₱")}`;
}

// =============================
// CHART (FIXED: NO PREDICTED)
// =============================
let chartInstance = null;

async function loadChart() {
    const res = await fetch(`${BASE_URL}/api/forecast`);
    const data = await res.json();

    if (!data.history_actual?.length) return;

    const ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) chartInstance.destroy();

    const history = data.history_actual;
    const forecast = data.future_consumption;
    const labels = data.labels;

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Actual",
                    data: history.concat(Array(forecast.length).fill(null)),
                    borderColor: "#2196F3",
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
}

// =============================
// ANOMALY
// =============================
async function checkAnomaly() {
    const res = await fetch(`${BASE_URL}/api/anomaly`);
    const data = await res.json();

    const anomalies = data.filter(d => d.status === "ANOMALY");

    const el = document.getElementById("anomaly");

    if (!anomalies.length) {
        el.innerHTML = "No anomalies";
        return;
    }

    el.innerHTML = anomalies
        .map(a => `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`)
        .join("<br>");
}

// =============================
// REPORTS (FIXED YEAR)
// =============================
async function loadReports() {
    const res = await fetch(`${BASE_URL}/api/data`);
    const data = await res.json();

    const table = document.getElementById("reportTable");

    table.innerHTML = data.map(d => `
        <tr>
            <td>${d.Year}</td>
            <td>${d.Month}</td>
            <td>${d.Consumption}</td>
            <td>${d.Bill}</td>
        </tr>
    `).join("");
}

// =============================
// REFRESH
// =============================
async function refreshAll() {
    await Promise.all([
        loadDashboard(),
        loadForecast(),
        loadChart(),
        checkAnomaly(),
        loadReports()
    ]);
}

// =============================
// INIT
// =============================
window.onload = () => {
    refreshAll();
    setInterval(refreshAll, 30000);
};
