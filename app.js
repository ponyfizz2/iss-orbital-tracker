/* =========================
   CONFIG + CONSTANTS
========================= */
const MAP_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAABlBMVEUAAAD///+l2Z/dAAABGklEQVRYw+2YMQ6DMBBDXyAnQC6AnAA5AXIB5AThApxA7kAnuUByAsvVvUpU9atYSmV7S/6D7dhS/T7LkhWfH+M48vXyInmRPX3OayYvshY8K9O77OlzXjN5kbXgWZneeZfN90xeZC14VqZ32dPnvGbyImvBszK98y6b75m8yFrwrEzvsifzImvBszK9y54+5zWTF1kLnpXpnXfZfM/kRdaCZ2V6lz15kbXgWZneZfM9kxdZC56V6V325EXWgmdlepc9fc5rJi+yFjwr0zvvsvmfyYusBc/K9C57+pzXTF5kLXhWpnfeZfM9kxdZC56V6V325EXWgmdlepfcJi+yFjwr07vsyYusBc/K9C578iJrwbMyvfMue/Ii6789PwE7F/K44WqJswAAAABJRU5ErkJggg==";
const COUNTRIES_GEOJSON_URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";
const ISS_TLE_URL_PRIMARY = "https://api.wheretheiss.at/v1/satellites/25544/tles";
const ISS_TLE_URL_FALLBACK = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";
const TLE_STORAGE_KEY = "iss_tle_cache_v1";
const TLE_FETCH_TIMEOUT_MS = 7000;
const TRACK_COLOR = 0x22c55e;
const BORDER_NEAR = new THREE.Color(0xffffff);
const BORDER_FAR = new THREE.Color(0x5c6672);
const EARTH_RADIUS_UNITS = 5;
const EARTH_RADIUS_KM = 6371;
const DEFAULT_ALT_KM = 420;
const ORBIT_PERIOD_MS = 92 * 60 * 1000;
let FETCH_INTERVAL_MS = 30000;
let fetchIntervalId = null;
let FUTURE_STEP_SEC = 20;
let PAST_STEP_SEC = 20;
const FOOTPRINT_OUTER_THICKNESS = 0.18;
const ASTROS_URLS = [
  'https://api.open-notify.org/astros.json',
  'http://api.open-notify.org/astros.json',
];

/* STATE */
let scene, camera, renderer, controls;
let earthGroup, trackingGroup;
let dots, earthDotsMaterial, landMask, stars;
let borderDots, borderPositions, borderColors;
let countryGeoJSON = null;
let cityLights = null, terminatorLine = null;
let issMarker, laser, laserBeam, impactRing;
let pastLine, futureDots, swathRing = null;
let calloutGroup, calloutStem, calloutElbow, calloutLabel, calloutGlow;
let highlightDots = null;
let dayNightEnabled = true, trackerEnabled = true, autoFollowEnabled = false, pathsEnabled = true;
let sunDir = new THREE.Vector3(1, 0, 0);
let issPos = { lat: 0, lon: 0, altKm: DEFAULT_ALT_KM };
let issPrev = null, issNext = null;
const LIVE_HISTORY_MAX = 480;
let liveHistory = [];
let tle = { line1: null, line2: null, satrec: null, lastFetch: 0 };
const TLE_TTL_MS = 6 * 60 * 60 * 1000;
let lastOverText = "--", lastOverFetchMs = 0;
const OVER_TTL_MS = 30000;
let lastBorderShadeMs = 0, lastSwathMs = 0, lastHighlightKey = "";
let crewCount = null, crewNames = [];
let lastRefreshTime = Date.now();
let issSpeedKmh = 0;
let currentViewMode = 'dots';
let appBootStarted = false;

/* FETCH HELPERS */
async function fetchWithTimeout(url, opts = {}, timeoutMs = TLE_FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(id); }
}

/* UI HOOKS */
const ui = {
  den: document.getElementById('dot-density'),
  rot: document.getElementById('rot-speed'),
  altx: document.getElementById('alt-exag'),
  valDen: document.getElementById('val-den'),
  valRot: document.getElementById('val-rot'),
  valAltx: document.getElementById('val-altx'),
  status: document.getElementById('status-txt'),
  over: document.getElementById('iss-over'),
  toggleDN: document.getElementById('toggle-daynight'),
  toggleFollow: document.getElementById('toggle-follow'),
  toggleTracker: document.getElementById('toggle-tracker'),
  togglePaths: document.getElementById('toggle-paths'),
  panelToggle: document.getElementById('panel-toggle'),
  controlsPanel: document.getElementById('controls-panel'),
  refreshBar: document.getElementById('refresh-bar'),
  liveDot: document.getElementById('live-dot'),
  crewBadge: document.getElementById('crew-badge'),
  viewDots: document.getElementById('view-dots'),
  viewSatellite: document.getElementById('view-satellite'),
  viewHologram: document.getElementById('view-hologram'),
  refreshRate: document.getElementById('refresh-rate'),
  valRefresh: document.getElementById('val-refresh'),
};

/* BOOT */
async function startISSApp() {
  if (appBootStarted) return;
  appBootStarted = true;

  initScene();
  preloadTextures(); // background-load satellite/weather textures
  const countriesReady = loadCountriesGeoJSON();
  const tleReady = refreshTLEIfNeeded(true);

  // Only the base globe blocks first paint. Remote enrichment continues in the
  // background so a slow TLE or GeoJSON provider cannot hold the loading screen.
  await createEarth();
  createCityLights();
  createTerminatorLine();
  createTracking();
  createStars();
  setupLights();
  rebuildOrbitTracks();
  animate();

  countriesReady.then(async () => {
    await createCountryBorders();
    buildCountryHighlight(normalizeOverText(ui.over.innerText));
  }).catch(() => { });
  tleReady.then(() => rebuildOrbitTracks()).catch(() => { });

  updateISSData(false);
  fetchIntervalId = setInterval(updateISSData, FETCH_INTERVAL_MS);
  fetchCrewData();
  setInterval(fetchCrewData, 5 * 60 * 1000);
  initSatelliteToggles();
  initMoonTools();
  setTimeout(() => {
    document.getElementById('loading-screen').style.opacity = '0';
    setTimeout(() => { const ls = document.getElementById('loading-screen'); if (ls) ls.remove(); }, 500);
  }, 350);
}

window.startISSApp = startISSApp;

/* CREW */
function fetchJSONP(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const callbackName = `openNotifyAstros_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('JSONP request timed out'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeoutId);
      script.remove();
      delete window[callbackName];
    }

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('JSONP request failed'));
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

async function fetchAstrosPayload() {
  for (const url of ASTROS_URLS) {
    try {
      const res = await fetchWithTimeout(url, {}, 5000);
      if (res.ok) return await res.json();
    } catch { }
  }
  return fetchJSONP(ASTROS_URLS[1], 5000);
}

async function fetchCrewData() {
  try {
    const data = await fetchAstrosPayload();
    if (data.people) {
      const issCrew = data.people.filter(p => p.craft === 'ISS');
      crewCount = issCrew.length;
      crewNames = issCrew.map(p => p.name);
      ui.crewBadge.innerHTML = `👨‍🚀 ${crewCount} aboard ISS`;
      ui.crewBadge.title = crewNames.join(', ');
    }
  } catch (e) {
    ui.crewBadge.innerHTML = '👨‍🚀 Crew data unavailable';
  }
}

/* SCENE */
function initScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(14, 10, 14);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('canvas-container').appendChild(renderer.domElement);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 5.05;
  controls.maxDistance = 150;
  earthGroup = new THREE.Group();
  scene.add(earthGroup);
  trackingGroup = new THREE.Group();
  earthGroup.add(trackingGroup);
  window.addEventListener('resize', onWindowResize, false);

  // Start with an unobstructed globe on small screens; both panels remain one
  // tap away through their dedicated buttons.
  if (window.matchMedia('(max-width: 768px)').matches) {
    ui.controlsPanel.classList.add('collapsed');
  }

  // Buttons
  document.getElementById('reset-cam').onclick = () => presetOrbit();
  document.getElementById('reset-rotation').onclick = () => { ui.rot.value = 0; ui.valRot.innerText = "0"; };

  ui.toggleDN.onclick = () => { dayNightEnabled = !dayNightEnabled; ui.toggleDN.innerHTML = `Day/Night: ${dayNightEnabled ? "ON" : "OFF"} <span class="kbd">D</span>`; ui.toggleDN.classList.toggle('btn-on', dayNightEnabled); updateDNUniforms(); updateTerminatorLine(); };
  ui.toggleFollow.onclick = () => { autoFollowEnabled = !autoFollowEnabled; ui.toggleFollow.innerHTML = `Follow: ${autoFollowEnabled ? "ON" : "OFF"} <span class="kbd">F</span>`; ui.toggleFollow.classList.toggle('btn-on', autoFollowEnabled); };
  ui.toggleTracker.onclick = () => { trackerEnabled = !trackerEnabled; ui.toggleTracker.innerHTML = `Tracker: ${trackerEnabled ? "ON" : "OFF"} <span class="kbd">T</span>`; ui.toggleTracker.classList.toggle('btn-on', trackerEnabled); setTrackerVisible(trackerEnabled); };
  ui.togglePaths.onclick = () => { pathsEnabled = !pathsEnabled; ui.togglePaths.innerHTML = `Paths: ${pathsEnabled ? "ON" : "OFF"} <span class="kbd">P</span>`; ui.togglePaths.classList.toggle('btn-on', pathsEnabled); setPathsVisible(pathsEnabled && trackerEnabled); if (pathsEnabled) rebuildOrbitTracks(); };

  ui.panelToggle.onclick = () => { ui.controlsPanel.classList.toggle('collapsed'); };

  // View mode switcher
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => setViewMode(btn.dataset.view));
  });

  ui.den.oninput = (e) => ui.valDen.innerText = (e.target.value / 1000).toFixed(0) + "k";
  ui.rot.oninput = (e) => ui.valRot.innerText = (parseFloat(e.target.value) || 0).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  ui.altx.oninput = (e) => ui.valAltx.innerText = parseFloat(e.target.value).toFixed(1) + "x";
  ui.den.onchange = async () => { await rebuildGlobe(); };
  ui.altx.onchange = () => { rebuildOrbitTracks(); };

  // Refresh rate slider
  if (ui.refreshRate) {
    ui.refreshRate.oninput = (e) => { ui.valRefresh.innerText = e.target.value + 's'; };
    ui.refreshRate.onchange = (e) => {
      FETCH_INTERVAL_MS = parseInt(e.target.value) * 1000;
      if (fetchIntervalId) clearInterval(fetchIntervalId);
      fetchIntervalId = setInterval(updateISSData, FETCH_INTERVAL_MS);
      lastRefreshTime = Date.now();
    };
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    if (key === 'd') ui.toggleDN.click();
    else if (key === 'f') ui.toggleFollow.click();
    else if (key === 't') ui.toggleTracker.click();
    else if (key === 'p') ui.togglePaths.click();
    else if (key === 'r') presetOrbit();
    else if (key === 's') { ui.rot.value = 0; ui.valRot.innerText = "0"; }
    else if (key === ' ') { e.preventDefault(); const v = parseFloat(ui.rot.value); ui.rot.value = v > 0 ? 0 : 0.0005; ui.valRot.innerText = parseFloat(ui.rot.value).toFixed(4).replace(/0+$/, '').replace(/\.$/, ''); }
    else if (key === '1') setViewMode('dots');
    else if (key === '2') setViewMode('satellite');
    else if (key === '3') setViewMode('hologram');
    else if (key === '4') setViewMode('moon');
    else if (key === '5') setViewMode('mars');
  });
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
