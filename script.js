/* ========================================================
   RACK4MASTER·AUTO  —  script.js
   All DSP, UI logic and event wiring.
   Relies on i18n.js being loaded first (t() / initI18n()).
   ======================================================== */

// ======== DOM REFS ========
const dropTrack    = document.getElementById('dropTrack');
const fileTrack    = document.getElementById('fileTrack');
const waveCanvas   = document.getElementById('waveTrack');
const specCanvas   = document.getElementById('specTrack');
const waveOut      = document.getElementById('waveOut');
const specOut      = document.getElementById('specOut');
const ledTrack     = document.getElementById('ledTrack');
const ledOut       = document.getElementById('ledOut');
const trackInfo    = document.getElementById('trackInfo');
const sysLed       = document.getElementById('sysLed');
const sysMsg       = document.getElementById('sysMsg');
const autoBtn      = document.getElementById('autoCorrectBtn');
const reportPanel  = document.getElementById('reportPanel');
const outputSection= document.getElementById('outputSection');
const fxRack       = document.getElementById('fxRack');
const exportRow    = document.getElementById('exportRow');
const playTrackBtn = document.getElementById('playTrackBtn');
const stopTrackBtn = document.getElementById('stopTrackBtn');
const loopTrackBtn = document.getElementById('loopTrackBtn');
const playOutBtn   = document.getElementById('playOutBtn');
const stopOutBtn   = document.getElementById('stopOutBtn');
const abBtnA    = document.getElementById('abBtnA');
const abBtnB    = document.getElementById('abBtnB');
const monStatus = document.getElementById('monStatus');
const loopOutBtn   = document.getElementById('loopOutBtn');
const exportBtn    = document.getElementById('exportBtn');
const resetBtn     = document.getElementById('resetAllBtn');
const meydaBadge   = document.getElementById('meydaBadge');

if (window.Meyda) meydaBadge.style.display = 'inline-block';

// ======== STATE ========
let audioCtx         = null;
let originalBuffer   = null;
let currentTrackName = 'RACK4MASTER Preset';
let trackPeaks       = null;
let trackSpec        = null;
let recommendedParams = {
  eq: [0,0,0,0,0,0,0], compThr:-18, compRat:2, compAtk:15, compRel:200, makeUp:2,
  hpfFreq:20, hpfQ:0.7, sat:0, midGain:0, sideGain:0, lim:-0.3, outGain:0
};

// FIX: trackPlayer with looping flag + generation counter to prevent stale onended
let trackPlayer    = { src:null, playing:false, offset:0, startTime:0, looping:false };
let trackGeneration = 0;

let liveNodes = {
  active:false, source:null, hpf:null, eqNodes:[], shaper:null,
  comp:null, mkp:null, midG:null, sideG:null, spl:null, mrg:null,
  lim:null, outG:null, analyser:null, fadeGain:null
};
let livePlaying = false, liveOffset = 0, liveStart = 0, rafId = null;
let liveGeneration = 0;
let loopOut = false;   // loop on output player
let abState = 'B';     // 'A' = dry/original, 'B' = mastered/wet

// Loop regions — normalized [0..1] relative to track duration
let trackLoop = { start: 0, end: 1 };
let outLoop   = { start: 0, end: 1 };

function initCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

// ======== CONSTANTS ========
const ISO30 = [25,31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000,20000];
const EQ_GROUPS = [[0,1,2,3],[4,5,6,7],[8,9,10,11],[14,15,16,17],[18,19,20,21],[22,23,24,25],[26,27,28,29]];
const EQ_FREQS  = [50,100,300,1000,3000,8000,16000];
const EQ_QS     = [0.7,1.0,1.0,1.0,1.0,1.0,0.7];
const TARGET_LUFS         = -14.0;
const TARGET_CREST        = 10.0;
const TARGET_STEREO_WIDTH = 0.38;

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// ======== ANALYSIS ========
function computeFullAnalysis(buf) {
  if (!buf) return null;
  const sr = buf.sampleRate, len = Math.min(buf.length, sr * 30);
  let mono = new Float32Array(len);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    let d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += d[i] / buf.numberOfChannels;
  }
  let rms = 0;
  for (let i = 0; i < mono.length; i++) rms += mono[i] * mono[i];
  rms = 20 * Math.log10(Math.sqrt(rms / mono.length) + 1e-9);
  let peak = 0;
  for (let i = 0; i < mono.length; i++) peak = Math.max(peak, Math.abs(mono[i]));
  let peakdB = 20 * Math.log10(peak + 1e-9);
  let crest = peakdB - rms;
  let stereoW = 0.5;
  if (buf.numberOfChannels >= 2) {
    let L = buf.getChannelData(0), R = buf.getChannelData(1), mp = 0, sp = 0;
    for (let i = 0; i < len; i++) {
      let m = (L[i] + R[i]) * 0.5, s = (L[i] - R[i]) * 0.5;
      mp += m * m; sp += s * s;
    }
    stereoW = Math.sqrt(sp / (mp + 1e-12));
  }
  let iso = new Array(30).fill(-90);
  let flatness = 0.5, centroid = 1000;
  if (window.Meyda) {
    Meyda.sampleRate = sr; Meyda.bufferSize = 2048;
    let frames = 0, isoSum = new Array(30).fill(0), flatSum = 0, centSum = 0;
    for (let i = 0; i + 2048 <= mono.length; i += 1024) {
      let frame = mono.slice(i, i + 2048);
      let feat = Meyda.extract(['powerSpectrum','spectralFlatness','spectralCentroid'], frame);
      if (feat && feat.powerSpectrum) {
        let ps = feat.powerSpectrum, binHz = sr / 2048;
        for (let b = 0; b < 30; b++) {
          let fc = ISO30[b], fLo = fc / Math.pow(2, 1/6), fHi = fc * Math.pow(2, 1/6);
          let idxL = Math.max(0, Math.floor(fLo/binHz)), idxR = Math.min(ps.length-1, Math.ceil(fHi/binHz));
          let sum = 0, cnt = 0;
          for (let k = idxL; k <= idxR; k++) { sum += ps[k]; cnt++; }
          isoSum[b] += (cnt > 0 ? 10 * Math.log10(sum/cnt + 1e-24) : -120);
        }
        if (feat.spectralFlatness !== undefined) flatSum += feat.spectralFlatness;
        if (feat.spectralCentroid !== undefined) centSum += feat.spectralCentroid * binHz;
        frames++;
      }
    }
    if (frames) {
      for (let b = 0; b < 30; b++) iso[b] = isoSum[b] / frames;
      flatness = flatSum / frames;
      centroid = centSum / frames;
    }
  }
  return { rms, peakdB, crest, stereoWidth: stereoW, iso, flatness, centroid, sr };
}

// ======== HEURISTICS ========
function autoCorrectParams(analysis) {
  if (!analysis) return recommendedParams;
  let iso = analysis.iso;

  let bandLevels = EQ_GROUPS.map(function(idxs) {
    let s = 0; idxs.forEach(function(i) { s += iso[i]; }); return s / idxs.length;
  });
  let hasData = bandLevels.some(function(v) { return v > -85; });
  let anchor = bandLevels[3];
  let normLevels = bandLevels.map(function(v) { return v - anchor; });
  let tgt = [4.0, 7.0, 2.5, 0.0, -2.5, -9.5, -22.0];
  let scl = hasData ? 0.30 : 0.10;
  let eqGains = tgt.map(function(t, g) {
    return clamp((t - normLevels[g]) * scl, -9.0, 9.0);
  });
  eqGains[4] = Math.min(eqGains[4],  1.0);
  eqGains[5] = Math.min(eqGains[5],  0.0);
  eqGains[6] = Math.min(eqGains[6],  0.0);

  let crest = analysis.crest;
  let thr    = clamp(-16.0 - crest * 0.32, -28.0, -8.0);
  let ratio  = clamp(1.8 + Math.max(0, crest - 10.0) * 0.12, 1.5, 3.5);
  let attack = clamp(12.0 + crest * 0.6, 8.0, 32.0);
  let release= clamp(200.0 + crest * 7.0, 80.0, 420.0);
  let makeup = clamp(Math.abs(thr) * (ratio - 1.0) / ratio * 0.26, 0.0, 5.0);

  let subEng  = iso.slice(0,4).reduce(function(a,b){ return a+b; },0) / 4;
  let bassEng = iso.slice(4,8).reduce(function(a,b){ return a+b; },0) / 4;
  let hpfFreq = (hasData && subEng > bassEng + 8.0)
    ? clamp(28 + (subEng - bassEng - 8.0) * 2.0, 24, 80) : 20;

  let sat = clamp((0.40 - analysis.flatness) * 50.0, 0.0, 22.0);

  let wDelta   = analysis.stereoWidth - TARGET_STEREO_WIDTH;
  let sideGain = clamp(-wDelta * 9.0, -5.0, 5.0);
  let midGain  = clamp(wDelta * 0.8, -1.5, 1.5);

  let lufsEst  = analysis.rms + 14.0;
  let loudDelta= TARGET_LUFS - lufsEst;
  let outGain  = clamp(loudDelta * 0.60 + makeup * 0.35, -5.0, 8.0);
  let lim = -0.3;

  return {
    eq: eqGains, compThr: thr, compRat: ratio, compAtk: attack, compRel: release,
    makeUp: makeup, hpfFreq: hpfFreq, hpfQ: 0.71, sat: sat,
    midGain: midGain, sideGain: sideGain, lim: lim, outGain: outGain
  };
}

// ======== WAVEFORM & SPECTRUM DRAW ========
function computePeaks(buf, w) {
  let ch = buf.getChannelData(0), len = buf.length;
  let maxv = new Float32Array(w), minv = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let s = Math.floor(x/w*len), e = Math.min(Math.floor((x+1)/w*len), len);
    let hi = -1, lo = 1;
    for (let i = s; i < e; i++) { hi = Math.max(hi, ch[i]); lo = Math.min(lo, ch[i]); }
    maxv[x] = hi; minv[x] = lo;
  }
  return { max: maxv, min: minv };
}
function drawWave(canvas, peaks, pos, bright, dim, loopRgn, loopActive) {
  let w = canvas.offsetWidth || 800, h = canvas.height; canvas.width = w;
  let ctx = canvas.getContext('2d'); ctx.fillStyle = '#060609'; ctx.fillRect(0,0,w,h);
  if (peaks) {
    let mid = h * 0.5, px = Math.round((pos || 0) * w);
    for (let x = 0; x < w; x++) {
      let hi = peaks.max[x] * mid * 0.88, lo = -peaks.min[x] * mid * 0.88;
      ctx.fillStyle = (x <= px) ? bright : dim;
      if (hi > 0.5) ctx.fillRect(x, mid-hi, 1, hi);
      if (lo > 0.5) ctx.fillRect(x, mid,    1, lo);
    }
  }
  // ---- Loop region overlay ----
  if (loopRgn) {
    let ls = Math.round(loopRgn.start * w);
    let le = Math.round(loopRgn.end   * w);
    let col = loopActive ? bright : 'rgba(255,255,255,.22)';
    // Region fill
    ctx.fillStyle = loopActive ? 'rgba(255,220,50,.09)' : 'rgba(255,255,255,.03)';
    ctx.fillRect(ls, 0, le - ls, h);
    // Dashed boundary lines
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.moveTo(ls, 0); ctx.lineTo(ls, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(le, 0); ctx.lineTo(le, h); ctx.stroke();
    ctx.setLineDash([]);
    // Arrow handles at top — start (right-pointing) and end (left-pointing)
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(ls, 0); ctx.lineTo(ls + 10, 5); ctx.lineTo(ls, 10); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(le, 0); ctx.lineTo(le - 10, 5); ctx.lineTo(le, 10); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
function drawSpecFromData(canvas, specData, stroke, fill) {
  if (!specData) return;
  let w = canvas.offsetWidth || 800, h = canvas.height; canvas.width = w;
  let ctx = canvas.getContext('2d'); ctx.fillStyle = '#040508'; ctx.fillRect(0,0,w,h);
  let bin = specData.binHz, mag = specData.mag;
  let path = [];
  for (let px = 0; px < w; px++) {
    let fLo = 20 * Math.pow(20000/20, px/w), fHi = 20 * Math.pow(20000/20, (px+1)/w);
    let bLo = Math.max(1, Math.floor(fLo/bin)), bHi = Math.min(mag.length-1, Math.ceil(fHi/bin));
    let sum = 0, cnt = 0;
    for (let b = bLo; b <= bHi; b++) { sum += mag[b]; cnt++; }
    let db = 20 * Math.log10((cnt ? sum/cnt : 0) + 1e-9);
    let y = ((Math.max(-80, Math.min(0,db)) + 80) / 80) * h;
    path.push(h - y);
  }
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let i = 0; i < path.length; i++) ctx.lineTo(i, path[i]);
  ctx.lineTo(w-1, h); ctx.fillStyle = fill; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, path[0]);
  for (let i = 1; i < path.length; i++) ctx.lineTo(i, path[i]);
  ctx.strokeStyle = stroke; ctx.lineWidth = 1.3; ctx.stroke();
}
function redrawAll() {
  if (originalBuffer && trackPeaks) drawWave(waveCanvas, trackPeaks, 0, '#ffaa00','#2a1800', trackLoop, trackPlayer.looping);
  if (trackSpec) drawSpecFromData(specCanvas, trackSpec, '#ffaa00','rgba(255,170,0,.15)');
}

// ======== LOOP DRAG ========
// Shared drag-to-set-loop-region handler for both waveform canvases.
// Suppresses the click-to-seek event when a drag was performed.
function setupLoopDrag(canvas, loopObj, getBuf, onUpdate) {
  const HIT = 12; // px hit radius for handle grab
  let dragging = null; // 'start' | 'end' | 'region'
  let dragStartX = 0, snapStart = 0, snapEnd = 0;

  canvas.addEventListener('mousedown', function(e) {
    if (!getBuf()) return;
    let w = canvas.offsetWidth;
    let x = e.offsetX;
    let ls = loopObj.start * w, le = loopObj.end * w;
    if      (Math.abs(x - ls) <= HIT)           dragging = 'start';
    else if (Math.abs(x - le) <= HIT)           dragging = 'end';
    else if (x > ls + HIT && x < le - HIT)      dragging = 'region';
    if (dragging) {
      dragStartX = x; snapStart = loopObj.start; snapEnd = loopObj.end;
      canvas._loopDragged = false;
      e.stopPropagation();
    }
  });

  window.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    let rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let w = canvas.offsetWidth;
    let d = (x - dragStartX) / w;
    if (Math.abs(d) > 0.003) canvas._loopDragged = true;
    if (dragging === 'start') {
      loopObj.start = Math.max(0, Math.min(snapStart + d, loopObj.end - 0.02));
    } else if (dragging === 'end') {
      loopObj.end = Math.min(1, Math.max(snapEnd + d, loopObj.start + 0.02));
    } else {
      let span = snapEnd - snapStart;
      let ns = Math.max(0, Math.min(1 - span, snapStart + d));
      loopObj.start = ns; loopObj.end = ns + span;
    }
    onUpdate();
  });

  window.addEventListener('mouseup', function() {
    if (dragging) { dragging = null; onUpdate(); }
  });

  // Cursor feedback
  canvas.addEventListener('mousemove', function(e) {
    if (!getBuf()) return;
    let w = canvas.offsetWidth, x = e.offsetX;
    let ls = loopObj.start * w, le = loopObj.end * w;
    if (Math.abs(x - ls) <= HIT || Math.abs(x - le) <= HIT) {
      canvas.style.cursor = 'ew-resize';
    } else if (x > ls + HIT && x < le - HIT) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'pointer';
    }
  });
}

// ======== LIVE DSP CHAIN ========
function buildLiveChain() {
  if (!audioCtx || !originalBuffer) return;
  if (liveNodes.active) destroyLiveChain();
  let ctx = audioCtx, n = liveNodes, ch = originalBuffer.numberOfChannels;
  n.hpf = ctx.createBiquadFilter(); n.hpf.type = 'highpass';
  n.eqNodes = EQ_FREQS.map(function(f, i) {
    let fn = ctx.createBiquadFilter(); fn.type = 'peaking';
    fn.frequency.value = f; fn.Q.value = EQ_QS[i]; return fn;
  });
  for (let i = 0; i < 6; i++) n.eqNodes[i].connect(n.eqNodes[i+1]);
  n.shaper = ctx.createWaveShaper(); n.shaper.oversample = '2x';
  n.comp = ctx.createDynamicsCompressor(); n.comp.knee.value = 8;
  n.mkp = ctx.createGain();
  if (ch === 2) {
    n.spl = ctx.createChannelSplitter(2); n.mrg = ctx.createChannelMerger(2);
    n.midG = ctx.createGain(); n.sideG = ctx.createGain();
    n.inv = ctx.createGain(); n.inv.gain.value = -1;
    n.lM = ctx.createGain(); n.rM = ctx.createGain();
    n.sI = ctx.createGain(); n.sI.gain.value = -1;
  }
  n.lim = ctx.createDynamicsCompressor(); n.lim.ratio.value = 20; n.lim.attack.value = 0.001; n.lim.knee.value = 0;
  n.outG = ctx.createGain();
  n.analyser = ctx.createAnalyser(); n.analyser.fftSize = 2048; n.analyser.smoothingTimeConstant = 0.8;
  n.fadeGain = ctx.createGain(); n.fadeGain.gain.value = 0;
  n.hpf.connect(n.eqNodes[0]);
  n.eqNodes[6].connect(n.shaper); n.shaper.connect(n.comp); n.comp.connect(n.mkp);
  if (ch === 2) {
    n.mkp.connect(n.spl);
    n.spl.connect(n.midG,  0); n.spl.connect(n.midG,  1);
    n.spl.connect(n.sideG, 0); n.spl.connect(n.inv,   1); n.inv.connect(n.sideG);
    n.midG.connect(n.lM); n.sideG.connect(n.lM);
    n.midG.connect(n.rM); n.sideG.connect(n.sI); n.sI.connect(n.rM);
    n.lM.connect(n.mrg, 0, 0); n.rM.connect(n.mrg, 0, 1); n.mrg.connect(n.lim);
  } else {
    n.mkp.connect(n.lim);
  }
  n.lim.connect(n.outG); n.outG.connect(n.analyser);
  n.analyser.connect(n.fadeGain); n.fadeGain.connect(ctx.destination);
  // Dry bypass path for A/B comparison
  n.dryGain = ctx.createGain(); n.dryGain.gain.value = 0;
  n.dryGain.connect(ctx.destination);
  n.active = true;
  updateLiveParams();
}
function updateLiveParams() {
  if (!liveNodes.active) return;
  let n = liveNodes, p = recommendedParams;
  n.hpf.frequency.value = p.hpfFreq; n.hpf.Q.value = p.hpfQ;
  for (let i = 0; i < 7; i++) if (n.eqNodes[i]) n.eqNodes[i].gain.value = p.eq[i];
  let amt = p.sat/100, k = amt * 80, sz = 512, curve = new Float32Array(sz);
  for (let i = 0; i < sz; i++) {
    let x = (i*2)/sz - 1;
    curve[i] = k < 0.5 ? x : (1 + k/100) * x / (1 + (k/100) * Math.abs(x));
  }
  let maxV = 0; for (let v of curve) maxV = Math.max(maxV, Math.abs(v));
  if (maxV > 0) for (let i = 0; i < sz; i++) curve[i] /= maxV;
  n.shaper.curve = curve;
  n.comp.threshold.value = p.compThr; n.comp.ratio.value = p.compRat;
  n.comp.attack.value = p.compAtk / 1000; n.comp.release.value = p.compRel / 1000;
  n.mkp.gain.value = Math.pow(10, p.makeUp / 20);
  if (originalBuffer && originalBuffer.numberOfChannels === 2 && n.midG && n.sideG) {
    let mLin = Math.pow(10, p.midGain/20), sLin = Math.pow(10, p.sideGain/20);
    n.midG.gain.value = 0.5 * mLin; n.sideG.gain.value = 0.5 * sLin;
  }
  n.lim.threshold.value = p.lim; n.outG.gain.value = Math.pow(10, p.outGain / 20);
}
function destroyLiveChain() {
  let n = liveNodes;
  if (n.source) try { n.source.stop(); } catch(e) {}
  ['hpf','comp','mkp','shaper','spl','mrg','midG','sideG','inv','lM','rM','sI','lim','outG','analyser','fadeGain','dryGain'].forEach(function(k) {
    if (n[k]) { try { n[k].disconnect(); } catch(e) {} n[k] = null; }
  });
  if (n.eqNodes) { n.eqNodes.forEach(function(f) { try { f.disconnect(); } catch(e) {} }); n.eqNodes = []; }
  n.active = false;
}
function startLive(offset) {
  if (!originalBuffer || !liveNodes.active) return;
  initCtx();
  if (livePlaying) stopLive();
  liveGeneration++;
  var myLiveGen = liveGeneration;
  var src = audioCtx.createBufferSource();
  src.buffer = originalBuffer;
  src.loop = loopOut;
  if (loopOut && originalBuffer) {
    src.loopStart = outLoop.start * originalBuffer.duration;
    src.loopEnd   = outLoop.end   * originalBuffer.duration;
  }
  src.connect(liveNodes.hpf);
  src.connect(liveNodes.dryGain);
  let dur = originalBuffer.duration;
  offset = Math.min(offset, dur - 0.02);
  liveNodes.fadeGain.gain.cancelScheduledValues(audioCtx.currentTime);
  liveNodes.dryGain.gain.cancelScheduledValues(audioCtx.currentTime);
  // Restore A/B state
  if (abState === 'A') {
    liveNodes.fadeGain.gain.setValueAtTime(0, audioCtx.currentTime);
    liveNodes.dryGain.gain.setValueAtTime(1, audioCtx.currentTime);
  } else {
    liveNodes.fadeGain.gain.setValueAtTime(1, audioCtx.currentTime);
    liveNodes.dryGain.gain.setValueAtTime(0, audioCtx.currentTime);
  }
  src.start(0, offset);
  liveNodes.source = src; liveStart = audioCtx.currentTime - offset;
  livePlaying = true; liveOffset = offset;
  playOutBtn.textContent = t('btn.pause');
  ledOut.className = 'led playing';
  function update() {
    if (!livePlaying) return;
    let rawProg = (audioCtx.currentTime - liveStart); // seconds: initial offset + elapsed
    let prog;
    if (loopOut) {
      let ls = outLoop.start * dur, le = outLoop.end * dur, span = le - ls;
      let secPos = ls + ((rawProg - ls) % span + span) % span;
      prog = secPos / dur;
    } else {
      prog = Math.min(rawProg / dur, 1);
    }
    if (!loopOut && prog >= 1) {
      stopLive(); liveOffset = 0; seekOut.value = 0; seekOutCurEl.textContent = fmtTime(0);
      drawWave(waveOut, trackPeaks, 0, '#00ffa3','#003320', outLoop, loopOut);
      return;
    }
    drawWave(waveOut, trackPeaks, prog, '#00ffa3','#003320', outLoop, loopOut);
    seekOut.value = Math.round(prog * 10000);
    seekOutCurEl.textContent = fmtTime(prog * dur);
    if (liveNodes.analyser) {
      let w = specOut.offsetWidth || 800, h = specOut.height, fbc = liveNodes.analyser.frequencyBinCount;
      let data = new Float32Array(fbc); liveNodes.analyser.getFloatFrequencyData(data);
      let path = [];
      for (let px = 0; px < w; px++) {
        let fLo = 20 * Math.pow(20000/20, px/w), fHi = 20 * Math.pow(20000/20, (px+1)/w);
        let binHz = audioCtx.sampleRate / 2048;
        let bLo = Math.max(1, Math.floor(fLo/binHz)), bHi = Math.min(fbc-1, Math.ceil(fHi/binHz));
        let sum = 0, cnt = 0;
        for (let b = bLo; b <= bHi; b++) if (data[b] > -140) { sum += data[b]; cnt++; }
        let db = sum / cnt;
        let y = ((Math.max(-80, Math.min(0, db)) + 80) / 80) * h;
        path.push(h - y);
      }
      let sctx = specOut.getContext('2d'); sctx.fillStyle = '#040508'; sctx.fillRect(0,0,w,h);
      sctx.beginPath(); sctx.moveTo(0, h);
      for (let i = 0; i < path.length; i++) sctx.lineTo(i, path[i]);
      sctx.lineTo(w-1, h); sctx.fillStyle = 'rgba(0,255,163,.12)'; sctx.fill();
      sctx.beginPath();
      for (let i = 0; i < path.length; i++) sctx.lineTo(i, path[i]);
      sctx.strokeStyle = '#00ffa3'; sctx.stroke();
    }
    rafId = requestAnimationFrame(update);
  }
  update();
  src.onended = function() { if (liveGeneration !== myLiveGen) return; if (livePlaying) stopLive(); };
}
function stopLive() {
  if (liveNodes.fadeGain && audioCtx) {
    let now = audioCtx.currentTime;
    liveNodes.fadeGain.gain.cancelScheduledValues(now);
    liveNodes.fadeGain.gain.setValueAtTime(liveNodes.fadeGain.gain.value, now);
    liveNodes.fadeGain.gain.linearRampToValueAtTime(0, now + 0.012);
  }
  if (liveNodes.dryGain && audioCtx) {
    let now = audioCtx.currentTime;
    liveNodes.dryGain.gain.cancelScheduledValues(now);
    liveNodes.dryGain.gain.setValueAtTime(liveNodes.dryGain.gain.value, now);
    liveNodes.dryGain.gain.linearRampToValueAtTime(0, now + 0.012);
  }
  if (liveNodes.source) { try { liveNodes.source.stop(); } catch(e) {} liveNodes.source = null; }
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  livePlaying = false;
  playOutBtn.textContent = t('btn.play');
  ledOut.className = 'led loaded';
}

// ======== AUTO CORRECTION ========
async function autoCorrect() {
  if (!originalBuffer) { sysMsg.textContent = t('status.noaudio'); return; }
  sysMsg.textContent = t('status.analyzing'); sysLed.className = 's-led on'; autoBtn.disabled = true;
  setTimeout(function() {
    let analysis = computeFullAnalysis(originalBuffer);
    let params   = autoCorrectParams(analysis);
    recommendedParams = {
      eq: params.eq, compThr: params.compThr, compRat: params.compRat,
      compAtk: params.compAtk, compRel: params.compRel, makeUp: params.makeUp,
      hpfFreq: params.hpfFreq, hpfQ: params.hpfQ, sat: params.sat,
      midGain: params.midGain, sideGain: params.sideGain, lim: params.lim, outGain: params.outGain
    };
    const eqIds = ['eq50','eq100','eq300','eq1k','eq3k','eq8k','eq16k'];
    eqIds.forEach(function(id, i) { let el = document.getElementById(id); if (el) el.value = params.eq[i]; });
    document.getElementById('compThr').value  = params.compThr;
    document.getElementById('compRat').value  = params.compRat;
    document.getElementById('compAtk').value  = params.compAtk;
    document.getElementById('compRel').value  = params.compRel;
    document.getElementById('compMkp').value  = params.makeUp;
    document.getElementById('satAmt').value   = params.sat;
    document.getElementById('hpfFreq').value  = params.hpfFreq;
    document.getElementById('hpfQ').value     = params.hpfQ;
    document.getElementById('midGain').value  = params.midGain;
    document.getElementById('sideGain').value = params.sideGain;
    document.getElementById('limCeil').value  = params.lim;
    document.getElementById('outGain').value  = params.outGain;
    document.querySelectorAll('input[type=range]').forEach(function(s) { s.dispatchEvent(new Event('input')); });
    buildLiveChain();
    let html = '<table class="atbl"><tr class="cat-row"><td colspan="2">' + t('rpt.decisions') + '</td></tr>'
      + '<tr><td>' + t('rpt.eq')     + '</td><td>' + params.eq.map(function(v){ return v.toFixed(1); }).join(' | ') + '</td></tr>'
      + '<tr><td>' + t('rpt.dyn')    + '</td><td>Thr ' + params.compThr.toFixed(1) + 'dB  Ratio ' + params.compRat.toFixed(1) + ':1  Atk ' + params.compAtk.toFixed(1) + 'ms</td></tr>'
      + '<tr><td>' + t('rpt.hpf')    + '</td><td>HPF ' + Math.round(params.hpfFreq) + 'Hz (Q ' + params.hpfQ.toFixed(2) + ') &middot; Sat ' + Math.round(params.sat) + '%</td></tr>'
      + '<tr><td>' + t('rpt.ms')     + '</td><td>Mid ' + params.midGain.toFixed(1) + 'dB &middot; Side ' + params.sideGain.toFixed(1) + 'dB</td></tr>'
      + '<tr><td>' + t('rpt.output') + '</td><td>Limiter ' + params.lim.toFixed(1) + 'dB &middot; Out Gain ' + params.outGain.toFixed(1) + 'dB</td></tr>'
      + '<tr><td>' + t('rpt.metrics')+ '</td><td>Crest ' + analysis.crest.toFixed(1) + 'dB (target 10) &middot; Stereo width ' + (analysis.stereoWidth*100).toFixed(0) + '% &middot; Flatness ' + analysis.flatness.toFixed(3) + '</td></tr>'
      + '</table>';
    document.getElementById('analysisReport').innerHTML = html;
    reportPanel.style.display = ''; outputSection.style.display = ''; fxRack.style.display = ''; exportRow.style.display = '';
    drawWave(waveOut, trackPeaks, 0, '#00ffa3','#003320', outLoop, loopOut);
    if (trackSpec) drawSpecFromData(specOut, trackSpec, '#00ffa3','rgba(0,255,163,.1)');
    seekOut.disabled = false;
    sysMsg.textContent = t('status.ready_ok'); sysLed.className = 's-led ok';
    autoBtn.disabled = false;
  }, 50);
}

// ======== AUDIO LOADING ========
function loadAudio(file) {
  initCtx();
  let reader = new FileReader();
  reader.onload = function(e) {
    audioCtx.decodeAudioData(e.target.result, function(buf) {
      originalBuffer   = buf;
      currentTrackName = file.name.replace(/\.[^/.]+$/, '');
      trackPeaks = computePeaks(buf, waveCanvas.offsetWidth || 800);
      drawWave(waveCanvas, trackPeaks, 0, '#ffaa00','#2a1800', trackLoop, trackPlayer.looping);
      dropTrack.classList.add('loaded');
      trackInfo.textContent = file.name + '  |  ' + buf.duration.toFixed(1) + 's  |  ' + (buf.sampleRate/1000) + 'kHz  |  ' + buf.numberOfChannels + 'ch';
      ledTrack.className = 'led loaded';
      seekTrack.disabled = false; seekTrack.value = 0;
      seekTrackCurEl.textContent = fmtTime(0); seekTrackDurEl.textContent = fmtTime(buf.duration);
      seekOutDurEl.textContent = fmtTime(buf.duration);
      setTimeout(function() {
        let sr = buf.sampleRate, FR = 2048, mag = new Float32Array(FR >> 1);
        let mono = new Float32Array(Math.min(buf.length, sr * 10));
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          let d = buf.getChannelData(ch);
          for (let i = 0; i < mono.length; i++) mono[i] += d[i] / buf.numberOfChannels;
        }
        let w = 0;
        for (let off = 0; off + FR <= mono.length; off += FR) {
          let re = new Float32Array(FR), im = new Float32Array(FR);
          for (let i = 0; i < FR; i++) re[i] = mono[off+i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / FR));
          for (let len = 2; len <= FR; len <<= 1) {
            let halfLen = len >> 1, ang = -2 * Math.PI / len;
            for (let i = 0; i < FR; i += len) {
              for (let j = 0; j < halfLen; j++) {
                let cos = Math.cos(ang*j), sin = Math.sin(ang*j);
                let tr = cos*re[i+j+halfLen] - sin*im[i+j+halfLen];
                let ti = sin*re[i+j+halfLen] + cos*im[i+j+halfLen];
                re[i+j+halfLen] = re[i+j]-tr; im[i+j+halfLen] = im[i+j]-ti;
                re[i+j] += tr; im[i+j] += ti;
              }
            }
          }
          for (let i = 0; i < FR>>1; i++) mag[i] += Math.hypot(re[i], im[i]);
          w++;
        }
        for (let i = 0; i < mag.length; i++) mag[i] /= w;
        trackSpec = { mag: mag, sr: sr, binHz: sr/FR };
        drawSpecFromData(specCanvas, trackSpec, '#ffaa00','rgba(255,170,0,.15)');
      }, 50);
      sysMsg.textContent = t('status.ready'); sysLed.className = 's-led';
    }, function() { sysMsg.textContent = t('status.decode_error'); });
  };
  reader.readAsArrayBuffer(file);
}

// ======== DROP ZONE ========
function setupDrop() {
  fileTrack.style.display = 'none';
  dropTrack.addEventListener('click', function() {
    if (!dropTrack.classList.contains('loaded')) fileTrack.click();
  });
  dropTrack.addEventListener('dragover', function(e) {
    e.preventDefault();
    if (!dropTrack.classList.contains('loaded')) dropTrack.classList.add('drag-over');
  });
  dropTrack.addEventListener('dragleave', function() { dropTrack.classList.remove('drag-over'); });
  dropTrack.addEventListener('drop', function(e) {
    e.preventDefault();
    dropTrack.classList.remove('drag-over');
    if (dropTrack.classList.contains('loaded')) return;
    let f = e.dataTransfer.files[0]; if (f) loadAudio(f);
  });
  fileTrack.addEventListener('change', function() {
    if (fileTrack.files[0]) loadAudio(fileTrack.files[0]);
  });
}
setupDrop();
document.getElementById('loadTrackBtn').addEventListener('click', function() { fileTrack.click(); });

// ======== TRANSPORT - TRACK PLAYER ========
function makeTrackSource(offset) {
  trackGeneration++;
  let myGen = trackGeneration;
  let src = audioCtx.createBufferSource();
  src.buffer = originalBuffer; src.loop = trackPlayer.looping;
  if (trackPlayer.looping) {
    src.loopStart = trackLoop.start * originalBuffer.duration;
    src.loopEnd   = trackLoop.end   * originalBuffer.duration;
  }
  src.connect(audioCtx.destination);
  let off = Math.min(offset || 0, originalBuffer.duration - 0.05);
  src.start(0, off);
  trackPlayer.src = src;
  trackPlayer.startTime = audioCtx.currentTime - off;
  trackPlayer.playing = true;
  playTrackBtn.textContent = t('btn.pause');
  ledTrack.className = 'led playing';
  rafTrack();
  src.onended = function() {
    if (trackGeneration !== myGen) return;
    if (trackPlayer.looping) return;
    trackPlayer.playing = false; trackPlayer.offset = 0;
    if (rafTrackId) { cancelAnimationFrame(rafTrackId); rafTrackId = null; }
    seekTrack.value = 0; seekTrackCurEl.textContent = fmtTime(0);
    playTrackBtn.textContent = t('btn.play');
    ledTrack.className = 'led loaded';
    if (trackPeaks) drawWave(waveCanvas, trackPeaks, 0, '#ffaa00','#2a1800', trackLoop, trackPlayer.looping);
  };
}

playTrackBtn.onclick = function() {
  if (!originalBuffer) { fileTrack.click(); return; }
  initCtx();
  if (trackPlayer.playing) {
    trackGeneration++;
    let rawPos = audioCtx.currentTime - trackPlayer.startTime;
    if (trackPlayer.looping) {
      let dur = originalBuffer.duration;
      trackPlayer.offset = ((rawPos % dur) + dur) % dur;
    } else {
      trackPlayer.offset = Math.min(Math.max(0, rawPos), originalBuffer.duration);
    }
    if (trackPlayer.src) try { trackPlayer.src.stop(); } catch(e) {}
    trackPlayer.src = null; trackPlayer.playing = false;
    if (rafTrackId) { cancelAnimationFrame(rafTrackId); rafTrackId = null; }
    playTrackBtn.textContent = t('btn.play');
    ledTrack.className = 'led loaded';
  } else {
    makeTrackSource(trackPlayer.offset);
  }
};

stopTrackBtn.onclick = function() {
  trackGeneration++;
  if (trackPlayer.src) try { trackPlayer.src.stop(); } catch(e) {}
  trackPlayer.src = null; trackPlayer.playing = false; trackPlayer.offset = 0;
  if (rafTrackId) { cancelAnimationFrame(rafTrackId); rafTrackId = null; }
  seekTrack.value = 0; seekTrackCurEl.textContent = fmtTime(0);
  playTrackBtn.textContent = t('btn.play');
  ledTrack.className = trackPeaks ? 'led loaded' : 'led';
  if (trackPeaks) drawWave(waveCanvas, trackPeaks, 0, '#ffaa00','#2a1800', trackLoop, trackPlayer.looping);
};

loopTrackBtn.onclick = function() {
  trackPlayer.looping = !trackPlayer.looping;
  if (trackPlayer.looping) {
    loopTrackBtn.classList.add('btn-loop-active');
    if (trackPlayer.src) {
      trackPlayer.src.loop = true;
      trackPlayer.src.loopStart = trackLoop.start * originalBuffer.duration;
      trackPlayer.src.loopEnd   = trackLoop.end   * originalBuffer.duration;
    }
  } else {
    loopTrackBtn.classList.remove('btn-loop-active');
    if (trackPlayer.src) trackPlayer.src.loop = false;
  }
  if (trackPeaks) drawWave(waveCanvas, trackPeaks,
    trackPlayer.offset / (originalBuffer ? originalBuffer.duration : 1),
    '#ffaa00','#2a1800', trackLoop, trackPlayer.looping);
};

playOutBtn.onclick = function() {
  if (!liveNodes.active) buildLiveChain();
  if (livePlaying) {
    liveOffset = Math.max(0, audioCtx.currentTime - liveStart);
    stopLive();
  } else {
    startLive(liveOffset);
  }
};
stopOutBtn.onclick = function() {
  stopLive(); liveOffset = 0; seekOut.value = 0; seekOutCurEl.textContent = fmtTime(0);
  if (trackPeaks) drawWave(waveOut, trackPeaks, 0, '#00ffa3','#003320', outLoop, loopOut);
};

// ======== LOOP OUTPUT ========
loopOutBtn.onclick = function() {
  loopOut = !loopOut;
  loopOutBtn.classList.toggle('btn-loop-active', loopOut);
  if (liveNodes.source && originalBuffer) {
    liveNodes.source.loop = loopOut;
    if (loopOut) {
      liveNodes.source.loopStart = outLoop.start * originalBuffer.duration;
      liveNodes.source.loopEnd   = outLoop.end   * originalBuffer.duration;
    }
  }
  if (trackPeaks) drawWave(waveOut, trackPeaks, 0, '#00ffa3','#003320', outLoop, loopOut);
};

// ======== A/B COMPARISON ========
function setAB(state) {
  abState = state;
  if (!liveNodes.active || !audioCtx) return;
  let now = audioCtx.currentTime;
  const RAMP = 0.012; // 12 ms crossfade — inaudible click suppression
  if (state === 'A') {
    liveNodes.fadeGain.gain.cancelScheduledValues(now);
    liveNodes.dryGain.gain.cancelScheduledValues(now);
    liveNodes.fadeGain.gain.setValueAtTime(liveNodes.fadeGain.gain.value, now);
    liveNodes.dryGain.gain.setValueAtTime(liveNodes.dryGain.gain.value, now);
    liveNodes.fadeGain.gain.linearRampToValueAtTime(0, now + RAMP);
    liveNodes.dryGain.gain.linearRampToValueAtTime(1, now + RAMP);
  } else {
    liveNodes.fadeGain.gain.cancelScheduledValues(now);
    liveNodes.dryGain.gain.cancelScheduledValues(now);
    liveNodes.fadeGain.gain.setValueAtTime(liveNodes.fadeGain.gain.value, now);
    liveNodes.dryGain.gain.setValueAtTime(liveNodes.dryGain.gain.value, now);
    liveNodes.fadeGain.gain.linearRampToValueAtTime(1, now + RAMP);
    liveNodes.dryGain.gain.linearRampToValueAtTime(0, now + RAMP);
  }
}

function applyAB(state) {
  abState = state;
  abBtnA.classList.toggle('ab-a-active', state === 'A');
  abBtnB.classList.toggle('ab-b-active', state === 'B');
  monStatus.className = 'mon-status mon-' + state.toLowerCase();
  monStatus.textContent = t(state === 'A' ? 'monitor.a' : 'monitor.b');
  setAB(state);
}

abBtnA.onclick = function() { applyAB('A'); };
abBtnB.onclick = function() { applyAB('B'); };

// ======== SEEK BARS ========
const seekTrack       = document.getElementById('seekTrack');
const seekOut         = document.getElementById('seekOut');
const seekTrackCurEl  = document.getElementById('seekTrackCur');
const seekTrackDurEl  = document.getElementById('seekTrackDur');
const seekOutCurEl    = document.getElementById('seekOutCur');
const seekOutDurEl    = document.getElementById('seekOutDur');

let rafTrackId = null;
function rafTrack() {
  if (rafTrackId) { cancelAnimationFrame(rafTrackId); rafTrackId = null; }
  function loop() {
    if (!trackPlayer.playing) { rafTrackId = null; return; }
    let dur = originalBuffer ? originalBuffer.duration : 1;
    let raw = audioCtx.currentTime - trackPlayer.startTime;
    let pos;
    if (trackPlayer.looping) {
      let ls = trackLoop.start * dur, le = trackLoop.end * dur, span = le - ls;
      pos = ls + ((raw + (trackPlayer.offset - ls)) % span + span) % span;
    } else {
      pos = Math.min(raw, dur);
    }
    seekTrack.value = Math.round((pos/dur) * 10000);
    seekTrackCurEl.textContent = fmtTime(pos);
    drawWave(waveCanvas, trackPeaks, pos/dur, '#ffaa00','#2a1800', trackLoop, trackPlayer.looping);
    rafTrackId = requestAnimationFrame(loop);
  }
  rafTrackId = requestAnimationFrame(loop);
}

seekTrack.addEventListener('input', function() {
  if (!originalBuffer) return;
  let dur = originalBuffer.duration;
  let pos = (this.value / 10000) * dur;
  seekTrackCurEl.textContent = fmtTime(pos);
  drawWave(waveCanvas, trackPeaks, pos/dur, '#ffaa00','#2a1800', trackLoop, trackPlayer.looping);
  trackPlayer.offset = pos;
  if (trackPlayer.playing) {
    if (trackPlayer.src) try { trackPlayer.src.stop(); } catch(e) {}
    if (rafTrackId) { cancelAnimationFrame(rafTrackId); rafTrackId = null; }
    makeTrackSource(pos);
  }
});

waveCanvas.style.cursor = 'pointer';
waveCanvas.addEventListener('click', function(e) {
  if (waveCanvas._loopDragged) { waveCanvas._loopDragged = false; return; }
  if (!originalBuffer) return;
  let pos = (e.offsetX / this.offsetWidth) * originalBuffer.duration;
  seekTrack.value = Math.round((pos / originalBuffer.duration) * 10000);
  seekTrack.dispatchEvent(new Event('input'));
});

seekOut.addEventListener('input', function() {
  if (!originalBuffer) return;
  let dur = originalBuffer.duration;
  let pos = (this.value / 10000) * dur;
  seekOutCurEl.textContent = fmtTime(pos);
  if (trackPeaks) drawWave(waveOut, trackPeaks, pos/dur, '#00ffa3','#003320', outLoop, loopOut);
  liveOffset = pos;
  if (livePlaying) { stopLive(); startLive(liveOffset); }
});

waveOut.style.cursor = 'pointer';
waveOut.addEventListener('click', function(e) {
  if (waveOut._loopDragged) { waveOut._loopDragged = false; return; }
  if (!originalBuffer) return;
  let pos = (e.offsetX / this.offsetWidth) * originalBuffer.duration;
  seekOut.value = Math.round((pos / originalBuffer.duration) * 10000);
  seekOut.dispatchEvent(new Event('input'));
});

// ======== LOOP DRAG SETUP ========
setupLoopDrag(waveCanvas, trackLoop, function() { return originalBuffer; }, function() {
  let pos = originalBuffer && trackPlayer.playing
    ? ((audioCtx.currentTime - trackPlayer.startTime) % originalBuffer.duration) / originalBuffer.duration
    : (originalBuffer ? trackPlayer.offset / originalBuffer.duration : 0);
  if (trackPeaks) drawWave(waveCanvas, trackPeaks, pos, '#ffaa00','#2a1800', trackLoop, trackPlayer.looping);
  if (trackPlayer.src && originalBuffer && trackPlayer.looping) {
    trackPlayer.src.loopStart = trackLoop.start * originalBuffer.duration;
    trackPlayer.src.loopEnd   = trackLoop.end   * originalBuffer.duration;
  }
});

setupLoopDrag(waveOut, outLoop, function() { return originalBuffer; }, function() {
  if (trackPeaks) drawWave(waveOut, trackPeaks, 0, '#00ffa3','#003320', outLoop, loopOut);
  if (liveNodes.source && originalBuffer && loopOut) {
    liveNodes.source.loopStart = outLoop.start * originalBuffer.duration;
    liveNodes.source.loopEnd   = outLoop.end   * originalBuffer.duration;
  }
});

// ======== PRESETS ========
function applyPreset(p) {
  recommendedParams = Object.assign({}, recommendedParams, p);
  if (p.eq) recommendedParams.eq = [...p.eq];
  const eqIds = ['eq50','eq100','eq300','eq1k','eq3k','eq8k','eq16k'];
  eqIds.forEach(function(id, i) {
    let el = document.getElementById(id);
    if (el && recommendedParams.eq[i] !== undefined) el.value = recommendedParams.eq[i];
  });
  const map = {
    compThr:'compThr', compRat:'compRat', compAtk:'compAtk', compRel:'compRel',
    makeUp:'compMkp', sat:'satAmt', hpfFreq:'hpfFreq', hpfQ:'hpfQ',
    midGain:'midGain', sideGain:'sideGain', lim:'limCeil', outGain:'outGain'
  };
  Object.entries(map).forEach(function(kv) {
    let el = document.getElementById(kv[1]);
    if (el && recommendedParams[kv[0]] !== undefined) el.value = recommendedParams[kv[0]];
  });
  document.querySelectorAll('input[type=range]').forEach(function(s) { s.dispatchEvent(new Event('input')); });
  if (liveNodes.active) updateLiveParams();
  sysMsg.textContent = t('status.preset_loaded'); sysLed.className = 's-led ok';
}

document.getElementById('savePresetBtn').onclick = function() {
  let defaultName = currentTrackName || 'RACK4MASTER Preset';
  let presetName = window.prompt(t('prompt.preset'), defaultName);
  if (presetName === null) return;
  if (!presetName.trim()) presetName = defaultName;
  let preset = { name: presetName.trim(), date: new Date().toISOString(), params: Object.assign({}, recommendedParams, { eq: [...recommendedParams.eq] }) };
  let blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
  let url = URL.createObjectURL(blob), a = document.createElement('a');
  let safeFileName = presetName.trim().replace(/[\\/:*?"<>|]/g, '_');
  a.href = url; a.download = safeFileName + '.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  sysMsg.textContent = t('status.preset_saved');
};

const presetFileInput = document.getElementById('presetFileInput');
document.getElementById('loadPresetBtn').onclick = function() { presetFileInput.click(); };
presetFileInput.addEventListener('change', function() {
  let file = presetFileInput.files[0]; if (!file) return;
  let reader = new FileReader();
  reader.onload = function(e) {
    try {
      let data = JSON.parse(e.target.result);
      let p = data.params || data;
      applyPreset(p);
    } catch(err) { sysMsg.textContent = t('status.preset_error'); }
  };
  reader.readAsText(file); presetFileInput.value = '';
});

// ======== EXPORT ========
exportBtn.onclick = async function() {
  if (!originalBuffer) return;
  sysMsg.textContent = t('status.rendering'); exportBtn.disabled = true;
  var preRollSec = 0.5;
  var sr = originalBuffer.sampleRate;
  var preRollSamples = Math.ceil(preRollSec * sr);
  var totalSamples   = originalBuffer.length + preRollSamples;
  let oc  = new OfflineAudioContext(originalBuffer.numberOfChannels, totalSamples, sr);
  let src = oc.createBufferSource(); src.buffer = originalBuffer;
  let hpf = oc.createBiquadFilter(); hpf.type = 'highpass';
  hpf.frequency.value = recommendedParams.hpfFreq; hpf.Q.value = recommendedParams.hpfQ;
  let eqs = EQ_FREQS.map(function(f, i) {
    let n = oc.createBiquadFilter(); n.type = 'peaking';
    n.frequency.value = f; n.Q.value = EQ_QS[i]; n.gain.value = recommendedParams.eq[i]; return n;
  });
  for (let i = 0; i < 6; i++) eqs[i].connect(eqs[i+1]);
  let shaper = oc.createWaveShaper();
  let amt = recommendedParams.sat/100, k = amt * 80, sz = 512, curve = new Float32Array(sz);
  for (let i = 0; i < sz; i++) {
    let x = (i*2)/sz - 1;
    curve[i] = k < 0.5 ? x : (1 + k/100)*x / (1 + (k/100)*Math.abs(x));
  }
  let maxV = 0; for (let v of curve) maxV = Math.max(maxV, Math.abs(v));
  if (maxV > 0) for (let i = 0; i < sz; i++) curve[i] /= maxV;
  shaper.curve = curve;
  let comp = oc.createDynamicsCompressor();
  comp.threshold.value = recommendedParams.compThr; comp.ratio.value = recommendedParams.compRat;
  comp.attack.value = recommendedParams.compAtk/1000; comp.release.value = recommendedParams.compRel/1000;
  let mkp = oc.createGain(); mkp.gain.value = Math.pow(10, recommendedParams.makeUp/20);
  let lim = oc.createDynamicsCompressor(); lim.threshold.value = recommendedParams.lim;
  lim.ratio.value = 20; lim.attack.value = 0.001;
  let outG = oc.createGain(); outG.gain.value = Math.pow(10, recommendedParams.outGain/20);
  hpf.connect(eqs[0]); eqs[6].connect(shaper); shaper.connect(comp); comp.connect(mkp);
  if (originalBuffer.numberOfChannels === 2) {
    let spl = oc.createChannelSplitter(2), mrg = oc.createChannelMerger(2);
    let midG = oc.createGain(), sideG = oc.createGain();
    let inv = oc.createGain(); inv.gain.value = -1;
    let lM = oc.createGain(), rM = oc.createGain();
    let sI = oc.createGain(); sI.gain.value = -1;
    let mLin = Math.pow(10, recommendedParams.midGain/20);
    let sLin = Math.pow(10, recommendedParams.sideGain/20);
    midG.gain.value = 0.5*mLin; sideG.gain.value = 0.5*sLin;
    mkp.connect(spl);
    spl.connect(midG,0); spl.connect(midG,1);
    spl.connect(sideG,0); spl.connect(inv,1); inv.connect(sideG);
    midG.connect(lM); sideG.connect(lM);
    midG.connect(rM); sideG.connect(sI); sI.connect(rM);
    lM.connect(mrg,0,0); rM.connect(mrg,0,1); mrg.connect(lim);
  } else {
    mkp.connect(lim);
  }
  lim.connect(outG); outG.connect(oc.destination);
  src.connect(hpf); src.start(preRollSec);
  let rendered = await oc.startRendering();
  var numChR = rendered.numberOfChannels, trimLen = rendered.length - preRollSamples;
  var trimmed = audioCtx.createBuffer(numChR, trimLen, sr);
  for (var ch = 0; ch < numChR; ch++) {
    trimmed.getChannelData(ch).set(rendered.getChannelData(ch).subarray(preRollSamples));
  }
  let blob = (function(wav) {
    let numCh = wav.numberOfChannels, sr = wav.sampleRate, len = wav.length, bytes = len*numCh*2;
    let buffer = new ArrayBuffer(44+bytes), view = new DataView(buffer);
    let ws = function(o,s){ [...s].forEach(function(c,i){ view.setUint8(o+i, c.charCodeAt(0)); }); };
    ws(0,'RIFF'); view.setUint32(4,36+bytes,true); ws(8,'WAVE'); ws(12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,numCh,true);
    view.setUint32(24,sr,true); view.setUint32(28,sr*numCh*2,true);
    view.setUint16(32,numCh*2,true); view.setUint16(34,16,true); ws(36,'data');
    view.setUint32(40,bytes,true);
    let off = 44;
    for (let i = 0; i < len; i++) for (let ch = 0; ch < numCh; ch++) {
      let s = Math.max(-1, Math.min(1, wav.getChannelData(ch)[i]));
      view.setInt16(off, s < 0 ? s*0x8000 : s*0x7FFF, true); off += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  })(trimmed);
  let url = URL.createObjectURL(blob);
  let defaultName = (currentTrackName || 'rack4master') + '_autoprocessed';
  let chosenName = window.prompt(t('prompt.export'), defaultName);
  if (chosenName === null) { URL.revokeObjectURL(url); exportBtn.disabled = false; sysMsg.textContent = t('status.export_cancel'); return; }
  if (!chosenName.trim()) chosenName = defaultName;
  chosenName = chosenName.trim().replace(/\.wav$/i, '');
  let a = document.createElement('a'); a.href = url; a.download = chosenName + '.wav';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  sysMsg.textContent = t('status.export_ok'); exportBtn.disabled = false;
};

// ======== SLIDER EVENT BINDING ========
const allSliders = document.querySelectorAll('input[type=range]');
allSliders.forEach(function(slider) {
  slider.addEventListener('input', function() {
    let id = this.id;
    if (id.startsWith('eq')) {
      let idx = ['eq50','eq100','eq300','eq1k','eq3k','eq8k','eq16k'].indexOf(id);
      if (idx >= 0) recommendedParams.eq[idx] = parseFloat(this.value);
    } else if (id === 'compThr')  recommendedParams.compThr  = parseFloat(this.value);
    else if (id === 'compRat')    recommendedParams.compRat  = parseFloat(this.value);
    else if (id === 'compAtk')    recommendedParams.compAtk  = parseFloat(this.value);
    else if (id === 'compRel')    recommendedParams.compRel  = parseFloat(this.value);
    else if (id === 'compMkp')    recommendedParams.makeUp   = parseFloat(this.value);
    else if (id === 'satAmt')     recommendedParams.sat      = parseFloat(this.value);
    else if (id === 'hpfFreq')    recommendedParams.hpfFreq  = parseFloat(this.value);
    else if (id === 'hpfQ')       recommendedParams.hpfQ     = parseFloat(this.value);
    else if (id === 'midGain')    recommendedParams.midGain  = parseFloat(this.value);
    else if (id === 'sideGain')   recommendedParams.sideGain = parseFloat(this.value);
    else if (id === 'limCeil')    recommendedParams.lim      = parseFloat(this.value);
    else if (id === 'outGain')    recommendedParams.outGain  = parseFloat(this.value);
    let span = document.getElementById(id+'v') || document.getElementById(id+'V');
    if (span) {
      let val = parseFloat(this.value);
      if (id.includes('eq'))                        span.textContent = (val>=0?'+':'') + val.toFixed(1) + ' dB';
      else if (id === 'compThr')                    span.textContent = val.toFixed(1) + ' dB';
      else if (id === 'compRat')                    span.textContent = val.toFixed(1) + ':1';
      else if (id === 'compAtk')                    span.textContent = val.toFixed(1) + ' ms';
      else if (id === 'compRel')                    span.textContent = Math.round(val) + ' ms';
      else if (id === 'compMkp')                    span.textContent = (val>=0?'+':'') + val.toFixed(1) + ' dB';
      else if (id === 'satAmt')                     span.textContent = Math.round(val) + '%';
      else if (id === 'hpfFreq')                    span.textContent = Math.round(val) + ' Hz';
      else if (id === 'hpfQ')                       span.textContent = val.toFixed(1) + ' Q';
      else if (id==='midGain'||id==='sideGain'||id==='outGain') span.textContent = (val>=0?'+':'') + val.toFixed(1) + ' dB';
      else if (id === 'limCeil')                    span.textContent = val.toFixed(1) + ' dB';
    }
    if (liveNodes.active) updateLiveParams();
  });
});
allSliders.forEach(function(s) { s.dispatchEvent(new Event('input')); });

autoBtn.onclick = autoCorrect;

// ======== RESET MODAL ========
const resetModal = document.getElementById('resetModal');
resetBtn.onclick = function() { resetModal.classList.remove('hidden'); };
document.getElementById('resetConfirm').onclick = function() { location.reload(); };
document.getElementById('resetCancel').onclick  = function() { resetModal.classList.add('hidden'); };
resetModal.onclick = function(e) { if (e.target === resetModal) resetModal.classList.add('hidden'); };

// ======== HELPERS ========
function fmtTime(s) {
  s = Math.max(0, s || 0);
  let m = Math.floor(s / 60);
  return m + ':' + (Math.floor(s % 60) + '').padStart(2, '0');
}

// ======== INIT i18n (must be last) ========
initI18n();
