const BASE_URL = window.location.origin;

// =========================
// NOTIFY
// =========================
function notify(msg, type = "success") {
    const div = document.createElement("div");

    div.innerText = msg;
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === "error" ? "#e74c3c" : "#2ecc71"};
        color: white;
        padding: 12px;
        border-radius: 8px;
        z-index: 9999;
    `;

    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2500);
}

// =========================
// MAINTENANCE
// =========================
async function checkMaintenanceToday() {
    try {
        const res = await fetch(`${BASE_URL}/api/maintenance/today`);
        const d = await res.json();

        const box = document.getElementById("maintenanceAlert");

        if (d.is_today) {
            box.style.display = "block";

            notify("⚠ Today is maintenance day!", "error");
        } else {
            box.style.display = "none";
        }

    } catch (e) {
        console.log("Maintenance check failed");
    }
}

// =========================
// ADD RECORD
// =========================
window.addRecord = async function () {
    const data = {
        Year: +year.value,
        Month: +month.value,
        Consumption: +consumption.value,
        Bill: +bill.value
    };

    if (Object.values(data).some(v => !v)) {
        return notify("Missing entry value", "error");
    }

    const res = await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    const d = await res.json();
    if (d.error) return notify(d.error, "error");

    notify("Added");
    refreshAll();
};

// =========================
// UPLOAD
// =========================
window.uploadFile = async function () {
    const file = document.getElementById("file").files[0];

    if (!file) return notify("Missing file upload", "error");

    const ext = file.name.split(".").pop();
    if (!["csv", "json"].includes(ext)) {
        return notify("Unsupported file upload", "error");
    }

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: form
    });

    const d = await res.json();
    if (d.error) return notify(d.error, "error");

    notify("Upload success");
    refreshAll();
};

// =========================
// DASHBOARD
// =========================
async function loadDashboard() {
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    const d = await res.json();

    document.getElementById("total").innerText = d.total.toFixed(1);
    document.getElementById("avg").innerText = d.avg.toFixed(1);
    document.getElementById("bill_total").innerText = d.bill.toFixed(1);
}

// =========================
// FORECAST (BILL ONLY)
// =========================
async function loadForecast() {
    const res = await fetch(`${BASE_URL}/api/forecast`);
    const d = await res.json();

    if (d.error) {
        document.getElementById("forecast").innerText = d.error;
        return;
    }

    document.getElementById("forecast").innerHTML =
        "₱" + d.future_bill.map(v => v.toFixed(2)).join(" → ₱");
}

// =========================
// CHART
// =========================
let chartInstance;

async function loadChart() {
    const res = await fetch(`${BASE_URL}/api/forecast`);
    const d = await res.json();

    if (!d.history_actual || d.history_actual.length === 0) return;

    const ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) chartInstance.destroy();

    const historyLen = d.history_actual.length;

    // labels: real months + future labels
    const labels = [
        ...Array(historyLen).fill("").map((_, i) => `M${i + 1}`),
        "F1", "F2", "F3"
    ];

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,

            datasets: [
                // ======================
                // ACTUAL (FIXED)
                // ======================
                {
                    label: "Actual Bill",
                    data: d.history_actual,
                    borderColor: "#2196F3",
                    tension: 0.4,
                    pointRadius: 4
                },

                // ======================
                // FORECAST (SHIFTED)
                // ======================
                {
                    label: "Forecast Bill",
                    data: [
                        ...Array(historyLen).fill(null),
                        ...d.future_bill
                    ],
                    borderColor: "#FF5722",
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            spanGaps: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
// =========================
// ANOMALY (WITH POPUP)
// =========================
async function checkAnomaly() {
    const res = await fetch(`${BASE_URL}/api/anomaly`);
    const d = await res.json();

    const anomalies = d.filter(x => x.status === "ANOMALY");

    const el = document.getElementById("anomaly");

    if (!anomalies.length) {
        el.innerHTML = "No anomalies";
        return;
    }

    el.innerHTML = anomalies.map(a =>
        `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
    ).join("<br>");

    notify("⚠ Anomaly detected!", "error");
}

// =========================
// MAINTENANCE
// =========================
window.checkMaintenance = async function () {
    const date = document.getElementById("maintenanceDate").value;

    if (!date) return notify("Enter date", "error");

    const res = await fetch(`${BASE_URL}/api/maintenance`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ date })
    });

    const d = await res.json();

    if (d.error) return notify(d.error, "error");

    document.getElementById("maintenanceResult").innerText =
        "Next maintenance: " + d.next_maintenance;

    notify("Maintenance calculated");
};

// =========================
// REPORTS
// =========================
async function loadReports() {
    const res = await fetch(`${BASE_URL}/api/data`);
    const d = await res.json();

    document.getElementById("reportTable").innerHTML =
        d.map(x => `
            <tr>
                <td>${x.Year}</td>
                <td>${x.Month}</td>
                <td>${x.Consumption}</td>
                <td>${x.Bill}</td>
            </tr>
        `).join("");
}

// =========================
// RESET
// =========================
window.resetData = async function () {
    if (!confirm("Delete ALL data?")) return;

    await fetch(`${BASE_URL}/api/reset`, { method: "POST" });

    notify("Reset done");
    refreshAll();
};

// =========================
// REFRESH ALL (FIXED)
// =========================
async function refreshAll() {
    await Promise.all([
        loadDashboard(),
        loadForecast(),
        loadChart(),
        checkAnomaly(),
        loadReports(),
        checkMaintenanceToday()
    ]);
}

// expose missing functions
window.loadDashboard = loadDashboard;
window.loadForecast = loadForecast;
window.loadChart = loadChart;
window.checkAnomaly = checkAnomaly;
window.loadReports = loadReports;

window.onload = refreshAll;
