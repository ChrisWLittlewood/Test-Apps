/* X-Ray Pipe Vision (Experimental) – codename Bone Idle.
   A novelty: a drawing on top of the camera picture. Nothing is emitted, measured or diagnosed.
   Body tracking uses MediaPipe hand / face / pose landmarkers (downloaded once with signal); falls back to a training dummy. */
const XR_MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const XR_MODELS = {
  hand: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
};
const XR_FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
let xrNets = null;

function renderXrayLanding() {
  cur.report = null;
  setTop('X-Ray Pipe Vision', 'Experimental feature', '/');
  $('#main').innerHTML = `<div class="card xr-hero"><span class="xr-exp">EXPERIMENTAL</span><h2>☢ X-Ray Pipe Vision</h2>
      <p>See straight through insulation and cladding to check for corrosion under insulation, without a single strip of delagging. Point the phone's camera at insulated pipework, hold steady, and let the X-ray emitter do the rest.</p>
      <p class="small">Project codename: <b>Bone Idle</b> · Firmware MK II · Not yet approved by anyone</p></div>
    <div class="card xr-danger"><div class="xr-trefoil">☢</div><h3>DO NOT POINT AT PEOPLE</h3><p>This feature emits experimental doses of make-believe ionising radiation. It is intended <b>only for pipework</b>. Pointing it at people, including yourself, colleagues, contractors, visiting management or Brenda, is <b>strictly forbidden</b>.</p></div>
    <div class="card xr-disc"><h3>Mandatory safety briefing (please read in full, nobody does)</h3>
      <ol class="small">
        <li><b>Pipework only.</b> X-Ray Pipe Vision is designed exclusively for insulated piping. Under no circumstances point it at hands, heads, bodies, pets, or anything with a pulse. It will notice. It will tell you. Loudly.</li>
        <li><b>Side effects.</b> Prolonged use may cause mild hair loss, depression, slow agonising death, mild sleepiness, and/or possible unexpected superpowers. Rare side effects include glowing in the dark, an affinity for lead aprons, and an uncontrollable urge to point it at Brenda.</li>
        <li><b>Superpowers.</b> Any superpowers acquired must be reported to your line manager, risk-assessed, and raised through management of change before use on site. Flight is not covered by your working-at-height training.</li>
        <li><b>Exclusion zone.</b> Maintain an exclusion zone of approximately everyone. Barriers and signage are recommended. A man with a flag walking in front of you is optional but encouraged.</li>
        <li><b>Accuracy.</b> Wall thickness readings are experimental and may be off by up to 100%. Do not use them to credit any IMS schedule, RT, CR, DR, profile radiography or "having a quick look".</li>
        <li><b>Your skeleton.</b> Viewing your own skeleton may void its warranty. The manufacturer of your skeleton has not been consulted.</li>
        <li><b>Licensing.</b> Use requires a valid licence to operate imaginary radiation sources, a radiation protection supervisor with a good sense of humour, and a dosimeter you don't mind looking at.</li>
        <li><b>Hazardous areas.</b> Normal rules for phones and cameras in classified areas still apply. This feature does not make your phone intrinsically safe, though it may make you intrinsically silly.</li>
        <li><b>Battery.</b> The emitter is power-hungry. Expect your phone to get warm and your battery to get small.</li>
        <li><b>Liability.</b> By continuing you accept that any hair loss, sleepiness, superpowers, funerals or loss of professional credibility are entirely your own. The authors, the Inspection Toolbox, the IMS team, your employer and Brenda accept no liability whatsoever, now or in any future life.</li>
      </ol>
      <p class="xr-small">Small print of the small print: it's a joke. It's your camera and a drawing; nothing is emitted, detected, recorded or saved. The body trackers are downloaded once from Google MediaPipe and run on the phone.</p>
      <button class="btn danger block big" id="xrGo">☢ Enable experimental X-ray emitter</button>
      <button class="btn ghost block" id="xrDemo">🎓 Training mode (simulated colleague, no camera)</button></div>`;
  $('#xrGo').onclick = async () => { if (await xrConfirm()) openXray(false); };
  $('#xrDemo').onclick = () => openXray(true);
}
async function xrConfirm() {
  const a = await modal('⚠ Are you sure?', `<p>You are about to enable an <b>experimental X-ray emitter</b>.</p><p>It is for <b>pipework only</b>. Do not point it at people.</p>`, [['No, take me back', ''], ['Yes, I\'m sure', 'ok', 'danger']]);
  if (!a) return false;
  const b = await modal('☢ Are you SUPER sure?', `<p>Really really sure?</p><p>Side effects include mild hair loss, depression, slow agonising death, mild sleepiness and possible unexpected superpowers.</p><p>Your skeleton has asked us to ask you twice.</p>`, [['I\'ve changed my mind', ''], ['Yes, SUPER sure', 'ok', 'danger']]);
  if (!b) return false;
  const c = await modal('☠ Final legal confirmation', `<p>I confirm I will <b>not</b> point this at people, that no liability will be held by anyone, ever, and that I am solely responsible for any funeral arrangements.</p><label class="field"><span>Type <b>NOT AT PEOPLE</b> to arm the emitter</span><input name="sig" class="inp" autocomplete="off" autocapitalize="characters"></label>`, [['Abort', ''], ['Arm emitter', 'ok', 'danger']]);
  if (!c) return false;
  if ((c.vals.sig || '').trim().toUpperCase() !== 'NOT AT PEOPLE') { toast('Incorrect. The emitter remains safely un-armed.', 3000); return false; }
  return true;
}
async function getNets(onStep) {
  if (xrNets) return xrNets;
  const vision = await import(XR_MP + '/vision_bundle.mjs');
  const fs = await vision.FilesetResolver.forVisionTasks(XR_MP + '/wasm');
  const mk = async (Cls, key, extra) => { onStep?.(key); try { return await Cls.createFromOptions(fs, { baseOptions: { modelAssetPath: XR_MODELS[key], delegate: 'GPU' }, runningMode: 'VIDEO', ...extra }); } catch (e) { console.warn(key, e); return null; } };
  const nets = { hand: await mk(vision.HandLandmarker, 'hand', { numHands: 2 }), face: await mk(vision.FaceLandmarker, 'face', { numFaces: 2 }), pose: await mk(vision.PoseLandmarker, 'pose', { numPoses: 2 }) };
  if (!nets.hand && !nets.face && !nets.pose) throw new Error('no trackers');
  return (xrNets = nets);
}

function openXray(demoOnly) {
  const ov = document.createElement('div'); ov.className = 'xray';
  ov.innerHTML = `<video playsinline muted autoplay></video><canvas></canvas>
    <div class="xr-alarm" hidden><b>⚠ DANGER! ⚠</b><span>LETHAL RADIATION DOSE EXCEEDED!</span><span>SEEK EMERGENCY FUNERAL ARRANGEMENTS!</span></div>
    <div class="xr-top"><button class="btn ghost sm" data-x="close">✕</button><span class="xr-title">X-RAY PIPE VISION <small>EXP</small></span><span><button class="btn ghost sm" data-x="mute" title="Klaxon">🔊</button> <button class="btn ghost sm" data-x="flip" title="Switch camera">🔄</button></span></div>
    <div class="xr-hud"><div class="xr-gauge"><span>DOSE</span><i><b></b></i><em>0.00 mSv</em></div><div class="xr-msg">Charging emitter…</div></div>
    <div class="xr-foot">Experimental · pipework only · do not point at people</div>`;
  document.body.append(ov); document.body.classList.add('noscroll');
  const video = $('video', ov), cv = $('canvas', ov), g = cv.getContext('2d'), msg = $('.xr-msg', ov), bar = $('.xr-gauge b', ov), dose = $('.xr-gauge em', ov), alarm = $('.xr-alarm', ov);
  let stream = null, facing = 'environment', nets = null, raf = 0, demo = demoOnly, alive = true, t0 = performance.now(), turn = 0, muted = false, ac = null, lastBeep = 0, sv = 0;
  const last = { hand: null, face: null, pose: null, th: 0, tf: 0, tp: 0 };
  ov._test = d => { ov._inject = d; };
  function size() { const r = ov.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; }
  size(); addEventListener('resize', size);
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { }
  function klaxon() { if (muted || !ac) return; const o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(520, ac.currentTime); o.frequency.linearRampToValueAtTime(880, ac.currentTime + 0.35); gn.gain.setValueAtTime(0.08, ac.currentTime); gn.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.42); o.connect(gn).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.45); }
  async function startCam() {
    try { stream?.getTracks().forEach(t => t.stop()); stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }); video.srcObject = stream; await video.play(); }
    catch (e) { demo = true; msg.textContent = 'No camera access – training mode engaged.'; }
  }
  async function start() {
    if (!demo) await startCam();
    if (!demo) { try { nets = await getNets(k => { msg.textContent = `Calibrating ${k === 'hand' ? 'phalanx' : k === 'face' ? 'cranial' : 'skeletal'} detector…`; }); msg.textContent = 'Emitter armed. Point at pipework.'; }
      catch (e) { demo = true; msg.textContent = 'No signal for the detectors – training mode engaged.'; } }
    loop();
  }
  const coverMap = (W, H) => { const vw = video.videoWidth || W, vh = video.videoHeight || H, s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s; return p => ({ x: ((facing === 'user' ? 1 - p.x : p.x) * dw + (W - dw) / 2) / W, y: (p.y * dh + (H - dh) / 2) / H, z: p.z || 0, v: p.visibility ?? 1 }); };
  const px = (p, W, H) => [p.x * W, p.y * H, p.z || 0];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k], len = a => Math.hypot(a[0], a[1]) || 1, nrm = a => mul(a, 1 / len(a));
  function boneFill(A, B, w) { const n = nrm([-(B[1] - A[1]), B[0] - A[0]]), M = mix(A, B, 0.5); const gr = g.createLinearGradient(M[0] + n[0] * w, M[1] + n[1] * w, M[0] - n[0] * w, M[1] - n[1] * w); gr.addColorStop(0, 'rgba(160,210,255,.55)'); gr.addColorStop(0.5, 'rgba(245,252,255,.95)'); gr.addColorStop(1, 'rgba(150,200,255,.55)'); return gr; }
  function bone(A, B, w, glow = 1) {
    const d = sub(B, A), L = len(d), n = [-d[1] / L, d[0] / L], M = mix(A, B, 0.5), wm = w * 0.62, wb = w * 0.9;
    g.globalAlpha = Math.min(1, glow); g.beginPath();
    g.moveTo(A[0] + n[0] * w, A[1] + n[1] * w); g.quadraticCurveTo(M[0] + n[0] * wm, M[1] + n[1] * wm, B[0] + n[0] * wb, B[1] + n[1] * wb);
    g.arc(B[0], B[1], wb, Math.atan2(n[1], n[0]), Math.atan2(n[1], n[0]) - Math.PI, true);
    g.quadraticCurveTo(M[0] - n[0] * wm, M[1] - n[1] * wm, A[0] - n[0] * w, A[1] - n[1] * w);
    g.arc(A[0], A[1], w, Math.atan2(-n[1], -n[0]), Math.atan2(-n[1], -n[0]) - Math.PI, true); g.closePath();
    g.fillStyle = boneFill(A, B, w); g.fill(); g.globalAlpha = 1;
  }
  function glowOn(s) { g.shadowColor = 'rgba(160,220,255,.95)'; g.shadowBlur = s; }
  /* ---------- hand ---------- */
  function drawHand(lms, W, H) {
    const pts = lms.map(p => px(p, W, H)); const hs = len(sub(pts[9], pts[0])) || 100;
    const depth = i => Math.max(0.55, Math.min(1.25, 1 - pts[i][2] * 4));
    g.save(); g.filter = `blur(${hs * 0.12}px)`; g.strokeStyle = g.fillStyle = 'rgba(120,170,230,.2)'; g.lineWidth = hs * 0.42; g.lineJoin = 'round';
    g.beginPath(); [0, 1, 2, 3, 4, 3, 6, 7, 8, 7, 10, 11, 12, 11, 14, 15, 16, 15, 18, 19, 20, 19, 17, 0].forEach((i, k) => k ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1])); g.stroke(); g.fill(); g.restore();
    g.save(); glowOn(hs * 0.12);
    const w0 = pts[0], u = nrm(sub(w0, pts[9])), n = [-u[1], u[0]];
    for (const s2 of [-1, 1]) { const A = add(add(w0, mul(n, hs * 0.17 * s2)), mul(u, hs * 0.12)); bone(A, add(A, mul(u, hs * 1.2)), hs * (s2 < 0 ? 0.1 : 0.085), 0.9); }
    const cb = mix(w0, pts[9], 0.33), a1 = nrm(sub(pts[5], pts[17]));
    [[-0.8, -0.45], [-0.27, -0.55], [0.27, -0.5], [0.8, -0.4], [-0.65, 0.2], [-0.2, 0.18], [0.3, 0.2], [0.75, 0.25]].forEach(([i, j]) => {
      const c = add(add(cb, mul(a1, i * hs * 0.18)), mul(u, -j * hs * 0.16)); const rg = g.createRadialGradient(c[0], c[1], 1, c[0], c[1], hs * 0.09);
      rg.addColorStop(0, 'rgba(250,253,255,.95)'); rg.addColorStop(1, 'rgba(150,200,255,.25)'); g.fillStyle = rg; g.beginPath(); g.ellipse(c[0], c[1], hs * 0.08, hs * 0.065, Math.atan2(a1[1], a1[0]), 0, 7); g.fill();
    });
    XR_FINGERS.forEach((f, fi) => {
      const base = fi === 0 ? mix(w0, pts[1], 0.45) : add(mix(cb, pts[f[0]], 0.5), mul(sub(pts[f[0]], pts[9]), 0.15));
      const chain = fi === 0 ? [base, pts[2], pts[3], pts[4]] : [base, pts[f[0]], pts[f[1]], pts[f[2]], pts[f[3]]];
      const idx = fi === 0 ? [1, 2, 3, 4] : [f[0], f[0], f[1], f[2], f[3]];
      for (let k = 0; k < chain.length - 1; k++) { const A = chain[k], B = chain[k + 1], d = sub(B, A); bone(add(A, mul(d, 0.06)), sub(B, mul(d, 0.06)), hs * (k === 0 ? 0.07 : 0.064 - k * 0.009) * depth(idx[k + 1]), depth(idx[k + 1])); }
    });
    g.restore();
  }
  /* ---------- skull ---------- */
  function drawSkull({ le, re, chin, open = 0 }) {
    const e = len(sub(re, le)), u = nrm(sub(re, le)); let v = [-u[1], u[0]]; const M = mix(le, re, 0.5);
    if ((chin[0] - M[0]) * v[0] + (chin[1] - M[1]) * v[1] < 0) v = mul(v, -1);
    const at = (x, y) => add(add(M, mul(u, x * e)), mul(v, y * e)), ang = Math.atan2(u[1], u[0]);
    const jawDrop = Math.max(0, Math.min(0.45, open)) * e;
    g.save(); glowOn(e * 0.35);
    const fillBone = (cx, cy, r) => { const c = at(cx, cy); const rg = g.createRadialGradient(c[0], c[1], e * 0.1, c[0], c[1], r * e); rg.addColorStop(0, 'rgba(250,253,255,.97)'); rg.addColorStop(0.7, 'rgba(200,228,255,.85)'); rg.addColorStop(1, 'rgba(120,180,240,.45)'); return rg; };
    // cranium + face
    g.fillStyle = fillBone(0, -0.3, 1.9); g.beginPath();
    const c0 = at(0, -0.62); g.ellipse(c0[0], c0[1], 1.3 * e, 1.28 * e, ang, Math.PI * 0.93, Math.PI * 2.07);
    [[1.22, 0.05], [1.12, 0.55], [0.86, 0.9], [0.55, 1.15], [0.38, 1.28], [-0.38, 1.28], [-0.55, 1.15], [-0.86, 0.9], [-1.12, 0.55], [-1.22, 0.05]].forEach(([x, y]) => g.lineTo(...at(x, y)));
    g.closePath(); g.fill();
    // mandible
    const jd = mul(v, jawDrop);
    g.fillStyle = fillBone(0, 1.6, 1.3); g.beginPath();
    [[-0.92, 0.95], [-0.85, 1.55], [-0.5, 1.95], [0, 2.08], [0.5, 1.95], [0.85, 1.55], [0.92, 0.95], [0.72, 1.0], [0.62, 1.42], [0.35, 1.48], [-0.35, 1.48], [-0.62, 1.42], [-0.72, 1.0]].forEach(([x, y], i) => { const p = y > 1.3 ? add(at(x, y), jd) : at(x, y); i ? g.lineTo(...p) : g.moveTo(...p); });
    g.closePath(); g.fill();
    g.shadowBlur = 0;
    // teeth
    g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = 'rgba(40,70,110,.6)'; g.lineWidth = Math.max(1, e * 0.025);
    for (let k = -4; k < 4; k++) { const tw = 0.1; let p = at(k * tw + 0.005, 1.25); g.beginPath(); g.rect(-tw * e / 2, 0, tw * e * 0.9, 0.2 * e); g.save(); g.translate(...p); g.rotate(ang); g.fill(); g.stroke(); g.restore(); p = add(at(k * tw + 0.005, 1.5), jd); g.save(); g.translate(...p); g.rotate(ang); g.beginPath(); g.rect(-tw * e / 2, -0.2 * e, tw * e * 0.9, 0.2 * e); g.fill(); g.stroke(); g.restore(); }
    // eye sockets + nose
    g.fillStyle = 'rgba(2,8,18,.92)';
    for (const sx of [-0.5, 0.5]) { const c = at(sx, 0.02); g.beginPath(); g.ellipse(c[0], c[1], 0.36 * e, 0.31 * e, ang + (sx < 0 ? 0.12 : -0.12), 0, 7); g.fill(); }
    g.beginPath(); [[0, 0.42], [0.17, 0.82], [0.05, 0.86], [0, 0.78], [-0.05, 0.86], [-0.17, 0.82]].forEach(([x, y], i) => i ? g.lineTo(...at(x, y)) : g.moveTo(...at(x, y))); g.closePath(); g.fill();
    // cheekbone shading + suture line
    g.strokeStyle = 'rgba(120,170,230,.55)'; g.lineWidth = Math.max(1, e * 0.03);
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(...at(0.82 * sx, 0.38)); g.quadraticCurveTo(...at(1.05 * sx, 0.6), ...at(0.8 * sx, 0.78)); g.stroke(); }
    g.beginPath(); g.moveTo(...at(0, -1.85)); g.quadraticCurveTo(...at(0.12, -1.4), ...at(0, -0.95)); g.stroke();
    g.restore();
  }
  const skullFromFace = (f, W, H) => { const P2 = i => [f[i].x * W, f[i].y * H]; return { le: mix(P2(33), P2(133), 0.5), re: mix(P2(362), P2(263), 0.5), chin: P2(152), open: len(sub(P2(14), P2(13))) / len(sub(mix(P2(362), P2(263), 0.5), mix(P2(33), P2(133), 0.5))) - 0.05 }; };
  /* ---------- full skeleton ---------- */
  function drawSkeleton(lm, W, H, faces) {
    const P2 = i => [lm[i].x * W, lm[i].y * H], ok = i => (lm[i].v ?? 1) > 0.45;
    if (!ok(11) || !ok(12)) return false;
    const LS = P2(11), RS = P2(12), sw = len(sub(LS, RS)), S = mix(LS, RS, 0.5);
    const hipsOk = ok(23) && ok(24); const LH = hipsOk ? P2(23) : add(LS, [0, sw * 1.5]), RH = hipsOk ? P2(24) : add(RS, [0, sw * 1.5]), Hc = mix(LH, RH, 0.5);
    const down = nrm(sub(Hc, S)), across = nrm(sub(RS, LS)); const N = sub(S, mul(down, sw * 0.22));
    g.save(); glowOn(sw * 0.06);
    // soft tissue haze
    g.save(); g.filter = `blur(${sw * 0.15}px)`; g.fillStyle = 'rgba(110,160,220,.15)'; g.beginPath(); g.moveTo(...sub(LS, mul(across, sw * 0.15))); g.lineTo(...add(RS, mul(across, sw * 0.15))); g.lineTo(...add(RH, mul(across, sw * 0.1))); g.lineTo(...sub(LH, mul(across, sw * 0.1))); g.closePath(); g.fill(); g.restore();
    // spine
    for (let k = 0; k <= 20; k++) { const c = add(mix(N, Hc, k / 20), mul(down, 0)); g.fillStyle = 'rgba(235,247,255,.92)'; g.save(); g.translate(...c); g.rotate(Math.atan2(across[1], across[0])); g.beginPath(); g.roundRect?.(-sw * 0.06, -sw * 0.022, sw * 0.12, sw * 0.044, sw * 0.015) ?? g.rect(-sw * 0.06, -sw * 0.022, sw * 0.12, sw * 0.044); g.fill(); g.restore(); }
    // ribcage
    g.lineCap = 'round';
    for (let k = 0; k < 10; k++) {
      const t = 0.06 + k * 0.052, sp = mix(S, Hc, t), wr = sw * (0.44 + Math.sin(Math.min(1, k / 5) * Math.PI / 2) * 0.1 - Math.max(0, k - 6) * 0.04), dr = sw * 0.16;
      for (const s2 of [-1, 1]) {
        const out = add(add(sp, mul(across, wr * s2)), mul(down, dr * 0.4)), end = add(add(sp, mul(across, wr * 0.35 * s2)), mul(down, dr * (k < 7 ? 0.9 : 1.2)));
        g.strokeStyle = 'rgba(225,242,255,.85)'; g.lineWidth = sw * 0.035; g.beginPath(); g.moveTo(...sp); g.quadraticCurveTo(...add(add(sp, mul(across, wr * 1.05 * s2)), mul(down, -dr * 0.35)), ...out); if (k < 9) g.quadraticCurveTo(...add(out, mul(down, dr * 0.7)), ...end); g.stroke();
      }
    }
    bone(add(S, mul(down, sw * 0.08)), add(S, mul(down, sw * 0.55)), sw * 0.05);   // sternum
    // clavicles
    bone(sub(S, mul(across, sw * 0.05)), LS, sw * 0.04); bone(add(S, mul(across, sw * 0.05)), RS, sw * 0.04);
    // pelvis
    if (hipsOk) {
      for (const [hp, s2] of [[LH, -1], [RH, 1]]) { const c = add(add(hp, mul(down, -sw * 0.12)), mul(across, s2 * sw * 0.05)); const rg = g.createRadialGradient(c[0], c[1], 2, c[0], c[1], sw * 0.3); rg.addColorStop(0, 'rgba(245,252,255,.9)'); rg.addColorStop(1, 'rgba(130,185,240,.35)'); g.fillStyle = rg; g.beginPath(); g.ellipse(c[0], c[1], sw * 0.26, sw * 0.18, Math.atan2(across[1], across[0]) + s2 * 0.5, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(2,8,18,.7)'; for (const hp of [LH, RH]) { const c = add(mix(hp, Hc, 0.45), mul(down, sw * 0.12)); g.beginPath(); g.ellipse(c[0], c[1], sw * 0.06, sw * 0.08, 0, 0, 7); g.fill(); }
      bone(add(Hc, mul(down, -sw * 0.15)), add(Hc, mul(down, sw * 0.12)), sw * 0.07);   // sacrum
    }
    // limbs
    const limb = (a, b, w) => { if (ok(a) && ok(b)) bone(P2(a), P2(b), w); };
    const pair = (a, b, w) => { if (!ok(a) || !ok(b)) return; const A = P2(a), B = P2(b), n2 = nrm([-(B[1] - A[1]), B[0] - A[0]]); bone(add(A, mul(n2, w * 0.9)), add(B, mul(n2, w * 0.7)), w * 0.6); bone(sub(A, mul(n2, w * 0.9)), sub(B, mul(n2, w * 0.7)), w * 0.5); };
    limb(11, 13, sw * 0.06); limb(12, 14, sw * 0.06); pair(13, 15, sw * 0.07); pair(14, 16, sw * 0.07);
    for (const [w, i1, i2] of [[15, 17, 19], [16, 18, 20]]) if (ok(w) && ok(i1) && ok(i2)) { [i1, i2].forEach(i => bone(P2(w), P2(i), sw * 0.025)); }
    limb(23, 25, sw * 0.085); limb(24, 26, sw * 0.085); pair(25, 27, sw * 0.08); pair(26, 28, sw * 0.08);
    for (const [a, h, t] of [[27, 29, 31], [28, 30, 32]]) if (ok(a)) { if (ok(h)) bone(P2(a), P2(h), sw * 0.04); if (ok(t)) bone(P2(a), P2(t), sw * 0.04); }
    for (const k of [13, 14, 25, 26]) if (ok(k)) { const c = P2(k); g.fillStyle = 'rgba(245,252,255,.9)'; g.beginPath(); g.arc(c[0], c[1], sw * 0.05, 0, 7); g.fill(); }
    g.restore();
    // skull: from the face tracker when it has one near this body, else from the pose's eyes / mouth
    if (ok(2) && ok(5)) {
      const nose = P2(0); const f = faces?.find(fc => len(sub([fc[1].x * W, fc[1].y * H], nose)) < sw * 0.5);
      if (!f) { const le = P2(2), re = P2(5), mo = mix(P2(9), P2(10), 0.5), em = mix(le, re, 0.5); drawSkull({ le, re, chin: add(mo, mul(sub(mo, em), 0.85)), open: 0.05 }); }
    }
    return true;
  }
  /* ---------- training dummy ---------- */
  function demoBody(t) {
    const wave = Math.sin(t / 380) * 0.5, bob = Math.sin(t / 900) * 0.01, sway = Math.sin(t / 1600) * 0.03;
    const cx = 0.5 + sway, B = { 0: [0, -0.355], 2: [-0.025, -0.37], 5: [0.025, -0.37], 9: [-0.015, -0.33], 10: [0.015, -0.33], 11: [-0.11, -0.25], 12: [0.11, -0.25], 23: [-0.075, 0.03], 24: [0.075, 0.03], 25: [-0.085, 0.2], 26: [0.085, 0.2], 27: [-0.09, 0.36], 28: [0.09, 0.36], 29: [-0.1, 0.38], 30: [0.1, 0.38], 31: [-0.06, 0.39], 32: [0.06, 0.39], 13: [-0.17, -0.12], 15: [-0.19, 0.0], 17: [-0.2, 0.03], 19: [-0.19, 0.035] };
    const el = [0.21, -0.32], ang = -1.2 + wave * 0.6;
    B[14] = el; B[16] = [el[0] + Math.cos(ang) * 0.13, el[1] + Math.sin(ang) * 0.13]; B[18] = [B[16][0] + 0.01, B[16][1] - 0.035]; B[20] = [B[16][0] + 0.03, B[16][1] - 0.025];
    const out = []; for (let i = 0; i < 33; i++) { const p = B[i]; out.push(p ? { x: cx + p[0] * 0.92, y: 0.6 + p[1] * 0.92 + bob, z: 0, v: 1 } : { x: 0, y: 0, z: 0, v: 0 }); }
    return out;
  }
  /* ---------- main loop ---------- */
  function loop() {
    if (!alive) return;
    const W = cv.width, H = cv.height, now = performance.now();
    g.clearRect(0, 0, W, H);
    if (!demo && video.readyState >= 2) {
      g.save(); g.filter = 'grayscale(1) invert(1) contrast(1.6) brightness(0.45)';
      const vw = video.videoWidth, vh = video.videoHeight, s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
      if (facing === 'user') { g.translate(W, 0); g.scale(-1, 1); }
      g.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh); g.restore(); g.fillStyle = 'rgba(10,40,90,.55)'; g.fillRect(0, 0, W, H);
    } else { const bg = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * 0.7); bg.addColorStop(0, '#0f2a4a'); bg.addColorStop(1, '#02070e'); g.fillStyle = bg; g.fillRect(0, 0, W, H); }
    // detection: one tracker per frame, round robin, results kept for a moment
    if (nets && !demo && video.readyState >= 2) {
      const order = ['pose', 'face', 'hand'].filter(k => nets[k]); const k = order[turn++ % order.length]; const map = coverMap(W, H);
      try {
        if (k === 'pose') { const r = nets.pose.detectForVideo(video, now); last.pose = r.landmarks?.length ? r.landmarks.map(l => l.map(map)) : null; last.tp = now; }
        if (k === 'face') { const r = nets.face.detectForVideo(video, now); last.face = r.faceLandmarks?.length ? r.faceLandmarks.map(l => l.map(map)) : null; last.tf = now; }
        if (k === 'hand') { const r = nets.hand.detectForVideo(video, now); last.hand = r.landmarks?.length ? r.landmarks.map(l => l.map(map)) : null; last.th = now; }
      } catch (e) { }
    }
    const inj = ov._inject; let poses = inj?.pose || last.pose, faces = inj?.face || last.face, hands = inj?.hand || last.hand;
    if (demo && !inj) poses = [demoBody(now)];
    let human = false;
    (poses || []).forEach(p => { if (drawSkeleton(p, W, H, faces)) human = true; });
    (faces || []).forEach(f => { drawSkull(skullFromFace(f, W, H)); human = true; });
    (hands || []).forEach(h => { drawHand(h, W, H); human = true; });
    // scan line
    const sy = ((now - t0) / 9 % (H + 200)) - 100; const sg = g.createLinearGradient(0, sy - 60, 0, sy + 6); sg.addColorStop(0, 'rgba(120,200,255,0)'); sg.addColorStop(1, 'rgba(160,230,255,.35)'); g.fillStyle = sg; g.fillRect(0, sy - 60, W, 66);
    // HUD
    if (human) {
      alarm.hidden = false; sv += 37 + Math.random() * 90; bar.style.width = '100%'; bar.classList.add('max');
      dose.textContent = sv > 1e6 ? (sv / 1e6).toFixed(2) + ' MSv – extremely dead' : Math.round(sv).toLocaleString() + ' Sv';
      msg.textContent = poses?.length ? 'PERSON IN BEAM. Full skeleton exposed.' : faces?.length ? 'HEAD IN BEAM. Skull located. Brenda, is that you?' : 'HAND IN BEAM. That is not pipework.';
      if (now - lastBeep > 900) { klaxon(); lastBeep = now; }
    } else {
      alarm.hidden = true; bar.classList.remove('max'); sv = Math.max(0, sv * 0.9);
      const lvl = 0.06 + Math.random() * 0.06; bar.style.width = (lvl * 100).toFixed(0) + '%'; dose.textContent = (lvl * 2.3).toFixed(2) + ' mSv';
      if (!demo && nets) { const wt = (6.5 + Math.sin(now / 700) * 2.4 + Math.random() * 0.6).toFixed(2); msg.textContent = `Scanning pipework… remaining wall ${wt} mm (±${wt} mm) · CUI: undetermined · confidence 3%`; }
    }
    raf = requestAnimationFrame(loop);
  }
  ov.addEventListener('click', e => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    if (b.dataset.x === 'close') { alive = false; cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); try { ac?.close(); } catch { } removeEventListener('resize', size); ov.remove(); document.body.classList.remove('noscroll'); }
    if (b.dataset.x === 'flip' && !demo) { facing = facing === 'user' ? 'environment' : 'user'; startCam(); }
    if (b.dataset.x === 'mute') { muted = !muted; b.textContent = muted ? '🔇' : '🔊'; }
  });
  start();
}
