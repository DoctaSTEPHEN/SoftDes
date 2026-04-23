const BASE_URL = window.location.origin;
let chartInstance = null;

// =========================
// PAGE SWITCH
// =========================
function showPage(page, el) {

    document.querySelectorAll(".menu-item")
        .forEach(x => x.classList.remove("active"));

    if (el) el.classList.add("active");

    document.querySelectorAll(".page")
        .forEach(x => x.classList.remove("active"));

    const target = document.getElementById(page);
    if (target) target.classList.add("active");

    const title = document.getElementById("title");
    if (title) {
        title.innerText =
            page.charAt(0).toUpperCase() + page.slice(1);
    }

    if (page === "reports") loadReports();
}

// =========================
// SAFE FETCH
// =========================
async function safeFetch(url, options = {}) {
    try {
        const res = await fetch(url, options);
        return await res.json();
    } catch (err) {
        return null;
    }
}

// =========================
// ADD RECORD
// =========================
async function addRecord() {

    const data = {
        Year: document.getElementById("year").value,
        Month: document.getElementById("month").value,
        Consumption: document.getElementById("consumption").value,
        Bill: document.getElementById("bill").value
    };

    const res = await safeFetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    if (res && res.error) {
        alert(res.error);
        return;
    }

    refreshAll();
}

// =========================
// UPLOAD FILE
// =========================
async function uploadFile() {

    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];

    if (!file) {
        alert("Select file first");
        return;
    }

    const form = new FormData();
    form.append("file", file);

    const res = await safeFetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: form
    });

    if (!res) {
        alert("Upload failed");
        return;
    }

    if (res.error) {
        alert(res.error);
        return;
    }

    alert("Upload success");
    fileInput.value = "";

    refreshAll();
}

// =========================
// RESET
// =========================
async function resetData() {

    if (!confirm("Delete all records?")) return;

    await safeFetch(`${BASE_URL}/api/reset`, {
        method: "POST"
    });

    refreshAll();
}

// =========================
// DELETE
// =========================
async function deleteRow(index) {

    if (!confirm("Delete this record?")) return;

    await safeFetch(`${BASE_URL}/api/delete/${index}`, {
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

    await safeFetch(`${BASE_URL}/api/edit/${index}`, {
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

    if (!table) return;

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
            <td>${Number(d.Bill).toFixed(2)}</td>
            <td class="actions">
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

    const total = document.getElementById("total");
    const avg = document.getElementById("avg");
    const bill = document.getElementById("bill_total");

    if (total) total.innerText = Number(d.total).toFixed(1);
    if (avg) avg.innerText = Number(d.avg).toFixed(1);
    if (bill) bill.innerText = Number(d.bill).toFixed(1);

    loadSavedMaintenance();
}

// =========================
// FORECAST
// =========================
async function loadForecast() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);
    const el = document.getElementById("forecast");

    if (!el) return;

    if (!d || d.error) {
        el.innerText = "Need at least 3 records";
        return;
    }

    el.innerText =
        d.future_bill
            .map(x => "₱" + Number(x).toFixed(2))
            .join(" → ");
}

// =========================
// ANOMALY
// =========================
async function loadAnomaly() {

    const d = await safeFetch(`${BASE_URL}/api/anomaly`);
    const el = document.getElementById("anomaly");

    if (!el) return;

    if (!d) {
        el.innerText = "No anomalies";
        return;
    }

    const bad = d.filter(x => x.status === "ANOMALY");

    el.innerHTML = bad.length
        ? bad.map(a =>
            `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
        ).join("<br>")
        : "No anomalies";
}

// =========================
// CHART
// =========================
async function loadChart() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);
    const canvas = document.getElementById("chart");

    if (!canvas) return;

    if (chartInstance) chartInstance.destroy();

    if (!d || d.error) {

        chartInstance = new Chart(canvas, {
            type: "line",
            data: {
                labels: ["No Data"],
                datasets: [{
                    label: "Need 3 Records",
                    data: [0],
                    borderColor: "#170C79",
                    backgroundColor: "rgba(23,12,121,.15)",
                    tension: .35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        return;
    }

    chartInstance = new Chart(canvas, {
        type: "line",
        data: {
            labels: d.labels,
            datasets: [
                {
                    label: "Actual",
                    data: d.history_actual,
                    borderColor: "#170C79",
                    backgroundColor: "rgba(23,12,121,.12)",
                    fill: true,
                    tension: .35
                },
                {
                    label: "Forecast",
                    data: [
                        ...Array(d.history_actual.length).fill(null),
                        ...d.future_bill
                    ],
                    borderColor: "#56B6C6",
                    borderDash: [6, 6],
                    tension: .35,
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

// =========================
// MAINTENANCE UI
// =========================
function toggleCalendar() {

    const box = document.getElementById("calendarBox");
    if (!box) return;

    box.style.display =
        box.style.display === "block"
            ? "none"
            : "block";
}

// =========================
// SET MAINTENANCE DATE
// =========================
async function setMaintenance() {

    const input = document.getElementById("maintenanceDate");
    if (!input || !input.value) {
        alert("Select a date first");
        return;
    }

    const res = await safeFetch(`${BASE_URL}/api/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            date: input.value
        })
    });

    if (!res || res.error) {
        alert(res?.error || "Failed");
        return;
    }

    localStorage.setItem(
        "maintenanceDate",
        res.next_maintenance
    );

    loadSavedMaintenance();

    const box = document.getElementById("calendarBox");
    if (box) box.style.display = "none";

    checkMaintenanceReminder();
}

// =========================
// LOAD SAVED DATE
// =========================
function loadSavedMaintenance() {

    const txt = document.getElementById("nextMaintenance");
    if (!txt) return;

    const saved = localStorage.getItem("maintenanceDate");

    txt.innerText = saved || "Click Set Date";
}

// =========================
// POPUP CHECK
// =========================
function checkMaintenanceReminder() {

    const saved = localStorage.getItem("maintenanceDate");
    if (!saved) return;

    const popup = document.getElementById("maintenancePopup");
    const icon = document.getElementById("popupIcon");
    const title = document.getElementById("popupTitle");
    const text = document.getElementById("popupText");
    const card = popup?.querySelector(".popup-card");
    const okBtn = popup?.querySelector(".popup-btn");

    if (!popup || !icon || !title || !text || !card) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(saved);
    target.setHours(0, 0, 0, 0);

    const diff =
        Math.ceil((target - today) / 86400000);

    if (diff > 10 || diff < 0) {
        popup.style.display = "none";
        return;
    }

    popup.style.display = "flex";
    card.classList.remove("popup-lock");

    if (diff === 0) {

        icon.innerText = "🚨";
        title.innerText = "Maintenance Today";
        text.innerText =
            "Today is your maintenance schedule. This popup stays until you close it.";

        if (okBtn) okBtn.style.display = "none";

        card.classList.add("popup-lock");

    } else {

        icon.innerText = "⚠️";
        title.innerText = "Upcoming Maintenance";
        text.innerText =
            `Maintenance due in ${diff} day${diff > 1 ? "s" : ""}.`;

        if (okBtn) okBtn.style.display = "inline-block";
    }
}

// =========================
// CLOSE POPUP
// =========================
function closeMaintenancePopup() {

    const popup = document.getElementById("maintenancePopup");
    if (popup) popup.style.display = "none";
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
        loadReports()
    ]);

    checkMaintenanceReminder();
}

// =========================
// INIT
// =========================
window.onload = async function () {
    await refreshAll();
};

// expose to HTML
window.showPage = showPage;
window.addRecord = addRecord;
window.uploadFile = uploadFile;
window.resetData = resetData;
window.deleteRow = deleteRow;
window.editRow = editRow;
window.toggleCalendar = toggleCalendar;
window.setMaintenance = setMaintenance;
window.closeMaintenancePopup = closeMaintenancePopup;
