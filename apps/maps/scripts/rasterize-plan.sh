#!/usr/bin/env bash
# Renders the Salt Palace floor-plan page (PDF page 2) to the map background.
# The venue graph uses page coordinates at 100 dpi (1700x1100); we render at 200 dpi
# for crispness, cropped to the map area x 0..1120, y 140..1100 (100-dpi units),
# and the app maps the image onto those bounds (see MAP_BOUNDS in src/venue/load.ts).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/maps
pdftoppm -f 2 -l 2 -r 200 -x 0 -y 280 -W 2240 -H 1920 -png -singlefile vendor/spcc-brochure-2021.pdf public/maps/saltpalace
echo "wrote public/maps/saltpalace.png"
