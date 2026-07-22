import fs from 'fs';
import path from 'path';
import { buildVercelSecurityHeaders } from '../server/core/securityHeaders.js';

const configPath = path.join(process.cwd(), 'vercel.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const expectedHeaders = buildVercelSecurityHeaders();
const headerRules = Array.isArray(config.headers) ? config.headers : [];
const ruleIndex = headerRules.findIndex((entry) => entry?.source === '/(.*)');
const currentHeaders = ruleIndex >= 0 ? headerRules[ruleIndex].headers : null;
const matches = JSON.stringify(currentHeaders) === JSON.stringify(expectedHeaders);

if (process.argv.includes('--check')) {
  if (!matches) {
    console.error('vercel.json security headers are out of date. Run npm run sync:vercel-headers.');
    process.exitCode = 1;
  }
} else if (!matches) {
  const nextRule = { source: '/(.*)', headers: expectedHeaders };
  if (ruleIndex >= 0) headerRules[ruleIndex] = nextRule;
  else headerRules.unshift(nextRule);
  config.headers = headerRules;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}
