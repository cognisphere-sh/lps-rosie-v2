#!/usr/bin/env bash
# 4×2 contact sheet of a video (footage take or rendered chapter), evenly spaced.
# Usage: contact-sheet.sh <video.mp4> [out.jpg]   → then read the JPEG.
set -euo pipefail
in=$1; out=${2:-${in%.*}-sheet.jpg}
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$in")
ffmpeg -v error -y -i "$in" -vf "fps=8/$d,scale=480:-2,tile=4x2" -frames:v 1 "$out"
echo "$out"
