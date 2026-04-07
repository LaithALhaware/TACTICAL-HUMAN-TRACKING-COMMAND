let scene, camera, renderer, controls;
let peopleMeshes = [];
let currentRoom = "room1";
let heatCells = [];
let heatGridSize = 20;

let chartScene, chartCamera;
let chartMesh;

let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let tooltip = document.createElement("div");
tooltip.style.position = "absolute";
tooltip.style.padding = "4px 8px";
tooltip.style.background = "rgba(0,0,0)";
tooltip.style.color = "#fff";
tooltip.style.fontFamily = "Arial";
tooltip.style.fontSize = "12px";
tooltip.style.pointerEvents = "none";
tooltip.style.display = "none";
document.getElementById("3d-view").appendChild(tooltip);

// Info panel INSIDE the 3D view
let infoPanel = document.createElement("div");
infoPanel.style.top = "10px";
infoPanel.style.left = "10px";
infoPanel.style.padding = "8px 12px";
infoPanel.style.background = "rgba(0,0,0)";
infoPanel.style.color = "#00ffcc";
infoPanel.style.fontFamily = "Arial";
infoPanel.style.fontSize = "14px";
infoPanel.style.whiteSpace = "pre";
infoPanel.style.pointerEvents = "none";


let vitalSigns = {
    breathingRate: 0,
    breathingConfidence: 0,
    heartRate: 0,
    heartbeatConfidence: 0,
    signalQuality: 0
};


// Append infoPanel INSIDE the 3D view container
document.getElementById("3d-view").appendChild(infoPanel);

let lastPeoplePositions = [];

init();
init3DChart();
animate();
fetchData();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // black

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 15, 20);
    camera.lookAt(0, 0, 0);



const container = document.getElementById("3d-view");
renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, window.innerHeight - 60);
renderer.setClearColor(0x000000, 1);
container.appendChild(renderer.domElement);


renderer.setClearColor(0x000000, 1); // black background
document.getElementById("3d-view").appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0);
    controls.update();

    const grid = new THREE.GridHelper(20, 20, 0x00ffff, 0x004444);
    scene.add(grid);

    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x002d20, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });

    for (let i = 0; i < heatGridSize; i++) {
        heatCells[i] = [];
        for (let j = 0; j < heatGridSize; j++) {
            let cell = new THREE.Mesh(planeGeometry, planeMaterial.clone());
            cell.rotation.x = -Math.PI / 2;
            cell.position.set(i - heatGridSize / 2 + 0.5, 0.01, j - heatGridSize / 2 + 0.5);
            cell.userData.intensity = 0;
            scene.add(cell);
            heatCells[i][j] = cell;
        }
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);


    window.addEventListener("mousemove", (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });
}








// Add this after you create the heat cells
function addHeightBorder() {
    const borderHeight = 5; // height of the border
    const size = heatGridSize; // assuming your grid is square
    const halfSize = size / 2;

    const borderGeometry = new THREE.BufferGeometry();
    const vertices = [];

    // four vertical lines (corners)
    vertices.push(-halfSize , 0, -halfSize); // bottom
    vertices.push(-halfSize , borderHeight, -halfSize); // top

    vertices.push(halfSize , 0, -halfSize );
    vertices.push(halfSize , borderHeight, -halfSize);

    vertices.push(halfSize , 0, halfSize );
    vertices.push(halfSize , borderHeight, halfSize);

    vertices.push(-halfSize , 0, halfSize );
    vertices.push(-halfSize , borderHeight, halfSize);

    // horizontal lines at top
    vertices.push(-halfSize , borderHeight, -halfSize);
    vertices.push(halfSize , borderHeight, -halfSize);

    vertices.push(halfSize , borderHeight, -halfSize);
    vertices.push(halfSize , borderHeight, halfSize);

    vertices.push(halfSize , borderHeight, halfSize);
    vertices.push(-halfSize , borderHeight, halfSize);

    vertices.push(-halfSize, borderHeight, halfSize);
    vertices.push(-halfSize, borderHeight, -halfSize);

    borderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x004422 });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);

    scene.add(border);
}

// Call this after creating heatCells
addHeightBorder();



function init3DChart() {
    chartScene = new THREE.Scene();
    chartScene.background = new THREE.Color(0x000000);
    chartCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    chartCamera.position.set(5, 5, 5);
    chartCamera.lookAt(0, 0, 0);



    const grid = new THREE.GridHelper(5, 10, 0x00ff9d, 0x004422);
    chartScene.add(grid);

    animateChart();
}

function animateChart() {
    requestAnimationFrame(animateChart);
}

function animate() {
    requestAnimationFrame(animate);

    heatCells.forEach(row => {
        row.forEach(cell => {
            cell.userData.intensity = THREE.MathUtils.lerp(cell.userData.intensity, 0, 0.02);
            const intensity = cell.userData.intensity;
            const c = new THREE.Color();
            if (intensity > 0.75) c.set(0xff4500);
            else if (intensity > 0.5) c.set(0xffff00);
            else if (intensity > 0.2) c.set(0x00ff00);
            else c.set(0x002d20);
            cell.material.color.copy(c);
        });
    });

    peopleMeshes.forEach(p => {
        if (p.userData.targetPos) {
            const cell = p.userData.heatCell;
            const height = 0.25 + 0.5 * (cell ? cell.userData.intensity : 0);
            const target = new THREE.Vector3(p.userData.targetPos.x, height, p.userData.targetPos.z);
            p.position.lerp(target, 0.1);
        }
    });

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(heatCells.flat());
    if (intersects.length > 0) {
        const cell = intersects[0].object;
        tooltip.style.display = "block";
        tooltip.style.left = (mouse.x * 0.5 + 0.5) * window.innerWidth + "px";
        tooltip.style.top = (-mouse.y * 0.5 + 0.5) * window.innerHeight + "px";
        tooltip.innerText = "Heat: " + cell.userData.intensity.toFixed(2);
    } else tooltip.style.display = "none";

    controls.update();
    renderer.render(scene, camera);
    updateInfoPanel();
}

function updateInfoPanel() {
    let numDetections = peopleMeshes.length;
    let avgSpeed = 0;
    let positions = peopleMeshes.map(p => `(${p.position.x.toFixed(1)}, ${p.position.z.toFixed(1)})`);

    if (lastPeoplePositions.length === peopleMeshes.length) {
        let total = 0;
        for (let i = 0; i < peopleMeshes.length; i++) {
            total += peopleMeshes[i].position.distanceTo(lastPeoplePositions[i]);
        }
        avgSpeed = total.toFixed(2);
    }
    lastPeoplePositions = peopleMeshes.map(p => p.position.clone());

    // Get latest data
    const latest = window.latestTrackingData ? window.latestTrackingData[window.latestTrackingData.length - 1] : null;
    const sf = latest ? latest.signal_features : {};
    const vs = latest ? latest.vital_signs : {};

    // Helper to safely format numbers
    function formatNum(val) {
        return (val !== undefined && val !== null) ? val.toFixed(2) : "--";
    }
    infoPanel.innerText =
        `Detections: ${numDetections}\n` +
        `Speed: ${avgSpeed}\n` +
        `Positions: ${positions.join(", ")}\n\n`;



// Safe helper to format numbers with 2 decimals
function formatNum(val, isPercent = false) {
    if (val === undefined || val === null) return "--";
    return isPercent ? (val * 100).toFixed(2) + "%" : val.toFixed(2);
}

// Update the info panel / stats
document.getElementById('variance').innerText = `Variance: ${formatNum(sf.variance)}`;
document.getElementById('motion').innerText = `Motion Band: ${formatNum(sf.motion_band_power)}`;
document.getElementById('breathing').innerText = `Breathing Band: ${formatNum(sf.breathing_band_power)}`;
document.getElementById('spectral').innerText = `Spectral Power: ${formatNum(sf.spectral_power)}`;
document.getElementById('dominantFreq').innerText = `Dominant Freq: ${formatNum(sf.dominant_freq_hz)} Hz`;
document.getElementById('changePoints').innerText = `Change Points: ${formatNum(sf.change_points)}`;
document.getElementById('meanRssi').innerText = `Mean RSSI: ${formatNum(sf.mean_rssi)}`;

document.getElementById('heartRate').innerText = `Heart Rate: ${formatNum(vs.heart_rate_bpm)}`;
document.getElementById('breathingRate').innerText = `Breathing Rate: ${formatNum(vs.breathing_rate_bpm)}`;
document.getElementById('heartbeatConfidence').innerText = `Heartbeat Confidence: ${formatNum(vs.heartbeat_confidence, true)}`;
document.getElementById('breathingConfidence').innerText = `Breathing Confidence: ${formatNum(vs.breathing_confidence, true)}`;
document.getElementById('signalQuality').innerText = `Signal Quality: ${formatNum(vs.signal_quality, true)}`;
}

function fetchData() {
    fetch(`/tracking_data/${currentRoom}`)
        .then(r => r.json())
        .then(data => {
            if (!data) return;
            window.latestTrackingData = data; // store globally
            updateScene(data);
            updateChart(data);
            if (data.heatmap && data.room_size) updateHeatmap(data.heatmap, data.room_size);
        })
        .catch(err => console.error(err));

    setTimeout(fetchData, 100);
}

function updateScene(data) {
    let last = data[data.length - 1];
    if (!last) return;

    // If we don't have enough spheres, create more
    while (peopleMeshes.length < last.people.length) {
        let sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        peopleMeshes.push(sphere);
        scene.add(sphere);
    }

    // Remove extra spheres if we have too many
    while (peopleMeshes.length > last.people.length) {
        const p = peopleMeshes.pop();
        scene.remove(p);
        if (p.geometry) p.geometry.dispose();
        if (p.material) p.material.dispose();
    }

    // Update positions
    last.people.forEach((pos, i) => {
        let gx = Math.floor(pos[0] * heatGridSize / 10);
        let gy = Math.floor(pos[1] * heatGridSize / 10);
        gx = Math.max(0, Math.min(heatGridSize - 1, gx));
        gy = Math.max(0, Math.min(heatGridSize - 1, gy));

        const cell = heatCells[gx][gy];
        cell.userData.intensity = 1.0;

        const sphere = peopleMeshes[i];
        // Only update target position, actual movement handled in animate()
        sphere.userData.targetPos = new THREE.Vector3(cell.position.x, 0.25, cell.position.z);
        sphere.userData.heatCell = cell;
    });
}

function updateChart(data) {
    if (!data.history || data.history.length < 2) return;

    if (chartMesh) {
        chartScene.remove(chartMesh);
        if (chartMesh.geometry) chartMesh.geometry.dispose();
        if (chartMesh.material) chartMesh.material.dispose();
    }

    let speeds = [];
    for (let i = 1; i < data.history.length; i++) {
        let p1 = data.history[i].people[0];
        let p2 = data.history[i - 1].people[0];
        if (!p1 || !p2) continue;
        speeds.push(Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2));
    }

    const points = speeds.map((s, i) => new THREE.Vector3(i * 0.2, s * 5, 0));
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 50, 0.05, 8, false);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff9d });
    chartMesh = new THREE.Mesh(geometry, material);
    chartScene.add(chartMesh);
}

function saveSession() {
    fetch(`/save/${currentRoom}`);
}

function exportPDF() {
    window.location.href = `/export_pdf/${currentRoom}`;
}

function updateHeatmap(grid, roomSize) {
    if (!grid) return;

    const size = grid.length;
    const cellSize = roomSize / size;

    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            let cell = heatCells[i][j];
            cell.scale.set(cellSize, 0.1, cellSize);
            cell.position.set(
                i * cellSize - roomSize / 2 + cellSize / 2,
                0.01,
                j * cellSize - roomSize / 2 + cellSize / 2
            );
        }
    }
}






function setCameraView(view) {
 const offset = 20;
    let targetPos = { x: 10, y: 15, z: 20 }; // default
    let targetLook = { x: 0, y: 0, z: 0 };   // look at center

    switch(view) {
        case "top":
            targetPos = { x: 0, y: offset, z: 0.01 };
            break;
        case "left":
            targetPos = { x: -offset, y: 5, z: 0 };
            break;
        case "right":
            targetPos = { x: offset, y: 5, z: 0 };
            break;
        case "front":
            targetPos = { x: 0, y: 5, z: offset };
            break;
        case "default":
            targetPos = { x: 10, y: 15, z: 20 };
            break;
    }

    gsap.to(camera.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => { controls.update(); }
    });

    gsap.to(controls.target, {
        x: targetLook.x,
        y: targetLook.y,
        z: targetLook.z,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => { controls.update(); }
    });
}




// Function to fetch data and update the card
async function updateVitalSigns() {
    try {
        const response = await fetch('/proxy/vital-signs');
        const data = await response.json();

        document.getElementById('breathingRate').textContent = data.vital_signs.breathing_rate_bpm.toFixed(2);
        document.getElementById('breathingConfidence').textContent = (data.vital_signs.breathing_confidence * 100).toFixed(1) + '%';
        document.getElementById('heartRate').textContent = data.vital_signs.heart_rate_bpm.toFixed(2);
        document.getElementById('heartbeatConfidence').textContent = (data.vital_signs.heartbeat_confidence * 100).toFixed(1) + '%';
        document.getElementById('signalQuality').textContent = (data.vital_signs.signal_quality * 100).toFixed(1) + '%';
    } catch (error) {
        console.error('Error fetching vital signs:', error);
    }
}

// Refresh every 2 seconds
setInterval(updateVitalSigns, 100);
updateVitalSigns(); // initial call


