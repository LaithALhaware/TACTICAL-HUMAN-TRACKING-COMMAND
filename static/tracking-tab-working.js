// tracking-tab-working.js
export class TrackingTab {
  constructor(container) {
    this.container = container;
    this.heatGridSize = 20;
    this.peopleMeshes = [];
    this.heatCells = [];
    this.currentRoom = "room1";
    this.lastPeoplePositions = [];
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.infoPanel = null;
    this.tooltip = null;
    this._fetchTimer = null;
  }

  async init() {
    await this._loadThree();
    await this._loadControls();
    this._buildDOM();
    this._initScene();
    this._initHeatmap();
    this._setupControls();
    this._setupEvents();
    this._fetchData();
    this._animate();
  }

  async _loadThree() {
    if (window.THREE) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async _loadControls() {
    if (THREE.OrbitControls) return;
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  _buildDOM() {
    this.container.style.position = "relative";
    this.container.style.width = "100%";
    this.container.style.height = "100vh";

    this.tooltip = document.createElement("div");
    Object.assign(this.tooltip.style, {
      position: "absolute",
      padding: "4px 8px",
      background: "rgba(0,0,0,0.8)",
      color: "#fff",
      fontFamily: "Arial",
      fontSize: "12px",
      pointerEvents: "none",
      display: "none",
      zIndex: 10,
    });
    this.container.appendChild(this.tooltip);

    this.infoPanel = document.createElement("div");
    Object.assign(this.infoPanel.style, {
      position: "absolute",
      top: "10px",
      left: "10px",
      padding: "8px 12px",
      background: "rgba(0,0,0,0.5)",
      color: "#00ffcc",
      fontFamily: "Arial",
      fontSize: "14px",
      whiteSpace: "pre",
      pointerEvents: "none",
      zIndex: 10,
    });
    this.container.appendChild(this.infoPanel);
  }

  _initScene() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    this.camera.position.set(10, 15, 20);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    this.scene.add(dirLight);
  }

  _initHeatmap() {
    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x002d20,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });

    for (let i = 0; i < this.heatGridSize; i++) {
      this.heatCells[i] = [];
      for (let j = 0; j < this.heatGridSize; j++) {
        const cell = new THREE.Mesh(planeGeometry, planeMaterial.clone());
        cell.rotation.x = -Math.PI / 2;
        cell.position.set(i - this.heatGridSize / 2 + 0.5, 0.01, j - this.heatGridSize / 2 + 0.5);
        cell.userData.intensity = 0;
        this.scene.add(cell);
        this.heatCells[i][j] = cell;
      }
    }

    const grid = new THREE.GridHelper(20, 20, 0x00ffff, 0x004444);
    this.scene.add(grid);
  }

  _setupControls() {
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _setupEvents() {
    window.addEventListener("mousemove", e => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener("resize", () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  _animate = () => {
    requestAnimationFrame(this._animate);

    // Fade heatmap
    this.heatCells.flat().forEach(cell => {
      cell.userData.intensity = THREE.MathUtils.lerp(cell.userData.intensity, 0, 0.02);
      const c = new THREE.Color(cell.userData.intensity > 0.5 ? 0xff4500 : 0x002d20);
      cell.material.color.copy(c);
    });

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.heatCells.flat());
    if (intersects.length) {
      const cell = intersects[0].object;
      this.tooltip.style.display = "block";
      this.tooltip.style.left = (this.mouse.x * 0.5 + 0.5) * window.innerWidth + "px";
      this.tooltip.style.top = (-this.mouse.y * 0.5 + 0.5) * window.innerHeight + "px";
      this.tooltip.innerText = `Heat: ${cell.userData.intensity.toFixed(2)}`;
    } else this.tooltip.style.display = "none";

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._updateInfoPanel();
  };

  _updateInfoPanel() {
    const num = this.peopleMeshes.length;
    this.infoPanel.innerText = `Detections: ${num}`;
  }

  _fetchData() {
    // TEMP: generate random data for testing
    const last = { people: [] };
    for (let i = 0; i < 3; i++) last.people.push([Math.random() * 10, Math.random() * 10]);

    // Update scene
    this.peopleMeshes.forEach(p => { this.scene.remove(p); });
    this.peopleMeshes = [];

    last.people.forEach(pos => {
      let gx = Math.floor(pos[0] * this.heatGridSize / 10);
      let gy = Math.floor(pos[1] * this.heatGridSize / 10);
      gx = Math.max(0, Math.min(this.heatGridSize - 1, gx));
      gy = Math.max(0, Math.min(this.heatGridSize - 1, gy));
      const cell = this.heatCells[gx][gy];
      cell.userData.intensity = 1.0;
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: 0x00ffff }));
      sphere.userData.targetPos = new THREE.Vector3(cell.position.x, 0.25, cell.position.z);
      sphere.userData.heatCell = cell;
      this.peopleMeshes.push(sphere);
      this.scene.add(sphere);
    });

    this._fetchTimer = setTimeout(() => this._fetchData(), 1000);
  }

  dispose() {
    clearTimeout(this._fetchTimer);
    this.peopleMeshes.forEach(p => this.scene.remove(p));
    this.container.innerHTML = "";
  }
}