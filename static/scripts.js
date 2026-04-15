const BASE_URL = window.location.origin;

// =============================
// NOTIFY
// =============================
function notify(msg, type = "success") {
    const d = document.createElement("div");
    d.innerText = msg;

    d.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === "error" ? "#e74c3c" : "#2ecc71"};
        color: white;
        padding: 12px;
        border-radius: 8px;
        z-index: 9999;
    `;

    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2000);
}

// =============================
// ADD
// =============================
window.addRecord = async function () {
    const data = {
        Year: +year.value,
        Month: +month.value,
        Consumption: +consumption.value,
        Bill: +bill.value
    };

    if (Object.values(data).some(isNaN)) return notify("Fill all fields", "error");

    await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    notify("Added");
    refreshAll();
};

// =============================
// UPLOAD
// =============================
window.uploadFile = async function () {
    const file = document.getElementById("file").files[0];
    if (!file) return notify("No file", "error");

    const form = new FormData();
    form.append("file", file);

    await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: form
    });

    notify("Uploaded");
    refreshAll();
};

// =============================
// RESET ALL
// =============================
window.resetData = async function () {
    if (!confirm("Delete ALL data?")) return;

    await fetch(`${BASE_URL}/api/reset`, { method: "POST" });

    notify("Reset done");
    refreshAll();
};

// =============================
// DELETE ROW
// =============================
window.deleteRow = async function (year, month) {
    await fetch(`${BASE_URL}/api/delete`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ Year: year, Month: month })
    });

    notify("Deleted");
    refreshAll();
};

// =============================
// DASHBOARD
// =============================
async function loadDashboard() {
    const r = await fetch(`${BASE_URL}/api/dashboard`);
    const d = await r.json();

    total.innerText = d.total.toFixed(1);
    avg.innerText = d.avg.toFixed(1);
    bill_total.innerText = d.bill.toFixed(1);
}

// =============================
// FORECAST (BILL ONLY)
// =============================
async function loadForecast() {
    const r = await fetch(`${BASE_URL}/api/forecast`);
    const d = await r.json();

    if (d.error) return forecast.innerText = d.error;

    forecast.innerHTML = "₱" + d.future_bill.map(v => v.toFixed(2)).join(" → ₱");
}

// =============================
// CHART
// =============================
let chartInstance;

async function loadChart() {
    const res = await fetch(`${BASE_URL}/api/forecast`);
    const d = await res.json();

    if (!d.history_actual || !d.history_actual.length) return;

    const ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) chartInstance.destroy();

    const historyLen = d.history_actual.length;

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: d.labels,

            datasets: [
                {
                    label: "Actual Bill",
                    data: d.history_actual,
                    borderColor: "#2196F3",
                    tension: 0.4
                },
                {
                    label: "Forecast Bill",
                    data: [
                        ...Array(historyLen).fill(null),
                        ...d.future_bill
                    ],
                    borderColor: "#FF5722",
                    borderDash: [5, 5],
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            spanGaps: true
        }
    });
}
// =============================
// ANOMALY
// =============================
async function checkAnomaly() {
    const r = await fetch(`${BASE_URL}/api/anomaly`);
    const d = await r.json();

    const a = d.filter(x => x.status === "ANOMALY");

    anomaly.innerHTML = a.length
        ? a.map(x => `${x.Year}-${x.Month}: ${x.Consumption}`).join("<br>")
        : "No anomalies";
}

// =============================
// REPORTS
// =============================
async function loadReports() {
    const r = await fetch(`${BASE_URL}/api/data`);
    const d = await r.json();

    reportTable.innerHTML = d.map(x => `
        <tr>
            <td>${x.Year}</td>
            <td>${x.Month}</td>
            <td>${x.Consumption}</td>
            <td>${x.Bill}</td>
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

window.onload = refreshAll;
