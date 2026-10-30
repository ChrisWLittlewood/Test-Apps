/* Bone Idle – novelty "x-ray" camera. It is a drawing on top of the camera picture: nothing is emitted, measured or diagnosed.
   Hand tracking: MediaPipe Hand Landmarker (downloaded the first time with signal); falls back to a demo hand. */
const XR_MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const XR_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const XR_FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
let xrLM = null;   // cached HandLandmarker

function renderXrayLanding() {
  cur.report = null;
  setTop('Bone Idle', 'X-ray vision, as seen in comic books', '/');
  let agreed = false; try { agreed = localStorage.getItem('boneidle_ok') === '1'; } catch { }
  $('#main').innerHTML = `<div class="card xr-hero"><h2>🦴 Bone Idle</h2><p>Point your phone at a hand and see the bones inside*. Uses the camera and a lot of imagination.</p><p class="small muted">*It doesn't. See below. At length.</p></div>
    <div class="card xr-disc"><h3>Important safety information – please read in full (nobody does)</h3>
      <ol class="small">
        <li><b>Hands only.</b> Bone Idle works exclusively on human hands. It does not work on feet, pets, colleagues' heads (sorry, Brenda), pipework, welds, flanges, lunch, or anything you were actually hoping to inspect. Pointing it at a pipe will not reveal wall thickness, no matter how hard you squint.</li>
        <li><b>Not a medical device.</b> Bone Idle is not an X-ray machine, a scanner, an NDT technique, or a qualified radiographer. It is a cartoon of some bones drawn on top of your camera picture. No radiation is emitted, detected, measured, recorded or certified. Do not use it to diagnose a broken finger; use a doctor, who went to university for this.</li>
        <li><b>Not to be credited against any IMS schedule.</b> This includes, but is not limited to, RT, CR, DR, profile radiography and "having a quick look".</li>
        <li><b>Side effects.</b> Prolonged use may cause mild hair loss, depression, slow agonising death, mild sleepiness, and/or possible unexpected superpowers. Side effects may also include smugness, an urge to show people, and being asked to "do Brenda's head". If you develop superpowers, please report them to your line manager and complete the relevant management of change.</li>
        <li><b>Accuracy.</b> Bone positions are approximate, artistic and occasionally optimistic. Number of bones shown may differ from number of bones owned. If the app shows six fingers, count again before seeking help.</li>
        <li><b>Permit to work.</b> Not required for looking at your own hand. Looking at someone else's hand requires their consent and a straight face.</li>
        <li><b>Camera.</b> The picture never leaves your phone and nothing is saved. The hand tracker is downloaded once from Google's MediaPipe service the first time you use it with signal; without signal you get a demo hand instead, which is equally inaccurate.</li>
        <li><b>Hazardous areas.</b> Normal rules for phones and cameras in classified areas still apply. Bone Idle does not make your phone intrinsically safe, though it may make you intrinsically silly.</li>
        <li><b>Batteries.</b> X-ray vision is power-hungry. Expect your phone to get warm and your battery to get small.</li>
        <li><b>Liability.</b> By tapping below you accept that any resulting hair loss, superpowers or loss of credibility are entirely your own, and that the authors, the Inspection Toolbox, and Brenda accept no responsibility whatsoever.</li>
      </ol>
      <label class="na-toggle"><input type="checkbox" id="xrAgree" ${agreed ? 'checked' : ''}> I have read this disclaimer, understood very little of it, and accept the risk of superpowers</label>
      <button class="btn primary block big" id="xrGo" ${agreed ? '' : 'disabled'}>📷 Engage X-ray vision</button>
      <button class="btn ghost block" id="xrDemo">🦴 Demo hand (no camera)</button></div>`;
  $('#xrAgree').onchange = e => { $('#xrGo').disabled = !e.target.checked; try { localStorage.setItem('boneidle_ok', e.target.checked ? '1' : '0'); } catch { } };
  $('#xrGo').onclick = () => openXray(false);
  $('#xrDemo').onclick = () => openXray(true);
}

async function getLandmarker() {
  if (xrLM) return xrLM;
  const vision = await import(XR_MP + '/vision_bundle.mjs');
  const fs = await vision.FilesetResolver.forVisionTasks(XR_MP + '/wasm');
  xrLM = await vision.HandLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: XR_MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2 });
  return xrLM;
}

function openXray(demoOnly) {
  const ov = document.createElement('div'); ov.className = 'xray';
  ov.innerHTML = `<video playsinline muted autoplay></video><canvas></canvas>
    <div class="xr-top"><button class="btn ghost sm" data-x="close">✕</button><span class="xr-title">BONE IDLE <small>MK II</small></span><button class="btn ghost sm" data-x="flip" title="Switch camera">🔄</button></div>
    <div class="xr-hud"><div class="xr-gauge"><span>RADIATION</span><i><b></b></i><em>0.00 mSv*</em></div><div class="xr-msg">Warming up the tubes…</div></div>
    <div class="xr-foot">*Not real. Nothing is. Only works on hands.</div>`;
  document.body.append(ov); document.body.classList.add('noscroll');
  const video = $('video', ov), cv = $('canvas', ov), g = cv.getContext('2d'), msg = $('.xr-msg', ov), bar = $('.xr-gauge b', ov), dose = $('.xr-gauge em', ov);
  let stream = null, facing = 'environment', lm = null, raf = 0, demo = demoOnly, alive = true, lastSeen = 0, t0 = performance.now(), noHandSince = performance.now(), jokeIdx = 0;
  ov._test = hands => { ov._hands = hands; };   // used by automated tests to inject landmarks
  const jokes = ["That's not a hand. See disclaimer, section 1.", 'No hand detected. Brenda says no.', 'Still not a hand. Try one with fingers.', 'Pipes are not hands. We checked.'];
  function size() { const r = ov.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; }
  size(); addEventListener('resize', size);
  async function startCam() {
    try { stream?.getTracks().forEach(t => t.stop()); stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); video.srcObject = stream; await video.play(); }
    catch (e) { demo = true; msg.textContent = 'No camera access – showing the demo hand. (Your bones are safe.)'; }
  }
  async function start() {
    if (!demo) { await startCam(); }
    if (!demo) { try { msg.textContent = 'Downloading the bone detector…'; lm = await getLandmarker(); msg.textContent = 'Point at a hand. Only works on hands.'; } catch (e) { console.warn(e); demo = true; msg.textContent = 'No signal for the hand tracker – demo hand engaged.'; } }
    if (demo) msg.textContent = 'Demo hand. Wave yours about for authenticity.';
    loop();
  }
  // geometry helpers
  const P = (p, W, H, mirror) => [(mirror ? 1 - p.x : p.x) * W, p.y * H, p.z || 0];
  function coverMap(W, H) {   // map normalised video coords to the canvas with object-fit: cover
    const vw = video.videoWidth || W, vh = video.videoHeight || H, s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
    return p => ({ x: ((facing === 'user' ? 1 - p.x : p.x) * dw + (W - dw) / 2) / W, y: (p.y * dh + (H - dh) / 2) / H, z: p.z });
  }
  function demoHand(t) {   // a hand-shaped set of 21 landmarks that waves gently
    const base = [[0, 0.32], [-0.10, 0.25], [-0.17, 0.16], [-0.22, 0.08], [-0.26, 0.01], [-0.07, 0.09], [-0.085, -0.03], [-0.09, -0.10], [-0.095, -0.16], [0, 0.08], [0, -0.06], [0, -0.14], [0, -0.21], [0.07, 0.09], [0.08, -0.04], [0.085, -0.11], [0.09, -0.17], [0.13, 0.12], [0.15, 0.03], [0.16, -0.02], [0.17, -0.07]];
    const a = Math.sin(t / 900) * 0.18, cx = 0.5 + Math.sin(t / 1700) * 0.06, cy = 0.52;
    return base.map(([x, y], i) => { const curl = (i % 4 === 0 && i) ? Math.sin(t / 600 + i) * 0.01 : 0; return { x: cx + (x * Math.cos(a) - y * Math.sin(a)) * 1.1, y: cy + (x * Math.sin(a) + y * Math.cos(a)) * 1.1 + curl, z: -0.02 * Math.sin(i + t / 800) }; });
  }
  function bone(A, B, w, glow) {   // tapered bone with knobbly ends
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const wa = w, wm = w * 0.62, wb = w * 0.9;
    const M = [A[0] + dx * 0.5, A[1] + dy * 0.5];
    g.beginPath();
    g.moveTo(A[0] + nx * wa, A[1] + ny * wa); g.quadraticCurveTo(M[0] + nx * wm, M[1] + ny * wm, B[0] + nx * wb, B[1] + ny * wb);
    g.arc(B[0], B[1], wb, Math.atan2(ny, nx), Math.atan2(ny, nx) - Math.PI, true);
    g.quadraticCurveTo(M[0] - nx * wm, M[1] - ny * wm, A[0] - nx * wa, A[1] - ny * wa);
    g.arc(A[0], A[1], wa, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) - Math.PI, true); g.closePath();
    const gr = g.createLinearGradient(M[0] + nx * w, M[1] + ny * w, M[0] - nx * w, M[1] - ny * w);
    gr.addColorStop(0, `rgba(170,215,255,${0.55 * glow})`); gr.addColorStop(0.5, `rgba(245,252,255,${0.95 * glow})`); gr.addColorStop(1, `rgba(150,200,255,${0.55 * glow})`);
    g.fillStyle = gr; g.fill();
    g.strokeStyle = `rgba(255,255,255,${0.35 * glow})`; g.lineWidth = Math.max(1, w * 0.12); g.beginPath(); g.moveTo(A[0] + dx * 0.15, A[1] + dy * 0.15); g.lineTo(A[0] + dx * 0.85, A[1] + dy * 0.85); g.stroke();   // marrow line
  }
  function drawHand(lms, W, H) {
    const pts = lms.map(p => [p.x * W, p.y * H, p.z || 0]);
    const hs = Math.hypot(pts[9][0] - pts[0][0], pts[9][1] - pts[0][1]) || 100;
    const depth = i => Math.max(0.55, Math.min(1.25, 1 - (pts[i][2]) * 4));   // nearer joints draw thicker / brighter
    // soft tissue silhouette
    g.save(); g.filter = `blur(${hs * 0.12}px)`; g.fillStyle = 'rgba(120,170,230,.22)';
    const outline = [0, 1, 2, 3, 4, 3, 6, 7, 8, 7, 10, 11, 12, 11, 14, 15, 16, 15, 18, 19, 20, 19, 17, 0];
    g.beginPath(); outline.forEach((i, k) => k ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1])); g.lineJoin = 'round'; g.lineWidth = hs * 0.42; g.strokeStyle = 'rgba(120,170,230,.22)'; g.stroke(); g.fill(); g.restore();
    g.save(); g.shadowColor = 'rgba(160,220,255,.95)'; g.shadowBlur = hs * 0.12;
    // forearm: radius and ulna
    const w0 = pts[0], dir = [w0[0] - pts[9][0], w0[1] - pts[9][1]], dl = Math.hypot(...dir) || 1, u = [dir[0] / dl, dir[1] / dl], n = [-u[1], u[0]];
    for (const s2 of [-1, 1]) { const A = [w0[0] + n[0] * hs * 0.17 * s2 + u[0] * hs * 0.12, w0[1] + n[1] * hs * 0.17 * s2 + u[1] * hs * 0.12]; bone(A, [A[0] + u[0] * hs * 1.3, A[1] + u[1] * hs * 1.3], hs * (s2 < 0 ? 0.1 : 0.085), 0.9); }
    // carpals – a little cluster of pebbles
    const cb = [(w0[0] * 0.65 + pts[9][0] * 0.35), (w0[1] * 0.65 + pts[9][1] * 0.35)];
    const across = [pts[5][0] - pts[17][0], pts[5][1] - pts[17][1]], al = Math.hypot(...across) || 1, a1 = [across[0] / al, across[1] / al];
    [[-0.9, -0.5], [-0.3, -0.6], [0.3, -0.55], [0.9, -0.45], [-0.75, 0.25], [-0.2, 0.2], [0.35, 0.25], [0.85, 0.3]].forEach(([i, j]) => {
      const x = cb[0] + a1[0] * i * hs * 0.2 - u[0] * j * hs * 0.18, y = cb[1] + a1[1] * i * hs * 0.2 - u[1] * j * hs * 0.18;
      const rg = g.createRadialGradient(x, y, 1, x, y, hs * 0.1); rg.addColorStop(0, 'rgba(250,253,255,.95)'); rg.addColorStop(1, 'rgba(150,200,255,.25)');
      g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, hs * 0.095, hs * 0.075, Math.atan2(a1[1], a1[0]), 0, 7); g.fill();
    });
    // metacarpals + phalanges
    XR_FINGERS.forEach((f, fi) => {
      const baseP = fi === 0 ? [w0[0] * 0.55 + pts[1][0] * 0.45, w0[1] * 0.55 + pts[1][1] * 0.45] : [cb[0] * 0.5 + pts[f[0]][0] * 0.5 + (pts[f[0]][0] - pts[9][0]) * 0.15, cb[1] * 0.5 + pts[f[0]][1] * 0.5 + (pts[f[0]][1] - pts[9][1]) * 0.15];
      const chain = fi === 0 ? [baseP, pts[2], pts[3], pts[4]] : [baseP, pts[f[0]], pts[f[1]], pts[f[2]], pts[f[3]]];
      const idxs = fi === 0 ? [1, 2, 3, 4] : [f[0], f[0], f[1], f[2], f[3]];
      for (let k = 0; k < chain.length - 1; k++) {
        const w = hs * (k === 0 ? 0.075 : 0.068 - k * 0.009) * depth(idxs[k + 1]);
        const A = chain[k], B = chain[k + 1]; const gap = 0.06; const dx = B[0] - A[0], dy = B[1] - A[1];
        bone([A[0] + dx * gap, A[1] + dy * gap], [B[0] - dx * gap, B[1] - dy * gap], w, depth(idxs[k + 1]));
      }
      // fingertip tuft
      const tip = chain[chain.length - 1]; g.fillStyle = 'rgba(235,248,255,.85)'; g.beginPath(); g.arc(tip[0], tip[1], hs * 0.035, 0, 7); g.fill();
    });
    g.restore();
  }
  function loop() {
    if (!alive) return;
    const W = cv.width, H = cv.height, now = performance.now();
    g.clearRect(0, 0, W, H);
    // x-ray film look: dark, blue, inverted camera picture
    if (!demo && video.readyState >= 2) {
      g.save(); g.filter = 'grayscale(1) invert(1) contrast(1.6) brightness(0.45)';
      const vw = video.videoWidth, vh = video.videoHeight, s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
      if (facing === 'user') { g.translate(W, 0); g.scale(-1, 1); }
      g.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh); g.restore();
      g.fillStyle = 'rgba(10,40,90,.55)'; g.fillRect(0, 0, W, H);
    } else { const bg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7); bg.addColorStop(0, '#0f2a4a'); bg.addColorStop(1, '#02070e'); g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    let hands = ov._hands || null;
    if (!hands && demo) hands = [demoHand(now)];
    if (!hands && lm && video.readyState >= 2) {
      try { const r = lm.detectForVideo(video, now); if (r.landmarks?.length) { const map = coverMap(W, H); hands = r.landmarks.map(h => h.map(map)); } } catch (e) { }
    }
    if (hands?.length) { hands.forEach(h => drawHand(h, W, H)); lastSeen = now; noHandSince = now; msg.textContent = hands.length > 1 ? 'Two hands detected. Show-off.' : 'Hand detected. Bones located. Probably.'; }
    else if (lm && now - noHandSince > 2500) { msg.textContent = jokes[jokeIdx % jokes.length]; if (now - noHandSince > 5000) { jokeIdx++; noHandSince = now - 2500; } }
    // scan line + gauge
    const sy = ((now - t0) / 9 % (H + 200)) - 100; const sg = g.createLinearGradient(0, sy - 60, 0, sy + 6); sg.addColorStop(0, 'rgba(120,200,255,0)'); sg.addColorStop(1, 'rgba(160,230,255,.35)'); g.fillStyle = sg; g.fillRect(0, sy - 60, W, 66);
    const lvl = now - lastSeen < 300 ? 0.62 + Math.random() * 0.3 : 0.05 + Math.random() * 0.05;
    bar.style.width = (lvl * 100).toFixed(0) + '%'; dose.textContent = (lvl * 3.7).toFixed(2) + ' mSv*';
    raf = requestAnimationFrame(loop);
  }
  ov.addEventListener('click', e => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    if (b.dataset.x === 'close') { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); removeEventListener('resize', size); ov.remove(); document.body.classList.remove('noscroll'); }
    if (b.dataset.x === 'flip' && !demo) { facing = facing === 'user' ? 'environment' : 'user'; startCam(); }
  });
  start();
}
