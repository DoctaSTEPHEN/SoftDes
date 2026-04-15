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

    alert("Saved");
    loadDashboard();
}

async function uploadFile() {
    const file = document.getElementById("file").files[0];

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
    });

    const data = await res.json();

    if (data.error) {
        alert(data.error);
    } else {
        alert("Uploaded: " + data.rows_added);
    }
}

async function loadDashboard() {
    const res = await fetch("/api/dashboard");
    const data = await res.json();

    total.innerText = data.total;
    avg.innerText = data.avg;
    bill_total.innerText = data.bill;
}

async function getForecast() {
    const res = await fetch("/api/forecast");
    const data = await res.json();

    forecast.innerHTML = `
        <b>Next 3 Months:</b><br>
        ${data.future_3_months.join(", ")}
    `;
}

async function checkAnomaly() {
    const res = await fetch("/api/anomaly");
    const data = await res.json();

    anomaly.innerHTML = data
        .filter(d => d.status === "ANOMALY")
        .map(d => `⚠ Month ${d.Month}`)
        .join("<br>");
}

let chartInstance = null;

async function loadChart() {
    const res = await fetch("/api/forecast");
    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    const ctx = document.getElementById("chart").getContext("2d");

    // destroy old chart
    if (chartInstance) {
        chartInstance.destroy();
    }

    // labels (months index)
    const labels = [
        ...Array(data.history_actual.length).keys(),
        ...Array(data.future_3_months.length).keys().map(i => "F+" + (i + 1))
    ];

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,

            datasets: [
                {
                    label: "Actual Consumption",
                    data: data.history_actual,
                    borderColor: "blue",
                    fill: false
                },
                {
                    label: "Predicted History",
                    data: data.history_predicted,
                    borderColor: "green",
                    borderDash: [5, 5],
                    fill: false
                },
                {
                    label: "Future Forecast (3 months)",
                    data: [
                        ...Array(data.history_actual.length).fill(null),
                        ...data.future_3_months
                    ],
                    borderColor: "red",
                    fill: false
                }
            ]
        },

        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "top"
                }
            }
        }
    });
}

window.onload = loadDashboard;
