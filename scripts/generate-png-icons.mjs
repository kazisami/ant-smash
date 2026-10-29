import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4);
  data.copy(buf, 8);
  const crcTarget = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(crcTarget), 8 + len);
  return buf;
}

function createPng(width, height, getPixelRGBA) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter method 0
  ihdrData[12] = 0; // No interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // Raw scanlines with filter byte 0
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRGBA(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', deflated);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Color helpers
function drawAntIcon(x, y, w, h, isMaskable) {
  // Normalize to 0..1
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5;
  const cy = 0.5;
  const dx = nx - cx;
  const dy = ny - cy;
  const distCenter = Math.sqrt(dx * dx + dy * dy);

  // Background gradient: bright joyful yellow/amber
  let bgR = 254;
  let bgG = 240 - ny * 80;
  let bgB = 138 - ny * 80;

  if (!isMaskable) {
    // Rounded squircle check
    const cornerR = 0.22;
    const clampedX = Math.abs(dx) - (0.5 - cornerR);
    const clampedY = Math.abs(dy) - (0.5 - cornerR);
    if (clampedX > 0 && clampedY > 0) {
      const cDist = Math.sqrt(clampedX * clampedX + clampedY * clampedY);
      if (cDist > cornerR) {
        return [0, 0, 0, 0]; // Transparent outside squircle
      }
    }
  }

  // Red cartoon splat splash in the background
  const angle = Math.atan2(dy, dx);
  const petal = 0.28 + 0.08 * Math.sin(angle * 5) + 0.04 * Math.cos(angle * 3);
  if (distCenter < petal) {
    // Splat gradient pink/red
    return [244, 63, 94, 255];
  }

  // Head (circle at 0.5, 0.35)
  const dHead = Math.hypot(nx - 0.5, ny - 0.36);
  if (dHead < 0.075) {
    // Cute big eyes
    const eyeLeftDist = Math.hypot(nx - 0.47, ny - 0.34);
    const eyeRightDist = Math.hypot(nx - 0.53, ny - 0.34);
    if (eyeLeftDist < 0.03 || eyeRightDist < 0.03) {
      const pupilL = Math.hypot(nx - 0.47, ny - 0.34);
      const pupilR = Math.hypot(nx - 0.53, ny - 0.34);
      if (pupilL < 0.015 || pupilR < 0.015) {
        return [30, 14, 4, 255]; // Pupil
      }
      return [255, 255, 255, 255]; // Eye white
    }
    return [69, 26, 3, 255]; // Head brown
  }

  // Thorax (ellipse at 0.5, 0.49)
  const dThorax = Math.hypot((nx - 0.5) * 1.2, (ny - 0.49) * 1.5);
  if (dThorax < 0.08) {
    return [69, 26, 3, 255];
  }

  // Abdomen (larger ellipse at 0.5, 0.65)
  const dAbdomen = Math.hypot((nx - 0.5) * 1.1, (ny - 0.65) * 0.9);
  if (dAbdomen < 0.12) {
    return [45, 15, 2, 255];
  }

  // Antennas
  const leftAnt = Math.hypot(nx - 0.42, ny - 0.22);
  const rightAnt = Math.hypot(nx - 0.58, ny - 0.22);
  if (leftAnt < 0.02 || rightAnt < 0.02) {
    return [245, 158, 11, 255]; // Amber tips
  }

  // Default background
  return [Math.round(bgR), Math.round(bgG), Math.round(bgB), 255];
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. pwa-192x192.png
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), createPng(192, 192, (x, y, w, h) => drawAntIcon(x, y, w, h, false)));

// 2. pwa-512x512.png
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), createPng(512, 512, (x, y, w, h) => drawAntIcon(x, y, w, h, false)));

// 3. pwa-maskable-512x512.png
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), createPng(512, 512, (x, y, w, h) => drawAntIcon(x, y, w, h, true)));

// 4. apple-touch-icon.png (180x180)
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), createPng(180, 180, (x, y, w, h) => drawAntIcon(x, y, w, h, false)));

// 5. favicon.ico (32x32 PNG)
fs.writeFileSync(path.join(outDir, 'favicon.ico'), createPng(32, 32, (x, y, w, h) => drawAntIcon(x, y, w, h, false)));

console.log('Successfully generated all PWA icons!');
