
let audioCtx: AudioContext | null = null;
let sharedAudio: HTMLAudioElement | null = null;

export const initAudio = () => {
  // Initialize AudioContext for beeps and Gemini PCM playback
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000 // Match Gemini TTS sample rate
    });
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Initialize shared Audio element for Proxy/WebSpeech fallback
  if (!sharedAudio) {
    sharedAudio = new Audio();
    // Pre-play silent gap to unlock
    sharedAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";
    sharedAudio.play().catch(() => {});
  }
  
  return { audioCtx, sharedAudio };
};

export const playTts = async (phrase: string): Promise<void> => {
  const { sharedAudio: audio } = initAudio();
  if (!audio) return;

  const cleanPhrase = phrase.trim().replace(/\s+/g, ' ');

  // Exclusively use FPT.AI TTS via Server Proxy (to handle CORS and API Key securely)
  try {
    const response = await fetch(`/api/fpt-tts?text=${encodeURIComponent(cleanPhrase)}`);
    if (response.ok) {
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      return new Promise((resolve) => {
        const tempAudio = new Audio(audioUrl);
        tempAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        tempAudio.onerror = (e) => {
          console.error("FPT Audio Playback Error:", e);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        tempAudio.play().catch(e => {
          console.warn("FPT play blocked by browser:", e);
          resolve();
        });
      });
    } else {
      const errorText = await response.text();
      console.warn("FPT TTS Proxy returned error:", errorText);
    }
  } catch (err) {
    console.error("FPT TTS Critical Failure:", err);
  }
};

export const playSafeSound = async () => {
  const { audioCtx: ctx } = initAudio();
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
  const { audioCtx: ctx } = initAudio();
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
