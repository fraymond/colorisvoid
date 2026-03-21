#!/usr/bin/env python3
"""
subtitle-gen: Generate .srt subtitle files from video/audio.

Usage:
  python3 subtitle-gen.py <video_file> [options]

Options:
  --song "<title> - <artist>"   Treat as song, search for official lyrics and correct
  --model <whisper_model>       Whisper model: tiny, base, small, medium, large (default: medium)
  --lang <language>             Language hint for Whisper (default: zh)
  --output <path>               Output .srt path (default: same dir as input)

Examples:
  python3 subtitle-gen.py video.mp4
  python3 subtitle-gen.py video.mp4 --song "红豆 - 王菲"
  python3 subtitle-gen.py podcast.mp4 --model small --lang en

Requirements:
  - ffmpeg (brew install ffmpeg)
  - whisper (pip install openai-whisper)
  - OPENAI_API_KEY env var (for song lyrics correction)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from typing import Dict, List, Optional


def extract_audio(video_path: str) -> str:
    tmp = tempfile.mktemp(suffix=".wav")
    cmd = [
        "ffmpeg", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
        tmp, "-y",
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return tmp


def run_whisper(audio_path: str, model: str, lang: str) -> List[Dict]:
    """Run whisper and return list of {start, end, text} segments."""
    out_dir = tempfile.mkdtemp()
    cmd = [
        "whisper", audio_path,
        "--model", model,
        "--language", lang,
        "--output_format", "json",
        "--output_dir", out_dir,
    ]
    subprocess.run(cmd, capture_output=True, check=True)

    base = os.path.splitext(os.path.basename(audio_path))[0]
    json_path = os.path.join(out_dir, f"{base}.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    segments = []
    for seg in data.get("segments", []):
        segments.append({
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"].strip(),
        })
    return segments


def search_lyrics(title: str, artist: str) -> Optional[str]:
    """Search for official lyrics using multiple APIs."""
    # Try LrcAPI first
    params = urllib.parse.urlencode({"title": title, "artist": artist})
    url = f"https://api.lrc.cx/api/v1/lyrics/single?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "subtitle-gen/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8")
            if text.strip():
                return text
    except Exception:
        pass

    # Fallback
    params2 = urllib.parse.urlencode({"msg": f"{title} {artist}"})
    url2 = f"https://jx.iqfk.top/api/lyric?{params2}"
    try:
        req2 = urllib.request.Request(url2, headers={"User-Agent": "subtitle-gen/1.0"})
        with urllib.request.urlopen(req2, timeout=10) as resp:
            text = resp.read().decode("utf-8")
            if text.strip():
                return text
    except Exception:
        pass

    return None


def parse_lrc(lrc_text: str) -> List[str]:
    """Extract plain lyric lines from LRC format, stripping timestamps."""
    lines = []
    for line in lrc_text.split("\n"):
        cleaned = re.sub(r"\[\d{2}:\d{2}[\.:]\d{2,3}\]", "", line).strip()
        if cleaned and not re.match(r"^\[.+\]$", cleaned):
            lines.append(cleaned)
    return [l for l in lines if l]


def call_openai(prompt: str, system: str) -> Optional[str]:
    """Call OpenAI chat completions API using raw HTTP (no pip dependency)."""
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return None

    body = json.dumps({
        "model": os.environ.get("OPENAI_MODEL", "gpt-4.1-mini"),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 4000,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"      Warning: OpenAI API call failed: {e}", file=sys.stderr)
        return None


def correct_with_llm(segments: List[Dict], lyrics_lines: List[str]) -> List[Dict]:
    """
    Use OpenAI to align Whisper transcription with official lyrics.
    The LLM sees both the Whisper output (with timestamps) and the official lyrics,
    then produces a corrected mapping.
    """
    whisper_text = "\n".join(
        f"[{i+1}] ({seg['start']:.1f}s - {seg['end']:.1f}s): {seg['text']}"
        for i, seg in enumerate(segments)
    )
    official = "\n".join(f"L{i+1}: {line}" for i, line in enumerate(lyrics_lines))

    system = (
        "You are a subtitle correction assistant. You will receive:\n"
        "1. Whisper transcription segments with timestamps\n"
        "2. Official song lyrics\n\n"
        "Your job: replace each Whisper segment's text with the correct official lyrics. "
        "Rules:\n"
        "- Keep the EXACT same number of segments and timestamps\n"
        "- Replace each segment's text with the matching official lyric line\n"
        "- If a Whisper segment is clearly instrumental/silence, set text to empty\n"
        "- If multiple Whisper segments map to one lyric line, split the lyric naturally\n"
        "- If one Whisper segment spans multiple lyric lines, combine them\n"
        "- Always use the official lyrics text, even if the singer changed words\n"
        "- Output ONLY valid JSON: an array of objects with keys: idx, text\n"
        "- idx is 1-based matching the Whisper segment number\n"
        "- No markdown fences, no explanation, just the JSON array"
    )

    prompt = (
        f"=== Whisper Transcription ===\n{whisper_text}\n\n"
        f"=== Official Lyrics ===\n{official}\n\n"
        "Return the corrected segments as JSON array."
    )

    result = call_openai(prompt, system)
    if not result:
        print("      LLM correction unavailable, falling back to sequential matching.")
        return correct_sequential(segments, lyrics_lines)

    try:
        # Strip markdown fences if the model added them anyway
        cleaned = result.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```\w*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)

        corrections = json.loads(cleaned)
        correction_map = {item["idx"]: item["text"] for item in corrections}

        corrected = []
        for i, seg in enumerate(segments):
            new_text = correction_map.get(i + 1, seg["text"])
            corrected.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": new_text,
            })
        return corrected
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print(f"      Warning: could not parse LLM response ({e}), falling back to sequential.")
        return correct_sequential(segments, lyrics_lines)


def correct_sequential(segments: List[Dict], lyrics_lines: List[str]) -> List[Dict]:
    """Fallback: simple sequential replacement of Whisper text with lyric lines."""
    corrected = []
    lyric_idx = 0
    for seg in segments:
        if lyric_idx < len(lyrics_lines):
            corrected.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": lyrics_lines[lyric_idx],
            })
            lyric_idx += 1
        else:
            corrected.append(seg)
    return corrected


def format_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(segments: List[Dict], output_path: str) -> None:
    with open(output_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            if not seg["text"].strip():
                continue
            f.write(f"{i}\n")
            f.write(f"{format_timestamp(seg['start'])} --> {format_timestamp(seg['end'])}\n")
            f.write(f"{seg['text']}\n\n")


def main():
    parser = argparse.ArgumentParser(
        description="Generate .srt subtitles from video/audio, with optional song lyrics correction."
    )
    parser.add_argument("input", help="Video or audio file path")
    parser.add_argument("--song", help='Song info: "title - artist" for lyrics lookup & LLM correction')
    parser.add_argument("--model", default="medium", help="Whisper model (default: medium)")
    parser.add_argument("--lang", default="zh", help="Language hint (default: zh)")
    parser.add_argument("--output", help="Output .srt file path")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    if args.output:
        out_path = args.output
    else:
        base = os.path.splitext(args.input)[0]
        out_path = f"{base}.srt"

    print(f"[1/4] Extracting audio from {os.path.basename(args.input)}...")
    audio_path = extract_audio(args.input)

    print(f"[2/4] Transcribing with Whisper ({args.model} model, lang={args.lang})...")
    segments = run_whisper(audio_path, args.model, args.lang)
    print(f"      Got {len(segments)} segments.")

    os.unlink(audio_path)

    segments = [s for s in segments if s["text"] and len(s["text"].strip()) > 0]

    if args.song:
        parts = args.song.split("-", 1)
        title = parts[0].strip()
        artist = parts[1].strip() if len(parts) > 1 else ""

        print(f"[3/4] Searching lyrics for: {title} - {artist}...")
        lrc_text = search_lyrics(title, artist)

        if lrc_text:
            lyrics_lines = parse_lrc(lrc_text)
            if lyrics_lines:
                print(f"      Found {len(lyrics_lines)} lyric lines.")
                if os.environ.get("OPENAI_API_KEY"):
                    print("      Using OpenAI to align lyrics with timestamps...")
                    segments = correct_with_llm(segments, lyrics_lines)
                else:
                    print("      No OPENAI_API_KEY set, using sequential matching.")
                    segments = correct_sequential(segments, lyrics_lines)
            else:
                print("      Warning: lyrics found but could not parse. Using Whisper output.")
        else:
            print("      Warning: no lyrics found online. Using Whisper output as-is.")
    else:
        print("[3/4] No --song flag, skipping lyrics correction.")

    print(f"[4/4] Writing {out_path}...")
    write_srt(segments, out_path)
    count = sum(1 for s in segments if s["text"].strip())
    print(f"Done! {count} subtitles written to: {out_path}")


if __name__ == "__main__":
    main()
