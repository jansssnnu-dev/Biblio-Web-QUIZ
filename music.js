// เสียงทั้งหมดสร้างด้วย Web Audio (ไม่ต้องใช้ไฟล์เสียง)
//   Music = เพลงเปียโนพื้นหลัง   |   Sfx = เสียงเอฟเฟกต์ตอนกดปุ่ม/ลิงก์
// ปุ่มลำโพงมุมซ้ายบนปิด/เปิดทั้งสองอย่างพร้อมกัน

// AudioContext ใช้ร่วมกัน (สร้างตอนผู้เล่นคลิก เพราะเบราว์เซอร์ไม่ให้เล่นเสียงก่อนมีการโต้ตอบ)
let _audioCtx;
function audioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

// ---------- เพลงเปียโนสังเคราะห์ ซ้ำคอร์ด Dm - Bb - Gm - A ให้อารมณ์สบายๆ แต่ลึกลับ ----------
const Music = (() => {
  let ctx, master, timer, i = 0, started = false, muted = false;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const CH = [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]];
  const PAT = [0, 1, 2, 3, 2, 1, 2, 3];
  const SC = [62, 64, 65, 67, 69, 70, 73, 74];   // D harmonic minor
  const ui = () => { const b = document.getElementById('snd'); if (b) b.classList.toggle('off', muted); };

  function note(m, t, dur, vol) {
    [[1, vol], [2, vol * 0.25], [3, vol * 0.08]].forEach(([k, v], j) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = j ? 'sine' : 'triangle'; o.frequency.value = hz(m) * k;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    });
  }
  function tick() {
    const t = ctx.currentTime + 0.05, c = CH[Math.floor(i / 8) % CH.length], k = i % 8;
    if (k === 0) note(c[0] - 12, t, 3.4, 0.16);
    note(c[PAT[k]] + 12, t, 1.8, 0.08);
    if (Math.random() < 0.3) note(SC[Math.floor(Math.random() * SC.length)] + 12, t + 0.2, 2.2, 0.045);
    i++;
  }
  function start() {
    ctx = audioCtx();
    master = ctx.createGain(); master.gain.value = 0;
    const dl = ctx.createDelay(); dl.delayTime.value = 0.52;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    master.connect(ctx.destination); master.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 2);
    timer = setInterval(tick, 520); started = true;
  }
  function toggle() {
    if (!started && !muted) { muted = true; ui(); return; }          // ยังไม่เริ่มเล่น = ผู้ใช้ขอปิดเสียง
    muted = !muted;
    if (!started) start();
    else if (muted) { master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); clearInterval(timer); }
    else { ctx.resume(); master.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 1); timer = setInterval(tick, 520); }
    ui();
  }
  // เบราว์เซอร์ต้องมีการคลิกก่อนถึงจะเล่นเสียงได้ จึงเริ่มเพลงตอนผู้เล่นคลิกครั้งแรก
  document.addEventListener('pointerdown', e => {
    if (!started && !muted && !e.target.closest('#snd')) start();
  });
  return { toggle, isMuted: () => muted };
})();

// ---------- เสียงเอฟเฟกต์ตอนคลิก ----------
// tap  = ปุ่มทั่วไป (เสียงเคาะเบาๆ เหมือนเคาะสันหนังสือ)
// back = ปุ่มย้อนกลับ (เสียงเคาะต่ำกว่า)
// ok   = ปุ่มสำคัญ เช่น "ใช่ เล่มนี้แหละ!" และปุ่มซื้อหนังสือ (เสียงกริ๊งสองโน้ต)
// อยากให้ปุ่มไหนใช้เสียงอะไร ใส่ data-sfx="ok" / "back" / "tap" ที่ปุ่มนั้นใน app.js ได้เลย
const Sfx = (() => {
  let bus;
  const out = c => {
    if (!bus) { bus = c.createGain(); bus.gain.value = 0.9; bus.connect(c.destination); }
    return bus;
  };
  function tone(c, f0, f1, t, dur, vol, type) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 > 0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out(c)); o.start(t); o.stop(t + dur + 0.03);
  }
  // เสียงแกร็กสั้นๆ (นอยส์) ให้ได้ความรู้สึกคลิกจริง
  function clack(c, t, vol, freq) {
    const len = Math.floor(c.sampleRate * 0.03), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / len, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = vol;
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(out(c)); s.start(t);
  }
  const KINDS = {
    tap: (c, t) => { tone(c, 760, 340, t, 0.1, 0.2, 'sine'); clack(c, t, 0.45, 2400); },
    back: (c, t) => { tone(c, 480, 230, t, 0.11, 0.18, 'sine'); clack(c, t, 0.3, 1600); },
    ok: (c, t) => { tone(c, 660, 0, t, 0.28, 0.13, 'triangle'); tone(c, 990, 0, t + 0.075, 0.4, 0.11, 'triangle'); clack(c, t, 0.4, 2400); }
  };
  function play(kind) {
    if (Music.isMuted()) return;                       // กดปิดเสียงแล้ว = เงียบทั้งหมด
    try { const c = audioCtx(); (KINDS[kind] || KINDS.tap)(c, c.currentTime + 0.005); } catch (e) { /* เบราว์เซอร์ไม่รองรับเสียง ข้ามไป */ }
  }
  // ดักคลิกทุกปุ่ม/ลิงก์ในหน้า (ปุ่มที่สร้างใหม่ด้วย innerHTML ก็ทำงานด้วย)
  document.addEventListener('click', e => {
    const el = e.target.closest('button, a');
    if (!el) return;
    play(el.dataset.sfx || (el.classList.contains('back') ? 'back' : 'tap'));
  });
  return { play };
})();
