/* =========================
   ASTRONOMY EXPLORATION LAYER
========================= */

const EXPLORATION_TOURS = [
  {
    id: 'orbit',
    label: 'Live',
    title: 'ISS ground track',
    note: 'Locks onto the station, keeps future and past orbital paths visible, and keeps the live position readout in view.',
    run: () => {
      setBodyMode('dots');
      setCoreToggle('tracker', true);
      setCoreToggle('paths', true);
      setCoreToggle('follow', true);
      setCoreToggle('daynight', true);
      setSliderValue('alt-exag', 4.5, 'change');
      moveCameraTo(new THREE.Vector3(12, 8, 12), new THREE.Vector3(0, 0, 0));
    },
  },
  {
    id: 'night',
    label: 'Earth',
    title: 'Night-side cities',
    note: 'Switches to the textured Earth layer so coastlines, cloud glow, and city lights can be read against the terminator.',
    run: () => {
      setBodyMode('satellite');
      setCoreToggle('daynight', true);
      setCoreToggle('follow', false);
      setSliderValue('rot-speed', 0.0007, 'input');
      moveCameraTo(new THREE.Vector3(-9, 5, 13), new THREE.Vector3(0, 0, 0));
    },
  },
  {
    id: 'satellites',
    label: 'Orbit',
    title: 'Satellite megastructure',
    note: 'Turns on dense satellite families and raises the altitude scale so orbital shells become easy to compare.',
    run: () => {
      setBodyMode('dots');
      ['starlink', 'gps', 'iridium', 'hubble'].forEach((key) => setConstellationEnabled(key, true));
      setSliderValue('alt-exag', 7.2, 'change');
      setCoreToggle('paths', true);
      setCoreToggle('follow', false);
      moveCameraTo(new THREE.Vector3(17, 11, 18), new THREE.Vector3(0, 0, 0));
    },
  },
  {
    id: 'moon',
    label: 'Moon',
    title: 'Lunar geology bench',
    note: 'Opens the Moon with landing-site labels and the measuring tools for distances and crater areas.',
    run: () => {
      setBodyMode('moon');
      setConstellationEnabled('lro', true);
      setSliderValue('rot-speed', 0.0004, 'input');
      moveCameraTo(new THREE.Vector3(7, 3, 8), new THREE.Vector3(0, 0, 0));
    },
  },
  {
    id: 'mars',
    label: 'Mars',
    title: 'Mars relay preview',
    note: 'Focuses Mars and enables the Mars Reconnaissance Orbiter layer when available.',
    run: () => {
      setBodyMode('mars');
      setConstellationEnabled('mro', true);
      setSliderValue('rot-speed', 0.0005, 'input');
      moveCameraTo(new THREE.Vector3(7.5, 4, 8.5), new THREE.Vector3(0, 0, 0));
    },
  },
  {
    id: 'solar',
    label: 'Atlas',
    title: 'Solar system survey',
    note: 'Pulls back into a compact orrery for comparing the inner and outer planets, then lets the catalog jump to each body.',
    run: () => {
      setBodyMode('solar');
      solarSelectedKey = 'earth';
      updateSolarEphemeris(true);
      updateSolarReadout();
      moveCameraTo(new THREE.Vector3(0, 65, 86), new THREE.Vector3(0, 0, 0));
    },
  },
];

const CATALOG_OBJECTS = [
  { key: 'iss', name: 'International Space Station', type: 'spacecraft', mode: 'dots', tag: 'live orbit', note: 'Crewed laboratory in low Earth orbit with live ground-track data.' },
  { key: 'earth', name: 'Earth', type: 'planet', mode: 'satellite', tag: 'home world', note: 'Textured Earth with day-night shading, clouds, city lights, borders, and station tracking.' },
  { key: 'moon', name: 'Moon', type: 'moon', mode: 'moon', tag: 'surface tools', note: 'Lunar surface with Apollo labels plus measuring tools for distances and crater areas.' },
  { key: 'mars', name: 'Mars', type: 'planet', mode: 'mars', tag: 'red planet', note: 'Mars globe with relay-orbit context for exploration planning.' },
  { key: 'sun', name: 'Sun', type: 'star', mode: 'solar', tag: 'orrery', note: 'Center of the compact solar-system survey.' },
  { key: 'mercury', name: 'Mercury', type: 'planet', mode: 'mercury', tag: 'surface globe', note: 'Inspect Mercury as a full-size cratered globe.' },
  { key: 'venus', name: 'Venus', type: 'planet', mode: 'venus', tag: 'cloud globe', note: 'Inspect the global cloud patterns of Venus.' },
  { key: 'jupiter', name: 'Jupiter', type: 'planet', mode: 'jupiter', tag: 'storm globe', note: 'Inspect Jupiter’s belts, zones, and Great Red Spot.' },
  { key: 'saturn', name: 'Saturn', type: 'planet', mode: 'saturn', tag: 'ring globe', note: 'Inspect Saturn and its broad ring system.' },
  { key: 'uranus', name: 'Uranus', type: 'planet', mode: 'uranus', tag: 'ice giant', note: 'Inspect Uranus with its extreme axial tilt and narrow rings.' },
  { key: 'neptune', name: 'Neptune', type: 'planet', mode: 'neptune', tag: 'ice giant', note: 'Inspect Neptune’s blue atmosphere, clouds, and dark storm.' },
  { key: 'hubble', name: 'Hubble Space Telescope', type: 'spacecraft', mode: 'dots', tag: 'toggle layer', note: 'Enables and frames the Hubble orbital layer.' },
  { key: 'starlink', name: 'Starlink shell', type: 'constellation', mode: 'dots', tag: 'toggle layer', note: 'Enables a large low-orbit satellite shell for scale comparison.' },
  { key: 'gps', name: 'GPS constellation', type: 'constellation', mode: 'dots', tag: 'toggle layer', note: 'Enables medium-Earth navigation satellites far above low orbit.' },
];

// JPL approximate Keplerian elements and rates for 1800–2050. Positions are
// recalculated from the current UTC time; display radii are compacted so all
// eight planets remain usable in one interactive view.
const SOLAR_PLANETS = [
  { key: 'mercury', name: 'Mercury', radius: 0.28, orbit: 4.4, color: 0xa7a29c, copy: 'A small, fast world skimming close to the Sun.', elements: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]] },
  { key: 'venus', name: 'Venus', radius: 0.48, orbit: 6.2, color: 0xeab676, copy: 'A bright, cloud-covered planet with a crushing atmosphere.', elements: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]] },
  { key: 'earth', name: 'Earth', radius: 0.52, orbit: 8.2, color: 0x3b82f6, copy: 'The reference world for live ISS tracking and day-night geometry.', elements: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]] },
  { key: 'mars', name: 'Mars', radius: 0.38, orbit: 10.5, color: 0xd65f3a, copy: 'Cold desert planet with active orbital reconnaissance missions.', elements: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]] },
  { key: 'jupiter', name: 'Jupiter', radius: 1.05, orbit: 15.4, color: 0xd7b28c, copy: 'A banded gas giant anchoring the outer-system scale.', elements: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]] },
  { key: 'saturn', name: 'Saturn', radius: 0.92, orbit: 20.6, color: 0xe2c27e, copy: 'A ringed planet shown with a tilted, inspectable ring plane.', elements: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]] },
  { key: 'uranus', name: 'Uranus', radius: 0.72, orbit: 25.8, color: 0x93d9e8, copy: 'A pale ice giant rolling around the Sun on its side.', elements: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]] },
  { key: 'neptune', name: 'Neptune', radius: 0.70, orbit: 31.2, color: 0x4169e1, copy: 'A deep-blue ice giant at the outer edge of the major-planet system.', elements: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]] },
];

let solarGroup = null;
let solarObjects = {};
let solarRaycaster = null;
let solarMouse = null;
let solarSelectedKey = 'earth';
let lastSolarEphemerisUpdate = 0;
let explorationReady = false;
let lastExplorationMode = 'dots';

initExplorationUi();
wrapExplorationHooks();

function initExplorationUi() {
  const panel = document.getElementById('explore-panel');
  const toggle = document.getElementById('explore-toggle');
  const close = document.getElementById('explore-close');
  if (!panel || !toggle) return;

  if (window.matchMedia('(max-width: 768px)').matches) {
    panel.classList.add('collapsed');
  }

  toggle.addEventListener('click', () => panel.classList.toggle('collapsed'));
  close?.addEventListener('click', () => panel.classList.add('collapsed'));

  document.querySelectorAll('[data-explore-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setExploreTab(btn.dataset.exploreTab));
  });

  const tourGrid = document.getElementById('tour-grid');
  if (tourGrid) {
    tourGrid.innerHTML = EXPLORATION_TOURS.map((tour) => `
      <button class="tour-btn" data-tour="${tour.id}">
        <span class="tour-label">${tour.label}</span>
        <strong>${tour.title}</strong>
      </button>
    `).join('');
    tourGrid.querySelectorAll('[data-tour]').forEach((btn) => {
      btn.addEventListener('click', () => runTour(btn.dataset.tour));
    });
  }

  const search = document.getElementById('catalog-search');
  search?.addEventListener('input', () => renderCatalog(search.value));
  renderCatalog('');
  renderEvents();
  setInterval(renderEvents, 1000);
  updateExplorationClock();
  setInterval(updateExplorationClock, 1000);

  document.getElementById('orrery-action')?.addEventListener('click', () => {
    document.getElementById('explore-panel')?.classList.remove('collapsed');
    setExploreTab('catalog');
  });

  document.addEventListener('keydown', (event) => {
    if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;
    const key = event.key.toLowerCase();
    if (key === '6') setBodyMode('solar');
    if (key === 'e') panel.classList.toggle('collapsed');
  });

  explorationReady = true;
}

function wrapExplorationHooks() {
  if (typeof setViewMode === 'function') {
    const baseSetViewMode = setViewMode;
    setViewMode = function explorationSetViewMode(mode) {
      baseSetViewMode(mode);
      syncExplorationMode(mode);
    };
  }

  if (typeof updateActiveViewMode === 'function') {
    const baseUpdateActiveViewMode = updateActiveViewMode;
    updateActiveViewMode = function explorationUpdateActiveViewMode() {
      baseUpdateActiveViewMode();
      animateSolarSystem();
    };
  }
}

function setExploreTab(tab) {
  document.querySelectorAll('.explore-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.exploreTab === tab);
  });
  document.querySelectorAll('.explore-view').forEach((view) => {
    view.classList.toggle('active', view.id === `explore-tab-${tab}`);
  });
}

function runTour(id) {
  const tour = EXPLORATION_TOURS.find((item) => item.id === id);
  if (!tour) return;
  tour.run();
  setMissionNote(tour.note);
  setFocus(tour.title);
}

function renderCatalog(query) {
  const list = document.getElementById('catalog-list');
  if (!list) return;
  const q = (query || '').trim().toLowerCase();
  const items = CATALOG_OBJECTS.filter((item) => {
    return !q || `${item.name} ${item.type} ${item.tag} ${item.note}`.toLowerCase().includes(q);
  });

  list.innerHTML = items.map((item) => `
    <button class="catalog-row" data-catalog="${item.key}">
      <strong>${item.name}</strong>
      <span class="catalog-meta">${item.type}</span>
      <span class="tag">${item.tag}</span>
    </button>
  `).join('');

  list.querySelectorAll('[data-catalog]').forEach((btn) => {
    btn.addEventListener('click', () => selectCatalogObject(btn.dataset.catalog));
  });
}

function selectCatalogObject(key) {
  const item = CATALOG_OBJECTS.find((obj) => obj.key === key);
  if (!item) return;

  setBodyMode(item.mode);
  setMissionNote(item.note);
  setFocus(item.name);

  if (item.mode === 'solar') {
    selectSolarObject(key);
    return;
  }

  if (key === 'iss') {
    setCoreToggle('tracker', true);
    setCoreToggle('paths', true);
    moveCameraTo(new THREE.Vector3(12, 8, 12), new THREE.Vector3(0, 0, 0));
  } else if (['hubble', 'starlink', 'gps'].includes(key)) {
    setConstellationEnabled(key, true);
    setSliderValue('alt-exag', key === 'gps' ? 8 : 6, 'change');
    moveCameraTo(new THREE.Vector3(15, 10, 16), new THREE.Vector3(0, 0, 0));
  } else {
    moveCameraTo(new THREE.Vector3(8, 4.5, 9), new THREE.Vector3(0, 0, 0));
  }
}

function renderEvents() {
  const list = document.getElementById('event-list');
  if (!list) return;
  const now = new Date();
  const nextRefresh = Math.max(0, Math.ceil(((typeof lastRefreshTime !== 'undefined' ? lastRefreshTime : Date.now()) + (typeof FETCH_INTERVAL_MS !== 'undefined' ? FETCH_INTERVAL_MS : 30000) - Date.now()) / 1000));
  const phase = getMoonPhase(now);
  const season = getNextSeasonMarker(now);
  const issLoop = getIssOrbitCountdown(now);

  const rows = [
    { title: 'Next ISS refresh', meta: 'Live telemetry polling', time: `${nextRefresh}s` },
    { title: 'Approx. orbital lap', meta: 'ISS period model', time: issLoop },
    { title: `Moon phase: ${phase.name}`, meta: `${phase.illumination}% illumination`, time: phase.age },
    { title: season.name, meta: 'Next seasonal marker', time: season.countdown },
  ];

  list.innerHTML = rows.map((row) => `
    <div class="event-row">
      <div>
        <strong>${row.title}</strong>
        <span class="event-meta">${row.meta}</span>
      </div>
      <span class="event-time">${row.time}</span>
    </div>
  `).join('');
}

function updateExplorationClock() {
  const clock = document.getElementById('explore-clock');
  const season = document.getElementById('explore-season');
  const now = new Date();
  if (clock) {
    clock.textContent = now.toISOString().slice(11, 16) + ' UTC';
  }
  if (season) {
    season.textContent = getHemisphereSeason(now);
  }
}

function setBodyMode(mode) {
  if (typeof setViewMode === 'function') setViewMode(mode);
}

function syncExplorationMode(mode) {
  if (!explorationReady) return;
  const isSolar = mode === 'solar';
  const isPlanet = typeof isPlanetViewMode === 'function' && isPlanetViewMode(mode);
  if (isSolar) createSolarSystemView();
  if (solarGroup) solarGroup.visible = isSolar;
  if (typeof earthGroup !== 'undefined' && earthGroup) earthGroup.visible = !isSolar;

  const dataPanel = document.querySelector('.data-panel');
  if (dataPanel) dataPanel.style.display = (isSolar || isPlanet) ? 'none' : '';

  const readout = document.getElementById('orrery-readout');
  if (readout) readout.classList.toggle('visible', isSolar || isPlanet);
  if (isPlanet && typeof updatePlanetViewReadout === 'function') updatePlanetViewReadout(mode);

  if (isSolar) {
    setFocus('Solar system survey');
    if (typeof controls !== 'undefined' && controls) {
      controls.minDistance = 3;
      controls.maxDistance = 180;
    }
    moveCameraTo(new THREE.Vector3(0, 65, 86), new THREE.Vector3(0, 0, 0));
  } else if (typeof controls !== 'undefined' && controls) {
    controls.minDistance = 5.05;
    controls.maxDistance = 150;
    if (lastExplorationMode === 'solar') {
      const returnPosition = mode === 'moon' || isPlanet
        ? new THREE.Vector3(11, 6, 12)
        : new THREE.Vector3(14, 10, 14);
      moveCameraTo(returnPosition, new THREE.Vector3(0, 0, 0));
    }
  }
  lastExplorationMode = mode;
}

function getJulianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function getPlanetElementsAtDate(planet, date) {
  const centuries = (getJulianDate(date) - 2451545.0) / 36525;
  return planet.elements[0].map((base, index) => base + planet.elements[1][index] * centuries);
}

function solveKeplerEquation(meanAnomaly, eccentricity) {
  let eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(meanAnomaly);
  for (let i = 0; i < 8; i++) {
    const delta = (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) /
      (1 - eccentricity * Math.cos(eccentricAnomaly));
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 1e-9) break;
  }
  return eccentricAnomaly;
}

function planetPositionFromElements(planet, elements, eccentricAnomaly = null) {
  const [a, e, inclinationDeg, meanLongitudeDeg, perihelionDeg, nodeDeg] = elements;
  const toRad = Math.PI / 180;
  const meanAnomaly = ((meanLongitudeDeg - perihelionDeg + 540) % 360 - 180) * toRad;
  const E = eccentricAnomaly ?? solveKeplerEquation(meanAnomaly, e);
  const orbitalX = a * (Math.cos(E) - e);
  const orbitalY = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const omega = (perihelionDeg - nodeDeg) * toRad;
  const node = nodeDeg * toRad;
  const inclination = inclinationDeg * toRad;
  const cosW = Math.cos(omega), sinW = Math.sin(omega);
  const cosN = Math.cos(node), sinN = Math.sin(node);
  const cosI = Math.cos(inclination), sinI = Math.sin(inclination);
  const eclipticX = (cosW * cosN - sinW * sinN * cosI) * orbitalX +
    (-sinW * cosN - cosW * sinN * cosI) * orbitalY;
  const eclipticY = (cosW * sinN + sinW * cosN * cosI) * orbitalX +
    (-sinW * sinN + cosW * cosN * cosI) * orbitalY;
  const eclipticZ = (sinW * sinI) * orbitalX + (cosW * sinI) * orbitalY;
  const compactScale = planet.orbit / a;

  return {
    vector: new THREE.Vector3(eclipticX * compactScale, eclipticZ * compactScale, eclipticY * compactScale),
    distanceAu: Math.sqrt(eclipticX ** 2 + eclipticY ** 2 + eclipticZ ** 2),
  };
}

function makePlanetOrbitPoints(planet, date) {
  const elements = getPlanetElementsAtDate(planet, date);
  const points = [];
  for (let i = 0; i <= 180; i++) {
    points.push(planetPositionFromElements(planet, elements, (i / 180) * Math.PI * 2).vector);
  }
  return points;
}

function updateSolarEphemeris(force = false) {
  if (!solarGroup) return;
  const nowMs = Date.now();
  if (!force && nowMs - lastSolarEphemerisUpdate < 15000) return;
  lastSolarEphemerisUpdate = nowMs;
  const now = new Date(nowMs);

  SOLAR_PLANETS.forEach((planet) => {
    const obj = solarObjects[planet.key];
    if (!obj?.mesh) return;
    const current = planetPositionFromElements(planet, getPlanetElementsAtDate(planet, now));
    obj.mesh.position.copy(current.vector);
    obj.distanceAu = current.distanceAu;
    if (obj.label) obj.label.position.copy(current.vector).add(new THREE.Vector3(0, planet.radius + 0.68, 0));
  });

  const live = document.getElementById('orrery-live');
  if (live) live.textContent = `LIVE · ${now.toISOString().slice(0, 19).replace('T', ' ')} UTC · JPL ELEMENTS`;
  updateSolarReadout();
}

function createSolarSystemView() {
  if (solarGroup || typeof scene === 'undefined' || typeof THREE === 'undefined') return;

  solarGroup = new THREE.Group();
  solarGroup.visible = false;
  scene.add(solarGroup);
  solarObjects = {};
  solarRaycaster = new THREE.Raycaster();
  solarMouse = new THREE.Vector2();

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd166 })
  );
  sun.userData.solarKey = 'sun';
  solarGroup.add(sun);
  solarObjects.sun = { mesh: sun, copy: 'The central star and reference origin for the live heliocentric survey.', name: 'Sun', distanceAu: 0 };

  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(255, 209, 102, 0.85)', 'rgba(255, 120, 60, 0)'),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  sunGlow.scale.set(6.8, 6.8, 1);
  sun.add(sunGlow);

  const ephemerisDate = new Date();
  SOLAR_PLANETS.forEach((planet, index) => {
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(makePlanetOrbitPoints(planet, ephemerisDate)),
      new THREE.LineBasicMaterial({
        color: index < 4 ? 0x38bdf8 : 0xfb923c,
        transparent: true,
        opacity: index < 4 ? 0.14 : 0.10,
        depthWrite: false,
      })
    );
    solarGroup.add(orbit);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(planet.radius, 36, 36),
      new THREE.MeshPhongMaterial({ color: planet.color, shininess: 18, emissive: planet.color, emissiveIntensity: 0.05 })
    );
    mesh.userData.solarKey = planet.key;
    solarGroup.add(mesh);

    if (planet.key === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.25, 1.75, 80),
        new THREE.MeshBasicMaterial({ color: 0xf8df9b, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
      );
      ring.rotation.x = Math.PI / 2.7;
      mesh.add(ring);
    }

    const label = makeSolarLabel(planet.name);
    solarGroup.add(label);

    solarObjects[planet.key] = { mesh, label, orbitLine: orbit, ...planet };
  });

  const dustGeo = new THREE.BufferGeometry();
  const dust = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const r = 24 + Math.random() * 38;
    const a = Math.random() * Math.PI * 2;
    dust[i * 3] = Math.cos(a) * r;
    dust[i * 3 + 1] = (Math.random() - 0.5) * 8;
    dust[i * 3 + 2] = Math.sin(a) * r;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  solarGroup.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.08,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  })));

  renderer.domElement.addEventListener('pointerdown', onSolarPointerDown);
  updateSolarEphemeris(true);
}

function animateSolarSystem() {
  if (!solarGroup || !solarGroup.visible) return;
  updateSolarEphemeris();
  Object.values(solarObjects).forEach((obj) => {
    if (obj.mesh) obj.mesh.rotation.y += 0.008;
    if (obj.label && typeof camera !== 'undefined') obj.label.quaternion.copy(camera.quaternion);
  });
}

function onSolarPointerDown(event) {
  if (typeof currentViewMode === 'undefined' || currentViewMode !== 'solar' || !solarRaycaster) return;
  const rect = renderer.domElement.getBoundingClientRect();
  solarMouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  solarMouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  solarRaycaster.setFromCamera(solarMouse, camera);
  const meshes = Object.values(solarObjects).map((obj) => obj.mesh).filter(Boolean);
  const hit = solarRaycaster.intersectObjects(meshes, false)[0];
  if (hit?.object?.userData?.solarKey) selectSolarObject(hit.object.userData.solarKey);
}

function updateSolarReadout() {
  const obj = solarObjects[solarSelectedKey];
  if (!obj) return;
  const title = document.getElementById('orrery-title');
  const copy = document.getElementById('orrery-copy');
  if (title) title.textContent = obj.name || solarSelectedKey;
  if (copy) {
    const distance = solarSelectedKey === 'sun' ? 'Heliocentric origin' : `${(obj.distanceAu || 0).toFixed(3)} AU from Sun now`;
    copy.textContent = `${distance} · ${obj.copy || 'Current compact solar-system position.'}`;
  }
}

function selectSolarObject(key) {
  createSolarSystemView();
  const obj = solarObjects[key];
  if (!obj) return;
  solarSelectedKey = key;
  updateSolarEphemeris(true);
  updateSolarReadout();
  setFocus(obj.name || key);

  Object.entries(solarObjects).forEach(([entryKey, entry]) => {
    if (!entry.mesh?.material) return;
    if ('emissiveIntensity' in entry.mesh.material) {
      entry.mesh.material.emissiveIntensity = entryKey === solarSelectedKey ? 0.28 : 0.05;
    }
  });

  const target = new THREE.Vector3();
  obj.mesh.getWorldPosition(target);
  const offset = key === 'sun' ? new THREE.Vector3(0, 6, 11) : new THREE.Vector3(2.8, 2.3, 4.4);
  moveCameraTo(target.clone().add(offset), target);
}

function setConstellationEnabled(key, enabled) {
  if (typeof toggleConstellation === 'function') {
    toggleConstellation(key, enabled);
    return;
  }
  const checkbox = document.querySelector(`input[data-sat="${key}"]`);
  if (checkbox && checkbox.checked !== enabled) {
    checkbox.checked = enabled;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function setCoreToggle(kind, enabled) {
  const config = {
    tracker: { id: 'toggle-tracker', state: () => typeof trackerEnabled !== 'undefined' && trackerEnabled },
    paths: { id: 'toggle-paths', state: () => typeof pathsEnabled !== 'undefined' && pathsEnabled },
    follow: { id: 'toggle-follow', state: () => typeof autoFollowEnabled !== 'undefined' && autoFollowEnabled },
    daynight: { id: 'toggle-daynight', state: () => typeof dayNightEnabled !== 'undefined' && dayNightEnabled },
  }[kind];
  const btn = config ? document.getElementById(config.id) : null;
  if (btn && config.state() !== enabled) btn.click();
}

function setSliderValue(id, value, eventName) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  if (eventName === 'change') el.dispatchEvent(new Event('change', { bubbles: true }));
}

function moveCameraTo(position, target) {
  if (typeof camera === 'undefined' || typeof controls === 'undefined' || !camera || !controls) return;
  camera.position.copy(position);
  controls.target.copy(target);
  controls.update();
}

function setMissionNote(text) {
  const note = document.getElementById('mission-note');
  if (note) note.textContent = text;
}

function setFocus(text) {
  const focus = document.getElementById('explore-focus');
  if (focus) focus.textContent = text;
}

function makeGlowTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeSolarLabel(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '700 24px Inter';
  const w = Math.ceil(ctx.measureText(text).width) + 26;
  canvas.width = w;
  canvas.height = 42;
  ctx.font = '700 24px Inter';
  ctx.fillStyle = 'rgba(5, 10, 18, 0.76)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 42, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
  ctx.stroke();
  ctx.fillStyle = '#e0f2fe';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 13, 22);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set((w / 42) * 0.7, 0.7, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function getMoonPhase(date) {
  const synodic = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const days = (date.getTime() - knownNewMoon) / 86400000;
  const age = ((days % synodic) + synodic) % synodic;
  const fraction = (1 - Math.cos((age / synodic) * Math.PI * 2)) / 2;
  const names = [
    [1.84566, 'New Moon'],
    [5.53699, 'Waxing Crescent'],
    [9.22831, 'First Quarter'],
    [12.91963, 'Waxing Gibbous'],
    [16.61096, 'Full Moon'],
    [20.30228, 'Waning Gibbous'],
    [23.99361, 'Last Quarter'],
    [27.68493, 'Waning Crescent'],
    [synodic, 'New Moon'],
  ];
  const name = names.find(([limit]) => age < limit)?.[1] || 'New Moon';
  return {
    name,
    illumination: Math.round(fraction * 100),
    age: `${age.toFixed(1)}d`,
  };
}

function getNextSeasonMarker(now) {
  const year = now.getUTCFullYear();
  const markers = [
    { name: 'March equinox', date: Date.UTC(year, 2, 20, 9) },
    { name: 'June solstice', date: Date.UTC(year, 5, 21, 3) },
    { name: 'September equinox', date: Date.UTC(year, 8, 22, 19) },
    { name: 'December solstice', date: Date.UTC(year, 11, 21, 15) },
    { name: 'March equinox', date: Date.UTC(year + 1, 2, 20, 9) },
  ];
  const next = markers.find((item) => item.date > now.getTime()) || markers[markers.length - 1];
  const days = Math.ceil((next.date - now.getTime()) / 86400000);
  return { name: next.name, countdown: `${days}d` };
}

function getHemisphereSeason(now) {
  const m = now.getUTCMonth();
  if (m >= 2 && m <= 4) return 'Equinox arc';
  if (m >= 5 && m <= 7) return 'June season';
  if (m >= 8 && m <= 10) return 'Equinox arc';
  return 'December season';
}

function getIssOrbitCountdown(now) {
  const period = 92 * 60 * 1000;
  const epoch = Date.UTC(2020, 0, 1);
  const left = period - ((now.getTime() - epoch) % period);
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}
