// Tiny real files for upload tests: PocketBase checks the content type from the bytes.
import { deflateSync } from 'node:zlib';

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A valid PNG of `size`×`size` pink pixels, optionally padded to reach `minBytes`. */
export function png(size = 8, minBytes = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0xd8)]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)));
  const parts = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
  ];
  const current = parts.reduce((total, part) => total + part.length, 0) + 12;
  if (minBytes > current) {
    // Ancillary chunk that viewers ignore, used only to make the file bigger.
    parts.push(chunk('teXt', Buffer.alloc(minBytes - current - 12, 0x20)));
  }
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/** Bytes that start like an MP4 (or QuickTime) video, padded to `bytes`. */
export function video(bytes = 1024, brand = 'mp42') {
  const file = Buffer.alloc(Math.max(bytes, 32));
  file.writeUInt32BE(24, 0);
  file.write('ftyp', 4);
  file.write(brand, 8);
  file.write(brand, 16);
  file.write('isom', 20);
  return file;
}
