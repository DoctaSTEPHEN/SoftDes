const BASE_URL = window.location.origin;
let chartInstance = null;

/* =====================================
   POPUP FLAGS (session only)
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
   FETCH
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
   DELETE SINGLE RECORD
===================================== */
async function deleteRow(index) {

    if (!confirm("Delete this record?")) return;

    const res = await fetch(
        `${BASE_URL}/api/delete/${index}`,
        { method: "POST" }
    );

    const d = await res.json();

    if (d.error) {
        alert(d.error);
        return;
    }

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

    table.innerHTML = "";

    if (!data || data.length === 0) {
        table.innerHTML =
        `<tr>
            <td colspan="5">No records</td>
        </tr>`;
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
                '${d.Year}',
                '${d.Month}',
                '${d.Consumption}',
                '${d.Bill}')">✏️</button>

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
   FORECAST
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
   ANOMALY DETECT + POPUP
===================================== */
async function loadAnomaly() {

    const d = await safeFetch(`${BASE_URL}/api/anomaly`);

    if (!d) return;

    const bad = d.filter(x =>
        x.status === "ANOMALY"
    );

    anomaly.innerHTML = bad.length
        ? bad.map(a =>
          `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
          ).join("<br>")
        : "No anomalies";

    // popup immediately if anomaly exists
    if (bad.length && !anomalyClosed) {

        const popup =
            document.getElementById("anomalyPopup");

        const body =
            document.getElementById("anomalyPopupBody");

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
    const ctx = document.getElementById("chart");

    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();

    if (!d || d.error) return;

    const actual = [
        ...d.history_actual,
        null, null, null
    ];

    const predicted = [
        ...Array(d.history_actual.length - 1).fill(null),
        d.history_actual[d.history_actual.length - 1],
        ...d.future_bill
    ];

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: d.labels,
            datasets: [
                {
                    label: "Actual Bill",
                    data: actual,
                    borderColor: "#170C79",
                    borderWidth: 3,
                    fill: false,
                    tension: 0.35
                },
                {
                    label: "Predicted Bill",
                    data: predicted,
                    borderColor: "#56B6C6",
                    borderDash: [7,5],
                    borderWidth: 3,
                    fill: false,
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
   MAINTENANCE DATE
===================================== */
async function setMaintenance() {

    const date =
        document.getElementById("maintenanceDate").value;

    if (!date) {
        alert("Select date first");
        return;
    }

    const res = await fetch(
        `${BASE_URL}/api/maintenance`,
        {
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify({ date })
        }
    );

    const d = await res.json();

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
        Math.ceil((target - today)/86400000);

    if (days > 10 || days < 0) return;

    const popup =
        document.getElementById("maintenancePopup");

    popup.style.display = "flex";

    popupIcon.innerText =
        days === 0 ? "🚨" : "⚠️";

    popupTitle.innerText =
        days === 0 ?
        "Maintenance Today" :
        "Upcoming Maintenance";

    popupText.innerText =
        days === 0 ?
        "Today is maintenance day." :
        `Maintenance due in ${days} day(s).`;
}

/* =====================================
   CLOSE POPUPS
===================================== */
function closeMaintenancePopup() {
    maintenancePopup.style.display = "none";
    maintenanceClosed = true;
}

function closeAnomalyPopup() {
    anomalyPopup.style.display = "none";
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
