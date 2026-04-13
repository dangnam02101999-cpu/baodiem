
let audioCtx: AudioContext | null = null;

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const playSafeSound = async () => {
  const ctx = initAudio();
  if (!ctx) return;
  
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const playBeep = (time: number) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, time);
    gainNode.gain.setValueAtTime(0.2, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    oscillator.start(time);
    oscillator.stop(time + 0.1);
  };

  const now = ctx.currentTime;
  playBeep(now);
  playBeep(now + 0.2);
  playBeep(now + 0.4);
};

export const playDangerSound = async () => {
  const ctx = initAudio();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  
  const playBuzz = (time: number) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, time);
    gainNode.gain.setValueAtTime(0.2, time);
    gainNode.gain.linearRampToValueAtTime(0.01, time + 0.8);
    oscillator.start(time);
    oscillator.stop(time + 0.8);
  };

  const now = ctx.currentTime;
  playBuzz(now);
  playBuzz(now + 1.0);
  playBuzz(now + 2.0);
};
