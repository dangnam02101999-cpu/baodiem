import { GoogleGenAI, Modality } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple in-memory cache for the current session
const ttsCache = new Map<string, ArrayBuffer>();

/**
 * Generates high-quality Vietnamese speech using Gemini 3.1 Flash TTS.
 * Compliant with Skill instructions: Called from frontend, using correct SDK syntax.
 */
export async function generateGeminiSpeech(text: string): Promise<ArrayBuffer | null> {
  const cleanText = text.trim();
  if (!cleanText) return null;
  
  if (ttsCache.has(cleanText)) {
    console.log("Serving Gemini TTS from cache:", cleanText.substring(0, 20));
    return ttsCache.get(cleanText) || null;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is missing, skipping Gemini TTS.");
    return null;
  }

  try {
    // CORRECT SYNTAX as per gemini-api skill
    const response = await genAI.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ 
        parts: [{ 
          text: `Hãy đọc đoạn văn sau bằng tiếng Việt với giọng đọc tự nhiên, chuẩn xác, phát âm rõ ràng: "${cleanText}"` 
        }] 
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    
    if (base64Audio) {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = bytes.buffer;
      ttsCache.set(cleanText, buffer);
      return buffer;
    }
  } catch (error: any) {
    // Handle 429 specifically and log less noisily
    if (error.message?.includes("429") || error.status === 429) {
      console.warn("Gemini TTS Quota exceeded (429). Will use fallback.");
    } else {
      console.error("Gemini TTS Error:", error);
    }
  }
  return null;
}
