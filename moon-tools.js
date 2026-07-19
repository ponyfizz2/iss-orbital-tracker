/* =========================
   MOON INTERACTION TOOLS
   ========================= */

let moonToolsMode = 'pan'; // pan, distance, crater
let moonToolPoints = [];
let moonToolVisuals = new THREE.Group();
// Lunar annotations must never inherit Three.js's default visible state while
// Earth is active. View switching is the single owner of this group's state.
moonToolVisuals.visible = false;
const MOON_RADIUS_KM = 1737.4;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const SURFACE_INSPECTOR_SOURCES = {
    moon: {
        title: 'Moon · LROC natural colour', detail: 'Global 4096×2048 overview · wheel to request higher-resolution imagery', src: 'assets/moon-natural-lroc-4k.jpg?v=1',
        service: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv', map: '/maps/earth/moon_simp_cyl.map', layer: 'LROC_WAC', label: 'USGS LROC WAC',
    },
    mars: {
        title: 'Mars · MOLA elevation', detail: 'Global 4096×2048 overview · wheel to request higher-resolution imagery', src: 'assets/mars-elevation-mola-4k.jpg?v=1',
        service: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv', map: '/maps/mars/mars_simp_cyl.map', layer: 'THEMIS_controlled', label: 'USGS THEMIS controlled mosaic',
    },
};
let surfaceInspectorState = { zoom: 1, lon: 0, lat: 0, x: 0, y: 0, drag: null, body: null };

function initMoonTools() {
    earthGroup.add(moonToolVisuals);

    // Create toolbar UI
    const toolbar = document.createElement('div');
    toolbar.id = 'moon-toolbar';
    toolbar.className = 'moon-toolbar hidden';
    toolbar.innerHTML = `
        <div class="mt-label">MOON TOOLS</div>
        <button class="mt-btn surface-layer-btn active" data-moon-layer="natural" title="NASA LROC natural-colour mosaic, 4096 × 2048 pixels">Natural 4K</button>
        <button class="mt-btn surface-layer-btn" data-moon-layer="topography" title="USGS GLD100 colour-shaded topography">Topography</button>
        <button class="mt-btn surface-layer-btn" data-moon-layer="geology" title="USGS Unified Geologic Map of the Moon">Geology</button>
        <button class="mt-btn" data-surface-inspect="moon">🔎 Inspect 4K</button>
        <span class="moon-source" id="moon-layer-source">NASA LROC · 4096×2048 · LOADING</span>
        <button class="mt-btn active" data-tool="pan">🖐️ Pan</button>
        <button class="mt-btn" data-tool="distance">📏 Distance</button>
        <button class="mt-btn" data-tool="crater">⭕ Crater Area</button>
        <button class="mt-btn" id="btn-clear-moon">🗑️ Clear</button>
    `;
    document.body.appendChild(toolbar);

    const marsToolbar = document.createElement('div');
    marsToolbar.id = 'mars-toolbar';
    marsToolbar.className = 'moon-toolbar surface-toolbar hidden';
    marsToolbar.innerHTML = `
        <div class="mt-label">MARS LAYERS</div>
        <button class="mt-btn surface-layer-btn active" data-mars-layer="natural">Natural</button>
        <button class="mt-btn surface-layer-btn" data-mars-layer="elevation">Elevation</button>
        <button class="mt-btn surface-layer-btn" data-mars-layer="thermal">Thermal IR</button>
        <button class="mt-btn surface-layer-btn" data-mars-layer="orbital">Orbital</button>
        <button class="mt-btn surface-layer-btn" data-mars-layer="terraform" title="A visual terraforming simulation using the MOLA elevation map">Water Lab</button>
        <button class="mt-btn" data-surface-inspect="mars">🔎 Inspect 4K</button>
        <label class="mars-water-control" for="mars-water-level">Sea level <input id="mars-water-level" type="range" min="-35" max="45" value="0" step="1"><output id="mars-water-readout">0 m</output></label>
        <span class="moon-source" id="mars-layer-source">NATURAL COLOUR BASEMAP · LOADED</span>
        <a class="mt-btn surface-external" href="https://murray-lab.caltech.edu/CTX/V01/SceneView/" target="_blank" rel="noopener" title="Open the official 5 m/pixel CTX mosaic">CTX 5m ↗</a>
    `;
    document.body.appendChild(marsToolbar);

    const inspector = document.createElement('section');
    inspector.id = 'surface-inspector';
    inspector.className = 'surface-inspector';
    inspector.setAttribute('aria-label', 'Native resolution surface inspector');
    inspector.innerHTML = `
        <header class="surface-inspector-header">
            <div><strong id="surface-inspector-title">Surface inspector</strong><span id="surface-inspector-detail"></span></div>
            <button class="mt-btn" id="surface-inspector-reset">Reset view</button>
            <button class="mt-btn" id="surface-inspector-close" aria-label="Close surface inspector">×</button>
        </header>
        <div class="surface-inspector-stage"><img id="surface-inspector-image" alt="Native-resolution planetary surface map"></div>
    `;
    document.body.appendChild(inspector);

    // Styles for toolbar
    const style = document.createElement('style');
    style.innerHTML = `
        .moon-toolbar {
            position: absolute;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 8px;
            background: rgba(10, 10, 15, 0.92);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 8px;
            z-index: 50;
            pointer-events: auto;
            transition: opacity 0.3s, transform 0.3s;
            visibility: visible;
            align-items: center;
            max-width: calc(100vw - 20px);
            overflow-x: auto;
        }
        .moon-toolbar.hidden {
            opacity: 0;
            pointer-events: none;
            transform: translate(-50%, 20px);
            visibility: hidden;
        }
        .mt-label {
            font-size: 0.6rem;
            color: var(--muted);
            letter-spacing: 2px;
            margin-right: 12px;
            margin-left: 8px;
            font-family: 'JetBrains Mono', monospace;
        }
        .surface-layer-btn.active {
            color: #f0abfc;
            border-color: rgba(217, 70, 239, 0.65);
            background: linear-gradient(90deg, rgba(239,68,68,0.14), rgba(59,130,246,0.14));
        }
        .surface-layer-btn.loading::after {
            content: '…';
            margin-left: 3px;
            animation: surfacePulse .8s ease-in-out infinite alternate;
        }
        @keyframes surfacePulse { to { opacity: .25; } }
        .moon-source {
            color: #c084fc;
            font: 0.52rem 'JetBrains Mono', monospace;
            letter-spacing: 0.6px;
            white-space: nowrap;
        }
        .mt-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #fff;
            padding: 8px 14px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.75rem;
            font-weight: 600;
            transition: all 0.2s;
        }
        .mt-btn:hover { background: rgba(255,255,255,0.1); }
        .surface-external { text-decoration: none; white-space: nowrap; }
        .mars-water-control {
            display: none;
            align-items: center;
            gap: 6px;
            color: #bbf7d0;
            font: 0.58rem 'JetBrains Mono', monospace;
            white-space: nowrap;
        }
        .mars-water-control.visible { display: flex; }
        .mars-water-control input { width: 104px; accent-color: #38bdf8; }
        .mars-water-control output { min-width: 38px; color: #e0f2fe; }
        .orrery-readout.surface-toolbar-open,
        .data-panel.surface-toolbar-open { bottom: 210px; }
        .mt-btn.active {
            background: rgba(250, 204, 21, 0.15);
            border-color: rgba(250, 204, 21, 0.5);
            color: var(--primary);
        }
        #btn-clear-moon { border-color: rgba(239, 68, 68, 0.3); color: #fca5a5; }
        #btn-clear-moon:hover { background: rgba(239, 68, 68, 0.15); }
        .surface-inspector {
            position: absolute;
            z-index: 72;
            top: 118px;
            bottom: 94px;
            left: 50%;
            width: min(1200px, calc(100vw - 32px));
            transform: translateX(-50%);
            display: none;
            grid-template-rows: auto minmax(0, 1fr);
            gap: 10px;
            pointer-events: auto;
        }
        .surface-inspector.visible { display: grid; }
        .surface-inspector-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 9px 12px;
            border: 1px solid rgba(125, 211, 252, 0.28);
            border-radius: 10px;
            background: rgba(3, 7, 18, 0.86);
            backdrop-filter: blur(14px);
        }
        .surface-inspector-header div { display: grid; gap: 2px; margin-right: auto; }
        .surface-inspector-header strong { color: #e0f2fe; font-size: .82rem; }
        .surface-inspector-header span { color: #94a3b8; font: .58rem 'JetBrains Mono', monospace; }
        .surface-inspector-stage {
            min-height: 0;
            overflow: hidden;
            display: grid;
            place-items: center;
            background: #020617;
            border: 1px solid rgba(125, 211, 252, 0.20);
            border-radius: 12px;
            cursor: grab;
            touch-action: none;
        }
        .surface-inspector-stage.dragging { cursor: grabbing; }
        .surface-inspector-stage img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
            max-width: none;
            user-select: none;
            -webkit-user-drag: none;
            transform-origin: center;
            transition: transform .06s linear;
        }
        @media (max-width: 700px) {
            .surface-inspector { top: 84px; bottom: 80px; width: calc(100vw - 16px); }
            .surface-inspector-header span { display: none; }
        }
    `;
    document.head.appendChild(style);

    // Tool switching logic
    document.querySelectorAll('.mt-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mt-btn[data-tool]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            moonToolsMode = e.target.dataset.tool;
            controls.enableRotate = (moonToolsMode === 'pan');
            moonToolPoints = []; // reset points on switch
        });
    });

    document.getElementById('btn-clear-moon').addEventListener('click', () => {
        clearMoonVisuals();
    });

    const moonSources = {
        natural: 'NASA LROC · 4096×2048',
        topography: 'USGS GLD100 · 1024×512',
        geology: 'USGS GEOLOGY · 2048×1024 · 1:5M',
    };
    document.querySelectorAll('[data-moon-layer]').forEach((button) => {
        button.addEventListener('click', async (event) => {
            const selectedButton = event.currentTarget;
            const layer = selectedButton.dataset.moonLayer;
            document.querySelectorAll('[data-moon-layer]').forEach((item) => item.classList.toggle('active', item === selectedButton));
            selectedButton.classList.add('loading');
            const source = document.getElementById('moon-layer-source');
            if (source) source.textContent = `${moonSources[layer]} · LOADING`;
            try { await window.setMoonSurfaceLayer?.(layer); }
            finally {
                selectedButton.classList.remove('loading');
                if (source && source.dataset.state !== 'error') source.textContent = `${moonSources[layer]} · LOADED`;
            }
        });
    });

    const marsSources = {
        natural: 'NATURAL COLOUR BASEMAP',
        elevation: 'NASA/USGS MOLA · 4096×2048',
        thermal: 'MARS ODYSSEY THEMIS · 2048×1024',
        orbital: 'MGS MOC · 2048×1024',
        terraform: 'TERRAFORM LAB · MOLA 4096×2048 · VISUAL SIMULATION',
    };
    document.querySelectorAll('[data-mars-layer]').forEach((button) => {
        button.addEventListener('click', async (event) => {
            const selectedButton = event.currentTarget;
            const layer = selectedButton.dataset.marsLayer;
            document.querySelectorAll('[data-mars-layer]').forEach((item) => item.classList.toggle('active', item === selectedButton));
            document.querySelector('.mars-water-control')?.classList.toggle('visible', layer === 'terraform');
            selectedButton.classList.add('loading');
            const source = document.getElementById('mars-layer-source');
            if (source) source.textContent = `${marsSources[layer]} · LOADING`;
            try { await window.setMarsSurfaceLayer?.(layer); }
            finally {
                selectedButton.classList.remove('loading');
                if (source && source.dataset.state !== 'error') source.textContent = `${marsSources[layer]} · LOADED`;
            }
        });
    });
    document.getElementById('mars-water-level')?.addEventListener('input', (event) => {
        const level = Number(event.currentTarget.value);
        const output = document.getElementById('mars-water-readout');
        if (output) output.textContent = `${level > 0 ? '+' : ''}${level} m`;
        window.setMarsWaterLevel?.(level);
    });
    document.querySelectorAll('[data-surface-inspect]').forEach((button) => {
        button.addEventListener('click', () => openSurfaceInspector(button.dataset.surfaceInspect));
    });
    document.getElementById('surface-inspector-close')?.addEventListener('click', closeSurfaceInspector);
    document.getElementById('surface-inspector-reset')?.addEventListener('click', resetSurfaceInspector);
    initSurfaceInspectorGestures();

    // Pointer events on canvas
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Initial moon landing labels
    createMoonLandingLabels();
}

function openSurfaceInspector(body) {
    const source = SURFACE_INSPECTOR_SOURCES[body];
    const panel = document.getElementById('surface-inspector');
    const image = document.getElementById('surface-inspector-image');
    if (!source || !panel || !image) return;
    surfaceInspectorState = { zoom: 1, lon: 0, lat: 0, x: 0, y: 0, drag: null, body };
    document.getElementById('surface-inspector-title').textContent = source.title;
    document.getElementById('surface-inspector-detail').textContent = source.detail;
    image.alt = `${source.title} native-resolution surface map`;
    panel.classList.add('visible');
    refreshSurfaceInspectorImage();
}

function closeSurfaceInspector() {
    document.getElementById('surface-inspector')?.classList.remove('visible');
    surfaceInspectorState.drag = null;
}

function resetSurfaceInspector() {
    surfaceInspectorState.zoom = 1;
    surfaceInspectorState.lon = 0;
    surfaceInspectorState.lat = 0;
    surfaceInspectorState.x = 0;
    surfaceInspectorState.y = 0;
    refreshSurfaceInspectorImage();
}

function applySurfaceInspectorTransform() {
    const image = document.getElementById('surface-inspector-image');
    if (!image) return;
    image.style.transform = `translate(${surfaceInspectorState.x}px, ${surfaceInspectorState.y}px)`;
}

function getSurfaceInspectorBounds() {
    const zoom = surfaceInspectorState.zoom;
    const halfLon = 180 / zoom;
    const halfLat = 90 / zoom;
    surfaceInspectorState.lon = Math.max(-180 + halfLon, Math.min(180 - halfLon, surfaceInspectorState.lon));
    surfaceInspectorState.lat = Math.max(-90 + halfLat, Math.min(90 - halfLat, surfaceInspectorState.lat));
    return {
        minLon: surfaceInspectorState.lon - halfLon,
        maxLon: surfaceInspectorState.lon + halfLon,
        minLat: surfaceInspectorState.lat - halfLat,
        maxLat: surfaceInspectorState.lat + halfLat,
    };
}

function getSurfaceInspectorWmsUrl(source) {
    const bounds = getSurfaceInspectorBounds();
    const params = new URLSearchParams({
        map: source.map,
        SERVICE: 'WMS',
        VERSION: '1.1.1',
        REQUEST: 'GetMap',
        LAYERS: source.layer,
        STYLES: '',
        SRS: 'EPSG:4326',
        BBOX: `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`,
        WIDTH: '3072',
        HEIGHT: '1536',
        FORMAT: 'image/png',
        TRANSPARENT: 'false',
    });
    return `${source.service}?${params.toString()}`;
}

function refreshSurfaceInspectorImage() {
    const source = SURFACE_INSPECTOR_SOURCES[surfaceInspectorState.body];
    const image = document.getElementById('surface-inspector-image');
    const detail = document.getElementById('surface-inspector-detail');
    if (!source || !image || !detail) return;
    surfaceInspectorState.x = 0;
    surfaceInspectorState.y = 0;
    applySurfaceInspectorTransform();
    if (surfaceInspectorState.zoom === 1) {
        image.onload = null;
        image.onerror = null;
        detail.textContent = source.detail;
        image.src = source.src;
        return;
    }
    detail.textContent = `${source.label} · ${surfaceInspectorState.zoom}× detail viewport · loading 3072×1536 image`;
    image.onload = () => {
        detail.textContent = `${source.label} · ${surfaceInspectorState.zoom}× detail viewport · 3072×1536 loaded`;
    };
    image.onerror = () => {
        detail.textContent = `${source.label} unavailable · showing 4096×2048 overview`;
        image.onload = null;
        image.onerror = null;
        image.src = source.src;
    };
    image.src = getSurfaceInspectorWmsUrl(source);
}

function initSurfaceInspectorGestures() {
    const stage = document.querySelector('.surface-inspector-stage');
    if (!stage) return;
    stage.addEventListener('wheel', (event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -1 : 1;
        surfaceInspectorState.zoom = Math.max(1, Math.min(8, surfaceInspectorState.zoom + delta));
        if (surfaceInspectorState.zoom === 1) {
            surfaceInspectorState.x = 0;
            surfaceInspectorState.y = 0;
        }
        refreshSurfaceInspectorImage();
    }, { passive: false });
    stage.addEventListener('pointerdown', (event) => {
        if (surfaceInspectorState.zoom <= 1) return;
        stage.setPointerCapture?.(event.pointerId);
        surfaceInspectorState.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: surfaceInspectorState.x, panY: surfaceInspectorState.y };
        stage.classList.add('dragging');
    });
    stage.addEventListener('pointermove', (event) => {
        const drag = surfaceInspectorState.drag;
        if (!drag || drag.id !== event.pointerId) return;
        surfaceInspectorState.x = drag.panX + event.clientX - drag.x;
        surfaceInspectorState.y = drag.panY + event.clientY - drag.y;
        applySurfaceInspectorTransform();
    });
    const finish = (event) => {
        const drag = surfaceInspectorState.drag;
        if (drag && drag.id === event.pointerId) {
            const spanLon = 360 / surfaceInspectorState.zoom;
            const spanLat = 180 / surfaceInspectorState.zoom;
            surfaceInspectorState.lon -= (surfaceInspectorState.x / stage.clientWidth) * spanLon;
            surfaceInspectorState.lat += (surfaceInspectorState.y / stage.clientHeight) * spanLat;
            surfaceInspectorState.drag = null;
            refreshSurfaceInspectorImage();
        }
        stage.classList.remove('dragging');
    };
    stage.addEventListener('pointerup', finish);
    stage.addEventListener('pointercancel', finish);
}

function clearMoonVisuals() {
    clearMoonUserVisuals();
}

function addUserVisual(obj) {
    obj.userData.isUserMade = true;
    moonToolVisuals.add(obj);
}

function clearMoonUserVisuals() {
    const toRemove = moonToolVisuals.children.filter(c => c.userData.isUserMade);
    toRemove.forEach(c => {
        moonToolVisuals.remove(c);
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
    });
    moonToolPoints = [];
}

function createMoonLandingLabels() {
    const sites = [
        { name: "Apollo 11", lat: 0.674, lon: 23.472, col: "#60a5fa" },
        { name: "Apollo 15", lat: 26.132, lon: 3.633, col: "#60a5fa" },
        { name: "Apollo 17", lat: 20.190, lon: 30.772, col: "#60a5fa" },
        { name: "Tycho Crater", lat: -43.30, lon: -11.22, col: "#cbd5e1" }
    ];

    sites.forEach(site => {
        const pos = latLonToPos(site.lat, site.lon, EARTH_RADIUS_UNITS + 0.02);
        const { tex, w, h } = makeMoonLabelTexture(site.name, site.col);

        // Offset laterally (about 3-4 degrees away) and slightly up so labels don't block craters
        const labelPos = latLonToPos(site.lat + 3, site.lon + 4, EARTH_RADIUS_UNITS + 0.15);

        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, depthWrite: false }));
        sprite.position.copy(labelPos);
        const aspect = w / h;
        sprite.scale.set(0.4 * aspect, 0.4, 1);
        sprite.renderOrder = 8;

        const stem = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([pos.clone().multiplyScalar(1.002), labelPos]),
            new THREE.LineBasicMaterial({ color: site.col, opacity: 0.6, transparent: true, depthTest: true, depthWrite: false })
        );
        stem.renderOrder = 7;

        // Add a dot on the surface
        const dot = new THREE.Mesh(
            new THREE.CircleGeometry(0.04, 16),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(site.col), transparent: true, opacity: 0.8, depthTest: true, depthWrite: false, side: THREE.DoubleSide })
        );
        dot.position.copy(pos);
        dot.lookAt(new THREE.Vector3(0, 0, 0));
        dot.renderOrder = 8;

        moonToolVisuals.add(sprite);
        moonToolVisuals.add(stem);
        moonToolVisuals.add(dot);
    });
}

function makeMoonLabelTexture(text, colorStr) {
    const c = document.createElement('canvas'); const ctx = c.getContext('2d');
    ctx.font = '600 24px Inter';
    const textW = ctx.measureText(text).width; const w = textW + 20; const h = 36;
    c.width = w; c.height = h;
    ctx.fillStyle = 'rgba(10,10,15,0.7)'; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill();
    ctx.strokeStyle = colorStr; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '600 24px Inter'; ctx.fillStyle = colorStr; ctx.textBaseline = 'middle'; ctx.fillText(text, 10, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
    return { tex, w, h };
}

function onPointerDown(event) {
    if (typeof currentViewMode === 'undefined' || currentViewMode !== 'moon') return;
    if (moonToolsMode === 'pan') return; // let orbit controls handle it
    if (!moonSphere) return;

    // Calculate mouse position
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(moonSphere);

    if (intersects.length > 0) {
        if (moonToolPoints.length === 0) clearMoonUserVisuals();

        const pt = intersects[0].point;
        moonToolPoints.push(pt.clone());

        // Draw temporary dot
        const dot = new THREE.Mesh(
            new THREE.CircleGeometry(0.03, 16),
            new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, side: THREE.DoubleSide })
        );
        dot.position.copy(pt).multiplyScalar(1.002);
        dot.lookAt(new THREE.Vector3(0, 0, 0));
        dot.renderOrder = 10;
        addUserVisual(dot);

        if (moonToolPoints.length === 2) {
            if (moonToolsMode === 'distance') {
                measureDistance(moonToolPoints[0], moonToolPoints[1]);
            } else if (moonToolsMode === 'crater') {
                measureCraterArea(moonToolPoints[0], moonToolPoints[1]);
            }
            moonToolPoints = []; // reset for next measurement
        }
    }
}

function measureDistance(pA, pB) {
    // Both points are on a sphere of radius EARTH_RADIUS_UNITS
    // Angle between them:
    const angle = pA.angleTo(pB); // in radians
    const distKm = angle * MOON_RADIUS_KM;

    // Draw great circle arc
    const pts = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
        pts.push(new THREE.Vector3().copy(pA).slerp(pB, i / segments).multiplyScalar(1.002));
    }
    const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2, depthTest: false })
    );
    line.renderOrder = 9;
    addUserVisual(line);

    // Add explicitly marked midpoint dot
    const mid = new THREE.Vector3().copy(pA).slerp(pB, 0.5);

    const midDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 16),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, side: THREE.DoubleSide })
    );
    midDot.position.copy(mid).multiplyScalar(1.002);
    midDot.lookAt(new THREE.Vector3(0, 0, 0));
    midDot.renderOrder = 10;
    addUserVisual(midDot);

    const labelPos = mid.clone().multiplyScalar(1.08);

    // Stem line from the center dot to the offset label
    const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([mid.clone().multiplyScalar(1.002), labelPos]),
        new THREE.LineBasicMaterial({ color: 0xfacc15, opacity: 0.8, transparent: true, depthTest: false, linewidth: 2 })
    );
    stem.renderOrder = 9;
    addUserVisual(stem);

    const { tex, w, h } = makeMoonLabelTexture(`${distKm.toFixed(1)} km`, '#facc15');
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.position.copy(labelPos);
    const aspect = w / h;
    sprite.scale.set(0.6 * aspect, 0.6, 1);
    sprite.renderOrder = 10;
    addUserVisual(sprite);
}

function measureCraterArea(pA, pB) {
    // pA and pB defining the diameter of a crater on the surface
    const angle = pA.angleTo(pB); // angle across diameter
    const radiusAngle = angle / 2;
    const craterRadiusKm = Math.sin(radiusAngle) * MOON_RADIUS_KM; // straight line radius approximation
    // Or great circle radius: craterRadiusKm = radiusAngle * MOON_RADIUS_KM; // For small craters this is almost identical.

    const areaKm2 = Math.PI * craterRadiusKm * craterRadiusKm;

    // Center is midpoint
    const center = new THREE.Vector3().copy(pA).slerp(pB, 0.5);
    // Draw circle on the surface
    const distUnits = pA.distanceTo(pB); // 3D distance in units
    const radiusUnits = distUnits / 2;

    const circleGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i <= 64; i++) {
        const u = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(u) * radiusUnits, Math.sin(u) * radiusUnits, 0));
    }
    circleGeo.setFromPoints(pts);

    const ring = new THREE.LineLoop(
        circleGeo,
        new THREE.LineBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 0.8, linewidth: 2 })
    );
    ring.position.copy(center).multiplyScalar(1.002);
    ring.lookAt(new THREE.Vector3(0, 0, 0));
    ring.renderOrder = 9;
    addUserVisual(ring);

    // Explicit center point
    const centerDot = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 16),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, side: THREE.DoubleSide })
    );
    centerDot.position.copy(center).multiplyScalar(1.002);
    centerDot.lookAt(new THREE.Vector3(0, 0, 0));
    centerDot.renderOrder = 10;
    addUserVisual(centerDot);

    // Label offset with stem
    const labelPos = center.clone().multiplyScalar(1.08);

    // Stem line
    const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([center.clone().multiplyScalar(1.002), labelPos]),
        new THREE.LineBasicMaterial({ color: 0x22c55e, opacity: 0.5, transparent: true, depthTest: false })
    );
    stem.renderOrder = 9;
    addUserVisual(stem);

    const { tex, w, h } = makeMoonLabelTexture(`${areaKm2.toFixed(1)} km²`, '#22c55e');
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.position.copy(labelPos);
    const aspect = w / h;
    sprite.scale.set(0.6 * aspect, 0.6, 1);
    sprite.renderOrder = 10;
    addUserVisual(sprite);
}

// Hook into view mode switching to show/hide the toolbar
const originalSetViewMode = setViewMode;
setViewMode = function (mode) {
    originalSetViewMode(mode);
    const toolbar = document.getElementById('moon-toolbar');
    const marsToolbar = document.getElementById('mars-toolbar');
    const isMoon = mode === 'moon';
    const isMars = mode === 'mars';
    moonToolVisuals.visible = isMoon;

    // Measurement mode disables orbit rotation so clicks land precisely. Always
    // restore rotation when leaving the Moon, otherwise Earth can feel frozen.
    if (typeof controls !== 'undefined' && controls) {
        controls.enableRotate = !isMoon || moonToolsMode === 'pan';
    }

    if (toolbar) {
        if (isMoon) {
            toolbar.classList.remove('hidden');
        } else {
            toolbar.classList.add('hidden');
        }
    }
    if (marsToolbar) marsToolbar.classList.toggle('hidden', !isMars);
    if (!isMoon && !isMars) closeSurfaceInspector();
    document.querySelector('.data-panel')?.classList.toggle('surface-toolbar-open', isMoon);
    document.getElementById('orrery-readout')?.classList.toggle('surface-toolbar-open', isMars);
};
