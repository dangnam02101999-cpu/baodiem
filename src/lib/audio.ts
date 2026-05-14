
let audioCtx: AudioContext | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let currentResolve: (() => void) | null = null;

export const initAudio = () => {
  // Initialize AudioContext for beeps
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000
    });
  }
  
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  // Initialize shared Audio element for TTS
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }
  
  // Every time initAudio is called (should be from a user gesture), 
  // attempt a silent play to keep the browser authorization active
  // But avoid interrupting if something is already playing
  if (sharedAudio.src === "" || (sharedAudio.paused && sharedAudio.currentTime === 0)) {
    sharedAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";
    sharedAudio.play().catch(() => {});
  }
  
  return { audioCtx, sharedAudio };
};

export const stopTts = () => {
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
    sharedAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";
    if (currentResolve) {
      currentResolve();
      currentResolve = null;
    }
  }
};

export const playTts = async (phrase: string): Promise<void> => {
  const { sharedAudio: audio } = initAudio();
  if (!audio) return;

  // Stop previous
  stopTts();

  const cleanPhrase = phrase.trim().replace(/\s+/g, ' ');

  // Immediate "unlock" playback for the current interaction context
  // This keeps the user gesture active for when the fetch finishes
  try {
    audio.play().catch(() => {});
  } catch (e) {}

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
      
      // If it's a new URL, we might need to wait for FPT to generate it
      // The "no supported source" error often means the URL returned 404 because it's still generating
      
      return new Promise((resolve) => {
        let retryCount = 0;
        const maxRetries = 10;
        
        currentResolve = resolve;
        
        const tryPlay = () => {
          audio.src = audioUrl;
          
          audio.onended = () => {
            cleanup();
            resolve();
          };

          audio.onerror = (e) => {
            if (retryCount < maxRetries) {
              retryCount++;
              console.warn(`Audio load failed, retrying (${retryCount}/${maxRetries})...`);
              setTimeout(tryPlay, 1000); // Wait 1s and try again
            } else {
              console.error("FPT Audio Playback Error after retries:", e);
              cleanup();
              resolve();
            }
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              // Only fail if it's not a "loading" error (which is handled by onerror)
              if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
                console.warn("Play promise error:", err);
              }
            });
          }
        };

        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
          currentResolve = null;
        };

        tryPlay();

        // Fail-safe global timeout
        setTimeout(() => {
          cleanup();
          resolve();
        }, 30000); // 30s limit
      });
    }
  } catch (error) {
    console.error("Lỗi gọi FPT:", error);
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
