import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";

// Create audio cache directory
const CACHE_DIR = path.join(process.cwd(), "audio_cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Initialize Gemini for TTS
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" }); // Using a fast model for TTS

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // New High-Quality TTS endpoint using Gemini (AI Studio Quality)
  app.get("/api/tts", async (req, res) => {
    const { text } = req.query;
    if (!text) return res.status(400).send("No text provided");

    const phrase = text as string;
    const hash = crypto.createHash('md5').update(phrase).digest('hex');
    const cachePath = path.join(CACHE_DIR, `${hash}.mp3`);

    // Check cache
    if (fs.existsSync(cachePath)) {
      return res.sendFile(cachePath);
    }

    try {
      console.log(`Generating high-quality Gemini TTS for: "${phrase}"`);
      
      // Use the generative model to produce audio modality
      // This is the "AI Studio" way.
      const ttsModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const result = await ttsModel.generateContent({
        contents: [{ 
          role: 'user', 
          parts: [{ text: `Đọc đoạn văn bản sau bằng tiếng Việt với giọng đọc tự nhiên, truyền cảm, tốc độ vừa phải: "${phrase}"` }] 
        }],
        generationConfig: {
          // @ts-ignore - responseModalities is supported in newer versions/REST
          responseModalities: ["audio"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede" // High quality neutral voice
              }
            }
          }
        }
      });

      const response = await result.response;
      // @ts-ignore - parts[0].inlineData is where the audio lives for multimodal
      const audioData = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;

      if (audioData) {
        const buffer = Buffer.from(audioData, 'base64');
        fs.writeFileSync(cachePath, buffer);
        console.log(`Gemini TTS Cached: ${hash}.mp3 (Size: ${buffer.length})`);
        
        res.set('Content-Type', 'audio/wav'); // Gemini often returns WAV or raw PCM
        res.set('Content-Length', buffer.length.toString());
        return res.send(buffer);
      } else {
        throw new Error("No audio data returned from Gemini");
      }
    } catch (e: any) {
      console.error("Gemini TTS Error:", e.message);
      // Fallback to a better Google Translate proxy if Gemini fails
      try {
        const encodedText = encodeURIComponent(phrase);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=${encodedText}`;
        const response = await axios.get(ttsUrl, {
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        fs.writeFileSync(cachePath, response.data);
        res.set('Content-Type', 'audio/mpeg');
        return res.send(response.data);
      } catch (err) {
        res.status(500).send("Error generating audio");
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
