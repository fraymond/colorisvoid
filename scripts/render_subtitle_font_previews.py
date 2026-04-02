#!/usr/bin/env python3
"""
Render static subtitle font previews from the latest processed AI news video.

Default behavior:
- Uses the newest *_processed video in ~/Documents/AI_news_processed
- Tries to reuse a subtitle line from the matching .srt file
- Outputs one preview image per font plus a contact sheet for quick comparison
"""

from __future__ import annotations

import argparse
import math
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Tuple

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:  # pragma: no cover - runtime guidance
    raise SystemExit(
        "Pillow is required. Install it in the Python environment used to run this script."
    ) from exc


OUT_DIR = Path("~/Documents/AI_news_processed").expanduser()
PREVIEW_DIR = OUT_DIR / "subtitle_font_previews"
VIDEO_EXTS = {".mp4", ".mov", ".MP4", ".MOV"}
DEFAULT_SAMPLE_TEXT = "Agent 会写代码了，但成本和速度，还是两笔很现实的账。"
DEFAULT_LABEL_COLOR = "#F8E27A"
SUBTITLE_BOX_STYLES = {
    "wenyuan": {
        "fill": (210, 192, 120, 108),
        "radius": 22,
        "padding_x": 26,
        "padding_y": 16,
    },
    "zcool": {
        "fill": (102, 128, 158, 112),
        "radius": 22,
        "padding_x": 28,
        "padding_y": 18,
    },
}

SUBTITLE_FONT_CANDIDATES: Dict[str, List[str]] = {
    "wenyuan": [
        os.path.expanduser("~/Library/Fonts/WenYuanRoundedSCVF.otf"),
        "/System/Library/Fonts/STHeiti Medium.ttc",
    ],
    "zcool": [
        os.path.expanduser("~/Library/Fonts/ZCOOLKuaiLe-Regular.ttf"),
        os.path.expanduser("~/Library/Fonts/WenYuanRoundedSCVF.otf"),
        "/System/Library/Fonts/STHeiti Medium.ttc",
    ],
    "noto": [
        os.path.expanduser("~/Library/Fonts/NotoSansCJKsc-Bold.otf"),
        os.path.expanduser("~/Library/Fonts/WenYuanRoundedSCVF.otf"),
        "/System/Library/Fonts/STHeiti Medium.ttc",
    ],
    "stheiti": [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        os.path.expanduser("~/Library/Fonts/WenYuanRoundedSCVF.otf"),
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render several static subtitle font previews."
    )
    parser.add_argument(
        "video",
        nargs="?",
        default="",
        help="Optional absolute path to a processed video. Defaults to the latest one.",
    )
    parser.add_argument(
        "--sample-text",
        default="",
        help="Optional custom subtitle sample text.",
    )
    return parser.parse_args()


def latest_processed_video() -> Path:
    videos = [
        path
        for path in OUT_DIR.iterdir()
        if path.is_file() and path.suffix in VIDEO_EXTS and "_processed" in path.stem
    ]
    if not videos:
        raise FileNotFoundError(f"No processed videos found in {OUT_DIR}")
    return max(videos, key=lambda item: item.stat().st_mtime)


def matching_srt_path(video_path: Path) -> Path | None:
    stem = video_path.stem
    if stem.endswith("_processed"):
        stem = stem[: -len("_processed")]
    candidate = OUT_DIR / f"{stem}.srt"
    return candidate if candidate.is_file() else None


def preview_background_video(video_path: Path) -> Path:
    stem = video_path.stem
    if stem.endswith("_processed"):
        original_stem = stem[: -len("_processed")]
        exact = video_path.with_name(f"{original_stem}{video_path.suffix}")
        if exact.is_file():
            return exact
        for ext in VIDEO_EXTS:
            candidate = OUT_DIR / f"{original_stem}{ext}"
            if candidate.is_file():
                return candidate
    return video_path


def pick_sample_text(video_path: Path, override: str) -> str:
    if override.strip():
        return override.strip()

    srt_path = matching_srt_path(video_path)
    if srt_path:
        text_lines: List[str] = []
        with srt_path.open("r", encoding="utf-8") as handle:
            for raw_line in handle:
                line = raw_line.strip()
                if (
                    not line
                    or line.isdigit()
                    or "-->" in line
                    or re.fullmatch(r"\d{2}:\d{2}:\d{2},\d{3}", line)
                ):
                    continue
                text_lines.append(line)

        candidates = [
            line
            for line in text_lines
            if 10 <= len(line) <= 34 and not line.startswith("#")
        ]
        if candidates:
            return max(candidates, key=len)
        if text_lines:
            return max(text_lines, key=len)

    return DEFAULT_SAMPLE_TEXT


def ffprobe_duration(video_path: Path) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    return float((result.stdout or "0").strip() or "0")


def extract_frame(video_path: Path) -> Path:
    duration = max(ffprobe_duration(video_path), 0.0)
    timestamp = min(max(duration * 0.25, 1.0), max(duration - 0.2, 1.0))
    fd, tmp_name = tempfile.mkstemp(prefix="subtitle_preview_", suffix=".png")
    os.close(fd)
    frame_path = Path(tmp_name)

    command = [
        "ffmpeg",
        "-y",
        "-ss",
        f"{timestamp:.2f}",
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        str(frame_path),
    ]
    subprocess.run(command, capture_output=True, text=True, check=True)
    return frame_path


def resolve_font(style_name: str) -> Tuple[str, str]:
    candidates = SUBTITLE_FONT_CANDIDATES[style_name]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return style_name, candidate
    raise FileNotFoundError(f"No usable font found for style {style_name}: {candidates}")


def load_font(font_path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path, size=size)


def fit_font_size(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_path: str,
    image_width: int,
    image_height: int,
) -> int:
    max_width = int(image_width * 0.86)
    size = max(36, int(image_height * 0.042))
    while size > 24:
        bbox = draw.textbbox((0, 0), text, font=load_font(font_path, size))
        width = bbox[2] - bbox[0]
        if width <= max_width:
            return size
        size -= 2
    return 24


def draw_subtitle_preview(
    background_path: Path,
    sample_text: str,
    style_name: str,
    font_path: str,
    output_path: Path,
) -> None:
    image = Image.open(background_path).convert("RGBA")
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    width, height = image.size

    gradient_height = int(height * 0.34)
    for idx in range(gradient_height):
        alpha = int(180 * (idx / max(gradient_height, 1)))
        y = height - gradient_height + idx
        draw.rectangle((0, y, width, y + 1), fill=(0, 0, 0, alpha))

    font_size = fit_font_size(draw, sample_text, font_path, width, height)
    subtitle_font = load_font(font_path, font_size)
    text_bbox = draw.textbbox((0, 0), sample_text, font=subtitle_font, stroke_width=2)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    text_x = (width - text_width) / 2
    text_y = height * 0.72 - text_height / 2

    box_style = SUBTITLE_BOX_STYLES.get(style_name)
    if box_style:
        padding_x = box_style["padding_x"]
        padding_y = box_style["padding_y"]
        box = (
            text_x - padding_x,
            text_y - padding_y,
            text_x + text_width + padding_x,
            text_y + text_height + padding_y,
        )
        draw.rounded_rectangle(
            box,
            radius=box_style["radius"],
            fill=box_style["fill"],
        )

    draw.text(
        (text_x, text_y),
        sample_text,
        font=subtitle_font,
        fill="#FFFFFF",
        stroke_width=2,
        stroke_fill="black",
    )

    label_font = load_font(font_path, max(28, int(font_size * 0.46)))
    label = f"{style_name} | {Path(font_path).stem}"
    label_bbox = draw.textbbox((0, 0), label, font=label_font, stroke_width=1)
    label_padding_x = 18
    label_padding_y = 12
    label_box = (
        28,
        28,
        28 + (label_bbox[2] - label_bbox[0]) + label_padding_x * 2,
        28 + (label_bbox[3] - label_bbox[1]) + label_padding_y * 2,
    )
    draw.rounded_rectangle(label_box, radius=18, fill=(0, 0, 0, 150))
    draw.text(
        (label_box[0] + label_padding_x, label_box[1] + label_padding_y),
        label,
        font=label_font,
        fill=DEFAULT_LABEL_COLOR,
        stroke_width=1,
        stroke_fill="black",
    )

    composed = Image.alpha_composite(image, overlay).convert("RGB")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    composed.save(output_path, quality=95)


def build_contact_sheet(image_paths: List[Path], output_path: Path) -> None:
    images = [Image.open(path).convert("RGB") for path in image_paths]
    if not images:
        return

    columns = 2
    rows = math.ceil(len(images) / columns)
    tile_width, tile_height = images[0].size
    gap = 24
    canvas = Image.new(
        "RGB",
        (
            columns * tile_width + gap * (columns + 1),
            rows * tile_height + gap * (rows + 1),
        ),
        color=(18, 18, 18),
    )

    for index, image in enumerate(images):
        row = index // columns
        col = index % columns
        x = gap + col * (tile_width + gap)
        y = gap + row * (tile_height + gap)
        canvas.paste(image, (x, y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, quality=95)


def main() -> None:
    args = parse_args()
    video_path = Path(args.video).expanduser() if args.video else latest_processed_video()
    if not video_path.is_file():
        raise FileNotFoundError(f"Video not found: {video_path}")
    background_video = preview_background_video(video_path)

    sample_text = pick_sample_text(video_path, args.sample_text)
    preview_root = PREVIEW_DIR / video_path.stem
    preview_root.mkdir(parents=True, exist_ok=True)

    frame_path = extract_frame(background_video)
    output_paths: List[Path] = []
    try:
        for style_name in SUBTITLE_FONT_CANDIDATES:
            try:
                _, font_path = resolve_font(style_name)
            except FileNotFoundError:
                continue

            output_path = preview_root / f"{video_path.stem}__subtitle_preview_{style_name}.png"
            draw_subtitle_preview(
                background_path=frame_path,
                sample_text=sample_text,
                style_name=style_name,
                font_path=font_path,
                output_path=output_path,
            )
            output_paths.append(output_path)
            print(output_path)

        if output_paths:
            contact_sheet_path = preview_root / f"{video_path.stem}__subtitle_preview_grid.png"
            build_contact_sheet(output_paths, contact_sheet_path)
            print(contact_sheet_path)
        else:
            raise FileNotFoundError("No preview images were generated because no fonts were available.")
    finally:
        if frame_path.exists():
            frame_path.unlink()


if __name__ == "__main__":
    main()
