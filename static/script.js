async function getForecast() {

    let input = document.getElementById("inputData").value;

    let data = JSON.parse(input);

    const res = await fetch("/forecast", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ data: data })
    });

    const result = await res.json();

    drawChart(result.forecast);
}

function drawChart(data) {

    const ctx = document.getElementById("chart").getContext("2d");

    new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map((_, i) => "Month " + (i+1)),
            datasets: [{
                label: "Forecast",
                data: data
            }]
        }
    });
}

function sendData() {
    let input;

    try {
        input = JSON.parse(document.getElementById("inputData").value);
    } catch (e) {
        alert("Invalid JSON format");
        return;
    }

    fetch("/forecast", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("result").textContent =
            JSON.stringify(data, null, 2);

        // ALERTS
        if (data.alerts && data.alerts.length > 0) {
            alert("⚠️ Alerts:\n" + data.alerts.join("\n"));
        }

        if (data.maintenance && data.maintenance.length > 0) {
            alert("🔧 Maintenance:\n" + data.maintenance.join("\n"));
        }
    })
    .catch(err => {
        document.getElementById("result").textContent = err;
    });
}
