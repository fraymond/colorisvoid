require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const db = require("./db");

const app = express();
const router = express.Router();
router.use(express.json({ limit: "2mb" }));

// Lets the same app run at the root of its own domain (BASE_PATH unset,
// local dev) or mounted under a path on someone else's site, e.g.
// "/tools/prosody" behind a reverse proxy that forwards the full path
// through unchanged. The router below is written as if always mounted at
// "/"; app.use(MOUNT_PATH, router) at the bottom does the prefixing.
const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/+$/, "");
const MOUNT_PATH = BASE_PATH || "/";
const BASE_HREF = BASE_PATH ? BASE_PATH + "/" : "/";

const PUBLIC_DIR = path.join(__dirname, "public");
const INDEX_TEMPLATE = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");

function renderIndex(res) {
  const html = INDEX_TEMPLATE.replace("__BASE_HREF__", BASE_HREF);
  res.set("Content-Type", "text/html; charset=utf-8").send(html);
}

router.get("/", (req, res) => renderIndex(res));

// A saved paragraph's shareable page: same app shell (relative asset paths
// resolved against <base href>), the client reads the id from the URL and
// loads that paragraph on boot.
router.get("/p/:id", (req, res) => renderIndex(res));

router.use(express.static(PUBLIC_DIR, { index: false }));

// ---- Saved paragraphs ----

router.get("/api/paragraphs", (req, res) => {
  const rows = db
    .prepare("SELECT id, title, text, language, created_at FROM paragraphs ORDER BY created_at DESC, id DESC")
    .all();
  res.json(rows);
});

router.post("/api/paragraphs", (req, res) => {
  const { text, title, language } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  const trimmedText = text.trim();
  const firstLine = trimmedText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || "Untitled";
  const finalTitle = (title && title.trim() ? title.trim() : firstLine).slice(0, 120);

  const info = db
    .prepare("INSERT INTO paragraphs (title, text, language) VALUES (?, ?, ?)")
    .run(finalTitle, trimmedText, language || "auto");
  const row = db
    .prepare("SELECT id, title, text, language, created_at FROM paragraphs WHERE id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.get("/api/paragraphs/:id", (req, res) => {
  const row = db
    .prepare("SELECT id, title, text, language, created_at FROM paragraphs WHERE id = ?")
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.delete("/api/paragraphs/:id", (req, res) => {
  db.prepare("DELETE FROM paragraphs WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ---- Text-to-speech (Google Cloud TTS, SSML <mark> timepoints) ----

const TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";

router.get("/api/tts/status", (req, res) => {
  res.json({ configured: Boolean(process.env.GOOGLE_TTS_API_KEY) });
});

router.post("/api/tts", async (req, res) => {
  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "GOOGLE_TTS_API_KEY is not configured on the server" });
  }
  const { ssml, languageCode, speakingRate } = req.body || {};
  if (!ssml) {
    return res.status(400).json({ error: "ssml is required" });
  }
  const rate = Math.min(4.0, Math.max(0.25, Number(speakingRate) || 0.5));

  try {
    const ttsRes = await fetch(`${TTS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { ssml },
        voice: { languageCode: languageCode || "en-US" },
        audioConfig: { audioEncoding: "MP3", speakingRate: rate },
        enableTimePointing: ["SSML_MARK"]
      })
    });

    if (!ttsRes.ok) {
      const details = await ttsRes.text();
      return res.status(502).json({ error: "Google TTS request failed", details });
    }

    const data = await ttsRes.json();
    res.json({
      audioContent: data.audioContent,
      timepoints: data.timepoints || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Phonemization (espeak-ng, real IPA) ----

const ESPEAK_VOICES = { en: "en-us", de: "de", fr: "fr-fr", it: "it", es: "es" };

router.post("/api/phonemize", (req, res) => {
  const { words, languageCode } = req.body || {};
  if (!Array.isArray(words) || !words.length) {
    return res.status(400).json({ error: "words array is required" });
  }
  const voice = ESPEAK_VOICES[languageCode] || "en-us";

  const child = spawn("espeak-ng", ["-v", voice, "--ipa", "-q"]);
  let out = "";
  let err = "";
  let settled = false;

  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { err += d; });

  child.on("error", (e) => {
    if (settled) return;
    settled = true;
    res.status(500).json({ error: "espeak-ng is not available on this server: " + e.message });
  });

  child.on("close", (code) => {
    if (settled) return;
    settled = true;
    if (code !== 0) {
      return res.status(500).json({ error: "espeak-ng exited with an error", details: err });
    }
    const rawLines = out.split("\n");
    if (rawLines.length && rawLines[rawLines.length - 1] === "") rawLines.pop();
    const ipa = words.map((_, i) => (rawLines[i] || "").trim());
    res.json({ ipa });
  });

  child.stdin.write(words.join("\n") + "\n");
  child.stdin.end();
});

app.use(MOUNT_PATH, router);

const PORT = process.env.PORT || 5175;
app.listen(PORT, () => {
  console.log(`Prosody server running at http://localhost:${PORT}${BASE_HREF === "/" ? "" : BASE_HREF}`);
});
