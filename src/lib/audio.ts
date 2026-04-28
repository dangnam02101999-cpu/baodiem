
import { GoogleGenAI, Modality } from "@google/genai";

let audioCtx: AudioContext | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let ai: any = null;

export const initAudio = () => {
  // Initialize AudioContext for beeps and raw PCM playback
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000
    });
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  // Initialize shared Audio element for HTML-based TTS fallbacks
  if (!sharedAudio) {
    sharedAudio = new Audio();
    // Pre-play a tiny silent sound to "bless" the audio element on the first user gesture
    sharedAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA== ";
    sharedAudio.play().catch(() => {});
  }

  // Initialize Gemini AI
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  
  return { audioCtx, sharedAudio, ai };
};

const playPcm = async (base64Data: string): Promise<void> => {
  const { audioCtx: ctx } = initAudio();
  if (!ctx) return;

  // Convert base64 to ArrayBuffer
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Int16Array(len / 2);
  for (let i = 0; i < len; i += 2) {
    bytes[i / 2] = (binaryString.charCodeAt(i + 1) << 8) | binaryString.charCodeAt(i);
  }

  // Convert Int16 PCM to Float32
  const float32Data = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    float32Data[i] = bytes[i] / 32768.0;
  }

  // Create AudioBuffer
  const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000);
  audioBuffer.getChannelData(0).set(float32Data);

  // Play
  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => resolve();
    source.start();
  });
};

export const playTts = async (phrase: string): Promise<void> => {
  const { sharedAudio: audio } = initAudio();
  if (!audio) return;

  const cleanPhrase = phrase.trim().replace(/\s+/g, ' ');
  const encodedText = encodeURIComponent(cleanPhrase);
  
  // Use our new high-quality server-side Gemini TTS endpoint
  const proxyUrl = `/api/tts?text=${encodedText}&t=${Date.now()}`;

  return new Promise((resolve) => {
    let fallbackTriggered = false;

    const onEnded = () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      resolve();
    };

    const onError = async (e: any) => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      
      console.warn("Server-side Gemini TTS failed, falling back to Web Speech:", e);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanPhrase);
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const viVoice = 
          voices.find(v => v.lang.includes('vi') && v.name.includes('Natural')) ||
          voices.find(v => v.lang.includes('vi') && v.name.includes('Google')) ||
          voices.find(v => v.lang.includes('vi') && v.name.includes('Online')) ||
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
    }, 8000);
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
