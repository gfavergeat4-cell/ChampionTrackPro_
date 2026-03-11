/**
 * generate-badge-slider.js
 * Creates public/icons/badge-72.png — white slider icon on transparent background.
 * Canvas 72×72, PNG-24 with alpha. For Android PWA status bar badge.
 */
const sharp = require('sharp');
const path = require('path');

// ── Geometry ──────────────────────────────────────────────────────────────────
// Canvas: 72×72
// Track: horizontal pill, 60% of canvas width (43px), 6px tall, centred vertically
// Thumb: circle r=11 at ~62% along the track, overlapping the track
const CANVAS   = 72;
const TRACK_W  = 44;              // 61% of canvas
const TRACK_H  = 6;
const TRACK_X  = (CANVAS - TRACK_W) / 2;          // 14
const TRACK_Y  = (CANVAS - TRACK_H) / 2;          // 33
const TRACK_RX = TRACK_H / 2;                     // 3  — pill ends
const THUMB_R  = 11;
// thumb at ~62% of track from left → matches logo's right-of-centre position
const THUMB_CX = Math.round(TRACK_X + TRACK_W * 0.62);   // 41
const THUMB_CY = Math.round(CANVAS / 2);                  // 36

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}">
  <!-- Track -->
  <rect
    x="${TRACK_X}" y="${TRACK_Y}"
    width="${TRACK_W}" height="${TRACK_H}"
    rx="${TRACK_RX}" ry="${TRACK_RX}"
    fill="#FFFFFF"
  />
  <!-- Thumb -->
  <circle cx="${THUMB_CX}" cy="${THUMB_CY}" r="${THUMB_R}" fill="#FFFFFF"/>
</svg>`;

const outPath = path.join(__dirname, '..', 'public', 'icons', 'badge-72.png');

sharp(Buffer.from(svg))
  .png()
  .toFile(outPath)
  .then(info => {
    console.log(`✔  badge-72.png written — ${info.width}×${info.height}px, ${info.size} bytes`);
    console.log(`   Path: ${outPath}`);
    console.log(`   Track: x=${TRACK_X} y=${TRACK_Y} w=${TRACK_W} h=${TRACK_H} rx=${TRACK_RX}`);
    console.log(`   Thumb: cx=${THUMB_CX} cy=${THUMB_CY} r=${THUMB_R}`);
  })
  .catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
