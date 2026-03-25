#!/usr/bin/env python3
"""
generate_capcut_draft: Create a CapCut draft from a video + SRT + sound effects.

Usage (standalone):
  python3 generate_capcut_draft.py <video_file> <srt_file> [options]

Options:
  --title TEXT          Title card text (default: "献哥AI报道 <today's date>")
  --draft-name NAME     Draft project name (default: "AI_news_<YYYYMMDD>")
  --sfx-dir DIR         Directory with sound effect mp3s (default: scripts/assets/sfx/)
  --drafts-folder DIR   CapCut drafts folder (auto-detected if omitted)
  --width W             Video width (default: 1080)
  --height H            Video height (default: 1920)

Can also be imported and called from process-news-video.py.
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from datetime import datetime
from typing import Dict, List, Optional

import pycapcut as cc
from pycapcut import trange, tim, SEC

log = logging.getLogger("capcut-draft")

CAPCUT_DRAFTS_CANDIDATES = [
    os.path.expanduser("~/Movies/CapCut/User Data/Projects/com.lveditor.draft"),
    os.path.expanduser("~/Movies/CapCut Drafts"),
]

TITLE_DURATION_SEC = 3
TITLE_FONT = cc.FontType.特黑体
SUBTITLE_FONT = cc.FontType.悠然体

ACTIVE_COLOR = (1.0, 1.0, 1.0)
CONTEXT_COLOR = (0.53, 0.53, 0.53)
ACTIVE_SIZE = 7.0
CONTEXT_SIZE = 5.5
SUBTITLE_Y_CENTER = -0.70
SUBTITLE_LINE_SPACING = 0.12


def parse_srt(srt_path: str) -> List[Dict]:
    """Parse an SRT file into a list of {start, end, text} dicts (times in seconds)."""
    with open(srt_path, "r", encoding="utf-8") as f:
        content = f.read()
    blocks = re.split(r"\n\s*\n", content.strip())
    segments = []
    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 3:
            continue
        m = re.match(
            r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})",
            lines[1].strip(),
        )
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        start = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000.0
        end = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000.0
        text = "\n".join(line.rstrip() for line in lines[2:]).strip()
        if text:
            segments.append({"start": start, "end": end, "text": text})
    return segments


def detect_capcut_drafts_folder() -> Optional[str]:
    for path in CAPCUT_DRAFTS_CANDIDATES:
        if os.path.isdir(path):
            return path
    return None


def _get_video_duration_us(video_path: str) -> int:
    """Get video duration in microseconds via pycapcut's VideoMaterial."""
    mat = cc.VideoMaterial(video_path)
    return mat.duration


def generate_capcut_draft(
    video_path: str,
    srt_path: str,
    title_text: str = "",
    draft_name: str = "",
    sfx_dir: str = "",
    capcut_drafts_folder: str = "",
    width: int = 1080,
    height: int = 1920,
) -> str:
    """Generate a CapCut draft project with video, subtitles, title, and SFX.

    Returns the path to the generated draft folder.
    """
    if not title_text:
        title_text = f"献哥AI报道 {datetime.now().strftime('%Y.%m.%d')}"
    if not draft_name:
        draft_name = f"AI_news_{datetime.now().strftime('%Y%m%d')}"
    if not sfx_dir:
        sfx_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "sfx")
    if not capcut_drafts_folder:
        capcut_drafts_folder = detect_capcut_drafts_folder()
        if not capcut_drafts_folder:
            raise FileNotFoundError(
                "Could not auto-detect CapCut drafts folder. "
                "Pass --drafts-folder or set it in CapCut: Settings > Global Settings > Draft Folder."
            )

    video_path = os.path.abspath(video_path)
    srt_path = os.path.abspath(srt_path)

    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")
    if not os.path.isfile(srt_path):
        raise FileNotFoundError(f"SRT not found: {srt_path}")

    log.info("Creating CapCut draft '%s' in %s", draft_name, capcut_drafts_folder)

    draft_folder = cc.DraftFolder(capcut_drafts_folder)
    script = draft_folder.create_draft(draft_name, width, height, allow_replace=True)

    video_duration_us = _get_video_duration_us(video_path)
    title_dur_us = TITLE_DURATION_SEC * SEC

    # --- Tracks ---
    script.add_track(cc.TrackType.video, "main_video")
    script.add_track(cc.TrackType.text, "title")
    script.add_track(cc.TrackType.text, "sub_active", relative_index=1)
    script.add_track(cc.TrackType.audio, "sfx")

    # --- Main video ---
    video_seg = cc.VideoSegment(
        video_path,
        trange(0, video_duration_us),
    )
    script.add_segment(video_seg, "main_video")
    log.info("  Added video track: %s (%.1fs)", os.path.basename(video_path), video_duration_us / SEC)

    # --- Title card ---
    title_seg = cc.TextSegment(
        title_text,
        trange(0, title_dur_us),
        font=TITLE_FONT,
        style=cc.TextStyle(
            size=12.0,
            bold=True,
            color=(1.0, 1.0, 1.0),
            align=1,
        ),
        clip_settings=cc.ClipSettings(transform_y=0.0),
        border=cc.TextBorder(color=(0.0, 0.0, 0.0), width=50.0, alpha=0.8),
    )
    title_seg.add_animation(cc.TextIntro.渐显)
    title_seg.add_animation(cc.TextOutro.渐隐, duration=tim("0.5s"))
    script.add_segment(title_seg, "title")
    log.info("  Added title card: '%s' (%.1fs)", title_text, TITLE_DURATION_SEC)

    # --- Subtitles: single-line display ---
    srt_segments = parse_srt(srt_path)
    y_active = SUBTITLE_Y_CENTER

    for seg in srt_segments:
        start_us = int(seg["start"] * SEC)
        dur_us = int((seg["end"] - seg["start"]) * SEC)
        if dur_us <= 0:
            continue

        active_seg = cc.TextSegment(
            seg["text"],
            trange(start_us, dur_us),
            font=SUBTITLE_FONT,
            style=cc.TextStyle(size=ACTIVE_SIZE, bold=True, color=ACTIVE_COLOR, align=1),
            clip_settings=cc.ClipSettings(transform_y=y_active),
            border=cc.TextBorder(color=(0.0, 0.0, 0.0), width=40.0, alpha=0.6),
        )
        script.add_segment(active_seg, "sub_active")

    log.info("  Added single-line subtitles: %d segments from %s",
             len(srt_segments), os.path.basename(srt_path))

    # --- Sound effects ---
    sfx_files = {
        "intro": os.path.join(sfx_dir, "intro.mp3"),
        "title": os.path.join(sfx_dir, "title.mp3"),
        "whoosh": os.path.join(sfx_dir, "whoosh.mp3"),
    }

    sfx_added = 0
    if os.path.isfile(sfx_files["intro"]):
        intro_mat = cc.AudioMaterial(sfx_files["intro"])
        intro_seg = cc.AudioSegment(intro_mat, trange(0, intro_mat.duration), volume=0.8)
        intro_seg.add_fade(tim("0.5s"), tim("0.5s"))
        script.add_segment(intro_seg, "sfx")
        sfx_added += 1
        log.info("  Added intro jingle (%.1fs)", intro_mat.duration / SEC)

    if os.path.isfile(sfx_files["title"]):
        title_sfx_mat = cc.AudioMaterial(sfx_files["title"])
        title_sfx_seg = cc.AudioSegment(
            title_sfx_mat,
            trange(0, title_sfx_mat.duration),
            volume=0.7,
        )
        script.add_segment(title_sfx_seg, "sfx")
        sfx_added += 1
        log.info("  Added title sound (%.1fs)", title_sfx_mat.duration / SEC)

    if os.path.isfile(sfx_files["whoosh"]):
        whoosh_mat = cc.AudioMaterial(sfx_files["whoosh"])
        whoosh_seg = cc.AudioSegment(
            whoosh_mat,
            trange(title_dur_us, whoosh_mat.duration),
            volume=0.6,
        )
        script.add_segment(whoosh_seg, "sfx")
        sfx_added += 1
        log.info("  Added whoosh at title end (%.1fs)", whoosh_mat.duration / SEC)

    if sfx_added == 0:
        log.info("  No SFX files found in %s (skipped)", sfx_dir)

    # --- Save ---
    script.save()
    draft_path = os.path.join(capcut_drafts_folder, draft_name)
    log.info("Draft saved: %s", draft_path)
    log.info("Open CapCut and look for draft '%s' (you may need to restart CapCut to see it).", draft_name)

    return draft_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate a CapCut draft from video + SRT + sound effects."
    )
    parser.add_argument("video", help="Path to the video file")
    parser.add_argument("srt", help="Path to the .srt subtitle file")
    parser.add_argument("--title", default="", help="Title card text")
    parser.add_argument("--draft-name", default="", help="Draft project name")
    parser.add_argument("--sfx-dir", default="", help="Directory with SFX mp3 files")
    parser.add_argument("--drafts-folder", default="", help="CapCut drafts folder path")
    parser.add_argument("--width", type=int, default=1080, help="Video width (default: 1080)")
    parser.add_argument("--height", type=int, default=1920, help="Video height (default: 1920)")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    generate_capcut_draft(
        video_path=args.video,
        srt_path=args.srt,
        title_text=args.title,
        draft_name=args.draft_name,
        sfx_dir=args.sfx_dir,
        capcut_drafts_folder=args.drafts_folder,
        width=args.width,
        height=args.height,
    )


if __name__ == "__main__":
    main()
