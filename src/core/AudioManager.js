// =====================================================================
// GREEN CODE — AudioManager
// Audio 100% procedural con Web Audio API (sin assets con licencia).
// Capas: viento, fuego, agua, aves, música y SFX.
// =====================================================================

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = null;
    this.volume = 0.7;
    this.mood = 'calm';
    this.layers = {};
    this._musicOsc = [];
    this._timer = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this._buildAmbient();
    this._buildMusic();
    this.ready = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  _noiseBuffer(seconds = 2) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  _noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(2);
    src.loop = true;
    return src;
  }

  _buildAmbient() {
    const c = this.ctx;

    // --- Viento ---
    const windSrc = this._noiseSource();
    const windFilter = c.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    const windGain = c.createGain();
    windGain.gain.value = 0.06;
    windSrc.connect(windFilter).connect(windGain).connect(this.master);
    windSrc.start();
    const windLfo = c.createOscillator();
    const windLfoGain = c.createGain();
    windLfo.frequency.value = 0.07;
    windLfoGain.gain.value = 0.035;
    windLfo.connect(windLfoGain).connect(windGain.gain);
    windLfo.start();
    this.layers.wind = windGain;

    // --- Fuego ---
    const fireSrc = this._noiseSource();
    const fireFilter = c.createBiquadFilter();
    fireFilter.type = 'bandpass';
    fireFilter.frequency.value = 900;
    fireFilter.Q.value = 0.7;
    const fireGain = c.createGain();
    fireGain.gain.value = 0;
    fireSrc.connect(fireFilter).connect(fireGain).connect(this.master);
    fireSrc.start();
    this.layers.fire = fireGain;

    // --- Agua ---
    const waterSrc = this._noiseSource();
    const waterFilter = c.createBiquadFilter();
    waterFilter.type = 'highpass';
    waterFilter.frequency.value = 1400;
    const waterGain = c.createGain();
    waterGain.gain.value = 0;
    waterSrc.connect(waterFilter).connect(waterGain).connect(this.master);
    waterSrc.start();
    this.layers.water = waterGain;

    // --- Aves (chirps programados) ---
    this.layers.birds = c.createGain();
    this.layers.birds.gain.value = 0;
    this.layers.birds.connect(this.master);
  }

  _buildMusic() {
    const c = this.ctx;
    const bus = c.createGain();
    bus.gain.value = 0.0;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    bus.connect(filter).connect(this.master);
    this.layers.music = bus;
    this.layers.musicFilter = filter;

    const chords = {
      calm: [110, 164.81, 220, 277.18],
      fire: [98, 146.83, 196, 246.94],
      restored: [130.81, 196, 261.63, 329.63]
    };
    for (let i = 0; i < 4; i++) {
      const osc = c.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = chords.calm[i];
      const g = c.createGain();
      g.gain.value = 0.14;
      osc.connect(g).connect(bus);
      const lfo = c.createOscillator();
      const lfoG = c.createGain();
      lfo.frequency.value = 0.05 + i * 0.017;
      lfoG.gain.value = 0.05;
      lfo.connect(lfoG).connect(g.gain);
      lfo.start();
      osc.start();
      this._musicOsc.push({ osc, chords });
    }

    // Secuenciador de arpegios suaves
    this._timer = setInterval(() => this._tick(), 420);
  }

  _tick() {
    if (!this.ready || this.muted) return;
    if (this.layers.birds && this.layers.birds.gain.value > 0.02 && Math.random() < 0.5) {
      this._chirp();
    }
    if (this.mood === 'restored' && Math.random() < 0.35) {
      this.note(784 + Math.random() * 400, 0.25, 0.04, 'sine');
    }
  }

  _chirp() {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    const base = 1600 + Math.random() * 1400;
    const now = c.currentTime;
    o.frequency.setValueAtTime(base, now);
    o.frequency.exponentialRampToValueAtTime(base * 1.6, now + 0.06);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, now + 0.16);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + 0.2);
  }

  note(freq, dur = 0.3, vol = 0.08, type = 'sine') {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(this.master);
    o.start(now); o.stop(now + dur + 0.05);
  }

  sfx(name) {
    if (!this.ready) return;
    switch (name) {
      case 'interact':
        this.note(660, 0.12, 0.09, 'square');
        this.note(990, 0.14, 0.05, 'sine');
        break;
      case 'confirm':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          setTimeout(() => this.note(f, 0.35, 0.09, 'triangle'), i * 90));
        break;
      case 'error':
        this.note(160, 0.3, 0.1, 'sawtooth');
        break;
      case 'plant':
        this.note(330, 0.2, 0.08, 'sine');
        this.note(440, 0.25, 0.06, 'triangle');
        break;
      case 'water':
        this.note(520, 0.5, 0.07, 'sine');
        this.note(780, 0.6, 0.05, 'sine');
        break;
      case 'scan':
        this.note(1200, 0.06, 0.04, 'square');
        break;
      case 'type':
        this.note(1500 + Math.random() * 300, 0.03, 0.02, 'square');
        break;
    }
  }

  setFireLevel(level01) {
    if (!this.ready) return;
    const g = 0.14 * Math.min(1, level01);
    this.layers.fire.gain.setTargetAtTime(g, this.ctx.currentTime, 0.4);
  }

  setWaterLevel(level01) {
    if (!this.ready) return;
    this.layers.water.gain.setTargetAtTime(0.07 * level01, this.ctx.currentTime, 0.6);
  }

  setBiodiversity(level01) {
    if (!this.ready) return;
    this.layers.birds.gain.setTargetAtTime(0.9 * level01, this.ctx.currentTime, 0.8);
  }

  setMood(mood) {
    if (!this.ready || this.mood === mood) return;
    this.mood = mood;
    const chords = {
      calm: [110, 164.81, 220, 277.18],
      fire: [98, 146.83, 196, 246.94],
      restored: [130.81, 196, 261.63, 329.63]
    }[mood] || [110, 164.81, 220, 277.18];
    const now = this.ctx.currentTime;
    this._musicOsc.forEach((m, i) => {
      m.osc.frequency.setTargetAtTime(chords[i], now, 1.5);
    });
    const target = mood === 'fire' ? 0.16 : mood === 'restored' ? 0.2 : 0.12;
    this.layers.music.gain.setTargetAtTime(target, now, 1.5);
    if (this.layers.musicFilter) {
      this.layers.musicFilter.frequency.setTargetAtTime(mood === 'restored' ? 1600 : mood === 'fire' ? 500 : 900, now, 1.5);
    }
  }

  start() {
    this.init();
    this.resume();
    this.setMood('calm');
  }

  dispose() {
    if (this._timer) clearInterval(this._timer);
    if (this.ctx) this.ctx.close();
  }
}
