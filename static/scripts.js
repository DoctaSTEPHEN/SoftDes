const BASE_URL = window.location.origin;

// =============================
// NOTIFY
// =============================
function notify(msg, type = "success") {
    const div = document.createElement("div");

    div.innerText = msg;
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px;
        border-radius: 8px;
        color: white;
        background: ${type === "error" ? "#e74c3c" : "#2ecc71"};
        z-index: 9999;
    `;

    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
}

// =============================
// ADD
// =============================
window.addRecord = async function () {
    const data = {
        Year: +document.getElementById("year").value,
        Month: +document.getElementById("month").value,
        Consumption: +document.getElementById("consumption").value,
        Bill: +document.getElementById("bill").value
    };

    if (Object.values(data).some(isNaN)) {
        return notify("Fill all fields", "error");
    }

    await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    notify("Added");
    refreshAll();
};

// =============================
// UPLOAD (FIXED ERROR)
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
// DASHBOARD
// =============================
async function loadDashboard() {
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    const d = await res.json();

    document.getElementById("total").innerText = d.total.toFixed(1);
    document.getElementById("avg").innerText = d.avg.toFixed(1);
    document.getElementById("bill_total").innerText = d.bill.toFixed(1);
}

// =============================
// FORECAST (BILL ONLY)
// =============================
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

// =============================
// CHART (BILL ONLY)
// =============================
let chartInstance;

async function loadChart() {
    const res = await fetch(`${BASE_URL}/api/forecast`);
    const d = await res.json();

    if (!d.history_actual) return;

    const ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: d.labels,
            datasets: [
                {
                    label: "Actual Bill",
                    data: d.history_actual.concat(Array(d.future_bill.length).fill(null)),
                    borderColor: "#2196F3"
                },
                {
                    label: "Forecast Bill",
                    data: Array(d.history_actual.length).fill(null).concat(d.future_bill),
                    borderColor: "#FF5722",
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// =============================
// ANOMALY
// =============================
async function checkAnomaly() {
    const res = await fetch(`${BASE_URL}/api/anomaly`);
    const d = await res.json();

    const a = d.filter(x => x.status === "ANOMALY");

    document.getElementById("anomaly").innerHTML =
        a.length ? a.map(x => `${x.Year}-${x.Month}: ${x.Consumption}`).join("<br>") : "No anomalies";
}

// =============================
// REPORTS
// =============================
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
