const BASE_URL = window.location.origin;
let chartInstance = null;

// =========================
// PAGE SWITCH
// =========================
function showPage(page, el) {

    document.querySelectorAll(".menu-item")
        .forEach(x => x.classList.remove("active"));

    el.classList.add("active");

    document.querySelectorAll(".page")
        .forEach(x => x.classList.remove("active"));

    document.getElementById(page).classList.add("active");

    document.getElementById("title").innerText =
        page.charAt(0).toUpperCase() + page.slice(1);

    if (page === "reports") loadReports();
}

// =========================
// SAFE FETCH
// =========================
async function safeFetch(url) {
    try {
        const r = await fetch(url);
        return await r.json();
    } catch {
        return null;
    }
}

// =========================
// ADD RECORD (FIXED INPUT ACCESS)
// =========================
async function addRecord() {

    const data = {
        Year: document.getElementById("year").value,
        Month: document.getElementById("month").value,
        Consumption: document.getElementById("consumption").value,
        Bill: document.getElementById("bill").value
    };

    await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    refreshAll();
}

// =========================
// UPLOAD FILE (FIXED - MISSING BEFORE)
// =========================
async function uploadFile() {

    const file = document.getElementById("file").files[0];

    if (!file) {
        alert("No file selected");
        return;
    }

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: form
    });

    const d = await res.json();

    if (d.error) {
        alert(d.error);
        return;
    }

    alert("Upload success");
    refreshAll();
}

// =========================
// RESET
// =========================
async function resetData() {

    if (!confirm("Delete all records?")) return;

    await fetch(`${BASE_URL}/api/reset`, {
        method: "POST"
    });

    refreshAll();
}

// =========================
// DELETE
// =========================
async function deleteRow(index) {

    await fetch(`${BASE_URL}/api/delete/${index}`, {
        method: "POST"
    });

    refreshAll();
}

// =========================
// EDIT
// =========================
async function editRow(index, y, m, c, b) {

    const Year = prompt("Year:", y);
    if (Year === null) return;

    const Month = prompt("Month:", m);
    if (Month === null) return;

    const Consumption = prompt("Usage:", c);
    if (Consumption === null) return;

    const Bill = prompt("Bill:", b);
    if (Bill === null) return;

    await fetch(`${BASE_URL}/api/edit/${index}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            Year, Month, Consumption, Bill
        })
    });

    refreshAll();
}

// =========================
// REPORTS
// =========================
async function loadReports() {

    const data = await safeFetch(`${BASE_URL}/api/data`);
    const table = document.getElementById("reportTable");

    table.innerHTML = "";

    if (!data || data.length === 0) {
        table.innerHTML =
            `<tr><td colspan="5" style="text-align:center;">No records</td></tr>`;
        return;
    }

    data.forEach((d, i) => {

        table.innerHTML += `
        <tr>
            <td>${d.Year}</td>
            <td>${d.Month}</td>
            <td>${d.Consumption}</td>
            <td>${d.Bill}</td>
            <td>

                <button onclick="editRow(${i},'${d.Year}','${d.Month}','${d.Consumption}','${d.Bill}')">✏️</button>

                <button onclick="deleteRow(${i})">🗑️</button>

            </td>
        </tr>`;
    });
}

// =========================
// DASHBOARD
// =========================
async function loadDashboard() {

    const d = await safeFetch(`${BASE_URL}/api/dashboard`);
    if (!d) return;
    
    document.getElementById("total").innerText = d.total.toFixed(1);
    document.getElementById("avg").innerText = d.avg.toFixed(1);
    document.getElementById("bill_total").innerText = d.bill.toFixed(1);
    document.getElementById("nextMaintenance").innerText = "Click Set Date";
}

// =========================
// FORECAST
// =========================
async function loadForecast() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);

    const el = document.getElementById("forecast");

    if (!d || d.error) {
        el.innerText = "Need at least 3 records";
        return;
    }

    el.innerText =
        d.future_bill.map(x => "₱" + x.toFixed(2)).join(" → ");
}

// =========================
// ANOMALY
// =========================
async function loadAnomaly() {

    const d = await safeFetch(`${BASE_URL}/api/anomaly`);
    if (!d) return;

    const bad = d.filter(x => x.status === "ANOMALY");

    const el = document.getElementById("anomaly");

    el.innerHTML = bad.length
        ? bad.map(a => `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`).join("<br>")
        : "No anomalies";
}

// =========================
// CHART (FIXED CLEAN VERSION)
// =========================
async function loadChart() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);

    const ctx = document.getElementById("chart");
    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();

    if (!d || d.error) {

        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: ["No Data"],
                datasets: [{
                    label: "Waiting for 3 records",
                    data: [0],
                    borderColor: "#170C79",
                    backgroundColor: "rgba(23,12,121,0.15)",
                    tension: 0.4
                }]
            }
        });

        return;
    }

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: d.labels,
            datasets: [
                {
                    label: "Actual",
                    data: d.history_actual,
                    borderColor: "#170C79",
                    backgroundColor: "rgba(23,12,121,0.12)",
                    tension: 0.35,
                    fill: true
                },
                {
                    label: "Forecast",
                    data: [...Array(d.history_actual.length).fill(null), ...d.future_bill],
                    borderColor: "#56B6C6",
                    borderDash: [6, 6],
                    tension: 0.35,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}


// show/hide calendar
function toggleCalendar() {
    const box = document.getElementById("calendarBox");
    box.style.display = box.style.display === "none" ? "block" : "none";
}

// send selected date to backend
async function setMaintenance() {

    const date = document.getElementById("maintenanceDate").value;

    if (!date) {
        alert("Select a date first");
        return;
    }

    const res = await fetch(`${BASE_URL}/api/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
    });

    const d = await res.json();

    if (d.error) {
        alert(d.error);
        return;
    }

    document.getElementById("nextMaintenance").innerText =
        d.next_maintenance;

    document.getElementById("calendarBox").style.display = "none";
}

async function checkMaintenanceToday() {

    const d = await safeFetch(`${BASE_URL}/api/maintenance/today`);
    if (!d) return;

    const icon = document.getElementById("maintenanceIcon");
    const text = document.getElementById("nextMaintenance");

    if (d.date) {
        text.innerText = d.date;
    }

    if (d.is_today) {
        icon.style.display = "inline";
    } else {
        icon.style.display = "none";
    }
}

// =========================
// REFRESH
// =========================
async function refreshAll() {
    await Promise.all([
        loadDashboard(),
        loadForecast(),
        loadAnomaly(),
        loadChart(),
        loadReports(),
        checkMaintenanceToday()
    ]);
}

// =========================
// INIT
// =========================
window.onload = refreshAll;
window.uploadFile = uploadFile;
