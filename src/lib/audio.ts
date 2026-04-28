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
  
  /**
   * SỬA LỖI TẠI ĐÂY:
   * Thay vì gửi link translate.google.com cũ, chúng ta gửi trực tiếp nội dung văn bản
   * lên API của server.ts để sử dụng giọng Neural2 chuẩn AI Studio.
   */
  const proxyUrl = `/api/proxy-audio?text=${encodedText}&t=${Date.now()}`;

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
      
      console.warn("Professional TTS via Server failed, falling back to Web Speech:", e);
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
          voices.find(v => v.lang.includes('vi') && v.name.includes('Natural')) ||
          voices.find(v => v.lang.includes('vi') && v.name.includes('Google')) ||
          voices.find(v => v.lang.includes('vi') && v.name.includes('Online')) ||
          voices.find(v => v.lang.includes('vi'));
        
        if (viVoice) {
          utterance.voice = viVoice;
          console.log("Using browser voice fallback:", viVoice.name);
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
    audio.src = proxyUrl; // Gọi đến API mới trên Vercel của bạn
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
