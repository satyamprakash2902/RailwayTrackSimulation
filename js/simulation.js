// Simulation constants
const TRACK_LENGTH = 5000; // 5km in meters
const NUM_SENSORS = 50;
const SENSORS_PER_BLOCK = 10; // 5 blocks of 1km, 10 sensors each
const UAV_SPEED = 50; // m/s (180 km/h)
const POLL_INTERVAL = 10; // seconds
const LATENCY_MIN = 1000; // ms
const LATENCY_MAX = 5000; // ms
const PACKET_LOSS_RATE = 0.05; // 5%
const FAULT_PROBABILITY = 0.1; // 10% per minute per sensor

// State variables
let simTime = 0;
let isRunning = false;
let sensors = [];
let uavPosition = 0;
let uavBattery = 100;
let alerts = [];
let repairCrews = [];
let map, trackLayer, sensorMarkers = [], uavMarker, heatmapChart;

// Initialize sensors
function initSensors() {
    sensors = [];
    for (let i = 0; i < NUM_SENSORS; i++) {
        const block = Math.floor(i / SENSORS_PER_BLOCK);
        const isDominant = (i % SENSORS_PER_BLOCK) === 0;
        sensors.push({
            id: i,
            position: i * 100,
            block,
            dominant: isDominant,
            reliability: isDominant ? 0.95 : Math.random() * 0.8 + 0.2,
            data: { temp: 20 + Math.random() * 10, vib: Math.random() * 5 },
            fault: null,
            lastPoll: 0
        });
    }
}

// Simulate noise and environmental effects
function addNoise(value, noiseLevel = 0.1) {
    return value + (Math.random() - 0.5) * noiseLevel * value;
}

// UAV polling
function pollSensors() {
    sensors.forEach(sensor => {
        if (Math.random() > PACKET_LOSS_RATE) {
            setTimeout(() => {
                sensor.data.temp = addNoise(sensor.data.temp);
                sensor.data.vib = addNoise(sensor.data.vib);
                sensor.lastPoll = simTime;
                checkForFaults(sensor);
            }, Math.random() * (LATENCY_MAX - LATENCY_MIN) + LATENCY_MIN);
        }
    });
}

// Fault detection
function checkForFaults(sensor) {
    if (sensor.fault) return;
    const faultChance = FAULT_PROBABILITY / 60; // per second
    if (Math.random() < faultChance) {
        const severity = Math.random() < 0.5 ? 'low' : Math.random() < 0.8 ? 'medium' : 'high';
        sensor.fault = { type: 'vibration', severity, time: simTime };
        alerts.push({ sensor: sensor.id, message: `Fault detected at sensor ${sensor.id}: ${severity} severity`, time: simTime });
        dispatchRepair(sensor);
        updateAlerts();
    }
}

// Dispatch repair crew
function dispatchRepair(sensor) {
    const eta = Math.random() * 30 + 10; // 10-40 minutes
    repairCrews.push({ sensor: sensor.id, eta: simTime + eta * 60, dispatched: simTime });
}

// Update UI
function updateUI() {
    // Time
    document.getElementById('timeDisplay').textContent = `Sim Time: ${Math.floor(simTime / 60)}:${(simTime % 60).toFixed(0).padStart(2, '0')}`;

    // Sensors
    const sensorList = document.getElementById('sensorList');
    sensorList.innerHTML = sensors.map(s => 
        `<div class="sensor ${s.fault ? 'fault' : ''}">Sensor ${s.id} (${s.dominant ? 'Dominant' : 'Supporting'}): Temp: ${s.data.temp.toFixed(1)}°C, Vib: ${s.data.vib.toFixed(2)}, Reliability: ${(s.reliability * 100).toFixed(0)}%</div>`
    ).join('');

    // UAV
    document.getElementById('uavTelemetry').innerHTML = `
        Position: ${uavPosition.toFixed(0)}m<br>
        Speed: ${UAV_SPEED}m/s<br>
        Battery: ${uavBattery.toFixed(1)}%<br>
        Wind Effect: ${addNoise(0, 0.2).toFixed(2)}m/s
    `;

    // Alerts
    updateAlerts();

    // Heatmap
    updateHeatmap();
}

function updateAlerts() {
    const alertsDiv = document.getElementById('alerts');
    alertsDiv.innerHTML = alerts.slice(-5).map(a => `<div class="alert">${a.message} at ${Math.floor(a.time / 60)}:${(a.time % 60).toFixed(0).padStart(2, '0')}</div>`).join('');
}

function updateHeatmap() {
    const ctx = document.getElementById('heatmapCanvas').getContext('2d');
    const data = sensors.map(s => s.fault ? 100 : (1 - s.reliability) * 100);
    if (heatmapChart) heatmapChart.destroy();
    heatmapChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sensors.map((_, i) => `${i * 100}m`),
            datasets: [{
                label: 'Fault Risk (%)',
                data,
                borderColor: 'red',
                fill: false
            }]
        }
    });
}

// Map initialization
function initMap() {
    map = L.map('map').setView([0, 0], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Track
    const trackPoints = [];
    for (let i = 0; i <= TRACK_LENGTH; i += 100) {
        trackPoints.push([0, i / 1000]); // Lat 0, Lon in km
    }
    trackLayer = L.polyline(trackPoints, { color: 'blue' }).addTo(map);

    // Sensors
    sensorMarkers = sensors.map(s => {
        const marker = L.marker([0, s.position / 1000]).addTo(map);
        marker.bindPopup(`Sensor ${s.id}`);
        return marker;
    });

    // UAV
    uavMarker = L.marker([0, 0]).addTo(map);
    uavMarker.bindPopup('UAV');
}

// Simulation loop
function simulationStep() {
    if (!isRunning) return;
    simTime += 1;
    uavPosition = (uavPosition + UAV_SPEED) % TRACK_LENGTH;
    uavBattery = Math.max(0, uavBattery - 0.01); // Drain battery
    uavMarker.setLatLng([0, uavPosition / 1000]);

    if (simTime % POLL_INTERVAL === 0) pollSensors();

    // Check repairs
    repairCrews = repairCrews.filter(crew => {
        if (simTime >= crew.eta) {
            sensors[crew.sensor].fault = null;
            alerts.push({ sensor: crew.sensor, message: `Repair completed for sensor ${crew.sensor}`, time: simTime });
            return false;
        }
        return true;
    });

    updateUI();
    setTimeout(simulationStep, 1000); // 1 second real time
}

// Event listeners
document.getElementById('startBtn').addEventListener('click', () => {
    if (!isRunning) {
        isRunning = true;
        simulationStep();
    }
});
document.getElementById('stopBtn').addEventListener('click', () => isRunning = false);
document.getElementById('resetBtn').addEventListener('click', () => {
    simTime = 0; uavPosition = 0; uavBattery = 100; alerts = []; repairCrews = [];
    initSensors(); initMap(); updateUI();
});
document.getElementById('injectFaultBtn').addEventListener('click', () => {
    const sensor = sensors[Math.floor(Math.random() * NUM_SENSORS)];
    sensor.fault = { type: 'manual', severity: 'high', time: simTime };
    alerts.push({ sensor: sensor.id, message: `Manual fault injected at sensor ${sensor.id}`, time: simTime });
    dispatchRepair(sensor);
});

// Initialize
initSensors();
initMap();
updateUI();