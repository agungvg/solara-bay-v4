// WebAudio sound for Solara Bay: everything is synthesized live — engine
// hum, two-tone sirens, gunshots, pickup blips and a lo-fi radio loop.
// No audio files are loaded, so the game stays fully offline.

import { RADIO_STATIONS } from './data.js';

export function createSoundEngine() {
  const engine = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOn: false, sirenTimer: 0, sirenHigh: false,
    radioStation: 0, radioStep: 0, radioTimer: 0, radioOn: true,
    started: false,
  };

  engine.ensure = function ensureAudioContext() {
    if (engine.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      engine.ctx = new Ctx();
      engine.master = engine.ctx.createGain();
      engine.master.gain.value = 0.35;
      engine.master.connect(engine.ctx.destination);
      engine.engineOsc = engine.ctx.createOscillator();
      engine.engineOsc.type = 'sawtooth';
      engine.engineOsc.frequency.value = 55;
      engine.engineGain = engine.ctx.createGain();
      engine.engineGain.gain.value = 0.0;
      const filter = engine.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engine.engineOsc.connect(filter);
      filter.connect(engine.engineGain);
      engine.engineGain.connect(engine.master);
      engine.engineOsc.start();
      engine.started = true;
      return true;
    } catch (err) {
      return false;
    }
  };

  engine.resume = function resumeAudio() {
    if (engine.ensure() && engine.ctx.state === 'suspended') engine.ctx.resume();
  };

  engine.setEngine = function setEngineRpm(speedKmh, driving) {
    if (!engine.ctx || !engine.engineGain) return;
    const rpm = driving ? 50 + Math.abs(speedKmh) * 1.6 : 42;
    engine.engineOsc.frequency.setTargetAtTime(rpm, engine.ctx.currentTime, 0.08);
    engine.engineGain.gain.setTargetAtTime(driving ? 0.05 : 0.0, engine.ctx.currentTime, 0.1);
  };

  engine.blip = function playBlip(freq, dur) {
    if (!engine.ctx) return;
    try {
      const osc = engine.ctx.createOscillator();
      const gain = engine.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq || 880;
      gain.gain.setValueAtTime(0.18, engine.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, engine.ctx.currentTime + (dur || 0.12));
      osc.connect(gain);
      gain.connect(engine.master);
      osc.start();
      osc.stop(engine.ctx.currentTime + (dur || 0.12));
    } catch (err) { /* audio is best-effort */ }
  };

  engine.gunshot = function playGunshot() {
    if (!engine.ctx) return;
    try {
      const len = engine.ctx.sampleRate * 0.12;
      const buffer = engine.ctx.createBuffer(1, len, engine.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = engine.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = engine.ctx.createGain();
      gain.gain.value = 0.4;
      src.connect(gain);
      gain.connect(engine.master);
      src.start();
    } catch (err) { /* best-effort */ }
  };

  engine.crash = function playCrash() {
    if (!engine.ctx) return;
    try {
      const osc = engine.ctx.createOscillator();
      const gain = engine.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(140, engine.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, engine.ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.3, engine.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, engine.ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(engine.master);
      osc.start();
      osc.stop(engine.ctx.currentTime + 0.3);
    } catch (err) { /* best-effort */ }
  };

  // Radio: a tiny sequencer, one bass note + one lead note per eighth step.
  const SCALES = [
    [0, 3, 5, 7, 10, 12], // island pop
    [0, 2, 4, 7, 9, 12], // sunset rock
    [0, 3, 5, 8, 10, 12], // night drive
  ];
  engine.tickRadio = function tickRadioMusic(dt, wanted) {
    if (!engine.ctx || !engine.radioOn) return;
    engine.radioTimer -= dt;
    if (engine.radioTimer > 0) return;
    engine.radioTimer = 0.22;
    const scale = SCALES[engine.radioStation % SCALES.length];
    const step = engine.radioStep++;
    const base = 110;
    const bassNote = scale[step % scale.length];
    const leadNote = scale[(step * 3 + 2) % scale.length] + 12;
    engine.note(base * Math.pow(2, bassNote / 12), 0.2, 'triangle', 0.10);
    if (step % 2 === 0) engine.note(base * Math.pow(2, leadNote / 12), 0.16, 'sine', 0.07);
    if (wanted >= 3 && step % 8 === 4) engine.note(220, 0.1, 'square', 0.05);
  };

  engine.note = function playNote(freq, dur, type, vol) {
    if (!engine.ctx) return;
    try {
      const osc = engine.ctx.createOscillator();
      const gain = engine.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, engine.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, engine.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(engine.master);
      osc.start();
      osc.stop(engine.ctx.currentTime + dur);
    } catch (err) { /* best-effort */ }
  };

  engine.tickSiren = function tickSirenSound(dt, wanted) {
    if (!engine.ctx) return;
    engine.sirenTimer -= dt;
    if (wanted < 1) { engine.sirenOn = false; return; }
    if (engine.sirenTimer <= 0) {
      engine.sirenTimer = 0.42;
      engine.sirenHigh = !engine.sirenHigh;
      engine.note(engine.sirenHigh ? 720 : 540, 0.4, 'sine', 0.045);
    }
  };

  engine.cycleStation = function cycleRadioStation() {
    engine.radioStation = (engine.radioStation + 1) % RADIO_STATIONS.length;
    engine.blip(660, 0.1);
    return RADIO_STATIONS[engine.radioStation];
  };

  engine.currentStation = function currentRadioStation() {
    return RADIO_STATIONS[engine.radioStation % RADIO_STATIONS.length];
  };

  return engine;
}
