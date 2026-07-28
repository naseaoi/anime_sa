import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distDir = path.join(process.cwd(), 'dist');
const compressibleExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.webmanifest', '.xml']);
const minimumBytes = 1024;

const collectFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const entryPath = path.join(directory, entry.name);
  return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
});

let generated = 0;
let sourceBytes = 0;
let compressedBytes = 0;

for (const filePath of collectFiles(distDir)) {
  if (!compressibleExtensions.has(path.extname(filePath))) continue;
  const source = fs.readFileSync(filePath);
  if (source.length < minimumBytes) continue;

  const variants = [
    ['.gz', zlib.gzipSync(source, { level: 9 })],
    ['.br', zlib.brotliCompressSync(source, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 }
    })]
  ];

  for (const [suffix, output] of variants) {
    if (output.length >= source.length) continue;
    fs.writeFileSync(`${filePath}${suffix}`, output);
    generated += 1;
    sourceBytes += source.length;
    compressedBytes += output.length;
  }
}

console.log(`Precompressed ${generated} files: ${sourceBytes} -> ${compressedBytes} bytes`);
