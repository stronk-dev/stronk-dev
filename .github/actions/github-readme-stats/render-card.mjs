import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Minimal harness to execute the upstream API handlers and capture their SVG output.

const sourceDir = process.env.GRS_SOURCE_DIR;
const options = process.env.GRS_OPTIONS || '';
const card = (process.env.GRS_CARD || 'stats').trim();
const outputPathInput = (process.env.GRS_OUTPUT_PATH || '').trim();

if (!sourceDir || !fs.existsSync(sourceDir)) {
  throw new Error('Missing github-readme-stats source directory');
}

if (!options) {
  throw new Error('`options` input is required');
}

const moduleMap = {
  stats: 'api/index.js',
  'top-langs': 'api/top-langs.js',
  repo: 'api/pin.js',
  wakatime: 'api/wakatime.js',
};

if (!moduleMap[card]) {
  throw new Error(`Unsupported card type: ${card}`);
}

const params = new URLSearchParams(options);
const query = Object.fromEntries(params.entries());

const handlerModulePath = path.join(sourceDir, moduleMap[card]);
const handlerModuleUrl = pathToFileURL(handlerModulePath).href;
const { default: handler } = await import(handlerModuleUrl);

const invokeHandler = (queryParams) => {
  return new Promise((resolve, reject) => {
    const res = {
      headers: {},
      statusCode: 200,
      setHeader(key, value) {
        this.headers[key.toLowerCase()] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(payload) {
        resolve(typeof payload === 'string' ? payload : String(payload));
      },
    };

    const req = { query: queryParams };

    Promise.resolve(handler(req, res)).catch(reject);
  });
};

const svg = await invokeHandler(query);

const outputPath = outputPathInput || `grs/${card}.svg`;
const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
fs.writeFileSync(resolvedOutputPath, svg, 'utf8');

console.log(`Wrote card to ${resolvedOutputPath}`);
