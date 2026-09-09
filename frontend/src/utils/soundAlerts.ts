/**
 * Web Audio API Sound Synthesizer for Real-Time Safety Telemetry Alerts.
 * Zero external audio file dependencies. Synthesizes gentle chimes for Medium risk
 * and urgent dual-pulse harmonic tones for Critical/High drop and dragging hazards.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction to conform to browser autoplay policy
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('wms_alert_sound_muted', muted ? 'true' : 'false');
    } catch {}
  }

  public getMuted(): boolean {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wms_alert_sound_muted');
        if (saved !== null) {
          this.isMuted = saved === 'true';
        }
      } catch {}
    }
    return this.isMuted;
  }

  public playAlert(riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | string) {
    if (this.getMuted()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const level = riskLevel.toUpperCase();

    if (level === 'CRITICAL' || level === 'HIGH') {
      this.playCriticalAlarm(ctx);
    } else if (level === 'MEDIUM') {
      this.playWarningChime(ctx);
    }
  }

  private playCriticalAlarm(ctx: AudioContext) {
    const now = ctx.currentTime;
    
    // Pulse 1: 880Hz (A5)
    this.createTone(ctx, 880, now, 0.12, 'sawtooth', 0.18);
    // Pulse 2: 1174Hz (D6)
    this.createTone(ctx, 1174, now + 0.14, 0.18, 'sawtooth', 0.22);
    // Secondary sub-harmonic for weight
    this.createTone(ctx, 440, now, 0.32, 'sine', 0.1);
  }

  private playWarningChime(ctx: AudioContext) {
    const now = ctx.currentTime;
    // Pleasant dual chime (E5 -> G#5)
    this.createTone(ctx, 659.25, now, 0.15, 'sine', 0.12);
    this.createTone(ctx, 830.61, now + 0.12, 0.25, 'sine', 0.15);
  }

  private createTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainVal: number = 0.15
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(gainVal, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (e) {
      console.debug('Audio synth trigger skipped:', e);
    }
  }
}

export const soundSynthesizer = new SoundSynthesizer();
