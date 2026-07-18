/* =========================
   EARTH DOTS (preserved from original)
========================= */
async function createEarth() {
    const mapImage = new Image();
    mapImage.crossOrigin = "Anonymous";
    mapImage.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/World_map_blank_without_borders.svg/512px-World_map_blank_without_borders.svg.png';
    return new Promise((resolve) => {
        const drawMap = () => {
            const w = 512, h = 256;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = w; canvas.height = h;
            ctx.drawImage(mapImage, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            landMask = { data: imgData.data, w, h };
            const count = parseInt(ui.den.value, 10);
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                const phi = Math.acos(-1 + (2 * i) / count);
                const theta = Math.sqrt(count * Math.PI) * phi;
                const u = (theta % (Math.PI * 2)) / (Math.PI * 2);
                const v = phi / Math.PI;
                const isLand = landAtUV(u, v);
                const r = EARTH_RADIUS_UNITS;
                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.cos(phi);
                const z = r * Math.sin(phi) * Math.sin(theta);
                positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
                const c = new THREE.Color();
                if (isLand) { c.setHex(0xfacc15); c.multiplyScalar(0.62 + Math.random() * 0.25); }
                else { c.setHex(0x1e3a8a); c.multiplyScalar(0.18); }
                colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geo.computeBoundingSphere();
            earthDotsMaterial = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.90, blending: THREE.AdditiveBlending, depthWrite: false });
            applyDayNightShader(earthDotsMaterial, "earth");
            dots = new THREE.Points(geo, earthDotsMaterial);
            earthGroup.add(dots);
            resolve();
        };
        mapImage.onload = drawMap;
        mapImage.onerror = () => { mapImage.src = MAP_BASE64; };
    });
}
function landAtUV(u, v) {
    if (!landMask) return false;
    const { data, w, h } = landMask;
    const px = Math.max(0, Math.min(w - 1, Math.floor(u * (w - 1))));
    const py = Math.max(0, Math.min(h - 1, Math.floor(v * (h - 1))));
    const idx = (py * w + px) * 4;
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3 < 200;
}

/* DAY/NIGHT + TERMINATOR + CITY LIGHTS */
function updateSunDirection() {
    const d = new Date();
    const t = (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) / 24;
    const ang = t * Math.PI * 2;
    sunDir.set(Math.cos(ang), 0.25, Math.sin(ang)).normalize();
    updateDNUniforms();
    updateTerminatorLine();
}
function applyDayNightShader(mat, mode) {
    mat.onBeforeCompile = (shader) => {
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
                mode === "earth" ? `float l = vL; float edge = smoothstep(-0.10, 0.20, l); float day = 0.10 + 0.90 * edge; float factor = mix(1.0, day, uDN); gl_FragColor = vec4(outgoingLight * factor, diffuseColor.a);`
                    : mode === "city" ? `float night = smoothstep(0.05, -0.35, vL); float vis = mix(1.0, night, uDN); gl_FragColor = vec4(outgoingLight * vis, diffuseColor.a * vis);`
                        : 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );');
        mat.userData.shader = shader;
    };
    mat.needsUpdate = true;
}
function updateDNUniforms() {
    const set = (m) => { if (m?.userData?.shader) { m.userData.shader.uniforms.uSunDir.value.copy(sunDir); m.userData.shader.uniforms.uDN.value = dayNightEnabled ? 1.0 : 0.0; } };
    set(earthDotsMaterial);
    if (cityLights) set(cityLights.material);
}
function createTerminatorLine() {
    const geo = new THREE.BufferGeometry(); geo.setFromPoints([]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
    terminatorLine = new THREE.LineLoop(geo, mat);
    terminatorLine.renderOrder = 1;
    earthGroup.add(terminatorLine);
    updateTerminatorLine();
}
function updateTerminatorLine() {
    if (!terminatorLine) return;
    const sunLocal = sunDir.clone();
    earthGroup.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(earthGroup.matrixWorld).invert();
    sunLocal.transformDirection(inv).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    let u = new THREE.Vector3().crossVectors(sunLocal, up);
    if (u.lengthSq() < 1e-6) u = new THREE.Vector3(1, 0, 0);
    u.normalize();
    const v = new THREE.Vector3().crossVectors(sunLocal, u).normalize();
    const r = EARTH_RADIUS_UNITS + 0.03;
    const segments = 180;
    const positions = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const p = u.clone().multiplyScalar(Math.cos(a)).add(v.clone().multiplyScalar(Math.sin(a))).multiplyScalar(r);
        positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
    }
    terminatorLine.geometry.dispose();
    terminatorLine.geometry = new THREE.BufferGeometry();
    terminatorLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    terminatorLine.material.opacity = dayNightEnabled ? 0.28 : 0.0;
}
function createCityLights() {
    const targetCount = 7000;
    const positions = new Float32Array(targetCount * 3);
    const colors = new Float32Array(targetCount * 3);
    const earthPos = dots?.geometry?.attributes?.position?.array;
    const earthCol = dots?.geometry?.attributes?.color?.array;
    if (!earthPos || !earthCol) return;
    let filled = 0;
    for (let t = 0; t < targetCount * 40 && filled < targetCount; t++) {
        const i = (Math.random() * (earthPos.length / 3)) | 0;
        const r = earthCol[i * 3], g = earthCol[i * 3 + 1], b = earthCol[i * 3 + 2];
        if (!(r > 0.25 && g > 0.18 && b < 0.25)) continue;
        positions[filled * 3] = earthPos[i * 3] * 1.003; positions[filled * 3 + 1] = earthPos[i * 3 + 1] * 1.003; positions[filled * 3 + 2] = earthPos[i * 3 + 2] * 1.003;
        const c = new THREE.Color(0x86efac); c.multiplyScalar(0.30 + Math.random() * 0.90);
        colors[filled * 3] = c.r; colors[filled * 3 + 1] = c.g; colors[filled * 3 + 2] = c.b;
        filled++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();
    const mat = new THREE.PointsMaterial({ size: 0.07, vertexColors: true, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false });
    applyDayNightShader(mat, "city");
    if (cityLights) { earthGroup.remove(cityLights); cityLights.geometry.dispose(); cityLights.material.dispose(); }
    cityLights = new THREE.Points(geo, mat);
    cityLights.renderOrder = 5;
    earthGroup.add(cityLights);
}

/* BORDERS + HIGHLIGHT */
async function loadCountriesGeoJSON() {
    try { const res = await fetch(COUNTRIES_GEOJSON_URL, { cache: "force-cache" }); countryGeoJSON = await res.json(); } catch (e) { countryGeoJSON = null; }
}
async function createCountryBorders() {
    if (!countryGeoJSON) return;
    if (borderDots) { earthGroup.remove(borderDots); borderDots.geometry.dispose(); borderDots.material.dispose(); borderDots = null; }
    const baseDensity = parseInt(ui.den.value, 10);
    const target = Math.max(20000, Math.min(90000, Math.floor(baseDensity * 1.0)));
    const spacingDeg = Math.max(0.085, 0.34 - (baseDensity / 80000) * 0.22);
    const baseR = EARTH_RADIUS_UNITS + 0.042;
    const positions = [], colors = [];
    const addPoint = (lat, lon, strength) => { const p = latLonToPos(lat, lon, baseR); positions.push(p.x, p.y, p.z); const c = BORDER_NEAR.clone().multiplyScalar(0.50 + strength * 0.28); colors.push(c.r, c.g, c.b); };
    for (const f of countryGeoJSON.features) {
        const g = f.geometry; if (!g) continue;
        if (g.type === "Polygon") pushPolygon(g.coordinates, addPoint, spacingDeg);
        else if (g.type === "MultiPolygon") for (const poly of g.coordinates) pushPolygon(poly, addPoint, spacingDeg);
        if (positions.length / 3 > target * 1.6) break;
    }
    if (positions.length / 3 > target) {
        const n = positions.length / 3, keep = target;
        const idxs = new Uint32Array(n); for (let i = 0; i < n; i++) idxs[i] = i;
        for (let i = n - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = idxs[i]; idxs[i] = idxs[j]; idxs[j] = t; }
        const pos2 = new Float32Array(keep * 3), col2 = new Float32Array(keep * 3);
        for (let k = 0; k < keep; k++) { const i = idxs[k]; pos2[k * 3] = positions[i * 3]; pos2[k * 3 + 1] = positions[i * 3 + 1]; pos2[k * 3 + 2] = positions[i * 3 + 2]; col2[k * 3] = colors[i * 3]; col2[k * 3 + 1] = colors[i * 3 + 1]; col2[k * 3 + 2] = colors[i * 3 + 2]; }
        borderPositions = pos2; borderColors = col2;
    } else { borderPositions = new Float32Array(positions); borderColors = new Float32Array(colors); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(borderPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(borderColors, 3));
    geo.computeBoundingSphere();
    borderDots = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.068, vertexColors: true, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false }));
    borderDots.renderOrder = 4;
    earthGroup.add(borderDots);
}
function shadeBordersNearFar() {
    if (!borderDots || !borderPositions || !borderColors) return;
    const now = performance.now(); if (now - lastBorderShadeMs < 180) return; lastBorderShadeMs = now;
    const camDir = camera.position.clone().normalize();
    earthGroup.updateMatrixWorld(true);
    const rot = new THREE.Matrix4().extractRotation(earthGroup.matrixWorld);
    const tmp = new THREE.Vector3(), nrm = new THREE.Vector3();
    for (let i = 0; i < borderPositions.length; i += 3) {
        tmp.set(borderPositions[i], borderPositions[i + 1], borderPositions[i + 2]);
        nrm.copy(tmp).applyMatrix4(rot).normalize();
        const facing = nrm.dot(camDir) > 0;
        const base = facing ? BORDER_NEAR : BORDER_FAR;
        const r = borderColors[i], g = borderColors[i + 1], b = borderColors[i + 2];
        const intensityRaw = Math.max(0.25, Math.min(1.0, (r + g + b) / 3 / 0.75));
        const intensity = facing ? intensityRaw * 0.90 : intensityRaw * 0.32;
        borderColors[i] = base.r * intensity; borderColors[i + 1] = base.g * intensity; borderColors[i + 2] = base.b * intensity;
    }
    borderDots.geometry.attributes.color.needsUpdate = true;
}
function buildCountryHighlight(countryName) {
    if (!countryGeoJSON || !countryName || countryName === "Ocean") { if (highlightDots) { earthGroup.remove(highlightDots); highlightDots.geometry.dispose(); highlightDots.material.dispose(); highlightDots = null; } return; }
    const key = countryName.toLowerCase(); if (key === lastHighlightKey) return; lastHighlightKey = key;
    let feat = countryGeoJSON.features.find(f => { const n = (f.properties?.name || "").toLowerCase(); return n === key; });
    if (!feat) feat = countryGeoJSON.features.find(f => { const n = (f.properties?.name || "").toLowerCase(); return n && (n.includes(key) || key.includes(n)); });
    if (!feat) { if (highlightDots) { earthGroup.remove(highlightDots); highlightDots.geometry.dispose(); highlightDots.material.dispose(); highlightDots = null; } return; }
    const spacingDeg = 0.14, baseR = EARTH_RADIUS_UNITS + 0.065;
    const positions = [];
    const addPoint = (lat, lon) => { const p = latLonToPos(lat, lon, baseR); positions.push(p.x, p.y, p.z); };
    const g = feat.geometry;
    if (g.type === "Polygon") pushPolygon(g.coordinates, (lat, lon) => addPoint(lat, lon), spacingDeg, true);
    else if (g.type === "MultiPolygon") for (const poly of g.coordinates) pushPolygon(poly, (lat, lon) => addPoint(lat, lon), spacingDeg, true);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.computeBoundingSphere();
    const mat = new THREE.PointsMaterial({ size: 0.095, color: new THREE.Color(TRACK_COLOR), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    if (highlightDots) { earthGroup.remove(highlightDots); highlightDots.geometry.dispose(); highlightDots.material.dispose(); }
    highlightDots = new THREE.Points(geo, mat); highlightDots.renderOrder = 7; earthGroup.add(highlightDots);
}
function pushPolygon(rings, addPoint, spacingDeg, simple = false) {
    if (!Array.isArray(rings)) return;
    for (const ring of rings) {
        if (!Array.isArray(ring) || ring.length < 2) continue;
        for (let i = 0; i < ring.length - 1; i++) {
            const a = ring[i], b = ring[i + 1]; if (!a || !b) continue;
            const lon1 = a[0], lat1 = a[1], lon2 = b[0], lat2 = b[1];
            const dLon = normalizeLon(lon2 - lon1), dLat = lat2 - lat1;
            const dist = Math.max(Math.abs(dLon), Math.abs(dLat));
            const steps = Math.max(1, Math.floor(dist / spacingDeg));
            for (let s = 0; s <= steps; s++) {
                const t = steps === 0 ? 0 : (s / steps);
                const lat = lerp(lat1, lat2, t), lon = normalizeLon(lon1 + dLon * t);
                if (simple) addPoint(lat, lon); else addPoint(lat, lon, 0.6 + 0.4 * Math.sin(t * Math.PI));
            }
        }
    }
}
