async function getForecast() {

    const input = document.getElementById("inputData").value;

    let data;
    try {
        data = JSON.parse(input);
    } catch (e) {
        alert("Invalid JSON format!");
        return;
    }

    const response = await fetch("https://your-app.onrender.com/forecast", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ data: data })
    });

    const result = await response.json();

    if (result.error) {
        alert(result.error);
        return;
    }

    renderChart(result.forecast);
}

function renderChart(data) {

    const ctx = document.getElementById("chart").getContext("2d");

    new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map((_, i) => "Month " + (i + 1)),
            datasets: [{
                label: "Water Consumption Forecast",
                data: data,
                borderColor: "#3498db",
                fill: false
            }]
        }
    });
}
