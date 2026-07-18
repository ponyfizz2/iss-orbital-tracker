/* =========================
   EARTH VIEWS — Satellite & Hologram Modes
   ========================= */

// Texture URLs (free, no API key needed)
const TEX_URLS = {
    day: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    night: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    bump: 'https://unpkg.com/three-globe/example/img/earth-topology.png',
    clouds: 'https://unpkg.com/three-globe/example/img/earth-clouds.png',
};

// Cached textures
const texCache = {};
let texturesLoading = false;
let texturesLoaded = false;

// Satellite mode objects
let satSphere = null;
let satCloudSphere = null;
let satAtmoSphere = null;
let satNightMaterial = null;
let satDayMaterial = null;

// Hologram mode objects
let holoGroup = null;
let holoScanLine = null;
let holoDataPoints = null;
let holoInnerGlow = null;
let holoScanAngle = 0;

function registerEmbeddedTextures() {
    const loader = new THREE.TextureLoader();

    try {
        if (!texCache.moon && typeof MOON_B64 !== 'undefined') {
            const moonTex = loader.load(MOON_B64);
            moonTex.anisotropy = 4;
            texCache.moon = moonTex;
            if (moonSphere) {
                moonSphere.material.map = moonTex;
                moonSphere.material.bumpMap = moonTex;
                moonSphere.material.needsUpdate = true;
            }
        }
    } catch { }

    try {
        if (!texCache.mars && typeof MARS_B64 !== 'undefined') {
            const marsTex = loader.load(MARS_B64);
            marsTex.anisotropy = 4;
            texCache.mars = marsTex;
            if (marsSphere) {
                marsSphere.material.map = marsTex;
                marsSphere.material.bumpMap = marsTex;
                marsSphere.material.needsUpdate = true;
            }
        }
    } catch { }
}

window.registerEmbeddedTextures = registerEmbeddedTextures;

/* Preload all textures */
function preloadTextures() {
    if (texturesLoading || texturesLoaded) return;
    texturesLoading = true;
    const loader = new THREE.TextureLoader();

    registerEmbeddedTextures();

    const keys = Object.keys(TEX_URLS);
    let loaded = 0;
    keys.forEach(key => {
        loader.load(TEX_URLS[key], (tex) => {
            tex.anisotropy = 4;
            texCache[key] = tex;
            loaded++;
            if (loaded === keys.length) { texturesLoaded = true; texturesLoading = false; }
        }, undefined, () => { loaded++; if (loaded === keys.length) { texturesLoaded = true; texturesLoading = false; } });
    });
}

/* ====== SATELLITE MODE ====== */
function createSatelliteEarth() {
    if (satSphere) return;

    const geo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 64, 64);

    // Day sphere with bump map
    const dayMat = new THREE.MeshPhongMaterial({
        map: texCache.day || null,
        bumpMap: texCache.bump || null,
        bumpScale: 0.04,
        specular: new THREE.Color(0x222222),
        shininess: 15,
    });
    satDayMaterial = dayMat;

    satSphere = new THREE.Mesh(geo, dayMat);
    satSphere.renderOrder = 0;
    satSphere.visible = false;
    earthGroup.add(satSphere);

    // Night glow layer
    const nightMat = new THREE.MeshBasicMaterial({
        map: texCache.night || null,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    satNightMaterial = nightMat;

    nightMat.onBeforeCompile = (shader) => {
        shader.uniforms.uSunDir = { value: sunDir.clone().normalize() };
        shader.uniforms.uDN = { value: dayNightEnabled ? 1.0 : 0.0 };
        shader.vertexShader = shader.vertexShader
            .replace('void main() {', 'uniform vec3 uSunDir;\nuniform float uDN;\nvarying float vL;\nvoid main() {')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vec3 nrm = normalize(worldPos);
        vL = -dot(nrm, normalize(uSunDir));`);
        shader.fragmentShader = shader.fragmentShader
            .replace('void main() {', 'uniform float uDN;\nvarying float vL;\nvoid main() {')
            .replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
                `float night = smoothstep(0.05, -0.30, vL);
         float vis = mix(1.0, night, uDN);
         gl_FragColor = vec4(outgoingLight * vis, diffuseColor.a * vis);`);
        nightMat.userData.shader = shader;
    };
    nightMat.needsUpdate = true;

    const nightSphere = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS_UNITS + 0.01, 64, 64),
        nightMat
    );
    nightSphere.renderOrder = 1;
    satSphere.add(nightSphere);

    dayMat.onBeforeCompile = (shader) => {
        shader.uniforms.uSunDir = { value: sunDir.clone().normalize() };
        shader.uniforms.uDN = { value: dayNightEnabled ? 1.0 : 0.0 };
        shader.vertexShader = shader.vertexShader
            .replace('void main() {', 'uniform vec3 uSunDir;\nuniform float uDN;\nvarying float vL;\nvoid main() {')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vec3 nrm = normalize(worldPos);
        vL = -dot(nrm, normalize(uSunDir));`);
        shader.fragmentShader = shader.fragmentShader
            .replace('void main() {', 'uniform float uDN;\nvarying float vL;\nvoid main() {')
            .replace('#include <output_fragment>',
                `#include <output_fragment>
         float edge = smoothstep(-0.10, 0.20, vL);
         float day = 0.15 + 0.85 * edge;
         gl_FragColor.rgb *= mix(1.0, day, uDN);`);
        dayMat.userData.shader = shader;
    };
    dayMat.needsUpdate = true;

    // Cloud layer
    if (texCache.clouds) {
        const cloudMat = new THREE.MeshBasicMaterial({
            map: texCache.clouds,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        satCloudSphere = new THREE.Mesh(
            new THREE.SphereGeometry(EARTH_RADIUS_UNITS + 0.06, 48, 48),
            cloudMat
        );
        satCloudSphere.renderOrder = 2;
        satSphere.add(satCloudSphere);
    }

    // Atmosphere glow
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.12, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
        vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * vec4(vPosition, 1.0);
      }`,
        fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(0.3, 0.6, 1.0, intensity * 0.6);
      }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
    });
    satAtmoSphere = new THREE.Mesh(atmoGeo, atmoMat);
    satAtmoSphere.renderOrder = -1;
    satSphere.add(satAtmoSphere);
}

function updateSatelliteDN() {
    const updateShader = (mat) => {
        if (mat?.userData?.shader) {
            mat.userData.shader.uniforms.uSunDir.value.copy(sunDir);
            mat.userData.shader.uniforms.uDN.value = dayNightEnabled ? 1.0 : 0.0;
        }
    };
    if (satDayMaterial) updateShader(satDayMaterial);
    if (satNightMaterial) updateShader(satNightMaterial);
}

/* ====== HOLOGRAM MODE ====== */
function createHologramEarth() {
    if (holoGroup) return;

    holoGroup = new THREE.Group();
    holoGroup.visible = false;
    earthGroup.add(holoGroup);

    // Transparent base sphere with fresnel edge glow
    const baseMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewDir;
            varying vec2 vUv;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vUv = uv;
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vViewDir = normalize(-mvPos.xyz);
                gl_Position = projectionMatrix * mvPos;
            }`,
        fragmentShader: `
            uniform float uTime;
            varying vec3 vNormal;
            varying vec3 vViewDir;
            varying vec2 vUv;
            void main() {
                float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
                float rim = pow(fresnel, 2.8) * 0.7;

                // Horizontal scan lines
                float scanLines = sin(vUv.y * 200.0) * 0.5 + 0.5;
                scanLines = smoothstep(0.4, 0.6, scanLines) * 0.08;

                // Hex-like pattern
                float hex = sin(vUv.x * 60.0 + uTime * 0.3) * sin(vUv.y * 30.0 - uTime * 0.2);
                hex = smoothstep(0.85, 1.0, hex) * 0.15;

                float fill = 0.02 + scanLines + hex;
                float alpha = rim + fill;
                vec3 col = vec3(0.0, 0.95, 0.85) * rim + vec3(0.0, 0.4, 0.45) * fill;
                gl_FragColor = vec4(col, alpha);
            }`,
        uniforms: {
            uTime: { value: 0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false,
    });
    const baseSphere = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS_UNITS - 0.02, 64, 64),
        baseMat
    );
    baseSphere.renderOrder = 0;
    holoGroup.add(baseSphere);
    holoInnerGlow = baseSphere;

    // Latitude grid lines
    const gridColor = 0x00f0dd;
    for (let lat = -75; lat <= 75; lat += 15) {
        const pts = [];
        for (let lon = 0; lon <= 360; lon += 2) {
            pts.push(latLonToPos(lat, lon - 180, EARTH_RADIUS_UNITS));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
            color: gridColor, transparent: true,
            opacity: lat === 0 ? 0.55 : (Math.abs(lat) % 30 === 0 ? 0.30 : 0.15),
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const line = new THREE.Line(geo, mat);
        if (lat === 0) line.material.color.set(0x00ffcc);
        line.renderOrder = 1;
        holoGroup.add(line);
    }

    // Longitude grid lines
    for (let lon = -180; lon < 180; lon += 15) {
        const pts = [];
        for (let lat = -90; lat <= 90; lat += 2) {
            pts.push(latLonToPos(lat, lon, EARTH_RADIUS_UNITS));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
            color: gridColor, transparent: true,
            opacity: lon % 90 === 0 ? 0.35 : 0.12,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const line = new THREE.Line(geo, mat);
        line.renderOrder = 1;
        holoGroup.add(line);
    }

    // Animated scan line — glowing ring that sweeps latitudes
    const scanPts = [];
    for (let lon = 0; lon <= 360; lon += 2) {
        scanPts.push(latLonToPos(0, lon - 180, EARTH_RADIUS_UNITS + 0.04));
    }
    holoScanLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(scanPts),
        new THREE.LineBasicMaterial({
            color: 0x00ffaa, transparent: true, opacity: 0.85,
            blending: THREE.AdditiveBlending, depthWrite: false,
            linewidth: 2
        })
    );
    holoScanLine.renderOrder = 5;
    holoGroup.add(holoScanLine);

    // Second scan line (vertical sweep)
    const vScanPts = [];
    for (let lat = -90; lat <= 90; lat += 2) {
        vScanPts.push(latLonToPos(lat, 0, EARTH_RADIUS_UNITS + 0.04));
    }
    const vScanLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(vScanPts),
        new THREE.LineBasicMaterial({
            color: 0x00ddff, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false
        })
    );
    vScanLine.renderOrder = 5;
    vScanLine.userData.isVerticalScan = true;
    holoGroup.add(vScanLine);

    // Data points — fibonacci sphere distribution
    createHoloDataPoints();

    // Outer wireframe frame
    const outerWire = new THREE.Mesh(
        new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.06, 20, 20),
        new THREE.MeshBasicMaterial({
            color: 0x00f0dd, wireframe: true, transparent: true,
            opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false
        })
    );
    outerWire.renderOrder = -1;
    holoGroup.add(outerWire);

    // Floating ring markers at notable latitudes
    [23.44, -23.44, 66.56, -66.56].forEach(lat => {
        const ringPts = [];
        for (let lon = 0; lon <= 360; lon += 4) {
            ringPts.push(latLonToPos(lat, lon - 180, EARTH_RADIUS_UNITS + 0.02));
        }
        const ringLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(ringPts),
            new THREE.LineBasicMaterial({
                color: 0x44ffcc, transparent: true, opacity: 0.18,
                blending: THREE.AdditiveBlending, depthWrite: false
            })
        );
        ringLine.renderOrder = 1;
        holoGroup.add(ringLine);
    });
}

function createHoloDataPoints() {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        // Fibonacci sphere for even distribution
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const y = 1 - (i / (count - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = goldenAngle * i;
        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;

        const r = EARTH_RADIUS_UNITS + 0.01;
        positions[i * 3] = x * r;
        positions[i * 3 + 1] = y * r;
        positions[i * 3 + 2] = z * r;

        // Teal/cyan/green palette
        const hue = 0.42 + Math.random() * 0.18;
        const brightness = 0.25 + Math.random() * 0.75;
        const c = new THREE.Color().setHSL(hue, 0.85, brightness);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    holoDataPoints = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.04,
        vertexColors: true,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    }));
    holoDataPoints.renderOrder = 2;
    holoGroup.add(holoDataPoints);
}

function animateHologram() {
    if (!holoGroup || !holoGroup.visible) return;

    const t = Date.now() * 0.001;

    // Update inner glow shader time
    if (holoInnerGlow?.material?.uniforms?.uTime) {
        holoInnerGlow.material.uniforms.uTime.value = t;
    }

    // Animate horizontal scan line: sweeps latitude -80 to 80
    holoScanAngle = Math.sin(t * 0.5) * 78;
    if (holoScanLine) {
        const geo = holoScanLine.geometry;
        const pos = geo.attributes.position.array;
        const count = pos.length / 3;
        for (let i = 0; i < count; i++) {
            const lon = (i / (count - 1)) * 360 - 180;
            const p = latLonToPos(holoScanAngle, lon, EARTH_RADIUS_UNITS + 0.04);
            pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        }
        geo.attributes.position.needsUpdate = true;
        holoScanLine.material.opacity = 0.45 + Math.sin(t * 4) * 0.35;
    }

    // Animate vertical scan line: sweeps longitude
    holoGroup.children.forEach(child => {
        if (child.userData?.isVerticalScan) {
            const sweepLon = (t * 25) % 360 - 180;
            const geo = child.geometry;
            const pos = geo.attributes.position.array;
            const count = pos.length / 3;
            for (let i = 0; i < count; i++) {
                const lat = -90 + (i / (count - 1)) * 180;
                const p = latLonToPos(lat, sweepLon, EARTH_RADIUS_UNITS + 0.04);
                pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
            }
            geo.attributes.position.needsUpdate = true;
            child.material.opacity = 0.3 + Math.sin(t * 3) * 0.2;
        }
    });

    // Pulse data points
    if (holoDataPoints) {
        holoDataPoints.material.opacity = 0.3 + Math.sin(t * 1.8) * 0.25;
    }
}

/* ====== MOON MODE ====== */
var moonSphere = null;

function createMoonView() {
    if (moonSphere) return;

    const geo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 64, 64);
    const mat = new THREE.MeshPhongMaterial({
        map: texCache.moon || null,
        bumpMap: texCache.moon || null,
        bumpScale: 0.05,
        specular: new THREE.Color(0x333333),
        shininess: 5,
    });

    moonSphere = new THREE.Mesh(geo, mat);
    moonSphere.renderOrder = 0;
    moonSphere.visible = false;
    earthGroup.add(moonSphere);
}

/* ====== MARS MODE ====== */
let marsSphere = null;

function createMarsView() {
    if (marsSphere) return;

    const geo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 64, 64);
    const mat = new THREE.MeshPhongMaterial({
        map: texCache.mars || null,
        bumpMap: texCache.mars || null,
        bumpScale: 0.03,
        specular: new THREE.Color(0x221111),
        shininess: 5,
    });

    marsSphere = new THREE.Mesh(geo, mat);
    marsSphere.renderOrder = 0;
    marsSphere.visible = false;
    earthGroup.add(marsSphere);
}

/* ====== VIEW MODE SWITCHING ====== */
function setViewMode(mode) {
    if (typeof currentViewMode !== 'undefined' && currentViewMode === mode) return;
    const previousBody = (currentViewMode === 'moon' || currentViewMode === 'mars') ? currentViewMode : 'earth';
    currentViewMode = mode;

    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });

    // Resolution slider only relevant in dot mode
    const resGroup = document.getElementById('resolution-group');
    if (resGroup) resGroup.classList.toggle('hidden', mode !== 'dots');

    // Hide/show dot mode objects
    const dotVisible = (mode === 'dots');
    if (dots) dots.visible = dotVisible;
    if (cityLights) cityLights.visible = dotVisible;
    if (terminatorLine) terminatorLine.visible = dotVisible && dayNightEnabled;
    if (borderDots) borderDots.visible = dotVisible;

    // Toggle Earth-centric tracking and satellites
    const activeBody = (mode === 'moon' || mode === 'mars') ? mode : 'earth';
    const isEarthView = (activeBody === 'earth');

    if (activeBody !== previousBody && typeof clearSelectedSatellite === 'function') {
        clearSelectedSatellite();
    }

    if (typeof highlightDots !== 'undefined' && highlightDots) {
        highlightDots.visible = isEarthView;
    }

    if (typeof trackingGroup !== 'undefined' && trackingGroup) {
        trackingGroup.visible = isEarthView ? (typeof trackerEnabled !== 'undefined' ? trackerEnabled : true) : false;
    }

    // Toggle CelesTrak satellites visibility
    if (typeof satData !== 'undefined' && typeof CONSTELLATIONS !== 'undefined') {
        for (const key of Object.keys(satData)) {
            const targetBody = CONSTELLATIONS[key]?.body || 'earth';
            const isVisible = CONSTELLATIONS[key]?.enabled && (activeBody === targetBody);
            if (satData[key]?.points) {
                satData[key].points.visible = isVisible;
            }
            if (satData[key]?.mesh) satData[key].mesh.visible = isVisible;
            if (satData[key]?.tails) satData[key].tails.visible = isVisible;
        }
    }

    // Satellite mode
    if (mode === 'satellite') {
        if (!satSphere) createSatelliteEarth();
        if (satSphere) satSphere.visible = true;
    } else {
        if (satSphere) satSphere.visible = false;
    }

    // Hologram mode
    if (mode === 'hologram') {
        if (!holoGroup) createHologramEarth();
        if (holoGroup) holoGroup.visible = true;
    } else {
        if (holoGroup) holoGroup.visible = false;
    }

    // Moon mode
    if (mode === 'moon') {
        if (!moonSphere) createMoonView();
        if (moonSphere) moonSphere.visible = true;
        if (typeof moonToolVisuals !== 'undefined') moonToolVisuals.visible = true;
    } else {
        if (moonSphere) moonSphere.visible = false;
        if (typeof moonToolVisuals !== 'undefined') moonToolVisuals.visible = false;
    }

    // Mars mode
    if (mode === 'mars') {
        if (!marsSphere) createMarsView();
        if (marsSphere) marsSphere.visible = true;
    } else {
        if (marsSphere) marsSphere.visible = false;
    }
}

/* Called each frame for active mode updates */
function updateActiveViewMode() {
    if (typeof currentViewMode === 'undefined') return;

    if (currentViewMode === 'satellite') {
        updateSatelliteDN();
        if (satCloudSphere) satCloudSphere.rotation.y += 0.0001;
    }

    if (currentViewMode === 'hologram') {
        animateHologram();
    }
}
