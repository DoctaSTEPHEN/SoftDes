function parseCSV(text) {
    const rows = text.split("\n");
    const headers = rows[0].split(",");

    return rows.slice(1).map(row => {
        const values = row.split(",");
        let obj = {};
        headers.forEach((h, i) => {
            obj[h.trim()] = isNaN(values[i]) ? values[i] : Number(values[i]);
        });
        return obj;
    });
}

function sendData() {
    let data = [];

    const jsonInput = document.getElementById("jsonInput").value;
    const fileInput = document.getElementById("csvFile").files[0];
    const maintenanceMonth = document.getElementById("maintenanceMonth").value;

    if (fileInput) {
        const reader = new FileReader();
        reader.onload = function(e) {
            data = parseCSV(e.target.result);
            sendToBackend(data, maintenanceMonth);
        };
        reader.readAsText(fileInput);
    } else {
        try {
            data = JSON.parse(jsonInput).data;
            sendToBackend(data, maintenanceMonth);
        } catch (e) {
            alert("Invalid JSON");
        }
    }
}

function sendToBackend(data, maintenanceMonth) {
    fetch("/forecast", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            data: data,
            maintenance_month: maintenanceMonth
        })
    })
    .then(res => res.json())
    .then(res => {
        document.getElementById("result").textContent =
            JSON.stringify(res, null, 2);

        showChart(res.forecast);

        if (res.alerts.length > 0) {
            alert("⚠️ " + res.alerts.join("\n"));
        }

        if (res.maintenance.length > 0) {
            alert("🔧 " + res.maintenance.join("\n"));
        }
    });
}

function showChart(forecast) {
    const labels = forecast.map(f => f.Month + "/" + f.Year);
    const values = forecast.map(f => f.Consumption);

    new Chart(document.getElementById("chart"), {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Predicted Consumption",
                data: values
            }]
        }
    });
}
