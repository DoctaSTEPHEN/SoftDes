const BASE_URL = window.location.origin;
let chartInstance = null;

/* =====================================
   FLAGS
===================================== */
let maintenanceClosed = false;
let anomalyClosed = false;

/* =====================================
   SAFE GET ELEMENT
===================================== */
const el = (id) => document.getElementById(id);

/* =====================================
   PAGE NAVIGATION
===================================== */
function showPage(page, btn) {

    document.querySelectorAll(".menu-item")
        .forEach(x => x.classList.remove("active"));

    if (btn) btn.classList.add("active");

    document.querySelectorAll(".page")
        .forEach(x => x.classList.remove("active"));

    el(page).classList.add("active");

    el("title").innerText =
        page.charAt(0).toUpperCase() + page.slice(1);

    if (page === "reports") loadReports();
}

/* =====================================
   TOGGLE CALENDAR
===================================== */
function toggleCalendar() {
    const box = el("calendarBox");
    if (!box) return;

    box.style.display =
        box.style.display === "block" ? "none" : "block";
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
   ADD RECORD (VALIDATION ADDED)
===================================== */
async function addRecord() {

    const year = el("year").value.trim();
    const month = el("month").value;
    const consumption = el("consumption").value.trim();
    const bill = el("bill").value.trim();

    // FIELD VALIDATION
    if (!year) return alert("Year is required.");
    if (!month) return alert("Month is required.");
    if (!consumption) return alert("Consumption is required.");
    if (!bill) return alert("Bill is required.");

    if (isNaN(year)) return alert("Year must be a number.");
    if (isNaN(consumption)) return alert("Consumption must be a number.");
    if (isNaN(bill)) return alert("Bill must be a number.");

    const data = {
        Year: year,
        Month: month,
        Consumption: consumption,
        Bill: bill
    };

    const res = await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(data)
    });

    const d = await res.json();

    if (d.error) return alert(d.error);

    refreshAll();
}

/* =====================================
   UPLOAD FILE (TYPE VALIDATION FIXED)
===================================== */
async function uploadFile() {

    const file = el("file").files[0];

    if (!file) return alert("Please select a file first.");

    const allowed = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];

    if (!allowed.includes(file.type)) {
        return alert("Invalid file type. Please upload CSV or XLSX only.");
    }

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: form
    });

    const d = await res.json();

    if (d.error) {
        return alert("Upload failed: " + d.error);
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

    anomalyClosed = false;
    maintenanceClosed = false;

    refreshAll();
}

/* =====================================
   DELETE
===================================== */
async function deleteRow(i) {

    if (!confirm("Delete this record?")) return;

    await fetch(`${BASE_URL}/api/delete/${i}`, {
        method: "POST"
    });

    refreshAll();
}

/* =====================================
   EDIT
===================================== */
async function editRow(i, y, m, c, b) {

    const Year = prompt("Year:", y);
    if (Year === null) return;

    const Month = prompt("Month:", m);
    if (Month === null) return;

    const Consumption = prompt("Consumption:", c);
    if (Consumption === null) return;

    const Bill = prompt("Bill:", b);
    if (Bill === null) return;

    if (isNaN(Year) || isNaN(Consumption) || isNaN(Bill)) {
        return alert("Invalid numeric input.");
    }

    await fetch(`${BASE_URL}/api/edit/${i}`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ Year, Month, Consumption, Bill })
    });

    refreshAll();
}

/* =====================================
   REPORTS
===================================== */
async function loadReports() {

    const data = await safeFetch(`${BASE_URL}/api/data`);
    const table = el("reportTable");

    table.innerHTML = "";

    if (!data || !data.length) {
        table.innerHTML = `<tr><td colspan="5">No records</td></tr>`;
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
                <button onclick="editRow(${i},
                '${d.Year}','${d.Month}',
                '${d.Consumption}','${d.Bill}')">✏️</button>

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

    el("total").innerText = (+d.total || 0).toFixed(1);
    el("avg").innerText = (+d.avg || 0).toFixed(1);
    el("bill_total").innerText = (+d.bill || 0).toFixed(2);
}

/* =====================================
   FORECAST
===================================== */
async function loadForecast() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);

    if (!d || d.error) {
        el("forecast").innerText = "Need 3 records";
        return;
    }

    el("forecast").innerText =
        d.future_bill.map(x =>
            "₱" + Number(x).toFixed(2)
        ).join(" → ");
}

/* =====================================
   ANOMALY DETECTION
===================================== */
async function loadAnomaly() {

    const d = await safeFetch(`${BASE_URL}/api/anomaly`);
    if (!d) return;

    const values = d.map(x => +x.Consumption || 0);

    const avg =
        values.reduce((a,b)=>a+b,0) /
        (values.length || 1);

    const bad = d.filter(x =>
        (+x.Consumption > avg * 1.5)
    );

    el("anomaly").innerHTML =
        bad.length
        ? bad.map(a =>
            `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
          ).join("<br>")
        : "No anomalies";

    if (bad.length && !anomalyClosed) {

        el("anomalyPopup").style.display = "flex";

        el("anomalyPopupBody").innerHTML =
            bad.map(a =>
                `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
            ).join("<br>");
    }
}

/* =====================================
   CHART
===================================== */
async function loadChart() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);
    const ctx = el("chart");

    if (!ctx || !d || d.error) return;

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: d.labels,
            datasets: [
                {
                    label: "Actual",
                    data: d.history_actual,
                    borderColor: "#170C79",
                    borderWidth: 3,
                    tension: 0.35
                },
                {
                    label: "Predicted",
                    data: [
                        ...Array(d.history_actual.length - 1).fill(null),
                        ...d.future_bill
                    ],
                    borderColor: "#56B6C6",
                    borderDash: [6,4],
                    borderWidth: 3,
                    tension: 0.35
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
   MAINTENANCE
===================================== */
async function setMaintenance() {

    const date = el("maintenanceDate").value;

    if (!date) return alert("Please select a maintenance date.");

    await fetch(`${BASE_URL}/api/maintenance`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ date })
    });

    localStorage.setItem("maintenanceDate", date);

    maintenanceClosed = false;

    checkMaintenanceReminder();
}

/* =====================================
   POPUPS
===================================== */
function closeMaintenancePopup() {
    el("maintenancePopup").style.display = "none";
    maintenanceClosed = true;
}

function closeAnomalyPopup() {
    el("anomalyPopup").style.display = "none";
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
