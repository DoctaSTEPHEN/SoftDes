const BASE_URL = window.location.origin;
let chartInstance = null;

/* =====================================
   FLAGS
===================================== */
let maintenanceClosed = false;
let anomalyClosed = false;

/* =====================================
   SAFE DOM GET
===================================== */
function el(id) {
    return document.getElementById(id);
}

/* =====================================
   PAGE NAV
===================================== */
function showPage(page, elBtn) {

    document.querySelectorAll(".menu-item")
        .forEach(x => x.classList.remove("active"));

    if (elBtn) elBtn.classList.add("active");

    document.querySelectorAll(".page")
        .forEach(x => x.classList.remove("active"));

    el(page).classList.add("active");

    el("title").innerText =
        page.charAt(0).toUpperCase() + page.slice(1);

    if (page === "reports") loadReports();
}

/* =====================================
   FETCH SAFE
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
   ADD
===================================== */
async function addRecord() {

    const data = {
        Year: el("year").value,
        Month: el("month").value,
        Consumption: el("consumption").value,
        Bill: el("bill").value
    };

    await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify(data)
    });

    refreshAll();
}

/* =====================================
   UPLOAD
===================================== */
async function uploadFile() {

    const file = el("file").files[0];
    if (!file) return alert("Select file first.");

    const form = new FormData();
    form.append("file", file);

    await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: form
    });

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
   ANOMALY FIXED (REAL DETECTION)
   - detects spike vs average
===================================== */
async function loadAnomaly() {

    const d = await safeFetch(`${BASE_URL}/api/anomaly`);
    if (!d) return;

    const list = d || [];

    const values = list.map(x => +x.Consumption || 0);
    const avg = values.reduce((a,b)=>a+b,0) / (values.length || 1);

    // REAL anomaly rule (fixed)
    const bad = list.filter(x =>
        (+x.Consumption > avg * 1.5) // spike detection
    );

    el("anomaly").innerHTML =
        bad.length
        ? bad.map(a =>
            `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
          ).join("<br>")
        : "No anomalies";

    if (bad.length && !anomalyClosed) {

        const popup = el("anomalyPopup");
        const body = el("anomalyPopupBody");

        body.innerHTML = bad.map(a =>
            `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
        ).join("<br>");

        popup.style.display = "flex";
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
                    data: [...Array(d.history_actual.length-1).fill(null),
                        ...d.future_bill],
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
   MAINTENANCE FIXED (DATE BUG FIX)
===================================== */
async function setMaintenance() {

    const date = el("maintenanceDate").value;
    if (!date) return alert("Select date first");

    const target = new Date(date);
    target.setHours(0,0,0,0);

    const res = await fetch(`${BASE_URL}/api/maintenance`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ date })
    });

    const d = await res.json();

    el("nextMaintenance").innerText = d.next_maintenance;

    localStorage.setItem("maintenanceDate", date);

    maintenanceClosed = false;

    checkMaintenanceReminder();
}

/* =====================================
   MAINTENANCE POPUP FIXED
===================================== */
function checkMaintenanceReminder() {

    if (maintenanceClosed) return;

    const saved = localStorage.getItem("maintenanceDate");
    if (!saved) return;

    const today = new Date();
    today.setHours(0,0,0,0);

    const target = new Date(saved);
    target.setHours(0,0,0,0);

    const days = Math.ceil((target - today)/86400000);

    if (days > 10 || days < 0) return;

    el("maintenancePopup").style.display = "flex";

    el("popupIcon").innerText =
        days === 0 ? "🚨" : "⚠️";

    el("popupTitle").innerText =
        days === 0 ? "Maintenance Today" : "Upcoming Maintenance";

    el("popupText").innerText =
        days === 0
        ? "Today is maintenance day."
        : `Maintenance due in ${days} day(s).`;
}

/* =====================================
   CLOSE POPUPS FIXED
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
