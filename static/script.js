const BASE_URL = window.location.origin.includes("render.com") ? 
    "https://softdes-2.onrender.com" : 
    window.location.origin;

async function refreshAll() {
    console.log("🔄 Refreshing...");
    await loadDashboard();
    await loadForecast();
    await loadChart();
    await checkAnomaly();
}

function notify(msg) {
    // Better notification
    const notification = document.createElement("div");
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; 
        background: #4CAF50; color: white; padding: 15px; 
        border-radius: 5px; z-index: 1000; font-weight: bold;
    `;
    notification.textContent = msg;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

async function addRecord() {
    const data = {
        Year: parseInt(year.value),
        Month: parseInt(month.value),
        Consumption: parseFloat(consumption.value),
        Bill: parseFloat(bill.value)
    };

    if (!data.Year || !data.Month || !data.Consumption || !data.Bill) {
        notify("❌ Please fill all fields");
        return;
    }

    try {
        const res = await fetch("/api/add", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.error) {
            notify("❌ ERROR: " + result.error);
            return;
        }

        notify("✅ Record added!");
        refreshAll();
        clearInputs();
    } catch (e) {
        notify("❌ Network error");
    }
}

function clearInputs() {
    year.value = month.value = consumption.value = bill.value = "";
}

async function uploadFile(event) {
    const fileInput = document.getElementById("file");
    const file = fileInput.files[0];
    
    console.log("🚀 Upload clicked, file:", file?.name);
    
    if (!file) {
        notify("❌ Please select a file first");
        return;
    }

    // Show loading
    const button = event ? event.target : document.querySelector('button[onclick="uploadFile()"]');
    const originalText = button.innerHTML;
    button.innerHTML = "⏳ Uploading...";
    button.disabled = true;

    const formData = new FormData();
    formData.append("file", file);
    
    notify(`📤 Uploading ${file.name}...`);

    try {
        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        console.log("📊 Upload result:", data);

        if (data.error) {
            notify(`❌ ${data.error}`);
        } else {
            notify(`✅ Success! ${data.rows_added || data.rows} rows added`);
            
            // 🔥 CLEAR FILE INPUT - READY FOR NEXT UPLOAD
            fileInput.value = "";  // Reset file input
            console.log("🧹 File input cleared");
            
            // Auto refresh everything
            refreshAll();
        }
    } catch (error) {
        console.error("💥 Upload error:", error);
        notify(`❌ Network error: ${error.message}`);
    } finally {
        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
    }
}
async function loadDashboard() {
    try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();

        document.getElementById("total").innerText = data.total?.toFixed(1) || 0;
        document.getElementById("avg").innerText = data.avg?.toFixed(1) || 0;
        document.getElementById("bill_total").innerText = data.bill?.toFixed(1) || 0;
    } catch (e) {
        console.error("Dashboard error:", e);
    }
}

async function loadForecast() {
    try {
        const res = await fetch("/api/forecast");
        const data = await res.json();

        if (data.error) {
            document.getElementById("forecast").innerHTML = 
                `<span style="color: orange;">${data.error}</span>`;
            return;
        }

        document.getElementById("forecast").innerHTML = `
            <h4>Next 3 Months</h4>
            <b>${data.future_3_months.map(v => v.toFixed(1)).join(" → ")} m³</b>
        `;
    } catch (e) {
        document.getElementById("forecast").innerHTML = "Loading...";
    }
}

let chartInstance;
async function loadChart() {
    try {
        const res = await fetch("/api/forecast");
        const data = await res.json();

        if (data.error || !data.history_actual.length) {
            return;
        }

        const ctx = document.getElementById("chart").getContext("2d");
        if (chartInstance) chartInstance.destroy();

        const totalPoints = data.history_actual.length + 3;
        const labels = Array.from({length: totalPoints}, (_, i) => 
            i < data.history_actual.length ? 
            `M${i+1}` : `F${i - data.history_actual.length + 1}`
        );

        chartInstance = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [
                    {
                        label: "Actual",
                        data: [...data.history_actual, null, null, null],
                        borderColor: "#2196F3",
                        backgroundColor: "#2196F3",
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: "Model Fit",
                        data: [...data.history_predicted, null, null, null],
                        borderColor: "#4CAF50",
                        backgroundColor: "#4CAF50",
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: "Forecast",
                        data: [null, null, null, ...data.future_3_months],
                        borderColor: "#FF5722",
                        backgroundColor: "#FF5722",
                        tension: 0.4,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    } catch (e) {
        console.error("Chart error:", e);
    }
}

async function checkAnomaly() {
    try {
        const res = await fetch("/api/anomaly");
        const data = await res.json();

        const anomalies = data.filter(d => d.status === "ANOMALY");
        
        if (anomalies.length === 0) {
            document.getElementById("anomaly").innerHTML = 
                '<span style="color: green;">✅ No anomalies</span>';
        } else {
            document.getElementById("anomaly").innerHTML = 
                anomalies.map(a => `⚠️ ${a.Year}-${a.Month.toString().padStart(2,'0')}: ${a.Consumption.toFixed(1)}m³`)
                         .join("<br>");
        }
    } catch (e) {
        document.getElementById("anomaly").innerHTML = "Loading...";
    }
}

// Auto refresh every 30 seconds
setInterval(refreshAll, 30000);

window.onload = () => {
    refreshAll();
    setTimeout(refreshAll, 2000); // Double check after load
};
