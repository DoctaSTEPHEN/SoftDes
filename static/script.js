let chartInstance = null;

// =========================
// NOTIFICATION
// =========================
function notify(msg) {
    alert(msg);
}

// =========================
// ADD RECORD
// =========================
async function addRecord() {
    const data = {
        Year: year.value,
        Month: month.value,
        Consumption: consumption.value,
        Bill: bill.value
    };

    const res = await fetch("/api/add", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.error) return notify(result.error);

    notify("Record added!");
    loadDashboard();
}

// =========================
// DASHBOARD
// =========================
async function loadDashboard() {
    const res = await fetch("/api/dashboard");
    const data = await res.json();

    total.innerText = data.total || 0;
    avg.innerText = data.avg || 0;
    bill_total.innerText = data.bill || 0;
}

// =========================
// UPLOAD
// =========================
async function uploadFile() {
    const file = document.getElementById("file").files[0];

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    notify(data.message || data.error);
}

// =========================
// FORECAST
// =========================
async function loadForecast() {
    const res = await fetch("/api/forecast");
    const data = await res.json();

    if (data.error) return notify(data.error);

    document.getElementById("forecast").innerHTML =
        "Next 3 Months: " + data.future_3_months.join(", ");

    notify("Forecast loaded!");
}

// =========================
// CHART
// =========================
async function loadChart() {
    const res = await fetch("/api/forecast");
    const data = await res.json();

    const ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: [...data.history_actual.map((_, i) => i)],
            datasets: [
                {
                    label: "Actual",
                    data: data.history_actual,
                    borderColor: "blue"
                },
                {
                    label: "Predicted",
                    data: data.history_predicted,
                    borderColor: "green"
                },
                {
                    label: "Future",
                    data: [...Array(data.history_actual.length).fill(null), ...data.future_3_months],
                    borderColor: "red"
                }
            ]
        }
    });

    notify("Chart loaded!");
}

// =========================
// ANOMALY
// =========================
async function checkAnomaly() {
    const res = await fetch("/api/anomaly");
    const data = await res.json();

    const anomalies = data.filter(d => d.status === "ANOMALY");

    document.getElementById("anomaly").innerHTML =
        anomalies.map(a => `Month ${a.Month}`).join("<br>");

    notify("Anomaly checked!");
}

// =========================
// INIT
// =========================
window.onload = loadDashboard;
