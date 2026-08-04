import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const failures = [];

const manifestRaw = fs.readFileSync(path.join(ROOT, 'static', 'js', 'build', 'manifest.js'), 'utf8');
const match = /window\.CANVAS_BUILD\s*=\s*(\{.*?\});/.exec(manifestRaw);
if(!match){
    console.error('SMOKE FAILED: local manifest missing');
    process.exit(1);
}
const manifest = JSON.parse(match[1]);

const checks = [
    { name: 'home', url: '/', notImmutable: true },
    { name: 'canvas.html', url: '/static/canvas.html', notImmutable: true },
    { name: 'health', url: '/api/health' },
    { name: 'warmup', url: '/api/warmup' },
    { name: 'manifest', url: '/static/js/build/manifest.js' },
    { name: 'core', url: '/static/js/build/' + manifest.core, immutable: true },
    { name: 'lucide', url: '/static/js/build/' + manifest.lucide, immutable: true },
    ...Object.entries(manifest.chunks || {}).map(([k, v]) => ({
        name: 'chunk-' + k,
        url: '/static/js/build/' + v,
        immutable: true,
    })),
];

async function run(c){
    try {
        const res = await fetch(BASE + c.url, { redirect: 'follow' });
        const cc = res.headers.get('cache-control') || '';
        let ok = res.status === 200;
        if(c.immutable && !/immutable/i.test(cc)){ ok = false; failures.push(`${c.name} missing immutable cache-control: ${cc}`); }
        if(c.notImmutable && /immutable/i.test(cc)){ ok = false; failures.push(`${c.name} HTML marked immutable`); }
        console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name} ${res.status} cc=${cc || '-'}`);
    } catch(e){
        failures.push(`${c.name} error: ${e.message}`);
        console.log(`FAIL ${c.name} ${e.message}`);
    }
}

for(const c of checks) await run(c);

try {
    const range = await fetch(BASE + '/static/js/build/' + manifest.core, { headers: { Range: 'bytes=0-99' } });
    console.log(`RANGE core ${range.status}`);
    if(![200, 206].includes(range.status)) failures.push(`range request unexpected status ${range.status}`);
} catch(e){
    failures.push('range check error: ' + e.message);
}

if(failures.length){
    console.error('\nSMOKE FAILED:');
    for(const f of failures) console.error('  - ' + f);
    process.exit(1);
}
console.log('\nSMOKE OK');
