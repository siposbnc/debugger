// WebAudio-synthesized SFX + a procedural synthwave music loop. No assets.

type SfxName =
  | 'shoot' | 'hit' | 'kill' | 'levelup' | 'pickup' | 'hurt' | 'chest'
  | 'bossWarn' | 'bossDie' | 'evolve' | 'click' | 'buy' | 'victory' | 'death' | 'objective'
  | 'fizz' | 'resolve';

class Sound {
  private ctx: AudioContext | null = null;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  masterVolume = 1;
  sfxVolume = 0.7;
  musicVolume = 0.5;
  private musicTimer: number | null = null;
  private musicStep = 0;
  intensity = 0; // 0..1, raises music energy as the run progresses
  private lastPlayed = new Map<string, number>();
  /** Minimum seconds between repeats of spammy SFX. */
  private static THROTTLE: Partial<Record<SfxName, number>> = {
    shoot: 0.07, kill: 0.06, pickup: 0.05, hit: 0.05, hurt: 0.15,
  };

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.ctx.destination);
        this.musicGain.connect(this.ctx.destination);
        this.applyVolumes();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.sfxGain.gain.value = this.masterVolume * this.sfxVolume * 0.5;
    this.musicGain.gain.value = this.masterVolume * this.musicVolume * 0.22;
  }

  /** Resume/create on first user gesture (browser autoplay policy). */
  unlock(): void {
    this.ensure();
  }

  private tone(
    freq: number, dur: number, type: OscillatorType, vol: number,
    slideTo?: number, delay = 0,
  ): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq = 2000): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }

  play(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const throttle = Sound.THROTTLE[name];
    if (throttle) {
      const last = this.lastPlayed.get(name) ?? -1;
      if (ctx.currentTime - last < throttle) return;
      this.lastPlayed.set(name, ctx.currentTime);
    }
    switch (name) {
      case 'shoot':
        this.tone(720, 0.07, 'square', 0.12, 380);
        break;
      case 'hit': this.tone(240, 0.05, 'sawtooth', 0.1, 140); break;
      case 'kill': this.tone(520, 0.09, 'triangle', 0.18, 160); this.noise(0.06, 0.1, 3500); break;
      case 'levelup':
        this.tone(440, 0.12, 'square', 0.2);
        this.tone(660, 0.12, 'square', 0.2, undefined, 0.09);
        this.tone(880, 0.2, 'square', 0.2, undefined, 0.18);
        break;
      case 'pickup': this.tone(900 + Math.random() * 200, 0.06, 'sine', 0.12, 1400); break;
      case 'hurt': this.tone(160, 0.18, 'sawtooth', 0.25, 70); this.noise(0.1, 0.15, 900); break;
      case 'chest':
        this.tone(523, 0.1, 'triangle', 0.2);
        this.tone(784, 0.18, 'triangle', 0.2, undefined, 0.1);
        break;
      case 'bossWarn':
        this.tone(220, 0.3, 'sawtooth', 0.25, 220);
        this.tone(220, 0.3, 'sawtooth', 0.25, 220, 0.4);
        this.tone(220, 0.45, 'sawtooth', 0.28, 110, 0.8);
        break;
      case 'bossDie':
        this.noise(0.5, 0.3, 1200);
        this.tone(880, 0.5, 'square', 0.2, 110);
        this.tone(440, 0.6, 'triangle', 0.22, 55, 0.1);
        break;
      case 'evolve':
        for (let i = 0; i < 5; i++) this.tone(330 * Math.pow(1.25, i), 0.14, 'square', 0.18, undefined, i * 0.08);
        break;
      case 'click': this.tone(800, 0.04, 'square', 0.08, 500); break;
      case 'buy': this.tone(660, 0.08, 'square', 0.15); this.tone(990, 0.12, 'square', 0.15, undefined, 0.08); break;
      case 'objective':
        this.tone(587, 0.12, 'triangle', 0.2);
        this.tone(880, 0.2, 'triangle', 0.2, undefined, 0.12);
        break;
      case 'victory':
        for (let i = 0; i < 7; i++) this.tone([523, 659, 784, 1046, 784, 1046, 1318][i], 0.22, 'square', 0.18, undefined, i * 0.16);
        break;
      case 'death':
        this.tone(440, 0.9, 'sawtooth', 0.25, 55);
        this.noise(0.6, 0.2, 600);
        break;
      case 'fizz': // something bubbling quietly in glassware
        this.noise(0.45, 0.1, 5200);
        for (let i = 0; i < 4; i++) {
          this.tone(1100 + Math.random() * 900, 0.05, 'sine', 0.07, 2400, 0.06 + i * 0.09);
        }
        break;
      case 'resolve': // warm glass arpeggio — a dependency clicking into place
        this.tone(660, 0.12, 'triangle', 0.18);
        this.tone(990, 0.14, 'triangle', 0.18, undefined, 0.1);
        this.tone(1320, 0.22, 'triangle', 0.18, undefined, 0.2);
        break;
    }
  }

  // ---------- music ----------

  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null) return;
    this.musicStep = 0;
    const stepDur = 0.14; // 16th notes ~107 BPM
    // A minor synthwave-ish progression: Am F C G
    const bassRoots = [110, 87.31, 130.81, 98];
    const arpNotes = [
      [220, 261.63, 329.63, 440],
      [174.61, 220, 261.63, 349.23],
      [261.63, 329.63, 392, 523.25],
      [196, 246.94, 293.66, 392],
    ];
    const tick = () => {
      const c = this.ensure();
      if (!c) return;
      const t = c.currentTime + 0.05;
      const bar = Math.floor(this.musicStep / 16) % 4;
      const step = this.musicStep % 16;

      // bass on every 4th step
      if (step % 4 === 0) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.value = bassRoots[bar];
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g); g.connect(this.musicGain);
        osc.start(t); osc.stop(t + 0.35);
      }
      // arpeggio (denser with intensity)
      if (step % 2 === 0 || this.intensity > 0.5) {
        const notes = arpNotes[bar];
        const note = notes[step % notes.length] * (this.intensity > 0.75 && step % 8 >= 4 ? 2 : 1);
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'square';
        osc.frequency.value = note;
        g.gain.setValueAtTime(0.10 + this.intensity * 0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(g); g.connect(this.musicGain);
        osc.start(t); osc.stop(t + 0.14);
      }
      // hat (noise tick) with intensity
      if (this.intensity > 0.25 && step % 2 === 1) {
        const len = Math.ceil(c.sampleRate * 0.03);
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = c.createBufferSource();
        src.buffer = buf;
        const hg = c.createGain();
        hg.gain.value = 0.06;
        const hp = c.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 6000;
        src.connect(hp); hp.connect(hg); hg.connect(this.musicGain);
        src.start(t);
      }
      this.musicStep++;
    };
    this.musicTimer = window.setInterval(tick, stepDur * 1000);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const sound = new Sound();
