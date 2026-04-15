const BASE_URL = window.location.origin;

// =========================
// NOTIFICATION
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
// SAFE FETCH (IMPORTANT FIX)
// =========================
async function safeFetch(url) {
    try {
        const res = await fetch(url);

        if (!res.ok) {
            console.error("API error:", url, res.status);
            return null;
        }

        return await res.json();
    } catch (e) {
        console.error("Network error:", url, e);
        return null;
    }
}

// =========================
// ADD RECORD
// =========================
window.addRecord = async function () {
    const data = {
        Year: +document.getElementById("year").value,
        Month: +document.getElementById("month").value,
        Consumption: +document.getElementById("consumption").value,
        Bill: +document.getElementById("bill").value
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

    notify("Record added");
    refreshAll();
};

// =========================
// UPLOAD FIX
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
    const d = await safeFetch(`${BASE_URL}/api/dashboard`);
    if (!d) return;

    document.getElementById("total").innerText = d.total?.toFixed(1) || 0;
    document.getElementById("avg").innerText = d.avg?.toFixed(1) || 0;
    document.getElementById("bill_total").innerText = d.bill?.toFixed(1) || 0;
}

// =========================
// FORECAST
// =========================
async function loadForecast() {
    const d = await safeFetch(`${BASE_URL}/api/forecast`);
    if (!d || d.error) return;

    document.getElementById("forecast").innerHTML =
        "₱ " + d.future_bill.map(v => v.toFixed(2)).join(" → ₱ ");
}

// =========================
// CHART
// =========================
let chartInstance;

async function loadChart() {
    const d = await safeFetch(`${BASE_URL}/api/forecast`);
    if (!d || !d.history_actual) return;

    const ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) chartInstance.destroy();

    const len = d.history_actual.length;

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: [
                ...Array(len).fill("").map((_, i) => `M${i + 1}`),
                "F1", "F2", "F3"
            ],
            datasets: [
                {
                    label: "Actual Bill",
                    data: d.history_actual,
                    borderColor: "#2196F3"
                },
                {
                    label: "Forecast Bill",
                    data: [
                        ...Array(len).fill(null),
                        ...d.future_bill
                    ],
                    borderColor: "#FF5722",
                    borderDash: [5, 5]
                }
            ]
        }
    });
}

// =========================
// ANOMALY
// =========================
async function checkAnomaly() {
    const d = await safeFetch(`${BASE_URL}/api/anomaly`);
    if (!d) return;

    const anomalies = d.filter(x => x.status === "ANOMALY");

    const el = document.getElementById("anomaly");

    if (!anomalies.length) {
        el.innerHTML = "No anomalies";
        return;
    }

    el.innerHTML = anomalies.map(a =>
        `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
    ).join("<br>");

    notify("Anomaly detected!", "error");
}

// =========================
// REPORTS (🔥 FIXED)
// =========================
async function loadReports() {
    const data = await safeFetch(`${BASE_URL}/api/data`);

    const table = document.getElementById("reportTable");
    table.innerHTML = "";

    // 🔥 FIX: server error OR empty
    if (!data || !Array.isArray(data) || data.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding:15px;">
                    No records available
                </td>
            </tr>
        `;
        return;
    }

    data.forEach(d => {
        table.innerHTML += `
            <tr>
                <td>${d.Year}</td>
                <td>${d.Month}</td>
                <td>${d.Consumption}</td>
                <td>${d.Bill}</td>
            </tr>
        `;
    });
}

// =========================
// RESET
// =========================
window.resetData = async function () {
    if (!confirm("Delete all data?")) return;

    await fetch(`${BASE_URL}/api/reset`, { method: "POST" });

    notify("Reset done");
    refreshAll();
};

// =========================
// REFRESH
// =========================
async function refreshAll() {
    await Promise.all([
        loadDashboard(),
        loadForecast(),
        loadChart(),
        checkAnomaly(),
        loadReports()
    ]);
}

window.onload = refreshAll;
