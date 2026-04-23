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

    const ctx = document.getElementById("chart");

    if (!ctx) return;

    if (chartInstance) {
        chartInstance.destroy();
    }

    // If no enough records
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
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: "#170C79"
                        }
                    }
                }
            }
        });

        return;
    }

    const historyCount = d.history_actual.length;

    const actualData = [
        ...d.history_actual,
        null,
        null,
        null
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
            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {
                legend: {
                    labels: {
                        color: "#170C79",
                        font: {
                            size: 13,
                            weight: "bold"
                        }
                    }
                }
            },

            scales: {

                x: {
                    ticks: {
                        color: "#170C79"
                    },
                    grid: {
                        color: "rgba(23,12,121,0.06)"
                    }
                },

                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#170C79"
                    },
                    grid: {
                        color: "rgba(23,12,121,0.06)"
                    }
                }

            }
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
