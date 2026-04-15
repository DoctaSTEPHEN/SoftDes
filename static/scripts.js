const BASE_URL = window.location.origin;

// =============================
// NOTIFY SYSTEM
// =============================
function notify(msg, type = "success") {
    const div = document.createElement("div");

    div.innerText = msg;
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === "error" ? "#e74c3c" : "#2ecc71"};
        color: white;
        padding: 12px;
        border-radius: 8px;
        z-index: 9999;
    `;

    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2500);
}

// =============================
// ADD (ERROR HANDLING)
// =============================
window.addRecord = async function () {
    const data = {
        Year: +year.value,
        Month: +month.value,
        Consumption: +consumption.value,
        Bill: +bill.value
    };

    if (Object.values(data).some(v => !v)) {
        return notify("Missing entry value", "error");
    }

    const res = await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    const d = await res.json();

    if (d.error) return notify(d.error, "error");

    notify("Added");
    refreshAll();
};

// =============================
// UPLOAD (ERROR HANDLING)
// =============================
window.uploadFile = async function () {
    const file = document.getElementById("file").files[0];

    if (!file) return notify("Missing file upload", "error");

    const allowed = ["csv", "json"];
    const ext = file.name.split(".").pop();

    if (!allowed.includes(ext)) {
        return notify("Unsupported file upload", "error");
    }

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${BASE_URL}/api/upload`, {
        method: "POST",
        body: form
    });

    const d = await res.json();

    if (d.error) return notify(d.error, "error");

    notify("Upload success");
    refreshAll();
};

// =============================
// ANOMALY ALERT POPUP
// =============================
async function checkAnomaly() {
    const res = await fetch(`${BASE_URL}/api/anomaly`);
    const d = await res.json();

    const anomalies = d.filter(x => x.status === "ANOMALY");

    const el = document.getElementById("anomaly");

    if (!anomalies.length) {
        el.innerHTML = "No anomalies";
        return;
    }

    el.innerHTML = anomalies.map(a =>
        `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`
    ).join("<br>");

    // POPUP ALERT
    notify("⚠ Anomaly detected!", "error");
}

// =============================
// MAINTENANCE INPUT
// =============================
window.checkMaintenance = async function () {
    const date = document.getElementById("maintenanceDate").value;

    if (!date) return notify("Enter maintenance date", "error");

    const res = await fetch(`${BASE_URL}/api/maintenance`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ date })
    });

    const d = await res.json();

    if (d.error) return notify(d.error, "error");

    notify("Next maintenance: " + d.next_maintenance);
};

// =============================
// GLOBAL REFRESH
// =============================
async function refreshAll() {
    await Promise.all([
        loadDashboard(),
        loadForecast(),
        loadChart(),
        checkAnomaly(),
        loadReports()
    ]);
}

window.onload = refreshAll;
