/* =========================
   SATELLITES — Multi-constellation support
   ========================= */

const CONSTELLATIONS = {
    tiangong: {
        name: 'Tiangong',
        noradId: 48274,
        color: '#ef4444',
        maxCount: 5,
        enabled: false,
        group: null,
        // Orbital params for fallback (approx)
        fallbackOrbit: { inclination: 41.47, altKm: 390, count: 1, planes: 1, satsPerPlane: 1 },
    },
    hubble: {
        name: 'Hubble',
        noradId: 20580,
        color: '#eab308',
        maxCount: 1,
        enabled: false,
        group: null,
        fallbackOrbit: { inclination: 28.47, altKm: 540, count: 1, planes: 1, satsPerPlane: 1 },
    },
    starlink: {
        name: 'Starlink',
        noradId: null,
        color: '#e2e8f0',
        maxCount: 200,
        enabled: false,
        group: 'starlink',
        tleSearch: 'STARLINK',
        fallbackOrbit: { inclination: 53, altKm: 550, count: 200, planes: 20, satsPerPlane: 10 },
    },
    iridium: {
        name: 'Iridium',
        noradId: null,
        color: '#3b82f6',
        maxCount: 80,
        enabled: false,
        group: 'iridium-NEXT',
        tleSearch: 'IRIDIUM',
        fallbackOrbit: { inclination: 86.4, altKm: 780, count: 66, planes: 6, satsPerPlane: 11 },
    },
    gps: {
        name: 'GPS',
        noradId: null,
        color: '#f97316',
        maxCount: 35,
        enabled: false,
        group: 'gps-ops',
        tleSearch: 'GPS',
        fallbackOrbit: { inclination: 55, altKm: 20200, count: 31, planes: 6, satsPerPlane: 5 },
    },
    lro: {
        name: 'LRO',
        noradId: 35315,
        color: '#94a3b8',
        maxCount: 1,
        enabled: false,
        group: null,
        body: 'moon',
        fallbackOrbit: { inclination: 90, altKm: 50, count: 1, planes: 1, satsPerPlane: 1 },
    },
    mro: {
        name: 'MRO',
        noradId: 28728,
        color: '#fca5a5',
        maxCount: 1,
        enabled: false,
        group: null,
        body: 'mars',
        fallbackOrbit: { inclination: 93, altKm: 300, count: 1, planes: 1, satsPerPlane: 1 },
    },
    military: {
        name: 'Military Aircraft',
        color: '#f97316',
        maxCount: 300,
        enabled: false,
        group: null,
        body: 'earth'
    },
    civilian: {
        name: 'Civilian Aircraft',
        color: '#38bdf8',
        maxCount: 2000,
        enabled: false,
        group: null,
        body: 'earth'
    }
};

// Storage
const satData = {};
const SAT_TLE_CACHE_PREFIX = 'sat_tle_v2_';
const SAT_TLE_TTL = 6 * 60 * 60 * 1000;
const SAT_MARKER_SCALE_KEY = 'sat_marker_scale_v1';
const DEFAULT_SAT_MARKER_SCALE = 1.75;
const MIN_SAT_MARKER_SCALE = 1;
const MAX_SAT_MARKER_SCALE = 3;
let satMarkerScale = DEFAULT_SAT_MARKER_SCALE;
const TLE_API_BASE = 'https://tle.ivanstanojevic.me/api/tle';
const AIRCRAFT_PROVIDERS = [
    { name: 'Airplanes.live', base: 'https://api.airplanes.live/v2' },
    { name: 'ADS-B One', base: 'https://api.adsb.one/v2' },
];
const AIRCRAFT_REFRESH_MS = 15000;
const AIRCRAFT_VIEW_SHIFT_DEG = 8;
const AIRCRAFT_REQUEST_GAP_MS = 1100;
let aircraftRequestQueue = Promise.resolve();
let lastAircraftRequestAt = 0;

function requestAircraftUrl(url) {
    const request = aircraftRequestQueue.then(async () => {
        const waitMs = Math.max(0, AIRCRAFT_REQUEST_GAP_MS - (Date.now() - lastAircraftRequestAt));
        if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
        lastAircraftRequestAt = Date.now();
        return fetchWithTimeout(url, { cache: 'no-store' }, 8000);
    });
    aircraftRequestQueue = request.catch(() => { });
    return request;
}

function setFeedState(key, label, tone = 'idle') {
    const checkbox = document.querySelector(`input[data-sat="${key}"]`);
    const row = checkbox?.closest('.sat-toggle');
    if (!row) return;
    let state = row.querySelector('.feed-state');
    if (!state) {
        state = document.createElement('span');
        state.className = 'feed-state';
        row.appendChild(state);
    }
    state.className = `feed-state ${tone}`;
    state.textContent = label;
}

/* ====== CELESTRAK URL ====== */
function getCelestrakUrl(key) {
    const config = CONSTELLATIONS[key];
    if (config.group) return `https://celestrak.org/NORAD/elements/gp.php?GROUP=${config.group}&FORMAT=TLE`;
    if (config.noradId) return `https://celestrak.org/NORAD/elements/gp.php?CATNR=${config.noradId}&FORMAT=TLE`;
    return null;
}

async function fetchTleApiItems(key) {
    const config = CONSTELLATIONS[key];
    if (config.noradId) {
        const response = await fetchWithTimeout(`${TLE_API_BASE}/${config.noradId}`, { cache: 'no-store' }, 6500);
        if (!response.ok) throw new Error(`TLE API returned ${response.status}`);
        const item = await response.json();
        if (!item?.line1 || !item?.line2) throw new Error('TLE API returned no orbital elements');
        return [{ name: item.name || config.name, line1: item.line1, line2: item.line2 }];
    }

    const search = config.tleSearch || config.name;
    const pageSize = Math.min(100, config.maxCount);
    const pageCount = Math.ceil(config.maxCount / pageSize);
    const items = [];
    for (let page = 1; page <= pageCount; page++) {
        const url = `${TLE_API_BASE}/?search=${encodeURIComponent(search)}&page-size=${pageSize}&page=${page}`;
        const response = await fetchWithTimeout(url, { cache: 'no-store' }, 6500);
        if (!response.ok) throw new Error(`TLE API returned ${response.status}`);
        const payload = await response.json();
        const members = Array.isArray(payload?.member) ? payload.member : [];
        items.push(...members.map(item => ({ name: item.name, line1: item.line1, line2: item.line2 })));
        if (members.length < pageSize) break;
    }
    if (!items.length) throw new Error('TLE API returned no matching satellites');
    return items.slice(0, config.maxCount);
}

/* ====== TLE FETCHING ====== */
async function fetchConstellationTLEs(key) {
    const config = CONSTELLATIONS[key];
    if (!config) return;

    // Standard TLE/SGP4 coordinates are Earth-centred. Rendering those values
    // around the Moon or Mars can place lunar/martian objects on Earth. Until a
    // body-centred ephemeris is available, use the explicit orbital model.
    if (config.body && config.body !== 'earth') {
        useFallbackOrbits(key);
        return;
    }

    if (key === 'military') {
        fetchAircraft('military');
        return;
    }
    if (key === 'civilian') {
        fetchAircraft('civilian');
        return;
    }

    setFeedState(key, 'LOADING', 'loading');

    // Try localStorage cache first
    const cacheKey = SAT_TLE_CACHE_PREFIX + key;
    try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached?.data?.length > 0 && (Date.now() - cached.fetchTime) < SAT_TLE_TTL) {
            processConstellationData(key, cached.data, 'cache');
            return;
        }
    } catch { }

    try {
        const items = await fetchTleApiItems(key);
        try {
            localStorage.setItem(cacheKey, JSON.stringify({ data: items, fetchTime: Date.now() }));
        } catch { }
        processConstellationData(key, items, 'tle-api');
        return;
    } catch { }

    const baseUrl = getCelestrakUrl(key);
    if (baseUrl) {
        try {
            const res = await fetchWithTimeout(baseUrl, { cache: 'no-store' }, 6500);
            if (!res.ok) throw new Error(`CelesTrak returned ${res.status}`);
            const text = await res.text();

            // Parse raw TLE format (3 lines per satellite)
            const lines = text.trim().split('\n').map(l => l.trim());
            const items = [];
            for (let i = 0; i < lines.length - 2; i += 3) {
                if (lines[i] && lines[i + 1] && lines[i + 2]) {
                    items.push({
                        name: lines[i],
                        line1: lines[i + 1],
                        line2: lines[i + 2]
                    });
                }
            }
            if (items.length === 0 || !items[0].line1) throw new Error('CelesTrak returned no TLEs');

            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    data: items.slice(0, config.maxCount),
                    fetchTime: Date.now()
                }));
            } catch { }

            processConstellationData(key, items, 'live');
            return;
        } catch { }
    }

    // Try expired cache
    try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached?.data?.length > 0) {
            processConstellationData(key, cached.data, 'stale-cache');
            return;
        }
    } catch { }

    // Fallback: generate positions from orbital parameters
    useFallbackOrbits(key);
}

/* ====== PROCESS TLE DATA ====== */
function processConstellationData(key, items, source) {
    const config = CONSTELLATIONS[key];
    const limited = items.slice(0, config.maxCount);
    const satrecs = [];

    for (const item of limited) {
        try {
            let line1 = item.line1;
            let line2 = item.line2;
            if (line1 && line2) {
                const satrec = satellite.twoline2satrec(line1.trim(), line2.trim());
                if (satrec) satrecs.push({ satrec, name: item.name || key });
            }
        } catch { }
    }

    if (satrecs.length === 0 && source !== 'fallback') {
        useFallbackOrbits(key);
        return;
    }

    if (!satData[key]) satData[key] = {};
    satData[key].satrecs = satrecs;
    satData[key].source = source;
    satData[key].useFallbackPositions = false;
    satData[key].lastFetch = Date.now();

    createConstellationMarkers(key);
    const sourceLabel = source === 'tle-api' || source === 'live' ? 'LIVE' : source === 'cache' ? 'CACHE' : 'STALE';
    setFeedState(key, sourceLabel, source === 'stale-cache' ? 'warning' : 'live');
    updateSatCountDisplay();
}

/* ====== FALLBACK: ORBITAL MECHANICS ====== */
function useFallbackOrbits(key) {
    const config = CONSTELLATIONS[key];
    const orbit = config.fallbackOrbit;
    if (!orbit) return;

    console.log(`Using orbital fallback for ${config.name} (${orbit.count} sats)`);

    if (!satData[key]) satData[key] = {};
    satData[key].satrecs = [];
    satData[key].source = 'orbital-fallback';
    satData[key].useFallbackPositions = true;
    satData[key].orbitParams = orbit;
    satData[key].lastFetch = Date.now();

    // Pre-generate satellite orbital elements
    const sats = [];
    for (let i = 0; i < orbit.count; i++) {
        const plane = Math.floor(i / orbit.satsPerPlane);
        const indexInPlane = i % orbit.satsPerPlane;
        const raan = (plane / orbit.planes) * 360; // degrees
        const meanAnomaly = (indexInPlane / orbit.satsPerPlane) * 360 + (plane * 15); // stagger between planes
        sats.push({ raan, meanAnomaly, inclination: orbit.inclination, altKm: orbit.altKm });
    }
    satData[key].fallbackSats = sats;

    createConstellationMarkers(key);
    setFeedState(key, 'MODEL', 'warning');
    updateSatCountDisplay();
}

function getFallbackSatCount(key) {
    const data = satData[key];
    if (data?.planes) return data.planes.length;
    if (data?.useFallbackPositions && data?.fallbackSats) return data.fallbackSats.length;
    if (data?.satrecs) return data.satrecs.length;
    return 0;
}

function getBodyRadiusKm(body = 'earth') {
    if (body === 'moon') return 1737.4;
    if (body === 'mars') return 3389.5;
    return EARTH_RADIUS_KM;
}

function getOrbitalRenderRadius(altKm, body = 'earth', altExag = 3) {
    const bodyRadiusKm = getBodyRadiusKm(body);
    return EARTH_RADIUS_UNITS * (1 + (altKm / bodyRadiusKm) * altExag);
}

function getAircraftViewState(key) {
    const distance = (typeof camera !== 'undefined' && typeof controls !== 'undefined')
        ? camera.position.distanceTo(controls.target)
        : 22;
    let band = 'far';
    let limit = key === 'military' ? 18 : 30;
    if (distance <= 10.5) {
        band = 'close';
        limit = key === 'military' ? 120 : 300;
    } else if (distance <= 19) {
        band = 'medium';
        limit = key === 'military' ? 60 : 120;
    }
    return { distance, band, limit, center: getVisibleGlobeCenter() };
}

function getVisibleGlobeCenter() {
    if (typeof camera === 'undefined' || typeof earthGroup === 'undefined' || !earthGroup) return { lat: 0, lon: 0 };
    const local = earthGroup.worldToLocal(camera.position.clone()).normalize();
    const lat = Math.asin(Math.max(-1, Math.min(1, local.y))) * 180 / Math.PI;
    const lon = Math.atan2(-local.z, local.x) * 180 / Math.PI;
    return { lat, lon: normalizeLon(lon) };
}

function angularDistanceDegrees(a, b) {
    const toRad = Math.PI / 180;
    const lat1 = a.lat * toRad, lat2 = b.lat * toRad;
    const dLon = normalizeLon(a.lon - b.lon) * toRad;
    return Math.acos(Math.max(-1, Math.min(1,
        Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLon)
    ))) / toRad;
}

function applyAircraftLod(key, force = false) {
    const data = satData[key];
    if (!data?.allPlanes?.length) return;
    const view = getAircraftViewState(key);
    const signature = `${view.band}:${Math.round(view.center.lat / 4)}:${Math.round(view.center.lon / 4)}:${data.allPlanes.length}`;
    if (!force && data.lodSignature === signature) return;

    data.lodSignature = signature;
    data.planes = data.allPlanes
        .slice()
        .sort((left, right) => angularDistanceDegrees(left, view.center) - angularDistanceDegrees(right, view.center))
        .slice(0, Math.min(view.limit, data.allPlanes.length));
    data.useFallbackPositions = false;
    createConstellationMarkers(key);
    setFeedState(key, `LIVE · ${data.planes.length} ${view.band.toUpperCase()}`, 'live');
    updateSatCountDisplay();
}

function normalizeAircraft(ac, key) {
    const lat = Number(ac.lat);
    const lon = Number(ac.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const defaultAltFt = key === 'military' ? 30000 : 35000;
    const rawAltitude = Number.isFinite(Number(ac.alt_geom)) ? Number(ac.alt_geom) :
        Number.isFinite(Number(ac.alt_baro)) ? Number(ac.alt_baro) : defaultAltFt;
    return {
        name: ac.flight?.trim() || ac.r || ac.hex || (key === 'military' ? 'Military Aircraft' : 'Civilian Aircraft'),
        lat,
        lon,
        altKm: Math.max(0, rawAltitude) * 0.0003048,
        track: Number(ac.track) || 0,
        speedKmh: Math.round((Number(ac.gs) || 0) * 1.852),
    };
}

async function fetchAircraft(key, force = false) {
    const data = satData[key] || (satData[key] = {});
    if (data.fetchInFlight) return;
    const view = getAircraftViewState(key);
    const previousCenter = data.lastViewCenter;
    const shifted = !previousCenter || angularDistanceDegrees(previousCenter, view.center) >= AIRCRAFT_VIEW_SHIFT_DEG;
    if (!force && data.lastFetch && Date.now() - data.lastFetch < AIRCRAFT_REFRESH_MS && (!shifted || key === 'military')) {
        applyAircraftLod(key);
        return;
    }

    data.fetchInFlight = true;
    setFeedState(key, 'LOADING', 'loading');
    let lastError = null;
    try {
        for (const provider of AIRCRAFT_PROVIDERS) {
            const path = key === 'military'
                ? 'mil'
                : `point/${view.center.lat.toFixed(3)}/${view.center.lon.toFixed(3)}/250`;
            try {
                const response = await requestAircraftUrl(`${provider.base}/${path}`);
                if (!response.ok) throw new Error(`${provider.name} returned ${response.status}`);
                let payload = await response.json();
                if (!Array.isArray(payload?.ac)) throw new Error(`${provider.name} returned invalid aircraft data`);
                let planes = payload.ac.map(ac => normalizeAircraft(ac, key)).filter(Boolean);

                // A camera pointed over open ocean can correctly return zero
                // nearby civilian aircraft. Seed the first far-globe view from
                // a busy region; later close views remain centred on the globe.
                if (!planes.length && key === 'civilian' && !data.allPlanes?.length && view.band === 'far') {
                    const seedResponse = await requestAircraftUrl(`${provider.base}/point/40/-100/250`);
                    if (seedResponse.ok) {
                        payload = await seedResponse.json();
                        planes = Array.isArray(payload?.ac)
                            ? payload.ac.map(ac => normalizeAircraft(ac, key)).filter(Boolean)
                            : [];
                    }
                }

                if (!planes.length) {
                    data.source = provider.name;
                    data.lastFetch = Date.now();
                    data.lastViewCenter = view.center;
                    if (data.allPlanes?.length) {
                        data.lodSignature = null;
                        applyAircraftLod(key, true);
                        return;
                    }
                    data.allPlanes = [];
                    data.planes = [];
                    setFeedState(key, 'LIVE · 0', 'live');
                    updateSatCountDisplay();
                    return;
                }

                data.allPlanes = planes;
                data.source = provider.name;
                data.lastFetch = Date.now();
                data.lastViewCenter = view.center;
                data.lodSignature = null;
                applyAircraftLod(key, true);
                return;
            } catch (error) {
                lastError = error;
            }
        }
    } finally {
        data.fetchInFlight = false;
    }

    if (data.allPlanes?.length) {
        setFeedState(key, 'STALE', 'warning');
        applyAircraftLod(key, true);
    } else {
        setFeedState(key, 'OFFLINE', 'error');
        console.warn(`Aircraft feeds unavailable for ${key}`, lastError);
    }
}

function getIconTexture(type) {
    if (!window.iconTextures) window.iconTextures = {};
    if (window.iconTextures[type]) return window.iconTextures[type];

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.translate(size / 2, size / 2);

    // The halo keeps markers legible over both bright cloud cover and the
    // dark side of the globe without changing their orbital positions.
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 30);
    glow.addColorStop(0, 'rgba(255,255,255,0.7)');
    glow.addColorStop(0.45, 'rgba(255,255,255,0.3)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-32, -32, 64, 64);
    ctx.fillStyle = "white";

    if (type === 'plane') {
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(4, -6);
        ctx.lineTo(22, 2);
        ctx.lineTo(22, 6);
        ctx.lineTo(4, 2);
        ctx.lineTo(0, 18);
        ctx.lineTo(-4, 2);
        ctx.lineTo(-22, 6);
        ctx.lineTo(-22, 2);
        ctx.lineTo(-4, -6);
        ctx.closePath();
        ctx.fill();
    } else {
        ctx.fillStyle = "white";
        ctx.fillRect(-14, -10, 8, 20); // left panel
        ctx.fillRect(6, -10, 8, 20); // right panel
        ctx.fillRect(-2, -6, 4, 12); // body
        ctx.fillRect(-6, -2, 12, 4); // connector
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    window.iconTextures[type] = tex;
    return tex;
}

/* ====== THREE.JS MARKERS ====== */
function createConstellationMarkers(key) {
    const config = CONSTELLATIONS[key];
    const data = satData[key];
    let count = 0;
    if (data.useFallbackPositions) count = data.fallbackSats.length;
    else if (data.satrecs) count = data.satrecs.length;
    else if (data.planes) count = data.planes.length;
    if (!count) return;

    if (data.points) {
        earthGroup.remove(data.points);
        data.points.geometry.dispose();
        data.points.material.dispose();
        data.points = null;
    }
    if (data.mesh) {
        earthGroup.remove(data.mesh);
        data.mesh.geometry.dispose();
        data.mesh.material.dispose();
        data.mesh = null;
    }
    if (data.tails) {
        earthGroup.remove(data.tails);
        data.tails.geometry.dispose();
        data.tails.material.dispose();
        data.tails = null;
    }

    const isSingle = (count <= 5);
    const isPlane = (key === 'military' || key === 'civilian');
    const tex = getIconTexture(isPlane ? 'plane' : 'satellite');

    let activeBody = 'earth';
    if (typeof currentViewMode !== 'undefined') {
        activeBody = typeof getActiveBodyForView === 'function' ? getActiveBodyForView(currentViewMode) : 'earth';
    }
    const targetBody = config.body || 'earth';
    const isVisible = config.enabled && (activeBody === targetBody);

    if (isPlane) {
        const planeSize = 0.28 * satMarkerScale;
        const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMat = new THREE.MeshBasicMaterial({
            map: tex, color: config.color, transparent: true, opacity: 1, depthTest: true, depthWrite: false, side: THREE.DoubleSide, alphaTest: 0.05
        });
        data.mesh = new THREE.InstancedMesh(planeGeo, planeMat, count);
        data.mesh.userData.markerBaseSize = 0.28;
        data.mesh.renderOrder = 6;
        data.mesh.visible = isVisible;
        earthGroup.add(data.mesh);
    } else {
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const color = new THREE.Color(config.color);
        for (let i = 0; i < count; i++) {
            colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: (isSingle ? 0.4 : 0.18) * satMarkerScale,
            map: tex, vertexColors: true, transparent: true, opacity: 1,
            alphaTest: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, sizeAttenuation: true
        });

        data.points = new THREE.Points(geo, mat);
        data.points.userData.markerBaseSize = isSingle ? 0.4 : 0.18;
        data.points.renderOrder = 6;
        data.points.visible = isVisible;
        earthGroup.add(data.points);
    }

    updateConstellationPos(key);
}

/* ====== POSITION UPDATE ====== */
function updateConstellationPos(key) {
    const data = satData[key];
    if (!data?.points && !data?.mesh) return;

    if (data.useFallbackPositions) {
        updateFallbackPositions(key);
    } else {
        updateSGP4Positions(key);
    }
}

function updateSGP4Positions(key) {
    const data = satData[key];
    if (!data?.satrecs?.length || !data.points) return;

    const now = new Date();
    const gmst = satellite.gstime(now);
    const pos = data.points.geometry.attributes.position.array;
    const altExag = parseFloat(ui.altx?.value || 3);
    const targetBody = CONSTELLATIONS[key]?.body || 'earth';

    for (let i = 0; i < data.satrecs.length; i++) {
        try {
            const prop = satellite.propagate(data.satrecs[i].satrec, now);
            if (!prop.position || typeof prop.position.x !== 'number') {
                pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
                continue;
            }
            const geo = satellite.eciToGeodetic(prop.position, gmst);
            const lat = satellite.degreesLat(geo.latitude);
            const lon = satellite.degreesLong(geo.longitude);
            const r = getOrbitalRenderRadius(geo.height, targetBody, altExag);
            const p = latLonToPos(lat, lon, r);
            pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        } catch {
            pos[i * 3] = 0; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = 0;
        }
    }
    data.points.geometry.attributes.position.needsUpdate = true;
    data.points.geometry.computeBoundingSphere();
}

function updateFallbackPositions(key) {
    const data = satData[key];
    if (!data?.fallbackSats?.length || !data.points) return;

    const pos = data.points.geometry.attributes.position.array;
    const altExag = parseFloat(ui.altx?.value || 3);
    const altKm = data.orbitParams.altKm;
    const targetBody = CONSTELLATIONS[key]?.body || 'earth';
    const bodyRadiusKm = getBodyRadiusKm(targetBody);
    const r = getOrbitalRenderRadius(altKm, targetBody, altExag);

    // Time-based orbital motion
    const now = Date.now() / 1000;
    const gravitationalParameter = targetBody === 'moon' ? 4902.8001 : targetBody === 'mars' ? 42828.375 : 398600.4418;
    const orbitalPeriodSec = 2 * Math.PI * Math.sqrt(Math.pow((bodyRadiusKm + altKm), 3) / gravitationalParameter);

    for (let i = 0; i < data.fallbackSats.length; i++) {
        const sat = data.fallbackSats[i];
        const incRad = sat.inclination * Math.PI / 180;
        const raanRad = sat.raan * Math.PI / 180;

        // Mean anomaly progresses with time
        const ma = (sat.meanAnomaly + (now / orbitalPeriodSec) * 360) % 360;
        const maRad = ma * Math.PI / 180;

        // Position in orbital plane
        const xOrb = r * Math.cos(maRad);
        const yOrb = r * Math.sin(maRad);

        // Rotate by inclination (around x-axis) then by RAAN (around z-axis)
        const x1 = xOrb;
        const y1 = yOrb * Math.cos(incRad);
        const z1 = yOrb * Math.sin(incRad);

        // Rotate by RAAN + Earth rotation
        const bodyRotRate = targetBody === 'moon' ? 2.6617e-6 : targetBody === 'mars' ? 7.0882e-5 : 7.2921159e-5;
        const raanTotal = raanRad + bodyRotRate * now;
        const x = x1 * Math.cos(raanTotal) - y1 * Math.sin(raanTotal);
        const z = x1 * Math.sin(raanTotal) + y1 * Math.cos(raanTotal);
        const y = z1;

        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
    }

    data.points.geometry.attributes.position.needsUpdate = true;
    data.points.geometry.computeBoundingSphere();
}

function updatePlanesPositions(key) {
    const data = satData[key];
    if (!data?.planes?.length || !data.mesh) return;

    const altExag = parseFloat(typeof ui !== 'undefined' && ui.altx ? ui.altx.value : 3);
    const dummy = new THREE.Object3D();
    const tailPts = [];

    for (let i = 0; i < data.planes.length; i++) {
        const p = data.planes[i];
        const r = EARTH_RADIUS_UNITS * (1 + (p.altKm / EARTH_RADIUS_KM) * altExag);
        const pos = latLonToPos(p.lat, p.lon, r);

        dummy.position.copy(pos);
        dummy.lookAt(new THREE.Vector3(0, 0, 0));

        let heading = p.track || 0;
        dummy.rotateZ(-heading * Math.PI / 180);
        dummy.updateMatrix();
        data.mesh.setMatrixAt(i, dummy.matrix);

        tailPts.push(pos.clone());
        const backDir = dummy.localToWorld(new THREE.Vector3(0, -0.08, 0)).sub(pos);
        tailPts.push(pos.clone().add(backDir));
    }
    data.mesh.instanceMatrix.needsUpdate = true;
    data.mesh.geometry.computeBoundingSphere();

    if (!data.tails) {
        const lineGeo = new THREE.BufferGeometry().setFromPoints(tailPts);
        data.tails = new THREE.LineSegments(
            lineGeo,
            new THREE.LineBasicMaterial({ color: CONSTELLATIONS[key].color, transparent: true, opacity: 0.5 })
        );
        data.tails.renderOrder = 5;
        let activeBody = 'earth';
        if (typeof currentViewMode !== 'undefined') activeBody = typeof getActiveBodyForView === 'function' ? getActiveBodyForView(currentViewMode) : 'earth';
        const targetBody = CONSTELLATIONS[key].body || 'earth';
        data.tails.visible = CONSTELLATIONS[key].enabled && (activeBody === targetBody);
        earthGroup.add(data.tails);
    } else {
        data.tails.geometry.setFromPoints(tailPts);
        data.tails.geometry.computeBoundingSphere();
    }
}

/* ====== UPDATE LOOP ====== */
let lastSatUpdateMs = 0;
const SAT_UPDATE_INTERVAL = 1000;

function updateAllConstellations() {
    const now = Date.now();
    if (now - lastSatUpdateMs < SAT_UPDATE_INTERVAL) return;
    lastSatUpdateMs = now;

    for (const key of Object.keys(CONSTELLATIONS)) {
        if (!CONSTELLATIONS[key].enabled) continue;
        if (key === 'military' || key === 'civilian') {
            fetchAircraft(key);
            applyAircraftLod(key);
            if (satData[key]?.planes) updatePlanesPositions(key);
        } else if (satData[key]?.planes) {
            updatePlanesPositions(key);
        } else if (satData[key]?.useFallbackPositions) {
            updateFallbackPositions(key);
        } else {
            updateSGP4Positions(key);
        }
    }
}

/* ====== TOGGLE ====== */
function toggleConstellation(key, enabled) {
    const config = CONSTELLATIONS[key];
    if (!config) return;
    config.enabled = enabled;

    if (enabled) {
        if (key === 'military' || key === 'civilian') {
            fetchAircraft(key, !satData[key]?.allPlanes?.length);
        } else if (!satData[key]) {
            fetchConstellationTLEs(key);
        }
    }

    const cb = document.querySelector(`input[data-sat="${key}"]`);
    if (cb) cb.checked = enabled;

    let activeBody = 'earth';
    if (typeof currentViewMode !== 'undefined') {
        activeBody = typeof getActiveBodyForView === 'function' ? getActiveBodyForView(currentViewMode) : 'earth';
    }
    const targetBody = config.body || 'earth';
    const isVisible = enabled && (activeBody === targetBody);

    if (satData[key]?.points) satData[key].points.visible = isVisible;
    if (satData[key]?.mesh) satData[key].mesh.visible = isVisible;
    if (satData[key]?.tails) satData[key].tails.visible = isVisible;

    updateSatCountDisplay();
}

function updateSatCountDisplay() {
    let total = 0;
    for (const key of Object.keys(CONSTELLATIONS)) {
        if (CONSTELLATIONS[key].enabled) {
            total += getFallbackSatCount(key);
        }
    }
    const countEl = document.getElementById('sat-count');
    if (countEl) {
        countEl.textContent = total > 0 ? `${total} tracked` : '';
    }
}

/* ====== INIT ====== */
function initSatelliteToggles() {
    initSatelliteMarkerScale();
    document.querySelectorAll('input[data-sat]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            toggleConstellation(e.target.dataset.sat, e.target.checked);
        });
    });
    initSatelliteInteractions();
}

function clampSatelliteMarkerScale(value) {
    return Math.min(MAX_SAT_MARKER_SCALE, Math.max(MIN_SAT_MARKER_SCALE, value));
}

function setSatelliteMarkerScale(value, persist = true) {
    const parsed = Number(value);
    satMarkerScale = clampSatelliteMarkerScale(Number.isFinite(parsed) ? parsed : DEFAULT_SAT_MARKER_SCALE);

    const input = document.getElementById('sat-marker-scale');
    const output = document.getElementById('val-sat-marker-scale');
    if (input) input.value = satMarkerScale.toFixed(2);
    if (output) output.textContent = `${satMarkerScale.toFixed(2)}x`;

    Object.values(satData).forEach(data => {
        if (data.points?.material && data.points.userData.markerBaseSize) {
            data.points.material.size = data.points.userData.markerBaseSize * satMarkerScale;
            data.points.material.needsUpdate = true;
        }
        if (data.mesh?.geometry && data.mesh.userData.markerBaseSize) {
            const size = data.mesh.userData.markerBaseSize * satMarkerScale;
            data.mesh.geometry.dispose();
            data.mesh.geometry = new THREE.PlaneGeometry(size, size);
        }
    });

    satRaycaster.params.Points.threshold = 0.16 * satMarkerScale;
    if (persist) {
        try { localStorage.setItem(SAT_MARKER_SCALE_KEY, String(satMarkerScale)); } catch { }
    }
}

function initSatelliteMarkerScale() {
    const input = document.getElementById('sat-marker-scale');
    if (!input) return;

    let initialScale = DEFAULT_SAT_MARKER_SCALE;
    try {
        const savedScale = Number(localStorage.getItem(SAT_MARKER_SCALE_KEY));
        if (Number.isFinite(savedScale) && savedScale > 0) initialScale = savedScale;
    } catch { }

    setSatelliteMarkerScale(initialScale, false);
    input.addEventListener('input', event => setSatelliteMarkerScale(event.target.value));
}

/* ====== INTERACTION ====== */
let selectedSatVisuals = new THREE.Group();
const satRaycaster = new THREE.Raycaster();
satRaycaster.params.Points.threshold = 0.16 * satMarkerScale;
const satMouse = new THREE.Vector2();

function initSatelliteInteractions() {
    earthGroup.add(selectedSatVisuals);
    renderer.domElement.addEventListener('pointerdown', onSatPointerDown);

    document.getElementById('close-detail')?.addEventListener('click', () => {
        clearSelectedSatellite();
    });
}

function onSatPointerDown(event) {
    if (typeof moonToolsMode !== 'undefined' && moonToolsMode !== 'pan') return; // let moon tools override

    const rect = renderer.domElement.getBoundingClientRect();
    satMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    satMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    satRaycaster.setFromCamera(satMouse, camera);

    let closestIntersect = null;
    let closestKey = null;

    // Check all visible constellation points
    for (const key of Object.keys(satData)) {
        const obj = satData[key]?.points || satData[key]?.mesh;
        if (obj && obj.visible) {
            const intersects = satRaycaster.intersectObject(obj);
            if (intersects.length > 0) {
                if (!closestIntersect || intersects[0].distance < closestIntersect.distance) {
                    closestIntersect = intersects[0];
                    closestIntersect.customIndex = intersects[0].instanceId !== undefined ? intersects[0].instanceId : intersects[0].index;
                    closestKey = key;
                }
            }
        }
    }

    if (closestIntersect && closestKey) {
        selectSatellite(closestKey, closestIntersect.customIndex);
    } else {
        clearSelectedSatellite();
    }
}

function clearSelectedSatellite() {
    while (selectedSatVisuals.children.length > 0) {
        const obj = selectedSatVisuals.children[0];
        selectedSatVisuals.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
    }
    const panel = document.getElementById('entity-detail-panel');
    if (panel) panel.classList.add('hidden');
}

function selectSatellite(key, index) {
    clearSelectedSatellite();
    const data = satData[key];
    const config = CONSTELLATIONS[key];
    if (!data || !config) return;

    let satName = config.name;
    let satPosition = new THREE.Vector3();

    // Get position array to find actual point
    if (data.points) {
        const posArray = data.points.geometry.attributes.position.array;
        satPosition.set(posArray[index * 3], posArray[index * 3 + 1], posArray[index * 3 + 2]);
    } else if (data.mesh) {
        const mat = new THREE.Matrix4();
        data.mesh.getMatrixAt(index, mat);
        satPosition.setFromMatrixPosition(mat);
    }

    const isFallback = data.useFallbackPositions;
    let satrec = null;
    let fallbackSat = null;

    if (data.planes) {
        const plane = data.planes[index];
        satName = plane.name + ' (Military)';
    } else if (isFallback) {
        fallbackSat = data.fallbackSats[index];
        satName += ` - Modeled #${index + 1}`;
    } else {
        satrec = data.satrecs[index];
        if (satrec) {
            satName = satrec.name || `${config.name} #${index + 1}`;
        }
    }

    // 1. Draw highlighted dot
    const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.1, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false })
    );
    dot.position.copy(satPosition).multiplyScalar(1.001);
    dot.lookAt(new THREE.Vector3(0, 0, 0));
    dot.renderOrder = 9;
    selectedSatVisuals.add(dot);

    // 2. Add Label
    const { tex, w, h } = makeSatLabelTexture(satName, config.color);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.position.copy(satPosition).multiplyScalar(1.04);
    const aspect = w / h;
    sprite.scale.set(0.6 * aspect, 0.6, 1);
    sprite.renderOrder = 10;
    selectedSatVisuals.add(sprite);

    // 3. Draw Orbit Track
    if (!data.planes) {
        drawSelectedOrbit(key, index, config.color);
    }

    // 4. Show HTML Details Panel
    const panel = document.getElementById('entity-detail-panel');
    if (panel) {
        document.getElementById('ed-name').innerText = satName;
        document.getElementById('ed-icon').innerText = data.planes ? '✈️' : '🛰️';
        document.getElementById('ed-type').innerText = config.name;

        if (data.planes) {
            const p = data.planes[index];
            document.getElementById('ed-alt').innerText = `${p.altKm.toFixed(1)} km`;
            document.getElementById('ed-speed').innerText = `${p.speedKmh} km/h`;
            document.getElementById('ed-track').innerText = `${Math.round(p.track)}°`;
            document.getElementById('ed-track-container').style.display = 'flex';
        } else {
            const r = satPosition.length();
            const bodyRadiusKm = getBodyRadiusKm(config.body || 'earth');
            const altExag = parseFloat(ui.altx?.value || 3);
            const alt = ((r / EARTH_RADIUS_UNITS) - 1) * bodyRadiusKm / Math.max(altExag, 0.01);
            document.getElementById('ed-alt').innerText = `~${alt.toFixed(0)} km`;
            document.getElementById('ed-speed').innerText = '27,500 km/h'; // approx orbital velocity
            document.getElementById('ed-track-container').style.display = 'none';
        }

        panel.classList.remove('hidden');
    }
}

function drawSelectedOrbit(key, index, colorStr) {
    const data = satData[key];
    const pts = [];
    const segments = 120;
    const now = new Date();
    const altExag = parseFloat(typeof ui !== 'undefined' && ui.altx ? ui.altx.value : 3);
    const color = new THREE.Color(colorStr);

    if (data.useFallbackPositions) {
        const sat = data.fallbackSats[index];
        const altKm = data.orbitParams.altKm;
        const r = getOrbitalRenderRadius(altKm, CONSTELLATIONS[key]?.body || 'earth', altExag);
        const incRad = sat.inclination * Math.PI / 180;
        const raanRad = sat.raan * Math.PI / 180; // Approximate static orbit track (ignoring earth rotation for track preview)

        for (let i = 0; i <= segments; i++) {
            const maRad = (i / segments) * Math.PI * 2;
            const xOrb = r * Math.cos(maRad);
            const yOrb = r * Math.sin(maRad);

            const x1 = xOrb;
            const y1 = yOrb * Math.cos(incRad);
            const z1 = yOrb * Math.sin(incRad);

            const x = x1 * Math.cos(raanRad) - y1 * Math.sin(raanRad);
            const z = x1 * Math.sin(raanRad) + y1 * Math.cos(raanRad);
            pts.push(new THREE.Vector3(x, z1, z));
        }
    } else {
        const satrec = data.satrecs[index].satrec;
        const nowMs = now.getTime();
        // SGP4 orbital period approximation in minutes = 2 * PI / mean motion
        const meanMotionRevPerDay = satrec.no * (1440 / (2 * Math.PI)); // rough
        const periodMin = 1440 / meanMotionRevPerDay;
        const periodMs = periodMin * 60 * 1000;
        const stepMs = periodMs / segments;

        for (let i = 0; i <= segments; i++) {
            const t = new Date(nowMs + i * stepMs);
            const prop = satellite.propagate(satrec, t);
            if (!prop.position || typeof prop.position.x !== 'number') continue;
            const gmst = satellite.gstime(t);
            const geo = satellite.eciToGeodetic(prop.position, gmst);
            const lat = satellite.degreesLat(geo.latitude);
            const lon = satellite.degreesLong(geo.longitude);
            const r = EARTH_RADIUS_UNITS * (1 + (geo.height / EARTH_RADIUS_KM) * altExag);
            pts.push(latLonToPos(lat, lon, r));
        }
    }

    if (pts.length > 0) {
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.8, linewidth: 2, depthTest: true })
        );
        line.renderOrder = 5;
        selectedSatVisuals.add(line);
    }
}

function makeSatLabelTexture(text, colorStr) {
    const c = document.createElement('canvas'); const ctx = c.getContext('2d');
    ctx.font = '600 24px Inter';
    const textW = ctx.measureText(text).width; const w = textW + 20; const h = 36;
    c.width = w; c.height = h;
    ctx.fillStyle = 'rgba(10,10,15,0.85)'; ctx.beginPath(); ctx.roundRect(0, 0, w, h, 8); ctx.fill();
    ctx.strokeStyle = colorStr; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '600 24px Inter'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, 10, h / 2 + 2);
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
    return { tex, w, h };
}
