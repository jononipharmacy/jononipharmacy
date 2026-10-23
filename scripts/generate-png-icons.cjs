const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height) {
  // RGBA buffer with filter byte per line
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.22;
  const crossWidth = width * 0.16;
  const crossLength = width * 0.55;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Base background: #0f7a4a (15, 122, 74)
      let r = 15;
      let g = 122;
      let b = 74;
      let a = 255;

      // Check if within rounded rect bounds (safe corner clipping)
      const cornerR = width * 0.22;
      let inCorner = false;
      const cornerDists = [
        [cornerR, cornerR],
        [width - cornerR, cornerR],
        [cornerR, height - cornerR],
        [width - cornerR, height - cornerR]
      ];

      for (const [ccx, ccy] of cornerDists) {
        if ((x < ccx || x > ccx) && (y < ccy || y > ccy)) {
          const dx = Math.abs(x - ccx);
          const dy = Math.abs(y - ccy);
          if (x < cornerR && y < cornerR && dx*dx + dy*dy > cornerR*cornerR) inCorner = true;
          if (x > width - cornerR && y < cornerR && dx*dx + dy*dy > cornerR*cornerR) inCorner = true;
          if (x < cornerR && y > height - cornerR && dx*dx + dy*dy > cornerR*cornerR) inCorner = true;
          if (x > width - cornerR && y > height - cornerR && dx*dx + dy*dy > cornerR*cornerR) inCorner = true;
        }
      }

      if (inCorner) {
        a = 0;
      } else {
        // Draw Medical Cross:
        const inVert = Math.abs(x - cx) <= crossWidth / 2 && Math.abs(y - cy) <= crossLength / 2;
        const inHoriz = Math.abs(y - cy) <= crossWidth / 2 && Math.abs(x - cx) <= crossLength / 2;

        if (inVert || inHoriz) {
          // White cross
          r = 255;
          g = 255;
          b = 255;

          // Tiny center emerald dot/heart
          const dc = Math.hypot(x - cx, y - cy);
          if (dc <= width * 0.05) {
            r = 15;
            g = 122;
            b = 74;
          }
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress IDAT
  const compressedData = zlib.deflateSync(rawData);

  // CRC32 calculation
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);

    const crcBuf = Buffer.alloc(4);
    const toCrc = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 13 bytes
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), createPng(192, 192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), createPng(512, 512));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), createPng(180, 180));
console.log('Successfully generated PNG icons in icons/');
