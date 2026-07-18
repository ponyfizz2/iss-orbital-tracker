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
      moveCameraTo(new THREE.Vector3(0, 34, 42), new THREE.Vector3(0, 0, 0));
      selectSolarObject('earth');
    },
  },
];

const CATALOG_OBJECTS = [
  { key: 'iss', name: 'International Space Station', type: 'spacecraft', mode: 'dots', tag: 'live orbit', note: 'Crewed laboratory in low Earth orbit with live ground-track data.' },
  { key: 'earth', name: 'Earth', type: 'planet', mode: 'satellite', tag: 'home world', note: 'Textured Earth with day-night shading, clouds, city lights, borders, and station tracking.' },
  { key: 'moon', name: 'Moon', type: 'moon', mode: 'moon', tag: 'surface tools', note: 'Lunar surface with Apollo labels plus measuring tools for distances and crater areas.' },
  { key: 'mars', name: 'Mars', type: 'planet', mode: 'mars', tag: 'red planet', note: 'Mars globe with relay-orbit context for exploration planning.' },
  { key: 'sun', name: 'Sun', type: 'star', mode: 'solar', tag: 'orrery', note: 'Center of the compact solar-system survey.' },
  { key: 'mercury', name: 'Mercury', type: 'planet', mode: 'solar', tag: 'inner planet', note: 'Fast, cratered inner planet with the tightest solar orbit.' },
  { key: 'venus', name: 'Venus', type: 'planet', mode: 'solar', tag: 'inner planet', note: 'Cloud-covered world and near twin of Earth by size.' },
  { key: 'jupiter', name: 'Jupiter', type: 'planet', mode: 'solar', tag: 'gas giant', note: 'Largest planet in the system, scaled down here for usable comparison.' },
  { key: 'saturn', name: 'Saturn', type: 'planet', mode: 'solar', tag: 'rings', note: 'Ringed gas giant represented with a tilted ring plane.' },
  { key: 'hubble', name: 'Hubble Space Telescope', type: 'spacecraft', mode: 'dots', tag: 'toggle layer', note: 'Enables and frames the Hubble orbital layer.' },
  { key: 'starlink', name: 'Starlink shell', type: 'constellation', mode: 'dots', tag: 'toggle layer', note: 'Enables a large low-orbit satellite shell for scale comparison.' },
  { key: 'gps', name: 'GPS constellation', type: 'constellation', mode: 'dots', tag: 'toggle layer', note: 'Enables medium-Earth navigation satellites far above low orbit.' },
];

const SOLAR_PLANETS = [
  { key: 'mercury', name: 'Mercury', radius: 0.28, orbit: 4.4, color: 0xa7a29c, speed: 0.010, copy: 'A small, fast world skimming close to the Sun.' },
  { key: 'venus', name: 'Venus', radius: 0.48, orbit: 6.2, color: 0xeab676, speed: 0.007, copy: 'A bright, cloud-covered planet with a crushing atmosphere.' },
  { key: 'earth', name: 'Earth', radius: 0.52, orbit: 8.2, color: 0x3b82f6, speed: 0.0058, copy: 'The reference world for live ISS tracking and day-night geometry.' },
  { key: 'mars', name: 'Mars', radius: 0.38, orbit: 10.5, color: 0xd65f3a, speed: 0.0046, copy: 'Cold desert planet with active orbital reconnaissance missions.' },
  { key: 'jupiter', name: 'Jupiter', radius: 1.05, orbit: 15.4, color: 0xd7b28c, speed: 0.0026, copy: 'A banded gas giant anchoring the outer-system scale.' },
  { key: 'saturn', name: 'Saturn', radius: 0.92, orbit: 20.6, color: 0xe2c27e, speed: 0.0021, copy: 'A ringed planet shown with a tilted, inspectable ring plane.' },
];

let solarGroup = null;
let solarObjects = {};
let solarRaycaster = null;
let solarMouse = null;
let solarSelectedKey = 'earth';
let explorationReady = false;

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
  if (isSolar) createSolarSystemView();
  if (solarGroup) solarGroup.visible = isSolar;
  if (typeof earthGroup !== 'undefined' && earthGroup) earthGroup.visible = !isSolar;

  const dataPanel = document.querySelector('.data-panel');
  if (dataPanel) dataPanel.style.display = isSolar ? 'none' : '';

  const readout = document.getElementById('orrery-readout');
  if (readout) readout.classList.toggle('visible', isSolar);

  if (isSolar) {
    setFocus('Solar system survey');
    if (typeof controls !== 'undefined' && controls) {
      controls.minDistance = 3;
      controls.maxDistance = 180;
    }
    moveCameraTo(new THREE.Vector3(0, 34, 42), new THREE.Vector3(0, 0, 0));
  } else if (typeof controls !== 'undefined' && controls) {
    controls.minDistance = 5.05;
    controls.maxDistance = 150;
  }
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
  solarObjects.sun = { mesh: sun, copy: 'A compact reference Sun for the exploration survey.', name: 'Sun' };

  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture('rgba(255, 209, 102, 0.85)', 'rgba(255, 120, 60, 0)'),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  sunGlow.scale.set(6.8, 6.8, 1);
  sun.add(sunGlow);

  SOLAR_PLANETS.forEach((planet, index) => {
    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(planet.orbit - 0.012, planet.orbit + 0.012, 160),
      new THREE.MeshBasicMaterial({
        color: index < 4 ? 0x38bdf8 : 0xfb923c,
        transparent: true,
        opacity: index < 4 ? 0.14 : 0.10,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    orbit.rotation.x = Math.PI / 2;
    solarGroup.add(orbit);

    const pivot = new THREE.Group();
    pivot.rotation.y = index * 0.8;
    solarGroup.add(pivot);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(planet.radius, 36, 36),
      new THREE.MeshPhongMaterial({ color: planet.color, shininess: 18, emissive: planet.color, emissiveIntensity: 0.05 })
    );
    mesh.position.set(planet.orbit, 0, 0);
    mesh.userData.solarKey = planet.key;
    pivot.add(mesh);

    if (planet.key === 'saturn') {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.25, 1.75, 80),
        new THREE.MeshBasicMaterial({ color: 0xf8df9b, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
      );
      ring.rotation.x = Math.PI / 2.7;
      mesh.add(ring);
    }

    const label = makeSolarLabel(planet.name);
    label.position.set(planet.orbit, planet.radius + 0.68, 0);
    pivot.add(label);

    solarObjects[planet.key] = { mesh, pivot, label, ...planet };
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
}

function animateSolarSystem() {
  if (!solarGroup || !solarGroup.visible) return;
  const timeScale = 1 + Math.sin(Date.now() * 0.00012) * 0.15;
  Object.values(solarObjects).forEach((obj) => {
    if (obj.pivot) obj.pivot.rotation.y += obj.speed * timeScale;
    if (obj.mesh) obj.mesh.rotation.y += 0.008;
    if (obj.label && typeof camera !== 'undefined') obj.label.quaternion.copy(camera.quaternion);
  });
  solarGroup.rotation.y += 0.0005;
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

function selectSolarObject(key) {
  createSolarSystemView();
  const obj = solarObjects[key];
  if (!obj) return;
  solarSelectedKey = key;
  const title = document.getElementById('orrery-title');
  const copy = document.getElementById('orrery-copy');
  if (title) title.textContent = obj.name || key;
  if (copy) copy.textContent = obj.copy || 'A compact solar-system reference object.';
  setFocus(obj.name || key);

  Object.entries(solarObjects).forEach(([entryKey, entry]) => {
    if (!entry.mesh?.material) return;
    entry.mesh.material.emissiveIntensity = entryKey === solarSelectedKey ? 0.28 : 0.05;
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
