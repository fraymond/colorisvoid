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
DEFAULT_BEAUTY_FILTER = (
    "hqdn3d=1.8:1.5:7.0:5.5,"
    "eq=brightness=0.038:saturation=1.05:gamma=1.06:contrast=1.02"
)
DEFAULT_TITLE_CARD_TEXT = "献哥每日AI播报"
DEFAULT_TITLE_CARD_DATE_TEMPLATE = "{year}年{month}月{day}日"
DEFAULT_TITLE_CARD_SUFFIX = "cover_v5"

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
HASHTAG_TOKEN = re.compile(r"#\S+")
NUMBER_TOKEN = r"\d+(?:\.\d+)+(?:[%％])?"
LATIN_TOKEN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9&+._'/-]*$")
DISPLAY_TOKEN = re.compile(rf"{NUMBER_TOKEN}|[A-Za-z0-9][A-Za-z0-9&+._'/-]*|.")
MIXED_WORD_TOKEN = re.compile(rf"{NUMBER_TOKEN}|[A-Za-z0-9][A-Za-z0-9&+._'/-]*|[\u4e00-\u9fff]+|[^A-Za-z0-9\u4e00-\u9fff\s]")
SCRIPT_TOKEN = re.compile(rf"{NUMBER_TOKEN}|[A-Za-z0-9][A-Za-z0-9&+._'/-]*|[\u4e00-\u9fff]+|\s+|.")
ALL_PUNCT = set("。，！？；：、…,.!?;:")
SENTENCE_END = set("。！？.!?")
CLAUSE_PUNCT = set("，；：、…,:;")


def strip_punct(text: str) -> str:
    return STRIP_PUNCT.sub("", text)


def _looks_like_hashtag_line(line: str) -> bool:
    tags = HASHTAG_TOKEN.findall(line)
    if not tags:
        return False
    remainder = HASHTAG_TOKEN.sub("", line)
    remainder = remainder.replace("｜", " ").replace("|", " ").replace("·", " ")
    remainder = re.sub(r"[\s,，/、]+", "", remainder)
    return remainder == ""


def strip_digest_metadata_lines(lines: List[str]) -> List[str]:
    """Remove title-ish and hashtag-only lines before subtitle alignment."""
    cleaned = [line.strip() for line in lines if line.strip()]
    if not cleaned:
        return cleaned

    if cleaned and re.match(r"^\d{4}年", cleaned[0]):
        cleaned = cleaned[1:]

    if not cleaned:
        return cleaned

    opener = "大家好，这里是献哥AI报道"

    while cleaned and _looks_like_hashtag_line(cleaned[0]):
        cleaned = cleaned[1:]

    if not cleaned:
        return cleaned

    opener_idx = next((idx for idx, line in enumerate(cleaned) if opener in line), -1)

    if opener_idx > 0:
        cleaned = cleaned[opener_idx:]
    elif len(cleaned) >= 2 and _looks_like_hashtag_line(cleaned[1]):
        cleaned = cleaned[1:]
        while cleaned and _looks_like_hashtag_line(cleaned[0]):
            cleaned = cleaned[1:]

    return cleaned


def _is_english(ch: str) -> bool:
    return ch.isascii() and ch.isalpha()


def _is_latin_token(text: str) -> bool:
    return bool(text) and bool(LATIN_TOKEN.fullmatch(text))


def _join_display_tokens(tokens: List[str]) -> str:
    out: List[str] = []
    prev_latin = False
    for token in tokens:
        token_latin = _is_latin_token(token)
        if out and prev_latin and token_latin:
            out.append(" ")
        out.append(token)
        prev_latin = token_latin
    return "".join(out)


def _split_mixed_script_words(words: List[Dict]) -> List[Dict]:
    split_words: List[Dict] = []
    for word in words:
        text = word["word"].strip()
        if not text:
            continue

        raw_parts = MIXED_WORD_TOKEN.findall(text)
        if len(raw_parts) <= 1:
            split_words.append({
                "start": word["start"],
                "end": word["end"],
                "word": text,
            })
            continue

        parts: List[str] = []
        for part in raw_parts:
            if strip_punct(part):
                parts.append(part)
            elif parts:
                parts[-1] += part
            else:
                parts.append(part)

        display_lengths = [max(len(strip_punct(part)), 1) for part in parts]
        total_units = sum(display_lengths) or len(parts)
        start = word["start"]
        duration = max(word["end"] - word["start"], 0.0)
        cursor = start

        for idx, part in enumerate(parts):
            piece_duration = duration * (display_lengths[idx] / total_units)
            piece_end = word["end"] if idx == len(parts) - 1 else cursor + piece_duration
            split_words.append({
                "start": cursor,
                "end": piece_end,
                "word": part,
            })
            cursor = piece_end

    return split_words


def _merge_latin_runs(words: List[Dict], max_gap: float = 0.18) -> List[Dict]:
    merged: List[Dict] = []
    for word in words:
        text = word["word"].strip()
        if not text:
            continue

        current = {
            "start": word["start"],
            "end": word["end"],
            "word": text,
        }
        display = strip_punct(text)

        if merged:
            prev = merged[-1]
            prev_display = strip_punct(prev["word"])
            gap = max(current["start"] - prev["end"], 0.0)
            prev_tail = prev["word"][-1] if prev["word"] else ""
            if (
                _is_latin_token(prev_display)
                and _is_latin_token(display)
                and prev_tail not in ALL_PUNCT
                and gap <= max_gap
            ):
                prev["end"] = current["end"]
                prev["word"] += f" {current['word']}"
                continue

        merged.append(current)
    return merged


def _subtitle_tokens(text: str) -> List[str]:
    return [token for token in DISPLAY_TOKEN.findall(text) if token.strip()]


def _token_units(prev_token: Optional[str], token: str) -> int:
    extra_space = 1 if prev_token and _is_latin_token(prev_token) and _is_latin_token(token) else 0
    token_units = len(strip_punct(token)) if _is_latin_token(token) else 1
    return extra_space + token_units


def _chunk_unit_total(tokens: List[str]) -> int:
    total = 0
    prev_token: Optional[str] = None
    for token in tokens:
        total += _token_units(prev_token, token)
        prev_token = token
    return total


def _rebalance_tail_chunks(chunk_token_lists: List[List[str]], min_tail_units: int = 3) -> List[List[str]]:
    if len(chunk_token_lists) < 2:
        return chunk_token_lists

    while len(chunk_token_lists) >= 2:
        tail = chunk_token_lists[-1]
        prev = chunk_token_lists[-2]
        if _chunk_unit_total(tail) >= min_tail_units or len(prev) <= 1:
            break

        moved = prev.pop()
        tail.insert(0, moved)

        if not prev:
            chunk_token_lists.pop(-2)
            break

    return chunk_token_lists


def _split_overlong_segments(segments: List[Dict], max_units: int = 13) -> List[Dict]:
    split_segments: List[Dict] = []

    for seg in segments:
        tokens = _subtitle_tokens(seg["text"])
        if not tokens:
            continue

        chunk_token_lists: List[List[str]] = []
        chunk_tokens: List[str] = []
        chunk_units = 0

        for token in tokens:
            prev_token = chunk_tokens[-1] if chunk_tokens else None
            next_units = _token_units(prev_token, token)
            if chunk_tokens and chunk_units + next_units > max_units:
                chunk_token_lists.append(chunk_tokens[:])
                chunk_tokens = [token]
                chunk_units = len(strip_punct(token)) if _is_latin_token(token) else 1
                continue

            chunk_tokens.append(token)
            chunk_units += next_units

        if chunk_tokens:
            chunk_token_lists.append(chunk_tokens[:])

        chunk_token_lists = _rebalance_tail_chunks(chunk_token_lists)
        chunks = [_join_display_tokens(chunk).strip() for chunk in chunk_token_lists if chunk]

        if len(chunks) == 1:
            split_segments.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": chunks[0],
            })
            continue

        total_units = sum(max(len(strip_punct(chunk.replace(" ", ""))), 1) for chunk in chunks)
        start = seg["start"]
        duration = max(seg["end"] - seg["start"], 0.0)

        for idx, chunk in enumerate(chunks):
            chunk_weight = max(len(strip_punct(chunk.replace(" ", ""))), 1)
            chunk_duration = duration * (chunk_weight / total_units)
            chunk_end = seg["end"] if idx == len(chunks) - 1 else start + chunk_duration
            split_segments.append({
                "start": start,
                "end": chunk_end,
                "text": chunk,
            })
            start = chunk_end

    return _normalize_segment_timing(split_segments)


def _split_script_sentences(script: str) -> List[str]:
    sentences: List[str] = []
    current: List[str] = []
    text = script.replace("\n", " ")

    for idx, ch in enumerate(text):
        current.append(ch)
        if ch not in SENTENCE_END:
            continue

        prev_ch = text[idx - 1] if idx > 0 else ""
        next_ch = text[idx + 1] if idx + 1 < len(text) else ""
        if ch == "." and prev_ch.isdigit() and next_ch.isdigit():
            continue

        sentence = "".join(current).strip()
        if sentence:
            sentences.append(sentence)
        current = []

    tail = "".join(current).strip()
    if tail:
        sentences.append(tail)

    return sentences


def _script_sentence_specs(script: str) -> List[Dict]:
    specs: List[Dict] = []
    for raw_sentence in _split_script_sentences(script):
        raw_sentence = raw_sentence.strip()
        if not raw_sentence:
            continue
        punct = raw_sentence[-1] if raw_sentence[-1] in SENTENCE_END else ""
        display = strip_punct(raw_sentence).replace(" ", "").strip()
        if not display:
            continue
        specs.append({
            "display_len": len(display),
            "punct": punct,
        })
    return specs


def _script_sentence_chunks(script: str) -> List[Dict]:
    chunks: List[Dict] = []
    for raw_sentence in _split_script_sentences(script):
        raw_sentence = raw_sentence.strip()
        if not raw_sentence:
            continue

        visible_parts: List[str] = []
        compact_chars: List[str] = []
        compact_to_visible: List[int] = []
        clause_breaks = set()
        protected_breaks = set()
        visible_len = 0
        tokens = SCRIPT_TOKEN.findall(raw_sentence)
        for idx, token in enumerate(tokens):
            if token.isspace():
                prev_token = next((t for t in reversed(tokens[:idx]) if not t.isspace()), "")
                next_token = next((t for t in tokens[idx + 1:] if not t.isspace()), "")
                if _is_latin_token(prev_token) and _is_latin_token(next_token):
                    visible_parts.append(" ")
                    visible_len += 1
                continue

            if token in CLAUSE_PUNCT:
                if compact_chars:
                    clause_breaks.add(len(compact_chars))
                continue
            if token in SENTENCE_END:
                continue

            visible_parts.append(token)
            token_compact_start = len(compact_chars)
            for char_offset, ch in enumerate(token):
                if ch.isspace() or not strip_punct(ch):
                    continue
                compact_chars.append(ch)
                compact_to_visible.append(visible_len + char_offset)
            token_compact_end = len(compact_chars)
            if token_compact_end - token_compact_start > 1 and (
                bool(re.fullmatch(NUMBER_TOKEN, token)) or _is_latin_token(strip_punct(token))
            ):
                for protected_idx in range(token_compact_start + 1, token_compact_end):
                    protected_breaks.add(protected_idx)
            visible_len += len(token)

        if not compact_chars:
            continue

        chunks.append({
            "visible_text": "".join(visible_parts),
            "compact_text": "".join(compact_chars),
            "compact_to_visible": compact_to_visible,
            "clause_breaks": clause_breaks,
            "protected_breaks": protected_breaks,
            "punct": raw_sentence[-1] if raw_sentence[-1] in SENTENCE_END else "",
        })
    return chunks


def _split_words_by_script_sentences(words: List[Dict], script: str) -> List[Dict]:
    specs = _script_sentence_specs(script)
    if not specs:
        return [{"words": words, "punct": ""}] if words else []

    sentences: List[Dict] = []
    cursor = 0

    for spec in specs:
        buf: List[Dict] = []
        consumed = 0
        target_len = spec["display_len"]

        while cursor < len(words):
            word = words[cursor]
            word_display = strip_punct(word["word"])
            if not word_display:
                cursor += 1
                continue

            if buf and consumed < target_len and consumed + len(word_display) > target_len:
                overshoot = consumed + len(word_display) - target_len
                undershoot = target_len - consumed
                if undershoot < overshoot:
                    break

            buf.append(word)
            consumed += len(word_display)
            cursor += 1

            if consumed >= target_len:
                break

        if buf:
            sentences.append({
                "words": buf,
                "punct": spec["punct"],
            })

    if cursor < len(words):
        leftovers = [word for word in words[cursor:] if strip_punct(word["word"])]
        if leftovers:
            if sentences:
                sentences[-1]["words"].extend(leftovers)
            else:
                sentences.append({"words": leftovers, "punct": ""})

    return sentences


def _words_to_char_units(words: List[Dict]) -> List[Dict]:
    char_units: List[Dict] = []
    for word in _split_mixed_script_words(words):
        display = strip_punct(word["word"])
        if not display:
            continue

        duration = max(word["end"] - word["start"], 0.0)
        total = max(len(display), 1)
        cursor = word["start"]

        for idx, ch in enumerate(display):
            ch_duration = duration / total
            ch_end = word["end"] if idx == total - 1 else cursor + ch_duration
            char_units.append({
                "char": ch,
                "start": cursor,
                "end": ch_end,
            })
            cursor = ch_end

    return char_units


def _map_script_chars_to_units(char_units: List[Dict], script_text: str) -> List[Optional[int]]:
    corrected_chars = [unit["char"] for unit in char_units]
    script_chars = list(script_text)
    mapping: List[Optional[int]] = [None] * len(script_chars)

    sm = difflib.SequenceMatcher(None, corrected_chars, script_chars, autojunk=False)
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op not in {"equal", "replace"}:
            continue
        for offset in range(min(i2 - i1, j2 - j1)):
            mapping[j1 + offset] = i1 + offset

    prev: Optional[int] = None
    for idx, mapped in enumerate(mapping):
        if mapped is not None:
            prev = mapped
        elif prev is not None:
            mapping[idx] = prev

    nxt: Optional[int] = None
    for idx in range(len(mapping) - 1, -1, -1):
        mapped = mapping[idx]
        if mapped is not None:
            nxt = mapped
        elif nxt is not None:
            mapping[idx] = nxt

    return mapping


def _break_allowed(text: str, end_idx: int) -> bool:
    if end_idx <= 0 or end_idx >= len(text):
        return True
    return not (_is_latin_token(text[end_idx - 1]) and _is_latin_token(text[end_idx]))


def _find_segment_time(char_units: List[Dict], mapping: List[Optional[int]], start_idx: int, end_idx: int) -> Optional[Dict]:
    indices = [idx for idx in mapping[start_idx:end_idx] if idx is not None]
    if not indices:
        return None
    return {
        "start": char_units[indices[0]]["start"],
        "end": char_units[indices[-1]]["end"],
    }


def _normalize_segment_timing(segments: List[Dict], min_duration: float = 0.25) -> List[Dict]:
    for idx, seg in enumerate(segments):
        if seg["end"] <= seg["start"]:
            seg["end"] = seg["start"] + 0.05

        next_start = segments[idx + 1]["start"] if idx < len(segments) - 1 else None
        if seg["end"] - seg["start"] < min_duration:
            desired_end = seg["start"] + min_duration
            if next_start is not None:
                desired_end = min(desired_end, max(next_start - 0.01, seg["end"]))
            seg["end"] = max(seg["end"], desired_end)

    return segments


def _script_based_subtitle_segments(char_units: List[Dict], script: str,
                                    target_chars: int,
                                    hard_chars: int,
                                    min_chars: int,
                                    sentence_gap: float,
                                    clause_gap: float,
                                    pause_gap: float,
                                    soft_pause_gap: float) -> List[Dict]:
    chunks = _script_sentence_chunks(script)
    if not chunks or not char_units:
        return []

    full_script = "".join(chunk["compact_text"] for chunk in chunks)
    mapping = _map_script_chars_to_units(char_units, full_script)
    segments: List[Dict] = []
    cursor = 0

    for chunk in chunks:
        text = chunk["compact_text"]
        visible_text = chunk["visible_text"]
        compact_to_visible = chunk["compact_to_visible"]
        clause_breaks = chunk["clause_breaks"]
        protected_breaks = chunk["protected_breaks"]
        sentence_mapping = mapping[cursor:cursor + len(text)]
        cursor += len(text)

        start_idx = 0
        while start_idx < len(text):
            best_end: Optional[int] = None
            best_punct = ""

            for end_idx in range(start_idx + 1, len(text) + 1):
                if end_idx in protected_breaks:
                    continue
                if not _break_allowed(text, end_idx):
                    continue

                seg_len = end_idx - start_idx
                timing = _find_segment_time(char_units, sentence_mapping, start_idx, end_idx)
                if timing is None:
                    continue

                next_gap = 0.0
                if end_idx < len(text):
                    prev_unit_idx = sentence_mapping[end_idx - 1]
                    next_unit_idx = sentence_mapping[end_idx]
                    if prev_unit_idx is not None and next_unit_idx is not None:
                        next_gap = max(char_units[next_unit_idx]["start"] - char_units[prev_unit_idx]["end"], 0.0)

                is_clause_break = end_idx in clause_breaks
                is_sentence_end = end_idx == len(text)

                if is_sentence_end:
                    best_end = end_idx
                    best_punct = chunk["punct"]
                    break
                if seg_len >= hard_chars:
                    best_end = end_idx
                    break
                if is_clause_break and seg_len >= min_chars:
                    best_end = end_idx
                    best_punct = "，"
                    break
                if next_gap >= pause_gap and seg_len >= min_chars:
                    best_end = end_idx
                    break
                if next_gap >= soft_pause_gap and seg_len >= target_chars:
                    best_end = end_idx
                    break

            if best_end is None:
                fallback_end = min(len(text), start_idx + hard_chars)
                while fallback_end > start_idx and (
                    fallback_end in protected_breaks or not _break_allowed(text, fallback_end)
                ):
                    fallback_end -= 1
                best_end = fallback_end if fallback_end > start_idx else min(len(text), start_idx + 1)
                best_punct = chunk["punct"] if best_end == len(text) else ""

            timing = _find_segment_time(char_units, sentence_mapping, start_idx, best_end)
            if timing is None:
                start_idx = best_end
                continue

            segments.append({
                "start": timing["start"],
                "end": timing["end"],
                "text": visible_text[
                    compact_to_visible[start_idx]:compact_to_visible[best_end - 1] + 1
                ].strip(),
                "_punct": best_punct,
            })
            start_idx = best_end

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
    return _normalize_segment_timing(segments)


def words_to_subtitle_segments(words: List[Dict], target_chars: int = 14,
                               hard_chars: int = 18,
                               min_chars: int = 3,
                               sentence_gap: float = 0.5,
                               clause_gap: float = 0.25,
                               pause_gap: float = 0.35,
                               soft_pause_gap: float = 0.18,
                               script: Optional[str] = None) -> List[Dict]:
    """
    Group words into subtitle segments. Rules:
    - Never let one subtitle segment cross a sentence boundary.
    - Allow shorter subtitles when the spoken rhythm naturally pauses.
    - Only split within the same sentence when a clause break, pause, or
      length threshold suggests it.
    - Keep contiguous English runs together before segmentation.
    """
    if script:
        char_units = _words_to_char_units(words)
        script_segments = _script_based_subtitle_segments(
            char_units,
            script,
            target_chars=target_chars,
            hard_chars=hard_chars,
            min_chars=min_chars,
            sentence_gap=sentence_gap,
            clause_gap=clause_gap,
            pause_gap=pause_gap,
            soft_pause_gap=soft_pause_gap,
        )
        if script_segments:
            return script_segments

    merged_words = _merge_latin_runs(_split_mixed_script_words(words))
    segments: List[Dict] = []

    def flush_segment(buf_words: List[Dict], buf_raw: str, punct: str) -> None:
        if not buf_words:
            return
        display = strip_punct(buf_raw).strip()
        if display:
            segments.append({
                "start": buf_words[0]["start"],
                "end": buf_words[-1]["end"],
                "text": display,
                "_punct": punct,
            })

    def flush_sentence(words_in_sentence: List[Dict], tail_punct: str) -> None:
        if not words_in_sentence:
            return

        buf_words: List[Dict] = []
        buf_raw = ""

        for idx, word in enumerate(words_in_sentence):
            word_text = word["word"]
            word_display = strip_punct(word_text)
            current_len = len(strip_punct(buf_raw))
            projected_len = current_len + len(word_display)

            if buf_words and projected_len > hard_chars:
                flush_segment(buf_words, buf_raw, "")
                buf_words = []
                buf_raw = ""

            buf_words.append(word)
            buf_raw += word_text

            trailing = buf_raw[-1] if buf_raw else ""
            display_len = len(strip_punct(buf_raw))
            next_gap = 0.0
            if idx < len(words_in_sentence) - 1:
                next_gap = max(words_in_sentence[idx + 1]["start"] - word["end"], 0.0)

            is_clause_break = trailing in CLAUSE_PUNCT
            is_pause_break = next_gap >= pause_gap
            is_sentence_tail = idx == len(words_in_sentence) - 1

            if is_sentence_tail:
                flush_segment(buf_words, buf_raw, tail_punct if tail_punct in SENTENCE_END else "")
                buf_words = []
                buf_raw = ""
                continue

            if display_len < min_chars:
                continue

            if is_clause_break:
                flush_segment(buf_words, buf_raw, trailing)
                buf_words = []
                buf_raw = ""
                continue

            if is_pause_break and display_len >= min_chars:
                flush_segment(buf_words, buf_raw, "")
                buf_words = []
                buf_raw = ""
                continue

            if next_gap >= soft_pause_gap and display_len >= target_chars:
                flush_segment(buf_words, buf_raw, "")
                buf_words = []
                buf_raw = ""

        if buf_words:
            flush_segment(buf_words, buf_raw, tail_punct if tail_punct in SENTENCE_END else "")

    sentence_words: List[Dict] = []
    sentence_punct = ""
    for word in merged_words:
        sentence_words.append(word)
        trailing = word["word"][-1] if word["word"] else ""
        if trailing in SENTENCE_END:
            sentence_punct = trailing
            flush_sentence(sentence_words, sentence_punct)
            sentence_words = []
            sentence_punct = ""

    if sentence_words:
        flush_sentence(sentence_words, sentence_punct)

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
    return _normalize_segment_timing(segments)


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
    lines = strip_digest_metadata_lines(text.split("\n"))
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
# Video beauty pre-pass
# ---------------------------------------------------------------------------
def beauty_enabled() -> bool:
    raw = os.environ.get("NEWS_VIDEO_BEAUTY", "1").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def beauty_filter_spec() -> str:
    override = os.environ.get("NEWS_VIDEO_BEAUTY_FILTER", "").strip()
    return override or DEFAULT_BEAUTY_FILTER


def apply_beauty_filter(video_path: str) -> str:
    filter_spec = beauty_filter_spec()
    fd, tmp_path = tempfile.mkstemp(prefix="beauty_", suffix=".mp4", dir=OUT_DIR)
    os.close(fd)
    os.unlink(tmp_path)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        video_path,
        "-vf",
        filter_spec,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        tmp_path,
    ]

    started_at = time.time()
    log.info("[beauty] Applying natural beauty pre-pass...")
    log.info("[beauty] filter:v=%s", filter_spec)
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as exc:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        stderr = (exc.stderr or "").strip()
        if stderr:
            log.error("[beauty] ffmpeg failed: %s", stderr[-1200:])
        raise

    log.info("[beauty] Finished in %.1fs: %s", time.time() - started_at, tmp_path)
    return tmp_path


def title_card_enabled() -> bool:
    raw = os.environ.get("NEWS_VIDEO_TITLE_CARD", "1").strip().lower()
    return raw not in {"0", "false", "off", "no"}


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        log.warning("Invalid %s=%r, using default %.3f", name, raw, default)
        return default


def title_card_text() -> str:
    return os.environ.get("NEWS_VIDEO_TITLE_TEXT", "").strip() or DEFAULT_TITLE_CARD_TEXT


def title_card_date_text(reference_video_path: str) -> str:
    explicit = os.environ.get("NEWS_VIDEO_TITLE_DATE_TEXT", "").strip()
    if explicit:
        return explicit

    source = os.environ.get("NEWS_VIDEO_TITLE_DATE_SOURCE", "file-mtime").strip().lower()
    if source == "now":
        dt = datetime.utcnow()
    else:
        dt = datetime.utcfromtimestamp(os.path.getmtime(reference_video_path))

    template = (
        os.environ.get("NEWS_VIDEO_TITLE_DATE_TEMPLATE", "").strip()
        or DEFAULT_TITLE_CARD_DATE_TEMPLATE
    )
    return template.format(year=dt.year, month=dt.month, day=dt.day)


def title_card_title_y_ratio() -> float:
    return _env_float("NEWS_VIDEO_TITLE_Y_RATIO", 0.25)


def title_card_date_y_ratio() -> float:
    return _env_float("NEWS_VIDEO_DATE_Y_RATIO", 0.75)


def title_card_duration() -> float:
    return _env_float("NEWS_VIDEO_TITLE_DURATION", 0.5)


def title_card_suffix() -> str:
    return os.environ.get("NEWS_VIDEO_TITLE_SUFFIX", "").strip() or DEFAULT_TITLE_CARD_SUFFIX


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

    active_size = max(36, int(h * 0.042))
    block_center_y = int(h * 0.72)
    ACTIVE_COLOR = "#FFFFFF"

    nonempty = [s for s in segments if s["text"].strip()]

    text_clips = []
    for seg in nonempty:
        start = seg["start"]
        dur = seg["end"] - seg["start"]
        if dur <= 0:
            continue

        tc = (
            TextClip(
                font=FONT,
                text=seg["text"].strip(),
                font_size=active_size,
                color=ACTIVE_COLOR,
                stroke_color="black",
                stroke_width=2,
                method="label",
            )
            .with_position(("center", block_center_y))
            .with_start(start)
            .with_duration(dur)
        )
        text_clips.append(tc)

    log.info("Compositing %d subtitle clips (single-line mode)...", len(text_clips))
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
    beauty_temp_path: Optional[str] = None
    title_card_body_path: Optional[str] = None

    try:
        # 1. Get script: from companion .txt if present, otherwise from website
        txt_path = find_companion_txt(video_path)
        if txt_path:
            log.info("[1/7] Using companion txt: %s", os.path.basename(txt_path))
            with open(txt_path, "r", encoding="utf-8") as f:
                script_text = f.read().strip()
        else:
            log.info("[1/7] No .txt file found, fetching from colorisvoid.com/notes...")
            script_text = fetch_latest_digest()

        if not script_text:
            log.error("No script found. Aborting.")
            return
        script_lines = split_script_lines("\n".join(strip_digest_metadata_lines(script_text.split("\n"))))
        log.info("      Got %d lines of script.", len(script_lines))

        # 2. Extract audio & transcribe with word-level timestamps
        log.info("[2/7] Extracting audio...")
        audio_path = extract_audio(video_path)

        log.info("[3/7] Transcribing with Whisper (word-level timestamps)...")
        words = run_whisper_words(audio_path, model="medium", lang="zh")
        log.info("      Got %d words.", len(words))
        os.unlink(audio_path)

        # 3. Correct misrecognized characters using official script (timestamps unchanged)
        if script_lines:
            log.info("[4/7] Aligning Whisper text to official script (fixing wrong chars)...")
            words = correct_words_with_script(words, "\n".join(script_lines))

        # 4. Build subtitle segments from words (precise timing per phrase)
        segments = words_to_subtitle_segments(words, script="\n".join(script_lines) if script_lines else None)
        segments = _split_overlong_segments(segments)
        log.info("      Built %d subtitle segments (punctuation stripped).", len(segments))

        # 5. Apply light beauty before subtitle burn so text stays crisp.
        burn_input_path = video_path
        if beauty_enabled():
            log.info("[5/7] Applying light beauty pre-pass before subtitle burn...")
            beauty_temp_path = apply_beauty_filter(video_path)
            burn_input_path = beauty_temp_path
        else:
            log.info("[5/7] Beauty pre-pass disabled via NEWS_VIDEO_BEAUTY.")

        # 6. Write SRT, burn subtitles, and optionally prepend a title card
        base, ext = os.path.splitext(os.path.basename(video_path))
        out_name = f"{base}_processed{ext}"
        out_path = os.path.join(OUT_DIR, out_name)
        srt_path = os.path.join(OUT_DIR, f"{base}.srt")
        original_copy_path = os.path.join(OUT_DIR, os.path.basename(video_path))
        burn_output_path = out_path
        if title_card_enabled():
            title_card_body_path = os.path.join(OUT_DIR, f"{base}_processed_body{ext}")
            burn_output_path = title_card_body_path

        log.info("[6/8] Writing SRT + burning subtitles...")
        write_srt(segments, srt_path)
        log.info("      SRT: %s", srt_path)

        burn_subtitles(burn_input_path, segments, burn_output_path)

        if title_card_enabled():
            log.info("[7/8] Rendering title card intro...")
            from render_title_card_video import render_title_card_video

            render_title_card_video(
                video_path=burn_output_path,
                title_text=title_card_text(),
                date_text=title_card_date_text(video_path),
                title_y_ratio=title_card_title_y_ratio(),
                date_y_ratio=title_card_date_y_ratio(),
                intro_duration=title_card_duration(),
                name_suffix=title_card_suffix(),
                output_path=out_path,
                artifact_base_path=out_path,
            )
        else:
            log.info("[7/8] Title card disabled via NEWS_VIDEO_TITLE_CARD.")

        # Copy original video to processed folder
        shutil.copy2(video_path, original_copy_path)
        log.info("      Original copied to: %s", original_copy_path)

        # 8. Generate CapCut draft (optional, non-fatal)
        log.info("[8/8] Generating CapCut draft...")
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

        # 8. Archive original from raw (and companion .txt if used)
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
    finally:
        if title_card_body_path and os.path.exists(title_card_body_path):
            os.unlink(title_card_body_path)
            log.info("[title-card] Removed temp file: %s", title_card_body_path)
        if beauty_temp_path and os.path.exists(beauty_temp_path):
            os.unlink(beauty_temp_path)
            log.info("[beauty] Removed temp file: %s", beauty_temp_path)


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
