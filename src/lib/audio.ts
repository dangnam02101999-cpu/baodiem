
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

  // Cleanup phrase to prevent TTS glitches
  const cleanPhrase = phrase.trim().replace(/\s+/g, ' ');
  const encodedText = encodeURIComponent(cleanPhrase);
  
  // Using client=tw-ob via server proxy is the most reliable way for high quality Vietnamese
  // We add a timestamp to prevent browser cache of failed requests
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=${encodedText}`;
  const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(ttsUrl)}&t=${Date.now()}`;

  return new Promise((resolve) => {
    let fallbackTriggered = false;

    const onEnded = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      resolve();
    };

    const onError = (e: any) => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      
      console.warn("Google TTS via Proxy failed/blocked, falling back to Web Speech:", e);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel(); // Clear queue
        const utterance = new SpeechSynthesisUtterance(cleanPhrase);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        
        // Priority for high-quality "Natural" voices in Edge and Chrome
        const viVoice = 
          // 1. Edge Online Natural voices (Best)
          voices.find(v => v.lang.includes('vi') && v.name.includes('Natural')) ||
          // 2. Google Online voices
          voices.find(v => v.lang.includes('vi') && v.name.includes('Google')) ||
          // 3. Microsoft Online voices
          voices.find(v => v.lang.includes('vi') && v.name.includes('Online')) ||
          // 4. Any Vietnamese voice
          voices.find(v => v.lang.includes('vi'));
        
        if (viVoice) {
          utterance.voice = viVoice;
          console.log("Using voice:", viVoice.name);
        }
        
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // Prepare and play
    audio.pause();
    audio.src = proxyUrl;
    audio.load();
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn("Audio element blocked, using Web Speech fallback:", err);
        onError(err);
      });
    }

    // Safety timeout to prevent getting stuck
    setTimeout(() => {
      if (audio.paused && !fallbackTriggered) {
        // If not playing after 2 seconds, move on or fallback
        resolve();
      }
    }, 5000);
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
