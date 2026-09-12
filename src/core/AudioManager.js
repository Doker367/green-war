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
    this._cinematicAudio = null;
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

  playCinematicTheme() {
    if (this._cinematicAudio) {
      this.stopCinematicTheme(0);
    }
    try {
      const base = import.meta.env.BASE_URL || '/';
      const cleanBase = base.endsWith('/') ? base : base + '/';
      this._cinematicAudio = new Audio(`${cleanBase}audio/the_last_of_us.mp3`);
      this._cinematicAudio.volume = Math.max(0, Math.min(1, this.volume));
      this._cinematicAudio.currentTime = 0;
      const p = this._cinematicAudio.play();
      if (p !== undefined) {
        p.catch(err => console.warn('Audio cinemática bloqueado hasta interacción:', err));
      }
    } catch (e) {
      console.warn('Error al iniciar audio de cinemática:', e);
    }
  }

  stopCinematicTheme(fadeDuration = 800) {
    if (!this._cinematicAudio) return;
    const audio = this._cinematicAudio;
    this._cinematicAudio = null;

    if (fadeDuration <= 0) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    const startVol = audio.volume;
    const startTime = performance.now();

    const fadeStep = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / fadeDuration);
      audio.volume = Math.max(0, startVol * (1 - progress));
      if (progress < 1) {
        requestAnimationFrame(fadeStep);
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    };
    requestAnimationFrame(fadeStep);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
    if (this._cinematicAudio) {
      this._cinematicAudio.volume = Math.max(0, Math.min(1, v));
    }
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
    
    const firePanner = c.createPanner();
    firePanner.panningModel = 'HRTF';
    firePanner.distanceModel = 'inverse';
    firePanner.refDistance = 1;
    firePanner.maxDistance = 10000;
    firePanner.rolloffFactor = 1;

    const fireGain = c.createGain();
    fireGain.gain.value = 0;
    fireSrc.connect(fireFilter).connect(firePanner).connect(fireGain).connect(this.master);
    fireSrc.start();
    this.layers.fire = fireGain;
    this.layers.firePanner = firePanner;

    // --- Agua ---
    const waterSrc = this._noiseSource();
    const waterFilter = c.createBiquadFilter();
    waterFilter.type = 'highpass';
    waterFilter.frequency.value = 1400;
    
    const waterPanner = c.createPanner();
    waterPanner.panningModel = 'HRTF';
    waterPanner.distanceModel = 'inverse';
    waterPanner.refDistance = 1;
    waterPanner.maxDistance = 10000;
    waterPanner.rolloffFactor = 1;

    const waterGain = c.createGain();
    waterGain.gain.value = 0;
    waterSrc.connect(waterFilter).connect(waterPanner).connect(waterGain).connect(this.master);
    waterSrc.start();
    this.layers.water = waterGain;
    this.layers.waterPanner = waterPanner;

    // --- Aves (chirps programados) ---
    this.layers.birds = c.createGain();
    this.layers.birds.gain.value = 0;
    this.layers.birds.connect(this.master);
  }


  _buildMusic() {
    const c = this.ctx;
    const bus = c.createGain();
    bus.gain.value = 0.0;
    
    // Filtro suave para los pads
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    // Delay/Eco para la musica
    const delay = c.createDelay();
    delay.delayTime.value = 0.75;
    const delayFeedback = c.createGain();
    delayFeedback.gain.value = 0.4;
    delay.connect(delayFeedback).connect(delay);
    
    bus.connect(filter).connect(this.master);
    filter.connect(delay).connect(this.master);
    
    this.layers.music = bus;
    this.layers.musicFilter = filter;

    this.scales = {
      calm: [220, 246.94, 277.18, 329.63, 369.99, 440], // A Major Pentatonic
      fire: [196, 220, 233.08, 261.63, 293.66, 392],    // G Minor
      restored: [261.63, 293.66, 329.63, 392, 440, 523.25] // C Major Pentatonic
    };
    
    this.baseChords = {
      calm: [110, 164.81, 220],
      fire: [98, 146.83, 196],
      restored: [130.81, 196, 261.63]
    };
    
    for (let i = 0; i < 3; i++) {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = this.baseChords.calm[i];
      const g = c.createGain();
      g.gain.value = 0.12;
      
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.05 + (i * 0.02);
      const lfoG = c.createGain();
      lfoG.gain.value = 0.06;
      lfo.connect(lfoG).connect(g.gain);
      lfo.start();
      
      osc.connect(g).connect(bus);
      osc.start();
      this._musicOsc.push(osc);
    }

    this._step = 0;
    this._timer = setInterval(() => this._tick(), 600);
  }

  _tick() {
    if (!this.ready || this.muted) return;
    this._step++;
    
    if (this.layers.birds && this.layers.birds.gain.value > 0.02 && Math.random() < 0.3) {
      this._chirp();
    }
    
    const scale = this.scales[this.mood] || this.scales.calm;
    
    if (Math.random() < 0.6) {
      const noteIdx = Math.floor(Math.random() * scale.length);
      let freq = scale[noteIdx];
      if (Math.random() < 0.3) freq *= 2;
      
      const dur = 1.5 + Math.random() * 2.0;
      const vol = 0.03 + Math.random() * 0.04;
      const type = Math.random() > 0.5 ? 'sine' : 'triangle';
      
      this._playMelodyNote(freq, dur, vol, type);
    }
    
    if (this._step % 8 === 0 && Math.random() < 0.7) {
      this._playMelodyNote(scale[0] / 2, 4.0, 0.07, 'sine');
    }
  }

  _playMelodyNote(freq, dur, vol, type) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    
    const now = c.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + (dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    
    o.connect(g).connect(this.layers.music);
    o.start(now);
    o.stop(now + dur + 0.1);
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

  playFootstep(surfaceType = 'dirt') {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const now = c.currentTime;
    
    const bufSize = c.sampleRate * 0.1; // 100ms de ruido
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const src = c.createBufferSource();
    src.buffer = buf;
    
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    
    if (surfaceType === 'grass') {
      filter.frequency.value = 800;
      filter.Q.value = 1.0;
    } else if (surfaceType === 'stone' || surfaceType === 'rock') {
      filter.frequency.value = 300;
      filter.Q.value = 2.0;
    } else { // dirt/default
      filter.frequency.value = 500;
      filter.Q.value = 1.5;
    }
    
    const env = c.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.15, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    src.connect(filter).connect(env).connect(this.master);
    src.start(now);
    src.stop(now + 0.15);
  }

  sfx(name) {
    if (!this.ready) return;
    switch (name) {
      case 'footstep':
        this.playFootstep();
        break;
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
    const chords = this.baseChords[mood] || this.baseChords.calm;
    const now = this.ctx.currentTime;
    
    this._musicOsc.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(chords[i], now, 1.5);
    });
    
    const target = mood === 'fire' ? 0.20 : mood === 'restored' ? 0.25 : 0.18;
    this.layers.music.gain.setTargetAtTime(target, now, 2.0);
    
    if (this.layers.musicFilter) {
      this.layers.musicFilter.frequency.setTargetAtTime(
        mood === 'restored' ? 1200 : mood === 'fire' ? 400 : 800, 
        now, 2.0
      );
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
