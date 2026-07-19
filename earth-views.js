/* =========================
   EARTH VIEWS — Satellite & Hologram Modes
   ========================= */

// Texture URLs (free, no API key needed)
const TEX_URLS = {
    day: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
    night: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
    bump: 'https://unpkg.com/three-globe/example/img/earth-topology.png',
    clouds: 'https://unpkg.com/three-globe/example/img/earth-clouds.png',
    moonGeology: 'assets/moon-geology-usgs.jpg?v=1',
};

// Scientific surface layers are intentionally excluded from the general
// preload. They are several times larger than the base maps and are fetched
// only when the user selects a layer.
const SURFACE_TEX_URLS = {
    moonNaturalHd: 'assets/moon-natural-lroc-4k.jpg?v=1',
    moonTopography: 'assets/moon-topography-gld100.jpg?v=2',
    marsElevation: 'assets/mars-elevation-mola-4k.jpg?v=1',
    marsThermal: 'assets/mars-thermal-themis-2k.jpg?v=1',
    marsOrbital: 'assets/mars-orbital-moc-2k.jpg?v=1',
    mercuryObserved: 'assets/planet-mercury-messenger.jpg?v=1',
    venusObserved: 'assets/planet-venus-magellan.jpg?v=1',
    jupiterObserved: 'assets/planet-jupiter-hubble-opal.jpg?v=1',
    saturnObserved: 'assets/planet-saturn-observational-4k.jpg?v=1',
    uranusObserved: 'assets/planet-uranus-observational-2k.jpg?v=1',
    neptuneObserved: 'assets/planet-neptune-observational-2k.jpg?v=1',
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
let moonSurfaceLayer = 'natural';
let marsSurfaceLayer = 'natural';
const surfaceTexturePromises = {};

// Hologram mode objects
let holoGroup = null;
let holoScanLine = null;
let holoDataPoints = null;
let holoInnerGlow = null;
let holoScanAngle = 0;

// Dedicated full-globe planet views. The canvas treatments remain only as
// immediate loading fallbacks; each globe replaces them with an observational
// spacecraft/telescope map as soon as its lazily loaded asset is ready.
const DEDICATED_PLANET_KEYS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const PLANET_VIEW_CONFIG = {
    mercury: { name: 'Mercury', tilt: 0.03, base: '#77736d', atmosphere: null, diameter: '4,879 km', day: '176 Earth days', summary: 'Cratered, airless inner world with extreme day-to-night temperatures.', textureKey: 'mercuryObserved', source: 'USGS / MESSENGER MDIS', resolution: '1024×512', dataKind: 'GLOBAL COLOUR SURFACE MOSAIC', sourceUrl: 'https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_color_mosaic_665m' },
    venus: { name: 'Venus', tilt: 177.4, base: '#d89a49', atmosphere: 0xf4c36b, diameter: '12,104 km', day: '243 Earth days', summary: 'A cloud-wrapped world with a dense carbon-dioxide atmosphere.', textureKey: 'venusObserved', source: 'USGS / MAGELLAN', resolution: '1024×512', dataKind: 'GLOBAL RADAR SURFACE MOSAIC', sourceUrl: 'https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_synthetic_color_mosaic_4641m' },
    mars: { name: 'Mars', tilt: 25.2, base: '#b85132', atmosphere: 0xe77b55, diameter: '6,779 km', day: '24 h 37 m', summary: 'Cold desert world marked by giant volcanoes, canyons, and polar caps.' },
    jupiter: { name: 'Jupiter', tilt: 3.1, base: '#b9916f', atmosphere: 0xe8c6a5, diameter: '139,820 km', day: '9 h 56 m', summary: 'The largest planet, with fast cloud bands and the Great Red Spot.', textureKey: 'jupiterObserved', source: 'NASA / ESA HUBBLE OPAL', resolution: '3600×1800', dataKind: 'GLOBAL OBSERVED CLOUD MAP', sourceUrl: 'https://science.nasa.gov/asset/hubble/jupiter-global-map-from-hubble-opal-data-rotation-1/' },
    saturn: { name: 'Saturn', tilt: 26.7, base: '#d8c08d', atmosphere: 0xf1deb0, diameter: '116,460 km', day: '10 h 42 m', summary: 'A low-density gas giant surrounded by a bright, complex ring system.', textureKey: 'saturnObserved', source: 'NASA-IMAGERY-DERIVED / SSS', resolution: '4096×2048', dataKind: 'REPRESENTATIVE CLOUD MAP', sourceUrl: 'https://www.solarsystemscope.com/textures/' },
    uranus: { name: 'Uranus', tilt: 97.8, base: '#83cbd2', atmosphere: 0xa7f0f0, diameter: '50,724 km', day: '17 h 14 m', summary: 'A pale ice giant rotating on its side, encircled by narrow dark rings.', textureKey: 'uranusObserved', source: 'NASA-IMAGERY-DERIVED / SSS', resolution: '2048×1024', dataKind: 'REPRESENTATIVE CLOUD MAP', sourceUrl: 'https://www.solarsystemscope.com/textures/' },
    neptune: { name: 'Neptune', tilt: 28.3, base: '#2559b5', atmosphere: 0x4f8fff, diameter: '49,244 km', day: '16 h 6 m', summary: 'A deep-blue ice giant with supersonic winds and evolving dark storms.', textureKey: 'neptuneObserved', source: 'NASA-IMAGERY-DERIVED / SSS', resolution: '2048×1024', dataKind: 'REPRESENTATIVE CLOUD MAP', sourceUrl: 'https://www.solarsystemscope.com/textures/' },
};

const MARS_LAYER_META = {
    natural: { label: 'NATURAL COLOUR BASEMAP · LOADED', sourceUrl: '' },
    elevation: { label: 'NASA/USGS MOLA ELEVATION · 4096×2048 · LOADED', sourceUrl: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_global_shaded_relief_463m' },
    thermal: { label: 'MARS ODYSSEY THEMIS DAY IR · 2048×1024 · LOADED', sourceUrl: 'https://astrogeology.usgs.gov/search/map/mars_odyssey_themis_ir_day_global_mosaic_100m_v12' },
    orbital: { label: 'MGS MOC ORBITAL MOSAIC · 2048×1024 · LOADED', sourceUrl: 'https://www.mars.asu.edu/data/' },
    terraform: { label: 'TERRAFORM LAB · MOLA 4096×2048 · VISUAL SIMULATION', sourceUrl: 'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_global_shaded_relief_463m' },
};

let planetViewGroups = {};

function isPlanetViewMode(mode) {
    return DEDICATED_PLANET_KEYS.includes(mode);
}

function getActiveBodyForView(mode) {
    if (mode === 'moon' || isPlanetViewMode(mode)) return mode;
    return 'earth';
}

window.isPlanetViewMode = isPlanetViewMode;
window.getActiveBodyForView = getActiveBodyForView;

function registerEmbeddedTextures() {
    const loader = new THREE.TextureLoader();

    try {
        if (!texCache.moon && typeof MOON_B64 !== 'undefined') {
            const moonTex = loader.load(MOON_B64);
            moonTex.anisotropy = 4;
            texCache.moon = moonTex;
            if (moonSphere) {
                moonSphere.material.map = getMoonLayerTexture(moonSurfaceLayer) || moonTex;
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
                if (marsSurfaceLayer === 'natural') marsSphere.material.map = marsTex;
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
            if (key === 'moonGeology' && moonSphere && moonSurfaceLayer === 'geology') {
                moonSphere.material.map = tex;
                moonSphere.material.needsUpdate = true;
            }
            loaded++;
            if (loaded === keys.length) { texturesLoaded = true; texturesLoading = false; }
        }, undefined, () => { loaded++; if (loaded === keys.length) { texturesLoaded = true; texturesLoading = false; } });
    });
}

function loadSurfaceTexture(key) {
    if (texCache[key]) return Promise.resolve(texCache[key]);
    if (surfaceTexturePromises[key]) return surfaceTexturePromises[key];
    const url = SURFACE_TEX_URLS[key];
    if (!url) return Promise.reject(new Error(`Unknown surface texture: ${key}`));
    surfaceTexturePromises[key] = new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(url, (texture) => {
            // Preserve as much detail as the visitor's GPU supports. The old
            // fixed cap of 8 made the 4K maps look very similar to their 1K
            // fallbacks when viewed at a shallow angle.
            texture.anisotropy = Math.min(16, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
            if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = true;
            texture.needsUpdate = true;
            texCache[key] = texture;
            resolve(texture);
        }, undefined, reject);
    }).catch((error) => {
        delete surfaceTexturePromises[key];
        throw error;
    });
    return surfaceTexturePromises[key];
}

function setLayerSourceText(id, text, state = '') {
    const source = document.getElementById(id);
    if (!source) return;
    source.textContent = text;
    source.dataset.state = state;
}

function getMoonLayerTexture(layer) {
    if (layer === 'natural') return texCache.moonNaturalHd || texCache.moon || null;
    if (layer === 'topography') return texCache.moonTopography || null;
    return texCache.moonGeology || texCache.moon || null;
}

function getMarsLayerTexture(layer) {
    if (layer === 'elevation') return texCache.marsElevation || null;
    if (layer === 'thermal') return texCache.marsThermal || null;
    if (layer === 'orbital') return texCache.marsOrbital || null;
    return texCache.mars || null;
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

    // A denser mesh keeps small craters and coastline edges from looking
    // faceted when a 4K map is inspected close to the surface.
    const geo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 192, 128);
    const mat = new THREE.MeshPhongMaterial({
        map: getMoonLayerTexture(moonSurfaceLayer),
        bumpMap: texCache.moon || null,
        bumpScale: 0.045,
        specular: new THREE.Color(0x202020),
        shininess: 3,
    });

    moonSphere = new THREE.Mesh(geo, mat);
    moonSphere.renderOrder = 0;
    moonSphere.visible = false;
    earthGroup.add(moonSphere);
}

async function setMoonSurfaceLayer(layer) {
    if (!['natural', 'topography', 'geology'].includes(layer)) return;
    moonSurfaceLayer = layer;
    if (!moonSphere) createMoonView();
    if (!moonSphere) return;

    const textureKey = layer === 'natural' ? 'moonNaturalHd' : layer === 'topography' ? 'moonTopography' : null;
    const labels = {
        natural: 'NASA LROC · 4096×2048',
        topography: 'USGS GLD100 · 1024×512',
        geology: 'USGS GEOLOGY · 2048×1024 · 1:5M',
    };
    let layerAvailable = true;
    if (textureKey && !texCache[textureKey]) {
        setLayerSourceText('moon-layer-source', `${labels[layer]} · LOADING`, 'loading');
        moonSphere.material.map = getMoonLayerTexture(layer) || texCache.moon || texCache.moonGeology || null;
        moonSphere.material.needsUpdate = true;
        try { await loadSurfaceTexture(textureKey); }
        catch (error) {
            layerAvailable = false;
            setLayerSourceText('moon-layer-source', `${labels[layer]} · FALLBACK`, 'error');
            console.warn(`Moon ${layer} layer unavailable.`, error);
        }
    }
    if (moonSurfaceLayer !== layer) return;
    moonSphere.material.map = getMoonLayerTexture(layer);
    moonSphere.material.bumpMap = texCache.moonNaturalHd || texCache.moon || moonSphere.material.bumpMap;
    moonSphere.material.bumpScale = layer === 'topography' ? 0.065 : 0.045;
    moonSphere.material.needsUpdate = true;
    setLayerSourceText('moon-layer-source', `${labels[layer]} · ${layerAvailable ? 'LOADED' : 'FALLBACK'}`, layerAvailable ? 'loaded' : 'error');
}

function setMoonGeologyEnabled(enabled) {
    return setMoonSurfaceLayer(enabled ? 'geology' : 'natural');
}

window.setMoonSurfaceLayer = setMoonSurfaceLayer;
window.setMoonGeologyEnabled = setMoonGeologyEnabled;

/* ====== DEDICATED PLANET GLOBES ====== */
function seededPlanetRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6D2B79F5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function drawWavyBand(ctx, y, height, color, wave, phase, width) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.018 + phase) * wave);
    }
    for (let x = width; x >= 0; x -= 16) {
        ctx.lineTo(x, y + height + Math.sin(x * 0.014 + phase + 1.7) * wave);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function createPlanetSurfaceTexture(key) {
    const config = PLANET_VIEW_CONFIG[key];
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const random = seededPlanetRandom(key.split('').reduce((sum, char) => sum + char.charCodeAt(0) * 97, 17));
    const baseGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    baseGradient.addColorStop(0, config.base);
    baseGradient.addColorStop(0.5, config.base);
    baseGradient.addColorStop(1, '#171c2a');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (key === 'mercury') {
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < image.data.length; i += 4) {
            const grain = Math.floor((random() - 0.5) * 52);
            image.data[i] = Math.max(35, Math.min(190, image.data[i] + grain));
            image.data[i + 1] = Math.max(35, Math.min(185, image.data[i + 1] + grain));
            image.data[i + 2] = Math.max(32, Math.min(175, image.data[i + 2] + grain));
        }
        ctx.putImageData(image, 0, 0);
        for (let i = 0; i < 240; i++) {
            const x = random() * canvas.width;
            const y = random() * canvas.height;
            const radius = 2 + random() * random() * 24;
            ctx.beginPath();
            ctx.ellipse(x, y, radius, radius * (0.55 + random() * 0.45), 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(35,31,28,${0.12 + random() * 0.28})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(222,216,202,${0.12 + random() * 0.2})`;
            ctx.lineWidth = Math.max(1, radius * 0.08);
            ctx.stroke();
        }
    } else if (key === 'venus') {
        const colors = ['#7f4b24', '#a8642b', '#d28b3d', '#edb75e', '#c77832', '#f2cf80'];
        for (let i = 0; i < 28; i++) {
            drawWavyBand(ctx, i * 19 - 10, 18 + random() * 14, colors[i % colors.length], 5 + random() * 9, random() * 9, canvas.width);
        }
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = 7;
        for (let i = 0; i < 45; i++) {
            const y = random() * canvas.height;
            ctx.beginPath();
            ctx.moveTo(-20, y);
            ctx.bezierCurveTo(240, y - 90, 650, y + 90, 1044, y - 20);
            ctx.strokeStyle = i % 2 ? '#ffe1a1' : '#6f3c20';
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    } else if (key === 'jupiter') {
        const colors = ['#e7d2bb', '#9f6d55', '#d3ae8d', '#68483d', '#f1dfc6', '#b8795a', '#d6b692', '#855746'];
        for (let i = 0; i < 26; i++) {
            drawWavyBand(ctx, i * 21 - 8, 18 + random() * 11, colors[i % colors.length], 3 + random() * 8, random() * 8, canvas.width);
        }
        ctx.beginPath();
        ctx.ellipse(735, 332, 76, 36, -0.08, 0, Math.PI * 2);
        ctx.fillStyle = '#a94935';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(735, 331, 55, 21, -0.08, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,205,165,.58)';
        ctx.lineWidth = 7;
        ctx.stroke();
    } else if (key === 'saturn') {
        const colors = ['#e6d4ab', '#c8ad77', '#f0dfb7', '#b99c6b', '#ddc592', '#f3e6c6'];
        for (let i = 0; i < 40; i++) {
            drawWavyBand(ctx, i * 13 - 5, 11 + random() * 6, colors[i % colors.length], 1 + random() * 3, random() * 8, canvas.width);
        }
    } else if (key === 'uranus') {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#b9eced');
        gradient.addColorStop(0.48, '#75bec9');
        gradient.addColorStop(1, '#4d8e9d');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 18; i++) {
            drawWavyBand(ctx, i * 31, 3 + random() * 4, 'rgba(225,255,255,.16)', 1.5, random() * 5, canvas.width);
        }
    } else if (key === 'neptune') {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#5d8eea');
        gradient.addColorStop(0.48, '#2453ad');
        gradient.addColorStop(1, '#102f78');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 22; i++) {
            drawWavyBand(ctx, i * 24, 4 + random() * 8, i % 3 ? 'rgba(117,173,255,.16)' : 'rgba(230,245,255,.24)', 3 + random() * 5, random() * 8, canvas.width);
        }
        ctx.beginPath();
        ctx.ellipse(690, 320, 62, 28, -0.12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(13,28,74,.78)';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(410, 195, 75, 8, -0.08, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240,249,255,.72)';
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
}

function addPlanetRings(group, key) {
    if (key !== 'saturn' && key !== 'uranus') return;
    const ringSets = key === 'saturn'
        ? [[5.8, 6.65, 0xe8d8b4, 0.58], [6.82, 7.58, 0xc8aa78, 0.78], [7.72, 8.75, 0xead8aa, 0.5]]
        : [[6.35, 6.48, 0x9cd7d8, 0.38], [7.18, 7.31, 0x7eafb2, 0.32]];
    ringSets.forEach(([inner, outer, color, opacity]) => {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(inner, outer, 160),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })
        );
        ring.rotation.x = Math.PI / 2;
        ring.renderOrder = 2;
        group.add(ring);
    });
}

function createPlanetView(key) {
    if (!PLANET_VIEW_CONFIG[key] || key === 'mars' || planetViewGroups[key]) return;
    const config = PLANET_VIEW_CONFIG[key];
    const group = new THREE.Group();
    const texture = createPlanetSurfaceTexture(key);
    const material = new THREE.MeshPhongMaterial({
        map: texture,
        bumpMap: key === 'mercury' ? texture : null,
        bumpScale: key === 'mercury' ? 0.035 : 0,
        specular: new THREE.Color(key === 'mercury' ? 0x242424 : 0x3a3328),
        shininess: key === 'venus' || key === 'jupiter' ? 16 : 5,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 96, 64), material);
    sphere.userData.planetKey = key;
    // Start the storm worlds on their most recognizable hemispheres. Users can
    // still rotate the globe freely with the shared Rotation control.
    if (key === 'jupiter') sphere.rotation.y = -2.1;
    if (key === 'neptune') sphere.rotation.y = -1.8;
    group.add(sphere);

    if (config.atmosphere) {
        const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.025, 64, 48),
            new THREE.MeshBasicMaterial({ color: config.atmosphere, transparent: true, opacity: key === 'venus' ? 0.16 : 0.08, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false })
        );
        atmosphere.renderOrder = 1;
        group.add(atmosphere);
    }

    addPlanetRings(group, key);
    group.rotation.z = config.tilt * Math.PI / 180;
    group.visible = false;
    group.userData.surfaceMesh = sphere;
    group.userData.surfaceState = 'loading';
    planetViewGroups[key] = group;
    earthGroup.add(group);
    loadPlanetObservation(key, sphere);
}

async function loadPlanetObservation(key, sphere) {
    const config = PLANET_VIEW_CONFIG[key];
    if (!config?.textureKey || !sphere) return;
    if (currentViewMode === key) updatePlanetViewReadout(key, 'loading');
    try {
        const texture = await loadSurfaceTexture(config.textureKey);
        sphere.material.map = texture;
        sphere.material.bumpMap = key === 'mercury' || key === 'venus' ? texture : null;
        sphere.material.bumpScale = key === 'mercury' ? 0.035 : key === 'venus' ? 0.018 : 0;
        sphere.material.needsUpdate = true;
        const group = planetViewGroups[key];
        if (group) group.userData.surfaceState = 'loaded';
        if (currentViewMode === key) updatePlanetViewReadout(key, 'loaded');
    } catch (error) {
        const group = planetViewGroups[key];
        if (group) group.userData.surfaceState = 'fallback';
        if (currentViewMode === key) updatePlanetViewReadout(key, 'fallback');
        console.warn(`${config.name} observational texture unavailable.`, error);
    }
}

function updatePlanetViewReadout(key, forcedState = '') {
    const config = PLANET_VIEW_CONFIG[key];
    if (!config) return;
    const title = document.getElementById('orrery-title');
    const copy = document.getElementById('orrery-copy');
    const live = document.getElementById('orrery-live');
    const focus = document.getElementById('explore-focus');
    if (title) title.textContent = config.name;
    if (copy) copy.textContent = `${config.diameter} diameter · ${config.day} rotation · ${config.summary}`;
    const state = forcedState || planetViewGroups[key]?.userData?.surfaceState || 'loading';
    const stateLabel = state === 'loaded' ? 'LOADED' : state === 'fallback' ? 'FALLBACK MODEL' : 'LOADING…';
    if (live) live.textContent = key === 'mars'
        ? MARS_LAYER_META[marsSurfaceLayer].label
        : `${config.dataKind || 'SURFACE MAP'} · ${config.source || 'LOCAL MAP'} · ${config.resolution || ''} · ${stateLabel}`;
    const action = document.getElementById('orrery-action');
    if (action) {
        const sourceUrl = key === 'mars' ? MARS_LAYER_META[marsSurfaceLayer].sourceUrl : config.sourceUrl;
        if (sourceUrl) {
            action.textContent = 'Open imagery source ↗';
            action.dataset.sourceUrl = sourceUrl;
            action.dataset.sourcePlanet = key;
        } else {
            action.textContent = 'Open catalog';
            delete action.dataset.sourceUrl;
            delete action.dataset.sourcePlanet;
        }
    }
    if (focus) focus.textContent = `${config.name} globe`;
}

window.updatePlanetViewReadout = updatePlanetViewReadout;

/* ====== MARS MODE ====== */
let marsSphere = null;
let marsTerrainShader = null;
let marsWaterLevel = 0;
let marsTerraformEnabled = false;

function installMarsTerraformShader(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTerraform = { value: marsTerraformEnabled ? 1 : 0 };
        shader.uniforms.uSeaLevel = { value: marsWaterLevel };
        shader.fragmentShader = shader.fragmentShader
            .replace('void main() {', 'uniform float uTerraform;\nuniform float uSeaLevel;\nvoid main() {')
            .replace('#include <map_fragment>', `#include <map_fragment>
                if (uTerraform > 0.5) {
                    // The MOLA global relief map drives a deliberately
                    // speculative, Earth-like terrain palette. It is a visual
                    // scenario tool, not a reconstruction of past Mars.
                    float elevation = clamp(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
                    float waterline = clamp(0.47 + uSeaLevel * 0.004, 0.12, 0.82);
                    float water = 1.0 - smoothstep(waterline - 0.018, waterline + 0.014, elevation);
                    vec3 deepOcean = vec3(0.012, 0.10, 0.19);
                    vec3 shelfOcean = vec3(0.035, 0.34, 0.48);
                    vec3 ocean = mix(deepOcean, shelfOcean, smoothstep(waterline - 0.30, waterline, elevation));
                    vec3 desert = mix(vec3(0.37, 0.20, 0.07), vec3(0.80, 0.56, 0.25), elevation);
                    float fertile = smoothstep(waterline, waterline + 0.15, elevation) * (1.0 - smoothstep(0.70, 0.90, elevation));
                    vec3 land = mix(desert, vec3(0.08, 0.34, 0.12), fertile);
                    float snow = smoothstep(0.74, 0.93, elevation);
                    land = mix(land, vec3(0.92, 0.96, 0.98), snow);
                    diffuseColor.rgb = mix(land, ocean, water);
                }`);
        marsTerrainShader = shader;
    };
    material.customProgramCacheKey = () => 'mars-terraform-v1';
}

function setMarsWaterLevel(level) {
    marsWaterLevel = Math.max(-35, Math.min(45, Number(level) || 0));
    if (marsTerrainShader) marsTerrainShader.uniforms.uSeaLevel.value = marsWaterLevel;
}

window.setMarsWaterLevel = setMarsWaterLevel;

function createMarsView() {
    if (marsSphere) return;

    const geo = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 192, 128);
    const mat = new THREE.MeshPhongMaterial({
        map: getMarsLayerTexture(marsSurfaceLayer),
        bumpMap: texCache.mars || null,
        bumpScale: 0.03,
        specular: new THREE.Color(0x221111),
        shininess: 5,
    });
    installMarsTerraformShader(mat);

    marsSphere = new THREE.Mesh(geo, mat);
    marsSphere.renderOrder = 0;
    marsSphere.visible = false;
    earthGroup.add(marsSphere);
}

async function setMarsSurfaceLayer(layer) {
    if (!['natural', 'elevation', 'thermal', 'orbital', 'terraform'].includes(layer)) return;
    marsSurfaceLayer = layer;
    if (!marsSphere) createMarsView();
    if (!marsSphere) return;
    const textureKey = layer === 'elevation' || layer === 'terraform' ? 'marsElevation' : layer === 'thermal' ? 'marsThermal' : layer === 'orbital' ? 'marsOrbital' : null;
    const sourceLabels = {
        natural: 'NATURAL COLOUR · 4096×2048',
        elevation: 'NASA/USGS MOLA · 4096×2048',
        thermal: 'MARS ODYSSEY THEMIS · 2048×1024',
        orbital: 'MGS MOC · 2048×1024',
        terraform: 'TERRAFORM LAB · MOLA 4096×2048 · VISUAL SIMULATION',
    };
    let layerAvailable = true;
    if (textureKey && !texCache[textureKey]) {
        setLayerSourceText('mars-layer-source', `${sourceLabels[layer]} · LOADING`, 'loading');
        marsSphere.material.map = texCache.mars || marsSphere.material.map;
        marsSphere.material.needsUpdate = true;
        try { await loadSurfaceTexture(textureKey); }
        catch (error) {
            layerAvailable = false;
            setLayerSourceText('mars-layer-source', `${sourceLabels[layer]} · FALLBACK`, 'error');
            console.warn(`Mars ${layer} layer unavailable.`, error);
        }
    }
    if (marsSurfaceLayer !== layer) return;
    marsTerraformEnabled = layer === 'terraform';
    marsSphere.material.map = layer === 'terraform'
        ? (texCache.marsElevation || texCache.mars || marsSphere.material.map)
        : getMarsLayerTexture(layer);
    marsSphere.material.bumpMap = layer === 'elevation' || layer === 'terraform'
        ? (texCache.marsElevation || texCache.mars || marsSphere.material.bumpMap)
        : (texCache.mars || marsSphere.material.bumpMap);
    marsSphere.material.bumpScale = layer === 'elevation' || layer === 'terraform' ? 0.07 : 0.03;
    if (marsTerrainShader) marsTerrainShader.uniforms.uTerraform.value = marsTerraformEnabled ? 1 : 0;
    marsSphere.material.color.setHex(0xffffff);
    marsSphere.material.needsUpdate = true;
    setLayerSourceText('mars-layer-source', `${sourceLabels[layer]} · ${layerAvailable ? 'LOADED' : 'FALLBACK'}`, layerAvailable ? 'loaded' : 'error');
    const live = document.getElementById('orrery-live');
    if (live && currentViewMode === 'mars') {
        updatePlanetViewReadout('mars');
    }
}

window.setMarsSurfaceLayer = setMarsSurfaceLayer;

/* ====== PROGRESSIVE SURFACE DETAIL OVERLAY ======
   The 4K global texture is an overview. At close range, this patch replaces
   the currently viewed geographic area with a fresh, tighter WMS image rather
   than enlarging the same pixels in a flat inspection pane. */
let surfaceDetailPatch = null;
let surfaceDetailTexture = null;
let surfaceDetailRequestId = 0;
let surfaceDetailTimer = null;
let surfaceDetailControlsAttached = false;
const surfaceDetailState = { body: null, level: 1, lon: 0, lat: 0 };
const SURFACE_DETAIL_WMS = {
    moon: { service: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv', map: '/maps/earth/moon_simp_cyl.map', layer: 'LROC_WAC', label: 'USGS LROC WAC' },
    mars: { service: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv', map: '/maps/mars/mars_simp_cyl.map', layer: 'THEMIS_controlled', label: 'USGS THEMIS controlled mosaic' },
};

function emitSurfaceDetailState(extra = {}) {
    window.dispatchEvent(new CustomEvent('surface-detail-update', { detail: { ...surfaceDetailState, ...extra } }));
}

function getSurfaceDetailLevel(mesh) {
    const center = new THREE.Vector3();
    mesh.getWorldPosition(center);
    const distance = camera.position.distanceTo(center);
    return Math.max(1, Math.min(8, Math.floor(32 / Math.max(5.2, distance))));
}

function getSurfaceDetailFocus(mesh) {
    const picker = new THREE.Raycaster();
    picker.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = picker.intersectObject(mesh, false)[0];
    if (!hit) return { lon: surfaceDetailState.lon, lat: surfaceDetailState.lat };
    const point = mesh.worldToLocal(hit.point.clone()).normalize();
    const phi = Math.atan2(point.z, -point.x);
    return {
        lon: THREE.MathUtils.radToDeg(phi),
        lat: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(point.y, -1, 1))),
    };
}

function getSurfaceDetailBounds(level, focus) {
    const halfLon = 180 / level;
    const halfLat = 90 / level;
    const lon = Math.max(-180 + halfLon, Math.min(180 - halfLon, focus.lon));
    const lat = Math.max(-90 + halfLat, Math.min(90 - halfLat, focus.lat));
    return { lon, lat, minLon: lon - halfLon, maxLon: lon + halfLon, minLat: lat - halfLat, maxLat: lat + halfLat };
}

function buildSurfaceDetailWmsUrl(config, bounds) {
    const params = new URLSearchParams({
        map: config.map, SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap', LAYERS: config.layer,
        STYLES: '', SRS: 'EPSG:4326', BBOX: `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`,
        WIDTH: '3072', HEIGHT: '1536', FORMAT: 'image/png', TRANSPARENT: 'false',
    });
    return `${config.service}?${params.toString()}`;
}

function clearSurfaceDetailOverlay() {
    surfaceDetailState.body = null;
    if (surfaceDetailTimer) clearTimeout(surfaceDetailTimer);
    surfaceDetailTimer = null;
    if (surfaceDetailPatch) {
        earthGroup.remove(surfaceDetailPatch);
        surfaceDetailPatch.geometry.dispose();
        surfaceDetailPatch.material.dispose();
        surfaceDetailPatch = null;
    }
    if (surfaceDetailTexture) {
        surfaceDetailTexture.dispose();
        surfaceDetailTexture = null;
    }
    emitSurfaceDetailState({ active: false, label: 'DETAIL OVERLAY OFF' });
}

function scheduleSurfaceDetailRefresh(immediate = false) {
    if (!surfaceDetailState.body) return;
    if (surfaceDetailTimer) clearTimeout(surfaceDetailTimer);
    surfaceDetailTimer = setTimeout(refreshSurfaceDetailOverlay, immediate ? 0 : 260);
}

function attachSurfaceDetailControls() {
    if (surfaceDetailControlsAttached || typeof controls === 'undefined' || !controls) return;
    controls.addEventListener('change', () => scheduleSurfaceDetailRefresh());
    surfaceDetailControlsAttached = true;
}

function refreshSurfaceDetailOverlay() {
    const body = surfaceDetailState.body;
    const mesh = body === 'moon' ? moonSphere : marsSphere;
    const config = SURFACE_DETAIL_WMS[body];
    if (!mesh || !mesh.visible || !config) return;
    const level = getSurfaceDetailLevel(mesh);
    const focus = getSurfaceDetailFocus(mesh);
    const bounds = getSurfaceDetailBounds(level, focus);
    surfaceDetailState.level = level;
    surfaceDetailState.lon = bounds.lon;
    surfaceDetailState.lat = bounds.lat;
    const requestId = ++surfaceDetailRequestId;
    emitSurfaceDetailState({ active: true, label: `${config.label} · ${level}× DETAIL · LOADING` });
    new THREE.TextureLoader().load(buildSurfaceDetailWmsUrl(config, bounds), (texture) => {
        if (requestId !== surfaceDetailRequestId || surfaceDetailState.body !== body) {
            texture.dispose();
            return;
        }
        texture.anisotropy = Math.min(16, renderer?.capabilities?.getMaxAnisotropy?.() || 4);
        if (typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        // SphereGeometry starts its longitude sweep at the globe's -X seam.
        // getSurfaceDetailFocus uses the same seam (atan2(z, -x)), so do not
        // add an extra half-turn here or the patch will land on the far side.
        const phiStart = THREE.MathUtils.degToRad(bounds.minLon);
        const phiLength = THREE.MathUtils.degToRad(bounds.maxLon - bounds.minLon);
        const thetaStart = THREE.MathUtils.degToRad(90 - bounds.maxLat);
        const thetaLength = THREE.MathUtils.degToRad(bounds.maxLat - bounds.minLat);
        const geometry = new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.006, 96, 64, phiStart, phiLength, thetaStart, thetaLength);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide, depthWrite: true });
        const patch = new THREE.Mesh(geometry, material);
        patch.renderOrder = 3;
        if (surfaceDetailPatch) {
            earthGroup.remove(surfaceDetailPatch);
            surfaceDetailPatch.geometry.dispose();
            surfaceDetailPatch.material.dispose();
        }
        if (surfaceDetailTexture) surfaceDetailTexture.dispose();
        surfaceDetailPatch = patch;
        surfaceDetailTexture = texture;
        earthGroup.add(patch);
        emitSurfaceDetailState({ active: true, label: `${config.label} · ${level}× DETAIL · 3072×1536 LOADED` });
    }, undefined, () => {
        if (requestId === surfaceDetailRequestId) emitSurfaceDetailState({ active: true, label: `${config.label} · TEMPORARILY UNAVAILABLE` });
    });
}

function toggleSurfaceDetailOverlay(body) {
    if (surfaceDetailState.body === body) {
        clearSurfaceDetailOverlay();
        return;
    }
    clearSurfaceDetailOverlay();
    attachSurfaceDetailControls();
    surfaceDetailState.body = body;
    emitSurfaceDetailState({ active: true, label: 'DETAIL OVERLAY STARTING…' });
    scheduleSurfaceDetailRefresh(true);
}

window.toggleSurfaceDetailOverlay = toggleSurfaceDetailOverlay;
window.addEventListener('resize', () => scheduleSurfaceDetailRefresh());

/* ====== VIEW MODE SWITCHING ====== */
function setViewMode(mode) {
    if (typeof currentViewMode !== 'undefined' && currentViewMode === mode) return;
    const previousBody = getActiveBodyForView(currentViewMode);
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
    const activeBody = getActiveBodyForView(mode);
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
        setMoonSurfaceLayer(moonSurfaceLayer);
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

    Object.entries(planetViewGroups).forEach(([key, group]) => {
        group.visible = key === mode;
    });
    if (isPlanetViewMode(mode) && mode !== 'mars') {
        createPlanetView(mode);
        if (planetViewGroups[mode]) planetViewGroups[mode].visible = true;
    }
    if (isPlanetViewMode(mode)) updatePlanetViewReadout(mode);
    if (surfaceDetailState.body && mode !== surfaceDetailState.body) clearSurfaceDetailOverlay();
}

/* Called each frame for active mode updates */
function updateActiveViewMode() {
    attachSurfaceDetailControls();
    if (typeof currentViewMode === 'undefined') return;

    if (currentViewMode === 'satellite') {
        updateSatelliteDN();
        if (satCloudSphere) satCloudSphere.rotation.y += 0.0001;
    }

    if (currentViewMode === 'hologram') {
        animateHologram();
    }
}
