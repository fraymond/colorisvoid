#!/usr/bin/env python3
"""
process-news-video: Watch ~/Documents/AI_news_raw/ for videos,
burn the latest 献哥AI报道 as subtitles, output to ~/Documents/AI_news_processed/.

Can be triggered by launchd or run manually.
"""

from __future__ import annotations

import difflib
import glob
import html
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import datetime
from typing import Dict, List, Optional

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
RAW_DIR = os.path.expanduser("~/Documents/AI_news_raw")
OUT_DIR = os.path.expanduser("~/Documents/AI_news_processed")
LOG_FILE = os.path.join(OUT_DIR, "process.log")
VIDEO_EXTS = {".mp4", ".mov", ".MP4", ".MOV"}
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("news-video")

# ---------------------------------------------------------------------------
# Load OPENAI_API_KEY from env or dotenv files
# ---------------------------------------------------------------------------
def load_api_key() -> Optional[str]:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key
    for path in [
        os.path.expanduser("~/.config/colorisvoid/.env"),
        os.path.join(SCRIPT_DIR, "..", ".env"),
    ]:
        path = os.path.abspath(path)
        if os.path.isfile(path):
            with open(path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("OPENAI_API_KEY=") and not line.startswith("#"):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            os.environ["OPENAI_API_KEY"] = val
                            return val
    return None


# ---------------------------------------------------------------------------
# Import helpers from subtitle-gen.py (same directory)
# ---------------------------------------------------------------------------
sys.path.insert(0, SCRIPT_DIR)
from subtitle_gen import (  # noqa: E402 – after sys.path fix
    call_openai,
    extract_audio,
    write_srt,
)
import shutil


def run_whisper_words(audio_path: str, model: str, lang: str) -> List[Dict]:
    """Run Whisper with word-level timestamps and return word list."""
    out_dir = tempfile.mkdtemp()
    cmd = [
        "whisper", audio_path,
        "--model", model,
        "--language", lang,
        "--word_timestamps", "True",
        "--output_format", "json",
        "--output_dir", out_dir,
    ]
    subprocess.run(cmd, capture_output=True, check=True)

    base = os.path.splitext(os.path.basename(audio_path))[0]
    json_path = os.path.join(out_dir, f"{base}.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    words = []
    for seg in data.get("segments", []):
        for w in seg.get("words", []):
            text = w.get("word", "").strip()
            if text:
                words.append({
                    "start": w["start"],
                    "end": w["end"],
                    "word": text,
                })
    return words


STRIP_PUNCT = re.compile(r"[。，！？；：、…,.!?;:~～\-\—\"\"\'\']")


def strip_punct(text: str) -> str:
    return STRIP_PUNCT.sub("", text)


def _is_english(ch: str) -> bool:
    return ch.isascii() and ch.isalpha()


def words_to_subtitle_segments(words: List[Dict], max_chars: int = 10,
                               sentence_gap: float = 0.5,
                               clause_gap: float = 0.25) -> List[Dict]:
    """
    Group words into subtitle segments. Rules:
    - Break at ANY punctuation (each clause/sentence is its own segment).
    - Force break when display length hits max_chars even without punctuation.
    - Never split an English word across segments.
    - Adds a timing gap after sentence-ending punctuation (。！？) so
      consecutive subtitles don't run together visually.
    - Adds a smaller gap after clause-level punctuation (，；：、…).
    """
    ALL_PUNCT = set("。，！？；：、…,.!?;:")
    SENTENCE_END = set("。！？.!?")

    segments: List[Dict] = []
    buf_words: List[Dict] = []
    buf_raw = ""
    last_punct = ""

    def flush():
        nonlocal buf_words, buf_raw, last_punct
        if not buf_words:
            return
        display = strip_punct(buf_raw).strip()
        if display:
            segments.append({
                "start": buf_words[0]["start"],
                "end": buf_words[-1]["end"],
                "text": display,
                "_punct": last_punct,
            })
        buf_words = []
        buf_raw = ""
        last_punct = ""

    for w in words:
        word_text = w["word"]
        word_display = strip_punct(word_text)
        cur_display_len = len(strip_punct(buf_raw))
        new_display_len = cur_display_len + len(word_display)

        # If adding this word would exceed max_chars and the word is English
        # (or the buffer already has content), flush first to avoid splitting.
        if buf_words and new_display_len > max_chars:
            any_english = any(_is_english(ch) for ch in word_display)
            if any_english or cur_display_len >= max_chars:
                last_punct = ""
                flush()

        buf_words.append(w)
        buf_raw += word_text

        trailing = buf_raw[-1] if buf_raw else ""
        has_punct = trailing in ALL_PUNCT
        display_len = len(strip_punct(buf_raw))

        if has_punct or display_len >= max_chars:
            last_punct = trailing if has_punct else ""
            flush()

    flush()

    for i in range(len(segments) - 1):
        punct = segments[i].pop("_punct", "")
        gap = sentence_gap if punct in SENTENCE_END else clause_gap if punct else 0.0
        if gap > 0:
            available = segments[i + 1]["start"] - segments[i]["end"]
            actual_gap = min(gap, max(available, 0))
            if actual_gap > 0:
                segments[i]["end"] -= actual_gap
    if segments:
        segments[-1].pop("_punct", "")

    return segments


# ---------------------------------------------------------------------------
# Fetch latest digest from the website
# ---------------------------------------------------------------------------
def fetch_latest_digest() -> Optional[str]:
    """Scrape https://colorisvoid.com/notes and extract the first article text.
    Retries up to 5 times with backoff for network issues (common in launchd)."""
    url = "https://colorisvoid.com/notes"
    page = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "news-video-bot/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                page = resp.read().decode("utf-8")
            break
        except Exception as e:
            wait = (attempt + 1) * 3
            log.warning("Fetch attempt %d failed (%s), retrying in %ds...", attempt + 1, e, wait)
            time.sleep(wait)

    if not page:
        log.error("Failed to fetch %s after 5 attempts", url)
        return None

    m = re.search(r"<article[^>]*>(.*?)</article>", page, re.DOTALL)
    if not m:
        log.error("Could not find <article> in page HTML")
        return None

    block = m.group(1)
    text = re.sub(r"<[^>]+>", "\n", block)
    text = html.unescape(text)
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if lines and re.match(r"^\d{4}年", lines[0]):
        lines = lines[1:]
    return "\n".join(lines)


def split_script_lines(script: str) -> List[str]:
    """Split a digest script into individual subtitle lines."""
    lines = []
    for line in script.split("\n"):
        line = line.strip()
        if line:
            lines.append(line)
    return lines


# ---------------------------------------------------------------------------
# Correct Whisper characters using official script (deterministic alignment)
# ---------------------------------------------------------------------------
def correct_words_with_script(words: List[Dict], script: str) -> List[Dict]:
    """
    Fix misrecognized characters in Whisper words by aligning them to the
    official script at the character level. Only substitutes wrong characters;
    extra/missing words are left as-is. Timestamps are never changed.
    """
    whisper_chars: List[str] = []
    char_word_idx: List[int] = []
    for wi, w in enumerate(words):
        for ch in w["word"]:
            whisper_chars.append(ch)
            char_word_idx.append(wi)

    script_clean = strip_punct(script.replace("\n", "").replace(" ", ""))
    script_chars = list(script_clean)

    if not whisper_chars or not script_chars:
        return words

    sm = difflib.SequenceMatcher(None, whisper_chars, script_chars, autojunk=False)
    corrected = list(whisper_chars)

    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "replace":
            w_len = i2 - i1
            s_len = j2 - j1
            for k in range(min(w_len, s_len)):
                corrected[i1 + k] = script_chars[j1 + k]

    result: List[Dict] = []
    for wi, w in enumerate(words):
        chars = [corrected[ci] for ci in range(len(char_word_idx)) if char_word_idx[ci] == wi]
        result.append({
            "start": w["start"],
            "end": w["end"],
            "word": "".join(chars),
        })

    n_fixed = sum(1 for a, b in zip(whisper_chars, corrected) if a != b)
    if n_fixed:
        log.info("      Corrected %d characters via script alignment.", n_fixed)

    return result


# ---------------------------------------------------------------------------
# Burn subtitles with moviepy
# ---------------------------------------------------------------------------
def burn_subtitles(
    video_path: str,
    segments: List[Dict],
    output_path: str,
) -> None:
    from moviepy import CompositeVideoClip, TextClip, VideoFileClip

    FONT = os.path.expanduser("~/Library/Fonts/WenYuanRoundedSCVF.otf")
    FONT_FALLBACK = "/System/Library/Fonts/STHeiti Medium.ttc"
    if not os.path.isfile(FONT):
        FONT = FONT_FALLBACK

    log.info("Loading video: %s", video_path)
    video = VideoFileClip(video_path)
    w, h = video.size

    active_size = max(34, int(h * 0.040))
    context_size = max(28, int(h * 0.032))
    max_width = int(w * 0.88)
    line_spacing = int(active_size * 1.6)

    # Vertical center of the 3-line subtitle block (lower third of screen)
    block_center_y = int(h * 2 / 3)

    # Colors
    ACTIVE_COLOR = "#FFFFFF"
    CONTEXT_COLOR = "#888888"

    nonempty = [s for s in segments if s["text"].strip()]

    text_clips = []
    for idx, seg in enumerate(nonempty):
        start = seg["start"]
        dur = seg["end"] - seg["start"]
        if dur <= 0:
            continue

        lines_to_show = []
        # Previous line (context above)
        if idx > 0:
            lines_to_show.append(("prev", nonempty[idx - 1]["text"].strip()))
        else:
            lines_to_show.append(("prev", ""))
        # Current line (active / highlighted)
        lines_to_show.append(("active", seg["text"].strip()))
        # Next line (context below)
        if idx < len(nonempty) - 1:
            lines_to_show.append(("next", nonempty[idx + 1]["text"].strip()))
        else:
            lines_to_show.append(("next", ""))

        for row, (role, txt) in enumerate(lines_to_show):
            if not txt:
                continue
            is_active = role == "active"
            y = block_center_y + (row - 1) * line_spacing

            tc = (
                TextClip(
                    font=FONT,
                    text=txt,
                    font_size=active_size if is_active else context_size,
                    color=ACTIVE_COLOR if is_active else CONTEXT_COLOR,
                    stroke_color="black",
                    stroke_width=2 if is_active else 1,
                    method="label",
                )
                .with_position(("center", y))
                .with_start(start)
                .with_duration(dur)
            )
            text_clips.append(tc)

    log.info("Compositing %d subtitle clips (3-line highlight mode)...", len(text_clips))
    final = CompositeVideoClip([video, *text_clips])

    tmp_path = output_path + ".tmp.mp4"
    log.info("Writing subtitled video (original speed)...")
    final.write_videofile(
        tmp_path,
        codec="libx264",
        audio_codec="aac",
        threads=4,
        logger=None,
    )
    video.close()
    final.close()

    SPEED = 1.15
    log.info("Speeding up to %.1fx (pitch-preserved) via ffmpeg...", SPEED)
    cmd = [
        "ffmpeg", "-i", tmp_path,
        "-filter:v", f"setpts=PTS/{SPEED}",
        "-filter:a", f"atempo={SPEED}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        output_path, "-y",
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Wait for file to stabilize (not still being copied/written)
# ---------------------------------------------------------------------------
def unique_path(directory: str, filename: str) -> str:
    """Return a path in directory for filename, adding (1), (2), ... if it exists."""
    base, ext = os.path.splitext(filename)
    candidate = os.path.join(directory, filename)
    n = 1
    while os.path.exists(candidate):
        candidate = os.path.join(directory, f"{base}({n}){ext}")
        n += 1
    return candidate


def wait_for_stable(path: str, interval: float = 2.0, checks: int = 3) -> bool:
    prev_size = -1
    stable_count = 0
    for _ in range(30):
        try:
            sz = os.path.getsize(path)
        except OSError:
            return False
        if sz == prev_size and sz > 0:
            stable_count += 1
            if stable_count >= checks:
                return True
        else:
            stable_count = 0
        prev_size = sz
        time.sleep(interval)
    return False


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------
def find_companion_txt(video_path: str) -> Optional[str]:
    """Look for a .txt file with the same base name or any lone .txt in the folder."""
    base = os.path.splitext(video_path)[0]
    # Same name: video.MOV -> video.txt
    for ext in [".txt", ".TXT"]:
        candidate = base + ext
        if os.path.isfile(candidate):
            return candidate
    # Any .txt file sitting in the same folder (not in archive)
    folder = os.path.dirname(video_path)
    txts = [os.path.join(folder, f) for f in os.listdir(folder)
            if f.lower().endswith(".txt") and os.path.isfile(os.path.join(folder, f))]
    if len(txts) == 1:
        return txts[0]
    return None


def process_video(video_path: str) -> None:
    log.info("=== Processing: %s ===", os.path.basename(video_path))

    # 1. Get script: from companion .txt if present, otherwise from website
    txt_path = find_companion_txt(video_path)
    if txt_path:
        log.info("[1/6] Using companion txt: %s", os.path.basename(txt_path))
        with open(txt_path, "r", encoding="utf-8") as f:
            script_text = f.read().strip()
    else:
        log.info("[1/6] No .txt file found, fetching from colorisvoid.com/notes...")
        script_text = fetch_latest_digest()

    if not script_text:
        log.error("No script found. Aborting.")
        return
    script_lines = split_script_lines(script_text)
    log.info("      Got %d lines of script.", len(script_lines))

    # 2. Extract audio & transcribe with word-level timestamps
    log.info("[2/6] Extracting audio...")
    audio_path = extract_audio(video_path)

    log.info("[3/6] Transcribing with Whisper (word-level timestamps)...")
    words = run_whisper_words(audio_path, model="medium", lang="zh")
    log.info("      Got %d words.", len(words))
    os.unlink(audio_path)

    # 3. Correct misrecognized characters using official script (timestamps unchanged)
    if script_lines:
        log.info("[4/6] Aligning Whisper text to official script (fixing wrong chars)...")
        words = correct_words_with_script(words, "\n".join(script_lines))

    # 4. Build subtitle segments from words (precise timing per phrase)
    segments = words_to_subtitle_segments(words)
    log.info("      Built %d subtitle segments (punctuation stripped).", len(segments))

    # 5. Write SRT, burn subtitles, copy original to processed folder
    base, ext = os.path.splitext(os.path.basename(video_path))
    out_name = f"{base}_processed{ext}"
    out_path = os.path.join(OUT_DIR, out_name)
    srt_path = os.path.join(OUT_DIR, f"{base}.srt")
    original_copy_path = os.path.join(OUT_DIR, os.path.basename(video_path))

    log.info("[5/6] Writing SRT + burning subtitles...")
    write_srt(segments, srt_path)
    log.info("      SRT: %s", srt_path)

    burn_subtitles(video_path, segments, out_path)

    # Copy original video to processed folder
    shutil.copy2(video_path, original_copy_path)
    log.info("      Original copied to: %s", original_copy_path)

    # 6. Generate CapCut draft (optional, non-fatal)
    log.info("[6/6] Generating CapCut draft...")
    try:
        from generate_capcut_draft import generate_capcut_draft, detect_capcut_drafts_folder

        drafts_folder = detect_capcut_drafts_folder()
        if drafts_folder:
            draft_path = generate_capcut_draft(
                video_path=original_copy_path,
                srt_path=srt_path,
                title_text=f"献哥AI报道 {datetime.now().strftime('%Y.%m.%d')}",
                draft_name=f"AI_news_{datetime.now().strftime('%Y%m%d')}_{base}",
                sfx_dir=os.path.join(SCRIPT_DIR, "assets", "sfx"),
                capcut_drafts_folder=drafts_folder,
            )
            log.info("      CapCut draft: %s", draft_path)
        else:
            log.warning("      CapCut drafts folder not found, skipping draft generation.")
    except ImportError:
        log.warning("      pycapcut not installed, skipping CapCut draft generation.")
    except Exception:
        log.exception("      CapCut draft generation failed (non-fatal).")

    # 7. Archive original from raw (and companion .txt if used)
    archive_dir = os.path.join(RAW_DIR, "archive")
    os.makedirs(archive_dir, exist_ok=True)
    archive_path = unique_path(archive_dir, os.path.basename(video_path))
    log.info("Archiving original to: %s", archive_path)
    os.rename(video_path, archive_path)
    if txt_path and os.path.isfile(txt_path):
        txt_archive = unique_path(archive_dir, os.path.basename(txt_path))
        os.rename(txt_path, txt_archive)
        log.info("Archived txt to: %s", txt_archive)

    log.info("=== Done! Output: %s ===", out_path)


def main() -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    os.chdir(OUT_DIR)

    load_api_key()

    videos = []
    for f in os.listdir(RAW_DIR):
        if os.path.splitext(f)[1] in VIDEO_EXTS:
            full = os.path.join(RAW_DIR, f)
            if os.path.isfile(full):
                videos.append(full)

    if not videos:
        log.info("No videos found in %s", RAW_DIR)
        return

    for vpath in sorted(videos):
        log.info("Waiting for file to stabilize: %s", os.path.basename(vpath))
        if not wait_for_stable(vpath):
            log.warning("File did not stabilize, skipping: %s", vpath)
            continue
        try:
            process_video(vpath)
        except Exception:
            log.exception("Failed to process %s", vpath)


if __name__ == "__main__":
    main()
