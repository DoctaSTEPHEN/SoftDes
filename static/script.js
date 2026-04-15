const BASE_URL = "https://softdes-2.onrender.com";

// =============================
// AUTO REFRESH SYSTEM
// =============================
async function refreshAll() {
    await loadDashboard();
    await loadForecast();
    await loadChart();
    await checkAnomaly();
}

// =============================
// NOTIFICATION
// =============================
function notify(msg) {
    alert(msg);
}

// =============================
// ADD RECORD (AUTO UPDATE EVERYTHING)
// =============================
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

    if (result.error) {
        notify("ERROR: " + result.error);
        return;
    }

    notify("Record added successfully!");

    // 🔥 AUTO REFRESH EVERYTHING
    refreshAll();
}

// =============================
// UPLOAD FILE (AUTO PROCESS)
// =============================
async function uploadFile() {
    const file = document.getElementById("file").files[0];

    if (!file) {
        notify("Please select a file");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    if (data.error) {
        notify("ERROR: " + data.error);
        return;
    }

    notify(`Upload successful: ${data.rows} rows`);

    // 🔥 AUTO REFRESH EVERYTHING
    refreshAll();
}

// =============================
// DASHBOARD
// =============================
async function loadDashboard() {
    const res = await fetch("/api/dashboard");
    const data = await res.json();

    if (!data || data.message) return;

    document.getElementById("total").innerText = data.total || 0;
    document.getElementById("avg").innerText = data.avg || 0;
    document.getElementById("bill_total").innerText = data.bill || 0;
}

// =============================
// FORECAST (AUTO ONLY - NO BUTTON)
// =============================
async function loadForecast() {
    const res = await fetch("/api/forecast");
    const data = await res.json();

    if (data.error) {
        document.getElementById("forecast").innerHTML = data.error;
        return;
    }

    document.getElementById("forecast").innerHTML = `
        <h3>Next 3 Months Forecast</h3>
        <b>${data.future_3_months.join(", ")}</b>
    `;
}

// =============================
// VISUALIZATION (AUTO CHART)
// =============================
let chartInstance;

async function loadChart() {
    const res = await fetch("/api/forecast");
    const data = await res.json();

    if (data.error) return;

    const ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.history_actual.map((_, i) => i + 1),
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
                    label: "Forecast",
                    data: [
                        ...Array(data.history_actual.length).fill(null),
                        ...data.future_3_months
                    ],
                    borderColor: "red"
                }
            ]
        }
    });
}

// =============================
// ANOMALY DETECTION
// =============================
async function checkAnomaly() {
    const res = await fetch("/api/anomaly");
    const data = await res.json();

    const anomalies = data.filter(d => d.status === "ANOMALY");

    document.getElementById("anomaly").innerHTML =
        anomalies.map(a => `⚠ Month ${a.Month}`).join("<br>");
}

// =============================
// AUTO RUN ON LOAD
// =============================
window.onload = () => {
    refreshAll();
};
