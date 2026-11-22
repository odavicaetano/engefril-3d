// Gera favicon.ico, PNGs (16, 32, 180, 192, 512 e maskable) a partir de public/favicon.svg
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg');
const out = 'public/';
const png = (size, file, bg) =>
  sharp(svg, { density: 1200 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten(bg ? { background: bg } : false)
    .png()
    .toBuffer()
    .then((b) => (file && writeFileSync(out + file, b), b));

const p16 = await png(16, 'favicon-16x16.png');
const p32 = await png(32, 'favicon-32x32.png');
const p48 = await png(48);
await png(192, 'icon-192.png');
await png(512, 'icon-512.png');
// apple-touch e maskable: fundo branco com margem de segurança (80%)
const padded = async (size, file) => {
  const inner = await sharp(svg, { density: 1200 }).resize(Math.round(size * 0.7), Math.round(size * 0.7), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const b = await sharp({ create: { width: size, height: size, channels: 4, background: '#ffffff' } }).composite([{ input: inner, gravity: 'center' }]).png().toBuffer();
  writeFileSync(out + file, b);
};
await padded(180, 'apple-touch-icon.png');
await padded(512, 'icon-maskable-512.png');

// ICO com PNGs embutidos (16, 32, 48)
const imgs = [[16, p16], [32, p32], [48, p48]];
const header = Buffer.alloc(6 + 16 * imgs.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(imgs.length, 4);
let offset = header.length;
imgs.forEach(([s, b], i) => {
  const o = 6 + 16 * i;
  header.writeUInt8(s, o); header.writeUInt8(s, o + 1); header.writeUInt8(0, o + 2); header.writeUInt8(0, o + 3);
  header.writeUInt16LE(1, o + 4); header.writeUInt16LE(32, o + 6);
  header.writeUInt32LE(b.length, o + 8); header.writeUInt32LE(offset, o + 12);
  offset += b.length;
});
writeFileSync(out + 'favicon.ico', Buffer.concat([header, ...imgs.map((x) => x[1])]));
console.log('ícones gerados');
