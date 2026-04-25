import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";

// Create audio cache directory
const CACHE_DIR = path.join(process.cwd(), "audio_cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Proxy endpoint with Caching as suggested by user
  app.get("/api/proxy-audio", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("No URL");

    const ttsUrl = url as string;
    // Create a unique filename for the URL to cache it
    const hash = crypto.createHash('md5').update(ttsUrl).digest('hex');
    const cachePath = path.join(CACHE_DIR, `${hash}.mp3`);

    // Check if already cached and valid
    if (fs.existsSync(cachePath)) {
      const stats = fs.statSync(cachePath);
      // If file is too small (likely a captured error page/HTML instead of MP3), delete it to retry
      if (stats.size > 200) {
        return res.sendFile(cachePath);
      } else {
        console.log(`Deleting invalid cache file: ${hash}.mp3 (Size: ${stats.size})`);
        fs.unlinkSync(cachePath);
      }
    }

    const downloadAudio = async (targetUrl: string) => {
      const response = await axios({
        method: 'get',
        url: targetUrl,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // Verify it's actually audio
      const contentType = response.headers['content-type']?.toString();
      if (!contentType || !contentType.includes('audio')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }
      
      if (response.data.length < 200) {
        throw new Error(`Audio data too short: ${response.data.length} bytes`);
      }
      
      return response;
    };

    try {
      let response;
      try {
        console.log(`TTS Request: ${ttsUrl}`);
        response = await downloadAudio(ttsUrl);
      } catch (e: any) {
        // Fallback to gtx client if tw-ob fails
        const fallbackUrl = ttsUrl.replace('client=tw-ob', 'client=gtx');
        console.log(`Main TTS client failed (${e.message}), trying fallback: ${fallbackUrl}`);
        response = await downloadAudio(fallbackUrl);
      }
      
      fs.writeFileSync(cachePath, response.data);
      console.log(`TTS Cached: ${hash}.mp3 (Size: ${response.data.length})`);
      
      res.set('Content-Type', 'audio/mpeg');
      res.set('Content-Length', response.data.length.toString());
      res.set('Accept-Ranges', 'bytes');
      res.send(response.data);
    } catch (error: any) {
      console.error("Proxy Audio Error:", error.message);
      res.status(500).send("Error fetching audio: " + error.message);
    }
  });

  // Vite middleware for development
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
