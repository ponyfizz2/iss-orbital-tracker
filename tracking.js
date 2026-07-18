/* TRACKING VISUALS + PATHS */
function createTracking() {
    const issMat = new THREE.SpriteMaterial({ map: makeRadialSpriteTexture('rgba(34,197,94,1)', 'rgba(34,197,94,0.18)', 'rgba(34,197,94,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    issMarker = new THREE.Sprite(issMat); issMarker.scale.set(0.9, 0.9, 0.9); issMarker.renderOrder = 12; trackingGroup.add(issMarker);
    impactRing = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.18, 32), new THREE.MeshBasicMaterial({ color: TRACK_COLOR, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthTest: false }));
    impactRing.renderOrder = 11; trackingGroup.add(impactRing);
    laser = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: TRACK_COLOR, transparent: true, opacity: 0.72, depthTest: false }));
    laser.renderOrder = 10; trackingGroup.add(laser);
    const beamGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 10, 1, true);
    laserBeam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: TRACK_COLOR, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthTest: false }));
    laserBeam.renderOrder = 9; trackingGroup.add(laserBeam);
    pastLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: TRACK_COLOR, transparent: true, opacity: 0.95, depthTest: false }));
    pastLine.renderOrder = 8; trackingGroup.add(pastLine);
    futureDots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.085, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    futureDots.renderOrder = 8; trackingGroup.add(futureDots);
    swathRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.001, 80), new THREE.MeshBasicMaterial({ color: TRACK_COLOR, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
    swathRing.renderOrder = 7; trackingGroup.add(swathRing);
    calloutGroup = new THREE.Group(); calloutGroup.renderOrder = 13; trackingGroup.add(calloutGroup);
    calloutStem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: TRACK_COLOR, transparent: true, opacity: 0.85, depthTest: false }));
    calloutGroup.add(calloutStem);
    calloutElbow = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: TRACK_COLOR, transparent: true, opacity: 0.78, depthTest: false }));
    calloutGroup.add(calloutElbow);
    calloutGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeRadialSpriteTexture('rgba(34,197,94,0.70)', 'rgba(34,197,94,0.14)', 'rgba(34,197,94,0)'), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
    calloutGlow.scale.set(2.0, 1.0, 1.0); calloutGroup.add(calloutGlow);
    const { tex } = makeLabelTexture("...");
    calloutLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
    calloutLabel.scale.set(2.2, 0.55, 1); calloutGroup.add(calloutLabel);
    setTrackerVisible(true); setPathsVisible(true);
}
function setTrackerVisible(v) {
    [issMarker, laser, laserBeam, impactRing, calloutGroup, swathRing, highlightDots].forEach(o => { if (o) o.visible = v; });
    setPathsVisible(pathsEnabled && v);
}
function setPathsVisible(v) { if (pastLine) pastLine.visible = v; if (futureDots) futureDots.visible = v; }

/* SGP4/TLE */
async function refreshTLEIfNeeded(force = false) {
    const now = Date.now();
    if (!force && tle.satrec && (now - tle.lastFetch) < TLE_TTL_MS) return true;
    try { const cached = JSON.parse(localStorage.getItem(TLE_STORAGE_KEY) || "null"); if (cached?.line1 && cached?.line2 && !tle.satrec) { tle.line1 = cached.line1; tle.line2 = cached.line2; tle.satrec = satellite.twoline2satrec(tle.line1, tle.line2); tle.lastFetch = cached.lastFetch || 0; } } catch { }
    for (const url of ISS_TLE_JSON_URLS) {
        try {
            const res = await fetchWithTimeout(url, { cache: "no-store" }, 6500); if (!res.ok) throw 0;
            const j = await res.json(); if (!j.line1 || !j.line2) throw 0;
            tle.line1 = j.line1.trim(); tle.line2 = j.line2.trim(); tle.satrec = satellite.twoline2satrec(tle.line1, tle.line2); tle.lastFetch = now;
            try { localStorage.setItem(TLE_STORAGE_KEY, JSON.stringify({ line1: tle.line1, line2: tle.line2, lastFetch: now })); } catch { }
            return true;
        } catch { }
    }
    try {
        const res = await fetchWithTimeout(ISS_TLE_TEXT_URL, { cache: "no-store" }, 6500);
        if (!res.ok) throw new Error(`TLE fallback returned ${res.status}`);
        const text = await res.text();
        const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
        let line1 = null, line2 = null;
        for (let i = 0; i < lines.length; i++) { if (lines[i].startsWith('1 ') && i + 1 < lines.length && lines[i + 1].startsWith('2 ')) { line1 = lines[i]; line2 = lines[i + 1]; break; } }
        if (!line1 || !line2) throw 0;
        tle.line1 = line1; tle.line2 = line2; tle.satrec = satellite.twoline2satrec(line1, line2); tle.lastFetch = now;
        try { localStorage.setItem(TLE_STORAGE_KEY, JSON.stringify({ line1, line2, lastFetch: now })); } catch { }
        return true;
    } catch { return !!tle.satrec; }
}
function sgp4LatLonAlt(date) {
    if (!tle.satrec) return null;
    const pv = satellite.propagate(tle.satrec, date); if (!pv.position) return null;
    const gmst = satellite.gstime(date); const gd = satellite.eciToGeodetic(pv.position, gmst);
    return { lat: satellite.degreesLat(gd.latitude), lon: satellite.degreesLong(gd.longitude), altKm: gd.height };
}

/* ORBIT TRACKS */
function rebuildOrbitTracks() { if (!pathsEnabled) return; if (tle.satrec) rebuildOrbitTracksFromTLE(); else rebuildOrbitTracksFromLive(); }
function rebuildOrbitTracksFromTLE() {
    if (!tle.satrec || !pastLine || !futureDots) return;
    const now = new Date(), liftUnits = 0.08;
    const pastPts = [];
    for (let ms = -ORBIT_PERIOD_MS; ms <= 0; ms += (PAST_STEP_SEC * 1000)) { const d = new Date(now.getTime() + ms); const s = sgp4LatLonAlt(d); if (!s) continue; const p = latLonToPos(s.lat, s.lon, getRenderedIssRadius(s.altKm) + liftUnits); pastPts.push(p.x, p.y, p.z); }
    pastLine.geometry.dispose(); pastLine.geometry = new THREE.BufferGeometry(); pastLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pastPts, 3)); pastLine.geometry.computeBoundingSphere();
    const steps = Math.max(28, Math.floor((ORBIT_PERIOD_MS / 1000) / FUTURE_STEP_SEC));
    const futPos = new Float32Array(steps * 3), futCol = new Float32Array(steps * 3);
    for (let i = 0; i < steps; i++) { const tSec = (i + 1) * FUTURE_STEP_SEC; const d = new Date(now.getTime() + tSec * 1000); const s = sgp4LatLonAlt(d); if (!s) continue; const p = latLonToPos(s.lat, s.lon, getRenderedIssRadius(s.altKm) + liftUnits); futPos[i * 3] = p.x; futPos[i * 3 + 1] = p.y; futPos[i * 3 + 2] = p.z; const fade = 1 - (i / (steps - 1)); const c = new THREE.Color(TRACK_COLOR).multiplyScalar(0.22 + fade * 0.90); futCol[i * 3] = c.r; futCol[i * 3 + 1] = c.g; futCol[i * 3 + 2] = c.b; }
    futureDots.geometry.dispose(); futureDots.geometry = new THREE.BufferGeometry(); futureDots.geometry.setAttribute('position', new THREE.BufferAttribute(futPos, 3)); futureDots.geometry.setAttribute('color', new THREE.BufferAttribute(futCol, 3)); futureDots.geometry.computeBoundingSphere();
    setPathsVisible(pathsEnabled && trackerEnabled);
}
function rebuildOrbitTracksFromLive() {
    if (!pastLine || !futureDots) return;
    const liftUnits = 0.08;
    const hist = liveHistory.slice(-Math.min(LIVE_HISTORY_MAX, liveHistory.length));
    const pastPts = [];
    for (const s of hist) { const p = latLonToPos(s.lat, s.lon, getRenderedIssRadius(s.altKm) + liftUnits); pastPts.push(p.x, p.y, p.z); }
    pastLine.geometry.dispose(); pastLine.geometry = new THREE.BufferGeometry(); pastLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pastPts, 3)); pastLine.geometry.computeBoundingSphere();
    const n = hist.length;
    if (n < 2) { futureDots.geometry.dispose(); futureDots.geometry = new THREE.BufferGeometry(); setPathsVisible(pathsEnabled && trackerEnabled); return; }
    const a = hist[n - 2], b = hist[n - 1], dt = Math.max(1, b.t - a.t), dLat = b.lat - a.lat, dLon = normalizeLon(b.lon - a.lon), dAlt = b.altKm - a.altKm;
    const steps = 90, futP = [], futC = [];
    for (let i = 0; i < steps; i++) { const tms = (i + 1) * 5000; const f = tms / dt; const lat = b.lat + dLat * f; const lon = normalizeLon(b.lon + dLon * f); const altKm = b.altKm + dAlt * f; const p = latLonToPos(lat, lon, getRenderedIssRadius(altKm) + liftUnits); futP.push(p.x, p.y, p.z); const fade = 1 - (i / (steps - 1)); const c = new THREE.Color(TRACK_COLOR).multiplyScalar(0.20 + fade * 0.95); futC.push(c.r, c.g, c.b); }
    futureDots.geometry.dispose(); futureDots.geometry = new THREE.BufferGeometry(); futureDots.geometry.setAttribute('position', new THREE.Float32BufferAttribute(futP, 3)); futureDots.geometry.setAttribute('color', new THREE.Float32BufferAttribute(futC, 3)); futureDots.geometry.computeBoundingSphere();
    setPathsVisible(pathsEnabled && trackerEnabled);
}

/* LIVE ISS FETCH */
function normalizeOverText(text) { const t = (text ?? "").toString().trim(); if (!t) return "Ocean"; if (t === "??" || t === "ZZ" || t.toLowerCase() === "unknown") return "Ocean"; return t; }
function countryNameFromCode(code) { try { if (!code) return null; return new Intl.DisplayNames(['en'], { type: 'region' }).of(code.toUpperCase()) || null; } catch { return code ? code.toUpperCase() : null; } }
async function resolveOverText(lat, lon) {
    const now = Date.now(); if ((now - lastOverFetchMs) < OVER_TTL_MS && lastOverText && lastOverText !== "--") return lastOverText;
    try {
        const res = await fetch(`https://api.wheretheiss.at/v1/coordinates/${lat},${lon}`); const data = await res.json(); const ccRaw = (data && (data.country_code || data.countryCode)) ? (data.country_code || data.countryCode) : null;
        if (ccRaw && typeof ccRaw === "string") { const cc = ccRaw.trim().toUpperCase(); if (cc === "??" || cc === "ZZ") lastOverText = "Ocean"; else { const name = countryNameFromCode(cc); lastOverText = name ? name : "Ocean"; } } else lastOverText = "Ocean";
        lastOverText = normalizeOverText(lastOverText); lastOverFetchMs = now; return lastOverText;
    } catch { lastOverText = normalizeOverText(lastOverText && lastOverText !== "--" ? lastOverText : "Ocean"); lastOverFetchMs = now; return lastOverText; }
}

function calculateSpeed() {
    if (liveHistory.length < 2) return 0;
    const a = liveHistory[liveHistory.length - 2], b = liveHistory[liveHistory.length - 1];
    const dt = (b.t - a.t) / 1000; if (dt <= 0) return issSpeedKmh;
    const R = EARTH_RADIUS_KM;
    const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
    const dLat = (b.lat - a.lat) * Math.PI / 180, dLon = normalizeLon(b.lon - a.lon) * Math.PI / 180;
    const aa = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    const dist = (R + (a.altKm + b.altKm) / 2) * c;
    return (dist / dt) * 3600;
}

async function updateISSData(refreshTle = true) {
    if (refreshTle) await refreshTLEIfNeeded(false);
    const now = Date.now(); let gotLive = false; let gotModeled = false;
    try {
        const res = await fetchWithTimeout('https://api.wheretheiss.at/v1/satellites/25544', { cache: 'no-store' }, 8000);
        if (!res.ok) throw new Error(`ISS telemetry returned ${res.status}`);
        const data = await res.json();
        const lat = Number(data.latitude), lon = Number(data.longitude), altKm = Number(data.altitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('ISS telemetry coordinates were invalid');
        issPos.lat = lat; issPos.lon = lon; issPos.altKm = Number.isFinite(altKm) ? altKm : DEFAULT_ALT_KM;
        ui.status.innerText = "LIVE FEED"; ui.status.style.color = "#86efac";
        if (ui.liveDot) ui.liveDot.style.background = "#22c55e";
        gotLive = true;
    } catch {
        const modeled = sgp4LatLonAlt(new Date(now));
        if (modeled && Number.isFinite(modeled.lat) && Number.isFinite(modeled.lon)) {
            issPos.lat = modeled.lat;
            issPos.lon = modeled.lon;
            issPos.altKm = Number.isFinite(modeled.altKm) ? modeled.altKm : DEFAULT_ALT_KM;
            ui.status.innerText = "TLE MODEL"; ui.status.style.color = "#facc15";
            if (ui.liveDot) ui.liveDot.style.background = "#facc15";
            gotModeled = true;
        } else {
            ui.status.innerText = "HOLDING"; ui.status.style.color = "#fca5a5";
            if (ui.liveDot) ui.liveDot.style.background = "#ef4444";
        }
    }

    if (gotLive || gotModeled) {
        issPrev = issNext || { t: now, lat: issPos.lat, lon: issPos.lon, altKm: issPos.altKm };
        issNext = { t: now, lat: issPos.lat, lon: issPos.lon, altKm: issPos.altKm };
        liveHistory.push({ t: now, lat: issPos.lat, lon: issPos.lon, altKm: issPos.altKm });
        if (liveHistory.length > LIVE_HISTORY_MAX) liveHistory.splice(0, liveHistory.length - LIVE_HISTORY_MAX);
    }
    document.getElementById('iss-lat').innerText = issPos.lat.toFixed(4) + "°";
    document.getElementById('iss-lon').innerText = issPos.lon.toFixed(4) + "°";
    document.getElementById('iss-alt').innerText = "~" + (issPos.altKm || DEFAULT_ALT_KM).toFixed(0) + " km";

    issSpeedKmh = calculateSpeed();
    document.getElementById('iss-speed').innerText = issSpeedKmh > 100 ? Math.round(issSpeedKmh).toLocaleString() + " km/h" : "-- km/h";

    lastRefreshTime = Date.now();

    const overText = await resolveOverText(issPos.lat, issPos.lon);
    ui.over.innerText = overText; ui.over.style.color = "#86efac";
    updateCalloutText(overText); buildCountryHighlight(overText);
    if (gotLive || gotModeled || tle.satrec || liveHistory.length > 2) rebuildOrbitTracks();
}

/* SWATH */
function updateSwath(groundPos, altKm) {
    if (!swathRing) return; const now = performance.now(); if (now - lastSwathMs < 200) return; lastSwathMs = now;
    const h = Math.max(1, altKm); const psi = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + h)); const footprintRadius = EARTH_RADIUS_UNITS * psi;
    const inner = Math.max(0.05, footprintRadius - FOOTPRINT_OUTER_THICKNESS), outer = footprintRadius + FOOTPRINT_OUTER_THICKNESS;
    const prev = swathRing.userData.prevR || 0;
    if (Math.abs(prev - footprintRadius) > 0.03) { swathRing.geometry.dispose(); swathRing.geometry = new THREE.RingGeometry(inner, outer, 96); swathRing.userData.prevR = footprintRadius; }
    swathRing.position.copy(groundPos); swathRing.lookAt(0, 0, 0);
    const ex = parseFloat(ui.altx.value); swathRing.material.opacity = 0.07 + Math.min(0.08, ex * 0.01) + (Math.sin(Date.now() * 0.002) * 0.01);
}

function presetOrbit() { camera.position.set(14, 10, 14); controls.target.set(0, 0, 0); }

/* RENDER LOOP */
function animate() {
    requestAnimationFrame(animate);
    earthGroup.rotation.y += parseFloat(ui.rot.value);
    updateSunDirection(); shadeBordersNearFar();
    updateActiveViewMode();
    updateAllConstellations();

    // Refresh bar
    if (ui.refreshBar) { const elapsed = Date.now() - lastRefreshTime; const pct = Math.min(100, (elapsed / FETCH_INTERVAL_MS) * 100); ui.refreshBar.style.width = pct + "%"; }

    const cur = getInterpolatedISSState();
    const issWorld = latLonToPos(cur.lat, cur.lon, getRenderedIssRadius(cur.altKm));
    const ground = latLonToPos(cur.lat, cur.lon, EARTH_RADIUS_UNITS);
    if (trackerEnabled) {
        issMarker.position.copy(issWorld); issMarker.quaternion.copy(camera.quaternion);
        impactRing.position.copy(ground); impactRing.lookAt(0, 0, 0);
        const s = 1 + Math.sin(Date.now() * 0.005) * 0.4; impactRing.scale.set(s, s, s); impactRing.material.opacity = 0.85 - (s - 1);
        const attr = laser.geometry.attributes.position; attr.setXYZ(0, issWorld.x, issWorld.y, issWorld.z); attr.setXYZ(1, ground.x, ground.y, ground.z); attr.needsUpdate = true;
        alignCylinderBetween(laserBeam, issWorld, ground); laserBeam.material.opacity = 0.14 + (Math.sin(Date.now() * 0.003) * 0.06);
        updateCalloutGeometry(ground); updateSwath(ground, cur.altKm);
    }
    if (autoFollowEnabled) { const tgt = ground.clone().lerp(issWorld, 0.25); controls.target.lerp(tgt, 0.05); }
    controls.update(); renderer.render(scene, camera);
}
function getInterpolatedISSState() {
    if (!issPrev || !issNext) return { ...issPos };
    const now = Date.now(), dt = Math.max(1, issNext.t - issPrev.t), t = Math.min(1, Math.max(0, (now - issPrev.t) / dt));
    return { lat: lerp(issPrev.lat, issNext.lat, t), lon: lerpLon(issPrev.lon, issNext.lon, t), altKm: lerp(issPrev.altKm, issNext.altKm, t) };
}

/* CALLOUT */
function updateCalloutText(text) {
    if (!calloutLabel) return; const safe = normalizeOverText(text);
    if (calloutLabel.userData.lastText === safe) return; calloutLabel.userData.lastText = safe;
    const { tex, w, h } = makeLabelTexture(safe); calloutLabel.material.map = tex; calloutLabel.material.needsUpdate = true;
    const aspect = w / h, baseH = 0.58; calloutLabel.scale.set(baseH * aspect, baseH, 1); calloutGlow.scale.set((baseH * aspect) * 1.25, baseH * 1.25, 1);
}
function updateCalloutGeometry(groundPos) {
    if (!calloutGroup) return;
    const n = groundPos.clone().normalize(); const lift = 0.95 + (parseFloat(ui.altx.value) - 1) * 0.06; const pUp = groundPos.clone().add(n.multiplyScalar(lift));
    const tangent = new THREE.Vector3().crossVectors(groundPos.clone().normalize(), new THREE.Vector3(0, 1, 0));
    if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0); tangent.normalize();
    const pLabel = pUp.clone().add(tangent.multiplyScalar(1.45));
    const a1 = calloutStem.geometry.attributes.position; a1.setXYZ(0, groundPos.x, groundPos.y, groundPos.z); a1.setXYZ(1, pUp.x, pUp.y, pUp.z); a1.needsUpdate = true;
    const a2 = calloutElbow.geometry.attributes.position; a2.setXYZ(0, pUp.x, pUp.y, pUp.z); a2.setXYZ(1, pLabel.x, pLabel.y, pLabel.z); a2.needsUpdate = true;
    calloutLabel.position.copy(pLabel); calloutGlow.position.copy(pLabel);
    calloutLabel.quaternion.copy(camera.quaternion); calloutGlow.quaternion.copy(camera.quaternion);
    const pulse = 1 + Math.sin(Date.now() * 0.0028) * 0.03; calloutGlow.material.opacity = 0.58 + Math.sin(Date.now() * 0.0032) * 0.08; calloutGlow.scale.multiplyScalar(pulse);
}

/* STARS + LIGHTS */
function createStars() {
    const count = 2800; const geo = new THREE.BufferGeometry(); const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - 0.5) * 1500; pos[i * 3 + 1] = (Math.random() - 0.5) * 1500; pos[i * 3 + 2] = (Math.random() - 0.5) * 1500; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.3 })); scene.add(stars);
}
function setupLights() { scene.add(new THREE.AmbientLight(0xffffff, 0.65)); const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(10, 10, 10); scene.add(key); }

/* REBUILD */
async function rebuildGlobe() {
    if (dots) { earthGroup.remove(dots); dots.geometry.dispose(); dots.material.dispose(); dots = null; earthDotsMaterial = null; }
    if (borderDots) { earthGroup.remove(borderDots); borderDots.geometry.dispose(); borderDots.material.dispose(); borderDots = null; borderPositions = null; borderColors = null; }
    if (highlightDots) { earthGroup.remove(highlightDots); highlightDots.geometry.dispose(); highlightDots.material.dispose(); highlightDots = null; }
    if (cityLights) { earthGroup.remove(cityLights); cityLights.geometry.dispose(); cityLights.material.dispose(); cityLights = null; }
    if (terminatorLine) { earthGroup.remove(terminatorLine); terminatorLine.geometry.dispose(); terminatorLine.material.dispose(); terminatorLine = null; }
    await createEarth(); await createCountryBorders(); createCityLights(); createTerminatorLine();
    lastHighlightKey = ""; buildCountryHighlight(normalizeOverText(ui.over.innerText)); rebuildOrbitTracks();
}

/* UTILS */
function makeRadialSpriteTexture(inner, mid, outer) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(0.22, inner); g.addColorStop(0.55, mid); g.addColorStop(1, outer);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill();
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
}
function roundRect(ctx, x, y, w, h, r) { const rr = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr); ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath(); }
function makeLabelTexture(text) {
    const padX = 20; const font = '800 22px Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI';
    const c = document.createElement('canvas'); const ctx = c.getContext('2d'); ctx.font = font;
    const textW = Math.ceil(ctx.measureText(text).width); const w = Math.max(220, textW + padX * 2); const h = 56;
    c.width = w; c.height = h; ctx.clearRect(0, 0, w, h);
    ctx.shadowColor = 'rgba(34,197,94,0.35)'; ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(10,10,15,0.88)'; ctx.strokeStyle = 'rgba(34,197,94,0.65)'; ctx.lineWidth = 2;
    roundRect(ctx, 2, 2, w - 4, h - 4, 14); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
    ctx.fillStyle = 'rgba(34,197,94,0.98)'; ctx.fillRect(14, 10, 4, h - 20);
    ctx.font = font; ctx.fillStyle = 'rgba(134,239,172,0.98)'; ctx.textBaseline = 'middle'; ctx.fillText(text, 28, h / 2 + 1);
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return { tex, w, h };
}
function latLonToPos(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180); const theta = (normalizeLon(lon) + 180) * (Math.PI / 180);
    return new THREE.Vector3(-(radius * Math.sin(phi) * Math.cos(theta)), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}
function getRenderedIssRadius(altKm) { const exag = parseFloat(ui.altx.value); return EARTH_RADIUS_UNITS + EARTH_RADIUS_UNITS * (altKm / EARTH_RADIUS_KM) * exag; }
function normalizeLon(lon) { let x = lon; while (x > 180) x -= 360; while (x < -180) x += 360; return x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpLon(a, b, t) { return normalizeLon(a + normalizeLon(b - a) * t); }
function alignCylinderBetween(mesh, start, end) {
    const dir = new THREE.Vector3().subVectors(end, start); const len = dir.length();
    if (len < 1e-6) { mesh.visible = false; return; } mesh.visible = true;
    mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
    mesh.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())); mesh.scale.set(1, len, 1);
}
