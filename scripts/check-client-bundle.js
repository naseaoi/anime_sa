import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distDir = path.join(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const initialScripts = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)]
  .map((match) => match[1]);
const forbidden = ['react-dp', 'CardEditModal', 'publicDataMutationService'];

for (const marker of forbidden) {
  if (initialScripts.some((file) => file.includes(marker))) {
    throw new Error(`Initial bundle unexpectedly includes ${marker}`);
  }
}

const gzipBytes = initialScripts.reduce((total, file) => {
  const bytes = fs.readFileSync(path.join(distDir, file));
  return total + zlib.gzipSync(bytes).length;
}, 0);

const maxInitialGzipBytes = 100 * 1024;
if (gzipBytes > maxInitialGzipBytes) {
  throw new Error(`Initial JavaScript exceeds ${maxInitialGzipBytes} gzip bytes: ${gzipBytes}`);
}

console.log(`Initial JavaScript: ${(gzipBytes / 1024).toFixed(2)} KiB gzip`);
