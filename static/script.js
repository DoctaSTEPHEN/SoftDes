const BASE_URL = "https://softdes-2.onrender.com";

// =============================
// PAGE NAVIGATION
// =============================
function showPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(page).classList.remove("hidden");

    if (page === "dashboard") loadDashboard();
    if (page === "visualize") loadChart();
    if (page === "reports") loadReports();
}

// =============================
// DASHBOARD
// =============================
async function loadDashboard() {
    const res = await fetch(BASE_URL + "/dashboard");
    const data = await res.json();

    document.getElementById("total_usage").innerText = data.total_usage || 0;
    document.getElementById("avg_usage").innerText = data.avg_usage || 0;
    document.getElementById("total_bill").innerText = data.total_bill || 0;
}

// =============================
// ADD RECORD
// =============================
async function addRecord() {
    const data = {
        Year: document.getElementById("year").value,
        Month: document.getElementById("month").value,
        Consumption: document.getElementById("consumption").value,
        Bill: document.getElementById("bill").value,
        Branch: document.getElementById("branch").value
    };

    await fetch(BASE_URL + "/record/manual", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    alert("Record Added!");
    loadDashboard();
    loadReports();
}

// =============================
// UPLOAD CSV
// =============================
async function uploadFile() {
    const fileInput = document.getElementById("file");

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    await fetch(BASE_URL + "/record/upload", {
        method: "POST",
        body: formData
    });

    alert("Uploaded!");
    loadDashboard();
    loadReports();
}

// =============================
// CHART
// =============================
let chartInstance = null;

async function loadChart() {
    const res = await fetch(BASE_URL + "/visualize");
    const data = await res.json();

    const ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.months,
            datasets: [{
                label: "Consumption",
                data: data.consumption
            }]
        }
    });
}

// =============================
// REPORTS
// =============================
async function loadReports() {
    const res = await fetch(BASE_URL + "/reports");
    const data = await res.json();

    const table = document.getElementById("reportTable");
    table.innerHTML = "";

    data.forEach((row, i) => {
        table.innerHTML += `
            <tr>
                <td>${row.Month}</td>
                <td>${row.Consumption}</td>
                <td>${row.Bill}</td>
                <td><button onclick="deleteRecord(${i})">Delete</button></td>
            </tr>
        `;
    });
}

// =============================
// DELETE
// =============================
async function deleteRecord(index) {
    await fetch(BASE_URL + "/reports/delete/" + index, {
        method: "DELETE"
    });

    loadReports();
    loadDashboard();
}

async function addData() {
    const data = {
        Year: document.getElementById("year").value,
        Month: document.getElementById("month").value,
        Consumption: document.getElementById("consumption").value,
        Bill: document.getElementById("bill").value
    };

    await fetch("/api/add", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    alert("Saved!");
    loadDashboard();
    checkMaintenance();
}

// =====================
async function loadDashboard() {
    const res = await fetch("/api/dashboard");
    const data = await res.json();

    document.getElementById("total").innerText = data.total;
    document.getElementById("avg").innerText = data.avg;
    document.getElementById("bill_total").innerText = data.bill;
}

// =====================
async function getForecast() {
    const res = await fetch("/api/forecast");
    const data = await res.json();

    document.getElementById("forecast").innerText =
        "Next: " + data.next;
}

// =====================
async function checkAnomaly() {
    const res = await fetch("/api/anomaly");
    const data = await res.json();

    let output = "";

    data.forEach(d => {
        if (d.status === "ANOMALY") {
            output += `⚠ Month ${d.Month} - High usage<br>`;
        }
    });

    document.getElementById("anomaly").innerHTML = output;
}

// =====================
async function checkMaintenance() {
    const res = await fetch("/api/maintenance");
    const data = await res.json();

    if (data.alert) {
        alert(data.message);
    }
}

// =============================
// INIT
// =============================
window.onload = () => {
    showPage("dashboard");
    loadDashboard();
    loadReports();
    checkMaintenance();
};
