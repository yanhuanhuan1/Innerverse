import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const requireKey = args.has('--require-key');
const baseUrl = String(process.env.APIMART_BASE_URL || readEnvValue('APIMART_BASE_URL') || 'https://api.apimart.ai').replace(/\/+$/, '');
const apiKey = process.env.APIMART_API_KEY || readEnvValue('APIMART_API_KEY') || '';
const upstreamTimeoutMs = Number(process.env.APIMART_AUDIT_TIMEOUT_MS || readEnvValue('APIMART_AUDIT_TIMEOUT_MS') || 45000);
const upstreamModelsJson = process.env.APIMART_MODELS_JSON || readEnvValue('APIMART_MODELS_JSON') || '';
const upstreamModelsFile = process.env.APIMART_MODELS_FILE || readEnvValue('APIMART_MODELS_FILE') || '';
let upstreamUnavailable = false;

function readEnvValue(key){
  for(const name of ['.env.local', '.env']){
    const file = path.join(root, name);
    if(!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for(const line of lines){
      if(!line || /^\s*#/.test(line)) continue;
      const idx = line.indexOf('=');
      if(idx < 0) continue;
      const k = line.slice(0, idx).trim();
      if(k !== key) continue;
      return line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return '';
}

function parseJsArrayLiteral(text){
  const jsonish = `[${text}]`
    .replace(/\/\/.*$/gm, '')
    .replace(/'/g, '"')
    .replace(/,\s*]/g, ']');
  return JSON.parse(jsonish);
}

function extractConstArray(file, name){
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const match = text.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if(!match) return [];
  try {
    return parseJsArrayLiteral(match[1]).map(String);
  } catch(err) {
    throw new Error(`Failed to parse ${name} in ${file}: ${err.message}`);
  }
}

function unique(list){
  return [...new Set((list || []).map(item => String(item || '').trim()).filter(Boolean))];
}

function classifyModel(id){
  const lc = String(id || '').toLowerCase();
  const videoKeys = ['veo', 'sora', 'wan2', 'wanx', 'doubao-seedance', 'kling', 'hailuo', 'video', 't2v-', 'i2v-', 's2v', 'pixverse', 'vidu', 'skyreels', 'happyhorse'];
  if(videoKeys.some(key => lc.includes(key))) return 'video';
  const imageKeys = ['banana', 'image', 'dalle', 'dall-e', 'imagen', 'flux', 'stable', 'sdxl', 'midjourney', 'ideogram', 'z-image', 'qwen-image', 'seedream', 'text-to-image', 'image-to-image', 'grok-imagine-1'];
  if(imageKeys.some(key => lc.includes(key))) return 'image';
  return 'chat';
}

function modelsFromPayload(body){
  const items = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : Array.isArray(body?.list) ? body.list : Array.isArray(body) ? body : [];
  return unique(items.map(item => typeof item === 'string' ? item : item?.id || item?.name || item?.model));
}

function parseOfflineModels(){
  const source = upstreamModelsJson || (upstreamModelsFile ? fs.readFileSync(path.resolve(root, upstreamModelsFile), 'utf8') : '');
  if(!source) return null;
  try {
    return modelsFromPayload(JSON.parse(source));
  } catch(err) {
    throw new Error(`Failed to parse APIMART_MODELS_JSON/APIMART_MODELS_FILE: ${err.message}`);
  }
}

function curlConfigQuote(value){
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '');
}

function fetchUpstreamModelsWithCurl(url){
  const config = [
    'silent',
    'show-error',
    `url = "${curlConfigQuote(url)}"`,
    'request = "GET"',
    `header = "Authorization: Bearer ${curlConfigQuote(apiKey)}"`,
    'header = "Accept: application/json"',
    'write-out = "\\n%{http_code}"',
  ].join('\n');
  const result = spawnSync('curl.exe', ['--config', '-'], {
    cwd: root,
    input: config,
    encoding: 'utf8',
    timeout: upstreamTimeoutMs,
    windowsHide: true,
  });
  const combined = `${result.stdout || ''}${result.stderr || ''}`;
  if(result.error){
    throw result.error;
  }
  if(result.status !== 0){
    throw new Error((combined || `curl exited with ${result.status}`).slice(0, 700));
  }
  const trimmed = String(result.stdout || '').trimEnd();
  const match = trimmed.match(/^(.*)\n(\d{3})$/s);
  if(!match){
    throw new Error(`curl returned an unexpected response: ${trimmed.slice(0, 700)}`);
  }
  const bodyText = match[1];
  const status = Number(match[2]);
  if(status < 200 || status >= 300){
    throw new Error(`/v1/models failed through curl: HTTP ${status} ${bodyText.slice(0, 500)}`);
  }
  try {
    return modelsFromPayload(JSON.parse(bodyText || '{}'));
  } catch(err) {
    throw new Error(`curl returned non-JSON from /v1/models: ${err.message}; body=${bodyText.slice(0, 500)}`);
  }
}

async function fetchUpstreamModels(){
  const offlineModels = parseOfflineModels();
  if(offlineModels){
    console.log('\nLoaded APIMart upstream models from APIMART_MODELS_JSON/APIMART_MODELS_FILE.');
    return offlineModels;
  }
  if(!apiKey){
    if(requireKey){
      console.error('APIMART_API_KEY is required for upstream model audit.');
      process.exitCode = 2;
    }
    return null;
  }
  const url = `${baseUrl}/v1/models`;
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(upstreamTimeoutMs),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
  } catch(err) {
    try {
      console.error('\nNode fetch could not reach APIMart; retrying once with curl.exe so Windows proxy settings can be used...');
      return fetchUpstreamModelsWithCurl(url);
    } catch(curlErr) {
    upstreamUnavailable = true;
    const code = err?.cause?.code || err?.code || err?.name || 'NETWORK_ERROR';
    const message = err?.cause?.message || err?.message || String(err);
    console.error(`\nAPIMart /v1/models is unreachable: ${code}`);
    console.error(`URL: ${url}`);
    console.error(`Reason: ${message}`);
    console.error('\nThis is a network/connectivity problem, not an API key validation result.');
    console.error('Try from the same PowerShell session:');
    console.error('  Test-NetConnection api.apimart.ai -Port 443');
    console.error('  curl.exe -I https://api.apimart.ai/v1/models');
    console.error('\nIf your browser uses a proxy, set HTTPS_PROXY/HTTP_PROXY before running this audit.');
    console.error(`curl fallback also failed: ${curlErr?.message || curlErr}`);
    process.exitCode = 3;
    return null;
    }
  }
  const text = await res.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 500) }; }
  if(!res.ok){
    throw new Error(`/v1/models failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  return modelsFromPayload(body);
}

function printList(title, values){
  console.log(`\n${title} (${values.length})`);
  if(!values.length){
    console.log('  - none');
    return;
  }
  for(const item of values) console.log(`  - ${item}`);
}

function escapeRegExp(value){
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const forbiddenLegacyModels = [
  'veo2',
  'veo2-fast',
  'veo2-pro',
  'wan2.2-t2v-plus',
  'wan2.2-i2v-plus',
  'wan2.2-i2v-flash',
  'doubao-seedance-1-0-lite-t2v-250428',
  'doubao-seedance-1-0-lite-i2v-250428',
  'doubao-seedream-4-5',
  'doubao-seedream-4-0',
  'qwen-image-2',
  'grok-imagine-1.5',
  'claude-sonnet-4.5',
  'claude-opus-4.1',
  'doubao-seedance-1.5-pro',
  'doubao-seedance-1.0-pro',
  'kling-v2.6',
  'vidu-q3-pro',
  'vidu-q3-turbo',
  'vidu-q3-mix',
  'vidu-q3-standard',
  'grok-imagine-video',
  'omni-flash-ext',
];
const forbiddenScanFiles = [
  'main.py',
  'static/js/api-settings.js',
  'static/js/canvas.js',
  'static/js/canvas-node-renderers.js',
];

const backend = {
  image: extractConstArray('main.py', 'APIMART_DEFAULT_IMAGE_MODELS'),
  chat: extractConstArray('main.py', 'APIMART_DEFAULT_CHAT_MODELS'),
  video: extractConstArray('main.py', 'APIMART_DEFAULT_VIDEO_MODELS'),
};
const apiSettings = {
  image: extractConstArray('static/js/api-settings.js', 'APIMART_DEFAULT_IMAGE_MODELS'),
  chat: extractConstArray('static/js/api-settings.js', 'APIMART_DEFAULT_CHAT_MODELS'),
  video: extractConstArray('static/js/api-settings.js', 'APIMART_DEFAULT_VIDEO_MODELS'),
};
const canvasVideoFallback = extractConstArray('static/js/canvas.js', 'DEFAULT_VIDEO_MODELS');

let failed = false;
for(const type of ['image', 'chat', 'video']){
  const backendSet = new Set(backend[type]);
  const uiMissing = apiSettings[type].filter(item => !backendSet.has(item));
  const uiExtra = backend[type].filter(item => !apiSettings[type].includes(item));
  if(uiMissing.length || uiExtra.length){
    failed = true;
    printList(`UI ${type} models not in backend defaults`, uiMissing);
    printList(`Backend ${type} models missing from API settings UI`, uiExtra);
  }
}
const canvasVideoMissing = canvasVideoFallback.filter(item => !backend.video.includes(item));
const canvasVideoExtra = backend.video.filter(item => !canvasVideoFallback.includes(item));
if(canvasVideoMissing.length || canvasVideoExtra.length){
  failed = true;
  printList('Canvas fallback video models not in backend defaults', canvasVideoMissing);
  printList('Backend video models missing from canvas fallback', canvasVideoExtra);
}

for(const file of forbiddenScanFiles){
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const found = forbiddenLegacyModels.filter(model => new RegExp(`['"]${escapeRegExp(model)}['"]`).test(text));
  if(found.length){
    failed = true;
    printList(`Forbidden legacy model ids found in ${file}`, found);
  }
}

const upstream = await fetchUpstreamModels();
if(upstream){
  const upstreamSet = new Set(upstream);
  console.log(`\nAPIMart upstream models: ${upstream.length}`);
  for(const type of ['image', 'chat', 'video']){
    const missing = backend[type].filter(item => !upstreamSet.has(item));
    printList(`Configured ${type} models missing from APIMart /v1/models`, missing);
    if(missing.length) failed = true;
  }
  const grouped = { image: [], chat: [], video: [] };
  upstream.forEach(id => grouped[classifyModel(id)].push(id));
  printList('Upstream image models', grouped.image);
  printList('Upstream chat models', grouped.chat);
  printList('Upstream video models', grouped.video);
}

if(!apiKey){
  console.log('\nNo APIMART_API_KEY found locally; skipped upstream /v1/models check. This static audit does not consume credits.');
}
if(failed) process.exitCode = 1;
if(upstreamUnavailable){
  console.error('\nAPIMart model audit could not verify upstream models because the network request failed.');
} else if(!failed) {
  console.log('\nAPIMart model audit passed.');
}
