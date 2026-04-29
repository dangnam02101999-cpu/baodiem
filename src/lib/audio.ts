
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

/**
 * Plays a PCM ArrayBuffer using Web Audio API.
 * Specifically designed for Gemini TTS output.
 */
async function playPcmData(buffer: ArrayBuffer, ctx: AudioContext): Promise<void> {
  // PCM data from Gemini is 16-bit Int, mono, 24kHz
  const int16 = new Int16Array(buffer);
  const float32 = new Float32Array(int16.length);
  
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }

  const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
  audioBuffer.getChannelData(0).set(float32);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  
  return new Promise((resolve) => {
    source.onended = () => resolve();
    source.start();
  });
}

export const playTts = async (phrase: string): Promise<void> => {
  const { audioCtx, sharedAudio: audio } = initAudio();
  if (!audioCtx || !audio) return;

  const cleanPhrase = phrase.trim().replace(/\s+/g, ' ');

  // 1. Try Gemini TTS (High Quality "AI Studio" Voice)
  try {
    const response = await fetch(`/api/gemini-tts?text=${encodeURIComponent(cleanPhrase)}`);
    if (response.ok) {
      const pcmData = await response.arrayBuffer();
      if (pcmData && pcmData.byteLength > 0) {
        await playPcmData(pcmData, audioCtx);
        return; // Success!
      }
    }
  } catch (err) {
    console.warn("Gemini TTS failed, trying FPT next...", err);
  }

  // 2. Try FPT.AI TTS (Neural Vietnamese Voice)
  try {
    const fptResponse = await fetch(`/api/fpt-tts?text=${encodeURIComponent(cleanPhrase)}`);
    if (fptResponse.ok) {
      const audioBlob = await fptResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      return new Promise((resolve) => {
        const tempAudio = new Audio(audioUrl);
        tempAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        tempAudio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        tempAudio.play().catch(e => {
          console.warn("FPT play failed:", e);
          resolve();
        });
      });
    }
  } catch (err) {
    console.warn("FPT TTS failed, trying Google fallback...", err);
  }

  // 3. Fallback to Google Translate Proxy (Legacy)
  const encodedText = encodeURIComponent(cleanPhrase);
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
      
      console.warn("Google TTS Proxy fallback failed, trying Web Speech API:", e);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanPhrase);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(v => v.lang.includes('vi') && (v.name.includes('Google') || v.name.includes('Natural'))) || 
                        voices.find(v => v.lang.includes('vi'));
        
        if (viVoice) utterance.voice = viVoice;
        
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

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
