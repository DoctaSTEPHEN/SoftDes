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
