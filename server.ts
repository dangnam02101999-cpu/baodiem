import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";
// Import thư viện TTS chuyên nghiệp
import textToSpeech from "@google-cloud/text-to-speech";

// Create audio cache directory
const CACHE_DIR = path.join(process.cwd(), "audio_cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Khởi tạo client (Nó sẽ tự tìm credentials từ biến môi trường GOOGLE_APPLICATION_CREDENTIALS)
const ttsClient = new textToSpeech.TextToSpeechClient();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Proxy endpoint rewritten for Professional Vietnamese TTS
  app.get("/api/proxy-audio", async (req, res) => {
    // Thay vì nhận URL, giờ ta nhận 'text' cần đọc
    const { text } = req.query; 
    if (!text) return res.status(400).send("No text provided");

    const textToSpeak = text as string;
    // Create a unique filename based on the text
    const hash = crypto.createHash('md5').update(textToSpeak).digest('hex');
    const cachePath = path.join(CACHE_DIR, `${hash}.mp3`);

    // 1. Check if already cached and valid
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      if (stats.size > 200) {
        console.log(`Serving from cache: ${hash}.mp3`);
        return res.sendFile(cachePath);
      } else {
        fs.unlinkSync(cachePath);
      }
    }

    try {
      console.log(`TTS Processing (Neural2): ${textToSpeak.substring(0, 30)}...`);

      // 2. Gọi API Google Cloud TTS với giọng Neural2 chuẩn AI Studio
      const [response] = await ttsClient.synthesizeSpeech({
        input: { text: textToSpeak },
        voice: { 
          languageCode: 'vi-VN', 
          name: 'vi-VN-Neural2-D', // Giọng nam chuẩn (hoặc 'vi-VN-Neural2-A' cho giọng nữ)
        },
        audioConfig: { 
          audioEncoding: 'MP3',
          pitch: 0,
          speakingRate: 1.0 
        },
      });

      const audioContent = response.audioContent as Buffer;

      if (!audioContent || audioContent.length < 200) {
        throw new Error("Invalid audio content received from Google Cloud");
      }

      // 3. Write to cache
      fs.writeFileSync(cachePath, audioContent);
      console.log(`TTS Cached: ${hash}.mp3 (Size: ${audioContent.length})`);

      // 4. Return audio stream
      res.set('Content-Type', 'audio/mpeg');
      res.set('Content-Length', audioContent.length.toString());
      res.set('Accept-Ranges', 'bytes');
      res.send(audioContent);

    } catch (error: any) {
      console.error("Professional TTS Error:", error.message);
      res.status(500).send("Error generating audio: " + error.message);
    }
  });

  // Vite middleware for development (GIỮ NGUYÊN)
  if (process.env.NODE_ENV !== "production") {
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
