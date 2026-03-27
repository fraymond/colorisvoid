#!/usr/bin/env python3
"""
render_title_card_video: Create a styled cover image and prepend it as a short
title-card intro to an existing portrait video.

Default behavior:
- Uses the video's first frame as the background
- Renders a top title and a bottom UTC date
- Prepends a 0.5s intro clip before the source video
- Writes cover/check images next to the source video

Example:
  python scripts/render_title_card_video.py \
    "/Users/rfu/Documents/AI_news_post/foo_processed.MOV" \
    --title "献哥每日AI播报"
"""

from __future__ import annotations

import argparse
import logging
import os
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError as exc:  # pragma: no cover - runtime guidance
    raise SystemExit(
        "Pillow is required. Install it in the Python environment used to run this script."
    ) from exc


log = logging.getLogger("title-card")

TITLE_FONT_CANDIDATES = [
    os.path.expanduser("~/Library/Fonts/ZCOOLKuaiLe-Regular.ttf"),
    os.path.expanduser("~/Library/Fonts/WenYuanRoundedSCVF.otf"),
    os.path.expanduser("~/Library/Fonts/NotoSansCJKsc-Bold.otf"),
    "/System/Library/Fonts/STHeiti Medium.ttc",
]

DATE_FONT_CANDIDATES = [
    os.path.expanduser("~/Library/Fonts/ZCOOLKuaiLe-Regular.ttf"),
    os.path.expanduser("~/Library/Fonts/WenYuanRoundedSCVF.otf"),
    os.path.expanduser("~/Library/Fonts/NotoSansCJKsc-Bold.otf"),
    "/System/Library/Fonts/STHeiti Medium.ttc",
]


@dataclass
class RenderPaths:
    first_frame: Path
    cover_image: Path
    intro_clip: Path
    final_video: Path
    check_frame: Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a cover image and prepend a short title-card intro."
    )
    parser.add_argument("video", help="Absolute path to the source video")
    parser.add_argument("--title", default="献哥每日AI播报", help="Top title text")
    parser.add_argument(
        "--date-text",
        default="",
        help="Explicit date text. If omitted, generated from UTC time.",
    )
    parser.add_argument(
        "--date-source",
        choices=["file-mtime", "now"],
        default="file-mtime",
        help="UTC date source when --date-text is omitted",
    )
    parser.add_argument(
        "--date-template",
        default="{year}年{month}月{day}日",
        help="Template for generated date text",
    )
    parser.add_argument(
        "--title-font",
        default="",
        help="Override title font path",
    )
    parser.add_argument(
        "--date-font",
        default="",
        help="Override date font path",
    )
    parser.add_argument(
        "--title-y-ratio",
        type=float,
        default=0.25,
        help="Vertical center ratio for the title text",
    )
    parser.add_argument(
        "--date-y-ratio",
        type=float,
        default=0.75,
        help="Vertical center ratio for the date text",
    )
    parser.add_argument(
        "--intro-duration",
        type=float,
        default=0.5,
        help="Intro duration in seconds",
    )
    parser.add_argument(
        "--name-suffix",
        default="cover_v5",
        help="Suffix used for generated filenames",
    )
    parser.add_argument(
        "--output",
        default="",
        help="Optional explicit output video path",
    )
    return parser.parse_args()


def resolve_font(override: str, candidates: list[str], label: str) -> str:
    if override:
        if not os.path.isfile(override):
            raise FileNotFoundError(f"{label} font not found: {override}")
        return override

    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate

    raise FileNotFoundError(f"No usable {label} font found")


def build_paths(
    video_path: Path,
    suffix: str,
    output: str,
    artifact_base_path: Optional[Path] = None,
) -> RenderPaths:
    base = (artifact_base_path or video_path).with_suffix("")
    first_frame = base.with_name(f"{base.name}_firstframe.png")
    cover_image = base.with_name(f"{base.name}_{suffix}.png")
    intro_clip = base.with_name(f"{base.name}_{suffix}_0p5.mp4")
    final_video = Path(output) if output else base.with_name(f"{base.name}_{suffix}_0p5.mov")
    check_frame = base.with_name(f"{base.name}_check_{suffix}_0s.png")
    return RenderPaths(
        first_frame=first_frame,
        cover_image=cover_image,
        intro_clip=intro_clip,
        final_video=final_video,
        check_frame=check_frame,
    )


def utc_date_for_video(video_path: Path, source: str) -> datetime:
    if source == "now":
        return datetime.now(timezone.utc)
    return datetime.fromtimestamp(video_path.stat().st_mtime, tz=timezone.utc)


def format_date_text(video_path: Path, explicit: str, source: str, template: str) -> str:
    if explicit:
        return explicit
    dt = utc_date_for_video(video_path, source)
    return template.format(year=dt.year, month=dt.month, day=dt.day)


def run_ffmpeg(command: list[str]) -> None:
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        if stderr:
            log.error("ffmpeg failed: %s", stderr[-1200:])
        raise


def extract_first_frame(video_path: Path, output_path: Path) -> None:
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "0",
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            str(output_path),
        ]
    )


def draw_text_layer(
    base: Image.Image,
    text: str,
    font_path: str,
    font_size: int,
    center_y: int,
    fill: str,
    stroke_fill: str,
    stroke_width: int,
    shadow_fill: tuple[int, int, int, int],
    shadow_offset: tuple[int, int],
) -> Image.Image:
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    font = ImageFont.truetype(font_path, font_size)
    bbox = draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (base.size[0] - text_w) / 2
    y = center_y - text_h / 2

    draw.text(
        (x + shadow_offset[0], y + shadow_offset[1]),
        text,
        font=font,
        fill=shadow_fill,
        stroke_width=stroke_width,
        stroke_fill=shadow_fill,
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=max(2, stroke_width // 2)))
    draw = ImageDraw.Draw(overlay)
    draw.text(
        (x, y),
        text,
        font=font,
        fill=fill,
        stroke_width=stroke_width,
        stroke_fill=stroke_fill,
    )
    return Image.alpha_composite(base, overlay)


def render_cover_image(
    first_frame: Path,
    output_path: Path,
    title_text: str,
    date_text: str,
    title_font_path: str,
    date_font_path: str,
    title_y_ratio: float,
    date_y_ratio: float,
) -> None:
    image = Image.open(first_frame).convert("RGBA")
    _, height = image.size

    image = draw_text_layer(
        image,
        text=title_text,
        font_path=title_font_path,
        font_size=int(height * 0.075),
        center_y=int(height * title_y_ratio),
        fill="#F6E7A8",
        stroke_fill="#1E1E1E",
        stroke_width=max(6, int(height * 0.004)),
        shadow_fill=(0, 0, 0, 180),
        shadow_offset=(0, max(6, int(height * 0.006))),
    )
    image = draw_text_layer(
        image,
        text=date_text,
        font_path=date_font_path,
        font_size=int(height * 0.052),
        center_y=int(height * date_y_ratio),
        fill="#FF6B5A",
        stroke_fill="#FFFFFF",
        stroke_width=max(4, int(height * 0.003)),
        shadow_fill=(0, 0, 0, 100),
        shadow_offset=(0, max(4, int(height * 0.004))),
    )
    image.convert("RGB").save(output_path)


def create_intro_clip(cover_image: Path, output_path: Path, duration: float) -> None:
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-t",
            str(duration),
            "-i",
            str(cover_image),
            "-f",
            "lavfi",
            "-t",
            str(duration),
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-shortest",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            str(output_path),
        ]
    )


def prepend_intro(intro_clip: Path, video_path: Path, output_path: Path) -> None:
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(intro_clip),
            "-i",
            str(video_path),
            "-filter_complex",
            "[0:v:0][0:a:0][1:v:0][1:a:0]concat=n=2:v=1:a=1[v][a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-video_track_timescale",
            "30000",
            str(output_path),
        ]
    )


def extract_check_frame(video_path: Path, output_path: Path) -> None:
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-ss",
            "0",
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            str(output_path),
        ]
    )


def render_title_card_video(
    video_path: str | Path,
    title_text: str = "献哥每日AI播报",
    date_text: str = "",
    date_source: str = "file-mtime",
    date_template: str = "{year}年{month}月{day}日",
    title_font: str = "",
    date_font: str = "",
    title_y_ratio: float = 0.25,
    date_y_ratio: float = 0.75,
    intro_duration: float = 0.5,
    name_suffix: str = "cover_v5",
    output_path: str = "",
    artifact_base_path: str | Path | None = None,
) -> RenderPaths:
    source_path = Path(video_path).expanduser().resolve()
    if not source_path.is_file():
        raise FileNotFoundError(f"Video not found: {source_path}")

    artifact_base = None
    if artifact_base_path:
        artifact_base = Path(artifact_base_path).expanduser().resolve()

    paths = build_paths(source_path, name_suffix, output_path, artifact_base)
    paths.final_video.parent.mkdir(parents=True, exist_ok=True)

    title_font_path = resolve_font(title_font, TITLE_FONT_CANDIDATES, "title")
    date_font_path = resolve_font(date_font, DATE_FONT_CANDIDATES, "date")
    formatted_date = format_date_text(source_path, date_text, date_source, date_template)

    log.info("Source video: %s", source_path)
    log.info("Title text: %s", title_text)
    log.info("Date text: %s", formatted_date)
    log.info("Title font: %s", title_font_path)
    log.info("Date font: %s", date_font_path)

    extract_first_frame(source_path, paths.first_frame)
    log.info("First frame: %s", paths.first_frame)

    render_cover_image(
        first_frame=paths.first_frame,
        output_path=paths.cover_image,
        title_text=title_text,
        date_text=formatted_date,
        title_font_path=title_font_path,
        date_font_path=date_font_path,
        title_y_ratio=title_y_ratio,
        date_y_ratio=date_y_ratio,
    )
    log.info("Cover image: %s", paths.cover_image)

    create_intro_clip(paths.cover_image, paths.intro_clip, intro_duration)
    log.info("Intro clip: %s", paths.intro_clip)

    prepend_intro(paths.intro_clip, source_path, paths.final_video)
    log.info("Final video: %s", paths.final_video)

    extract_check_frame(paths.final_video, paths.check_frame)
    log.info("Check frame: %s", paths.check_frame)
    return paths


def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    render_title_card_video(
        video_path=args.video,
        title_text=args.title,
        date_text=args.date_text,
        date_source=args.date_source,
        date_template=args.date_template,
        title_font=args.title_font,
        date_font=args.date_font,
        title_y_ratio=args.title_y_ratio,
        date_y_ratio=args.date_y_ratio,
        intro_duration=args.intro_duration,
        name_suffix=args.name_suffix,
        output_path=args.output,
    )


if __name__ == "__main__":
    main()
