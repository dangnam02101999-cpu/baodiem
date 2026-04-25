
let audioCtx: AudioContext | null = null;
let sharedAudio: HTMLAudioElement | null = null;

export const initAudio = () => {
  // Initialize AudioContext for beeps
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Initialize shared Audio element for TTS
  if (!sharedAudio) {
    sharedAudio = new Audio();
    // Pre-play a tiny silent sound to "bless" the audio element on the first user gesture
    sharedAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";
    sharedAudio.play().catch(() => {});
  }
  
  return { audioCtx, sharedAudio };
};

export const playTts = async (phrase: string): Promise<void> => {
  const { sharedAudio: audio } = initAudio();
  if (!audio) return;

  const encodedText = encodeURIComponent(phrase);
  // Using client=tw-ob via proxy for best quality and no CORS issues
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=${encodedText}`;
  const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(ttsUrl)}`;

  return new Promise((resolve) => {
    audio.pause();
    audio.src = proxyUrl;
    
    const onEnded = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      resolve();
    };

    const onError = (e: any) => {
      console.warn("TTS Error for phrase:", phrase, e);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      resolve();
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    
    audio.play().catch(err => {
      console.warn("Audio play blocked or failed:", err);
      // Fallback: if audio fails, try Web Speech API
      try {
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.lang = 'vi-VN';
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } catch (f) {
        resolve();
      }
    });
  });
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
