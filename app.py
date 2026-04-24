const BASE_URL = window.location.origin;
let chartInstance = null;

/* =====================================
   POPUP FLAGS
===================================== */
let maintenanceClosed = false;
let anomalyClosed = false;

/* =====================================
   PAGE
===================================== */
function showPage(page, el) {

    document.querySelectorAll(".menu-item")
        .forEach(x => x.classList.remove("active"));

    if (el) el.classList.add("active");

    document.querySelectorAll(".page")
        .forEach(x => x.classList.remove("active"));

    document.getElementById(page).classList.add("active");

    document.getElementById("title").innerText =
        page.charAt(0).toUpperCase() + page.slice(1);

    if (page === "reports") loadReports();
}

/* =====================================
   SAFE FETCH
===================================== */
async function safeFetch(url) {
    try {
        const r = await fetch(url);
        return await r.json();
    } catch {
        return null;
    }
}

/* =====================================
   ADD RECORD
===================================== */
async function addRecord() {

    const data = {
        Year: year.value,
        Month: month.value,
        Consumption: consumption.value,
        Bill: bill.value
    };

    const res = await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    const d = await res.json();

    if (d.error) {
        alert(d.error);
        return;
    }

    refreshAll();
}

/* =====================================
   UPLOAD
===================================== */
async function uploadFile() {

    const file = document.getElementById("file").files[0];

    if (!file) {
        alert("Select file first.");
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

    refreshAll();
}

/* =====================================
   RESET
===================================== */
async function resetData() {

    if (!confirm("Delete all records?")) return;

    await fetch(`${BASE_URL}/api/reset`, {
        method: "POST"
    });

    refreshAll();
}

/* =====================================
   DELETE RECORD
===================================== */
async function deleteRow(index) {

    if (!confirm("Delete this record?")) return;

    await fetch(`${BASE_URL}/api/delete/${index}`, {
        method: "POST"
    });

    refreshAll();
}

/* =====================================
   EDIT RECORD
===================================== */
async function editRow(index, y, m, c, b) {

    const Year = prompt("Year:", y);
    if (Year === null) return;

    const Month = prompt("Month:", m);
    if (Month === null) return;

    const Consumption = prompt("Consumption:", c);
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

/* =====================================
   REPORTS
===================================== */
async function loadReports() {

    const data = await safeFetch(`${BASE_URL}/api/data`);
    const table = document.getElementById("reportTable");

    if (!table) return;

    table.innerHTML = "";

    if (!data || data.length === 0) {
        table.innerHTML =
        `<tr><td colspan="5">No records</td></tr>`;
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

/* =====================================
   DASHBOARD
===================================== */
async function loadDashboard() {

    const d = await safeFetch(`${BASE_URL}/api/dashboard`);
    if (!d) return;

    total.innerText = Number(d.total).toFixed(1);
    avg.innerText = Number(d.avg).toFixed(1);
    bill_total.innerText = Number(d.bill).toFixed(2);
}

/* =====================================
   FORECAST TEXT
===================================== */
async function loadForecast() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);

    if (!d || d.error) {
        forecast.innerText = "Need 3 records";
        return;
    }

    forecast.innerText =
        d.future_bill
        .map(x => "₱" + Number(x).toFixed(2))
        .join(" → ");
}

/* =====================================
   ANOMALY
===================================== */
async function loadAnomaly() {

    const d = await safeFetch(`${BASE_URL}/api/anomaly`);
    if (!d) return;

    const box = document.getElementById("anomaly");

    const bad = d.filter(x =>
        String(x.status).trim().toUpperCase() === "ANOMALY"
    );

    if (box) {
        box.innerHTML = bad.length
            ? bad.map(a =>
                `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
              ).join("<br>")
            : "No anomalies";
    }

    /* popup */
    if (bad.length && !anomalyClosed) {

        const popup = document.getElementById("anomalyPopup");
        const body = document.getElementById("anomalyPopupBody");

        if (popup && body) {
            body.innerHTML = bad.map(a =>
                `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
            ).join("<br>");

            popup.style.display = "flex";
        }
    }
}

/* =====================================
   CHART (UNCHANGED STYLE)
===================================== */
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
                    pointRadius: 4,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        return;
    }

    const historyCount = d.history_actual.length;

    const actualData = [
        ...d.history_actual,
        null, null, null
    ];

    const predictedData = [
        ...Array(historyCount - 1).fill(null),
        d.history_actual[historyCount - 1],
        ...d.future_bill
    ];

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: d.labels,
            datasets: [
                {
                    label: "Actual Bill",
                    data: actualData,
                    borderColor: "#170C79",
                    backgroundColor: "rgba(23,12,121,0.12)",
                    pointBackgroundColor: "#170C79",
                    pointBorderColor: "#170C79",
                    pointRadius: 5,
                    borderWidth: 3,
                    tension: 0.35,
                    fill: true
                },
                {
                    label: "Predicted Bill",
                    data: predictedData,
                    borderColor: "#56B6C6",
                    backgroundColor: "rgba(86,182,198,0.10)",
                    pointBackgroundColor: "#56B6C6",
                    pointBorderColor: "#56B6C6",
                    pointRadius: 5,
                    borderWidth: 3,
                    borderDash: [8,6],
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

/* =====================================
   MAINTENANCE DATE
===================================== */
function openMaintenanceCalendar() {

    const input =
        document.getElementById("maintenanceDate");

    if (input) input.showPicker();
}

async function setMaintenance() {

    const input =
        document.getElementById("maintenanceDate");

    if (!input || !input.value) {
        alert("Select maintenance date.");
        return;
    }

    const res = await fetch(
        `${BASE_URL}/api/maintenance`,
        {
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify({
                date: input.value
            })
        }
    );

    const d = await res.json();

    if (d.error) {
        alert(d.error);
        return;
    }

    nextMaintenance.innerText =
        d.next_maintenance;

    localStorage.setItem(
        "maintenanceDate",
        d.next_maintenance
    );

    maintenanceClosed = false;

    checkMaintenanceReminder();
}

/* =====================================
   MAINTENANCE POPUP
===================================== */
function checkMaintenanceReminder() {

    if (maintenanceClosed) return;

    const saved =
        localStorage.getItem("maintenanceDate");

    if (!saved) return;

    const today = new Date();
    today.setHours(0,0,0,0);

    const target = new Date(saved);
    target.setHours(0,0,0,0);

    const days =
        Math.ceil((target - today) / 86400000);

    if (days > 10 || days < 0) return;

    const popup =
        document.getElementById("maintenancePopup");

    if (!popup) return;

    popup.style.display = "flex";

    popupIcon.innerText =
        days === 0 ? "🚨" : "⚠️";

    popupTitle.innerText =
        days === 0
        ? "Maintenance Today"
        : "Upcoming Maintenance";

    popupText.innerText =
        days === 0
        ? "Today is maintenance day."
        : `Maintenance due in ${days} day(s).`;
}

/* =====================================
   CLOSE POPUPS
===================================== */
function closeMaintenancePopup() {
    const popup =
        document.getElementById("maintenancePopup");

    if (popup) popup.style.display = "none";

    maintenanceClosed = true;
}

function closeAnomalyPopup() {
    const popup =
        document.getElementById("anomalyPopup");

    if (popup) popup.style.display = "none";

    anomalyClosed = true;
}

/* =====================================
   REFRESH
===================================== */
async function refreshAll() {

    await Promise.all([
        loadDashboard(),
        loadForecast(),
        loadAnomaly(),
        loadChart(),
        loadReports()
    ]);

    checkMaintenanceReminder();
}

/* =====================================
   INIT
===================================== */
window.onload = refreshAll;
