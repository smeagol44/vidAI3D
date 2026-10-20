import React, { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';

export type OverlayTone = 'neutral' | 'danger' | 'victory';

export interface OverlayProps {
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
  icon?: React.ReactNode;
  tone?: OverlayTone;
  autoFocus?: boolean;
}

const TONE_CLASS: Record<OverlayTone, string> = {
  neutral: 'bg-black/80',
  danger: 'bg-red-950/85',
  victory: 'bg-cyan-950/85',
};

const BUTTON_CLASS: Record<OverlayTone, string> = {
  neutral: 'hover:bg-cyan-400',
  danger: 'hover:bg-red-400',
  victory: 'hover:bg-cyan-300',
};

export function useAutoFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (enabled && ref.current) {
      ref.current.focus();
    }
  }, [enabled]);
  return ref;
}

export function Overlay({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  tone = 'neutral',
  autoFocus = true,
}: OverlayProps) {
  const buttonRef = useAutoFocus<HTMLButtonElement>(autoFocus);

  return (
    <div className={`absolute inset-0 ${TONE_CLASS[tone]} overflow-y-auto touch-auto z-50 flex items-center justify-center p-4 backdrop-blur-sm`}>
      <div className="w-full max-w-md bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-6 md:p-8 flex flex-col items-center shadow-2xl text-center">
        <h1 className="text-3xl md:text-4xl font-black mb-3 text-cyan-400 uppercase tracking-wider">
          {title}
        </h1>
        {description && (
          <p className="text-slate-300 text-sm md:text-base mb-6 leading-relaxed">
            {description}
          </p>
        )}
        <button
          ref={buttonRef}
          autoFocus={autoFocus}
          onClick={onAction}
          className={`bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-full text-base transition-all flex items-center justify-center gap-2 ${BUTTON_CLASS[tone]} active:scale-95 shadow-lg shadow-cyan-500/20`}>
          {icon}
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export interface MenuOverlayProps {
  children: React.ReactNode;
  tone?: OverlayTone;
  zIndex?: number;
}

export function MenuOverlay({
  children,
  tone = 'neutral',
  zIndex = 40,
}: MenuOverlayProps) {
  return (
    <div
      className={`absolute inset-0 ${TONE_CLASS[tone]} overflow-y-auto touch-auto backdrop-blur-sm`}
      style={{ zIndex }}>
      <div className="min-h-full flex flex-col items-center p-4">
        <div className="m-auto w-full max-w-lg flex flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  );
}

export type InputAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'confirm'
  | 'cancel'
  | 'tap';

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
}

export interface InputSnapshot {
  actions: Record<InputAction, boolean>;
  pointer: PointerState;
}

const ACTION_KEYS: Record<string, InputAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
  Enter: 'confirm',
  ' ': 'confirm',
  Escape: 'cancel',
};

const createEmptyActions = (): Record<InputAction, boolean> => ({
  left: false,
  right: false,
  up: false,
  down: false,
  confirm: false,
  cancel: false,
  tap: false,
});

export const useInput = (
  canvasRef: RefObject<HTMLCanvasElement>,
  enabled = true,
): MutableRefObject<InputSnapshot> => {
  const inputRef = useRef<InputSnapshot>({
    actions: createEmptyActions(),
    pointer: { x: 0, y: 0, down: false },
  });

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = ACTION_KEYS[event.key];
      if (!action) return;
      inputRef.current.actions[action] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = ACTION_KEYS[event.key];
      if (!action) return;
      inputRef.current.actions[action] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled]);

  return inputRef;
};

interface Beat {
  ctx: AudioContext;
  out: GainNode;
  now: number;
}

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxMaster: GainNode | null = null;
  private muted = false;
  private volume = 0.4;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.sfxMaster = this.ctx.createGain();
    this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.sfxMaster.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
    this.sfxMaster.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.attachUnlock();
    return this.ctx;
  }

  private attachUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      void this.ctx?.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
  }

  private begin(): Beat | null {
    const ctx = this.ensure();
    const out = this.sfxMaster;
    if (!ctx || !out || this.muted) return null;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return { ctx, out, now: ctx.currentTime };
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.sfxMaster && this.ctx) {
      this.sfxMaster.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  getMuteState(): boolean {
    return this.muted;
  }

  private blip(
    b: Beat,
    at: number,
    o: {
      freq: number;
      freqTo?: number;
      dur: number;
      type?: OscillatorType;
      gain?: number;
      glide?: 'exp' | 'lin';
    },
  ) {
    const { ctx, out } = b;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, at);
    if (o.freqTo !== undefined) {
      if ((o.glide ?? 'exp') === 'lin') {
        osc.frequency.linearRampToValueAtTime(o.freqTo, at + o.dur);
      } else {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), at + o.dur);
      }
    }

    const peak = o.gain ?? 0.15;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

    osc.connect(g);
    g.connect(out);
    osc.start(at);
    osc.stop(at + o.dur + 0.02);
  }

  private vary(amount = 0.05): number {
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  // --- Verified Inserted SFX ---
  playCrispClick() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 1200 * v, dur: 0.015, gain: 0.1 });
  }

  playHoverMicroTone() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary(0.02);
    this.blip(b, b.now, { type: 'sine', freq: 880 * v, dur: 0.03, gain: 0.05 });
  }

  playConfirmSelect() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 523.25 * v, dur: 0.1, gain: 0.08 });
    this.blip(b, b.now + 0.08, { type: 'sine', freq: 783.99 * v, dur: 0.15, gain: 0.1 });
  }

  playCoinPickup() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'square', freq: 987.77 * v, dur: 0.1, gain: 0.08 });
    this.blip(b, b.now + 0.08, { type: 'square', freq: 1318.51 * v, dur: 0.2, gain: 0.08 });
  }

  playPowerupChime() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.06, { type: 'sine', freq: freq * v, dur: 0.15, gain: 0.06 });
    });
  }

  playPotionGulp() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 320 * v, freqTo: 140 * v, dur: 0.15, gain: 0.1 });
    this.blip(b, b.now + 0.12, { type: 'sine', freq: 280 * v, freqTo: 120 * v, dur: 0.18, gain: 0.08 });
  }

  playDefeatMotif() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [311.13, 261.63, 246.94, 196.00];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.15, { type: 'sawtooth', freq: freq * v, dur: 0.3, gain: 0.08 });
      this.blip(b, b.now + i * 0.15, { type: 'sine', freq: freq * 0.5 * v, dur: 0.35, gain: 0.06 });
    });
  }

  playVictoryFanfare() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.1, { type: 'sawtooth', freq: freq * v, dur: 0.4, gain: 0.06 });
      this.blip(b, b.now + i * 0.1, { type: 'sine', freq: freq * v, dur: 0.4, gain: 0.04 });
    });
    const chordTime = notes.length * 0.1;
    notes.forEach((freq) => {
      this.blip(b, b.now + chordTime, { type: 'triangle', freq: freq * v, dur: 0.8, gain: 0.06 });
    });
  }
}

export const gameAudio = new GameAudio();

export const formatTime = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const remaining = clamped % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth < 768 ||
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window
    );
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          window.matchMedia('(pointer: coarse)').matches ||
          'ontouchstart' in window
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

export interface GameState {
  status: 'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'VICTORY' | 'LEVEL_COMPLETE';
  score: number;
  level: number;
  speed: number;
  selectedOrgId: string | null;
  [key: string]: any;
}

export interface MusicTrack {
  name: string;
  url: string;
  description: string;
}
