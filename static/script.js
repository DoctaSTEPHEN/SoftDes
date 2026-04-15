// =============================
// CONFIG
// =============================
const BASE_URL = "https://softdes-2.onrender.com"; // CHANGE THIS

// =============================
// PAGE NAVIGATION
// =============================
function showPage(pageId) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.add("hidden");
    });

    document.getElementById(pageId).classList.remove("hidden");

    // Auto-load data when switching pages
    if (pageId === "dashboard") loadDashboard();
    if (pageId === "visualize") loadChart();
    if (pageId === "reports") loadReports();
}


// =============================
// DASHBOARD
// =============================
async function loadDashboard() {
    try {
        const res = await fetch(`${BASE_URL}/dashboard`);
        const data = await res.json();

        if (data.message) {
            console.log("No data yet");
            return;
        }

        document.getElementById("total_usage").innerText = data.total_usage.toFixed(2);
        document.getElementById("avg_usage").innerText = data.avg_usage.toFixed(2);
        document.getElementById("total_bill").innerText = data.total_bill.toFixed(2);

    } catch (err) {
        console.error("Dashboard error:", err);
    }
}


// =============================
// ADD RECORD (MANUAL)
// =============================
async function addRecord() {
    try {
        const data = {
            Year: parseInt(document.getElementById("year").value),
            Month: parseInt(document.getElementById("month").value),
            Consumption: parseFloat(document.getElementById("consumption").value),
            Bill: parseFloat(document.getElementById("bill").value),
            Branch: document.getElementById("branch").value || "Main"
        };

        // Simple validation
        if (!data.Year || !data.Month || !data.Consumption || !data.Bill) {
            alert("Please fill all required fields");
            return;
        }

        const res = await fetch(`${BASE_URL}/record/manual`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        const result = await res.json();

        alert(result.message || "Record added!");

        // Refresh dashboard + reports
        loadDashboard();
        loadReports();

    } catch (err) {
        console.error("Add record error:", err);
    }
}


// =============================
// FILE UPLOAD
// =============================
async function uploadFile() {
    try {
        const fileInput = document.getElementById("file");

        if (!fileInput.files.length) {
            alert("Please select a file");
            return;
        }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        const res = await fetch(`${BASE_URL}/record/upload`, {
            method: "POST",
            body: formData
        });

        const result = await res.json();

        alert(result.message || "Upload complete!");

        loadDashboard();
        loadReports();

    } catch (err) {
        console.error("Upload error:", err);
    }
}


// =============================
// VISUALIZATION (CHART)
// =============================
let chartInstance = null;

async function loadChart() {
    try {
        const res = await fetch(`${BASE_URL}/visualize`);
        const data = await res.json();

        const ctx = document.getElementById("chart").getContext("2d");

        // Destroy old chart if exists
        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: data.months,
                datasets: [{
                    label: "Water Consumption",
                    data: data.consumption
                }]
            }
        });

    } catch (err) {
        console.error("Chart error:", err);
    }
}


// =============================
// REPORTS TABLE
// =============================
async function loadReports() {
    try {
        const res = await fetch(`${BASE_URL}/reports`);
        const data = await res.json();

        const table = document.getElementById("reportTable");
        table.innerHTML = "";

        data.forEach((row, index) => {
            table.innerHTML += `
                <tr>
                    <td>${row.Month}</td>
                    <td>${row.Consumption}</td>
                    <td>${row.Bill}</td>
                    <td>
                        <button onclick="deleteRecord(${index})">Delete</button>
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Reports error:", err);
    }
}


// =============================
// DELETE RECORD
// =============================
async function deleteRecord(index) {
    try {
        await fetch(`${BASE_URL}/reports/delete/${index}`, {
            method: "DELETE"
        });

        alert("Deleted!");

        loadReports();
        loadDashboard();

    } catch (err) {
        console.error("Delete error:", err);
    }
}


// =============================
// INIT LOAD
// =============================
window.onload = () => {
    loadDashboard();
    loadReports();
};
