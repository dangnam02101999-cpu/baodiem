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

  // API to proxy download from FPT AI and upload to Supabase
  // This bypasses browser CORS restrictions
  app.post("/api/proxy-upload", async (req, res) => {
    const { audioUrl, fileName } = req.body;

    if (!audioUrl || !fileName) {
      return res.status(400).json({ error: "Missing audioUrl or fileName" });
    }

    try {
      console.log(`[ProxyUpload] Downloading from FPT: ${audioUrl}`);
      
      // Download audio from FPT with retry logic
      let response;
      let retries = 5;
      let delay = 2000;

      while (retries > 0) {
        try {
          response = await axios({
            method: 'get',
            url: audioUrl,
            responseType: 'arraybuffer'
          });
          break; // Success
        } catch (err: any) {
          if (err.response?.status === 404 && retries > 1) {
            console.log(`[ProxyUpload] FPT file not ready (404), retrying in ${delay/1000}s... (${retries-1} left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            retries--;
            delay += 1000;
            continue;
          }
          throw err;
        }
      }

      if (!response) throw new Error("Failed to download from FPT");

      const buffer = Buffer.from(response.data, 'binary');
      console.log(`[ProxyUpload] Downloaded ${buffer.length} bytes`);

      // Initialize Supabase on server
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "Supabase configuration missing on server" });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      console.log(`[ProxyUpload] Uploading to Supabase: turns/${fileName}`);
      
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(`turns/${fileName}`, buffer, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (error) {
        console.error('[ProxyUpload] Supabase Error:', error);
        return res.status(500).json({ error: error.message });
      }

      const { data: publicData } = supabase.storage
        .from('audio')
        .getPublicUrl(data.path);

      console.log(`[ProxyUpload] Success: ${publicData.publicUrl}`);
      res.json({ publicUrl: publicData.publicUrl });
    } catch (error: any) {
      console.error('[ProxyUpload] Error:', error.message);
      res.status(500).json({ error: error.message });
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
