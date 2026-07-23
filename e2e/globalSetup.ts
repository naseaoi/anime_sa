import fs from 'node:fs';

export default function globalSetup() {
  fs.rmSync('.e2e-data', { recursive: true, force: true });
}
