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

window.onload = loadDashboard;
