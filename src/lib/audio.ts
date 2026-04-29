
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

  try {
    const response = await fetch("https://api.fpt.ai/hmi/tts/v5", {
      method: "POST",
      headers: {
        "api_key": "TulFRBOQWl1iolT0OHMk5Sr2Rewl1hyF",
        "voice": "banmai",
        "speed": "0"
      },
      body: cleanPhrase
    });

    if (!response.ok) {
      throw new Error(`FPT Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.url || result.async) {
      const audioUrl = result.url || result.async;
      console.log("Playing FPT Audio (Shared):", audioUrl);

      return new Promise((resolve) => {
        // Use 'audio' (sharedAudio) which was unlocked during init
        audio.src = audioUrl;
        
        audio.onended = () => {
          cleanup();
          resolve();
        };

        audio.onerror = (e) => {
          console.error("FPT Audio Playback Error:", e);
          cleanup();
          resolve();
        };

        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
        };

        audio.play().catch(err => {
          console.warn("FPT play was blocked by browser:", err);
          resolve();
        });

        // Fail-safe timeout
        setTimeout(() => {
          cleanup();
          resolve();
        }, 20000);
      });
    } else {
      console.error("Lỗi từ FPT.AI:", result.message);
    }
  } catch (error) {
    console.error("Lỗi gọi thẳng FPT:", error);
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
