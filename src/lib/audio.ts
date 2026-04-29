
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
    const response = await fetch("/api/fpt-tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ phrase: cleanPhrase })
    });

    if (!response.ok) {
      throw new Error(`Server Error: ${response.status}`);
    }

    const result = await response.json();

    if (result.error === 0) {
      // Use result.url as specified in user logic
      // Fallback to async if url is missing (common in FPT v5)
      const audioUrl = result.url || result.async;
      
      if (!audioUrl) {
        console.error("FPT API didn't return a URL:", result);
        return;
      }

      console.log("Playing FPT Audio:", audioUrl);

      return new Promise((resolve) => {
        const tempAudio = new Audio(audioUrl);
        
        tempAudio.onended = () => resolve();
        tempAudio.onerror = (e) => {
          console.error("FPT Audio Playback Error:", e);
          resolve();
        };

        tempAudio.play().catch(err => {
          console.warn("FPT play was blocked by browser, click interaction might be needed:", err);
          resolve();
        });

        // Fail-safe timeout
        setTimeout(resolve, 20000);
      });
    } else {
      console.error("Lỗi từ FPT.AI:", result.message);
    }
  } catch (error) {
    console.error("Lỗi kết nối FPT:", error);
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
