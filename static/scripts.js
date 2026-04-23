const BASE_URL = window.location.origin;
let chartInstance = null;

// PAGE
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

// FETCH
async function safeFetch(url) {
    try {
        const r = await fetch(url);
        return await r.json();
    } catch {
        return null;
    }
}

// ADD
async function addRecord() {

    const data = {
        Year: +year.value,
        Month: +month.value,
        Consumption: +consumption.value,
        Bill: +bill.value
    };

    await fetch(`${BASE_URL}/api/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    refreshAll();
}

// RESET
async function resetData() {

    if (!confirm("Delete all records?")) return;

    await fetch(`${BASE_URL}/api/reset`, {
        method: "POST"
    });

    refreshAll();
}

// DELETE ENTRY
async function deleteRow(index) {

    await fetch(`${BASE_URL}/api/delete/${index}`, {
        method: "POST"
    });

    loadReports();
    refreshAll();
}

// EDIT ENTRY
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

    loadReports();
    refreshAll();
}

// REPORTS
async function loadReports() {

    const data = await safeFetch(`${BASE_URL}/api/data`);
    const table = document.getElementById("reportTable");

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
            <td class="actions">

                <i class="fa-solid fa-pen edit-btn"
                onclick="editRow(${i},
                '${d.Year}',
                '${d.Month}',
                '${d.Consumption}',
                '${d.Bill}')"></i>

                <i class="fa-solid fa-trash delete-btn"
                onclick="deleteRow(${i})"></i>

            </td>
        </tr>`;
    });
}

// DASHBOARD
async function loadDashboard() {

    const d = await safeFetch(`${BASE_URL}/api/dashboard`);
    if (!d) return;

    total.innerText = d.total.toFixed(1);
    avg.innerText = d.avg.toFixed(1);
    bill_total.innerText = d.bill.toFixed(1);
}

// FORECAST
async function loadForecast() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);

    if (!d || d.error) {
        forecast.innerText = "Need 3 records";
        return;
    }

    forecast.innerText =
        d.future_bill.map(x => "₱" + x.toFixed(2)).join(" → ");
}

// ANOMALY
async function loadAnomaly() {

    const d = await safeFetch(`${BASE_URL}/api/anomaly`);
    if (!d) return;

    const bad = d.filter(x => x.status === "ANOMALY");

    anomaly.innerHTML = bad.length ?
        bad.map(a => `⚠ ${a.Year}-${a.Month}: ${a.Consumption}`).join("<br>")
        : "No anomalies";
}

// CHART
async function loadChart() {

    const d = await safeFetch(`${BASE_URL}/api/forecast`);
    if (!d || d.error) return;

    const ctx = document.getElementById("chart");

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: d.labels,
            datasets: [
                {
                    label: "Bill",
                    data: [...d.history_actual, null, null, null]
                },
                {
                    label: "Forecast",
                    data: [
                        ...Array(d.history_actual.length).fill(null),
                        ...d.future_bill
                    ],
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// REFRESH
async function refreshAll() {

    await Promise.all([
        loadDashboard(),
        loadForecast(),
        loadAnomaly(),
        loadChart(),
        loadReports()
    ]);
}

window.onload = refreshAll;
