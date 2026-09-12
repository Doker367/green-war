import re

with open("src/core/AudioManager.js", "r") as f:
    content = f.read()

# Replace _buildMusic and _tick
new_music_code = """
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
"""

# Replace setMood
new_setmood_code = """
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
"""

# RegEx replacements
content = re.sub(r"  _buildMusic\(\) \{.*?(?=  _chirp\(\) \{)", new_music_code, content, flags=re.DOTALL)
content = re.sub(r"  setMood\(mood\) \{.*?(?=  start\(\) \{)", new_setmood_code, content, flags=re.DOTALL)

with open("src/core/AudioManager.js", "w") as f:
    f.write(content)

print("Audio Manager patched.")
