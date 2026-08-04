import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'static', 'js', 'build');
const CANVAS_HTML = path.join(ROOT, 'static', 'canvas.html');
const errors = [];

const manifestRaw = fs.readFileSync(path.join(BUILD, 'manifest.js'), 'utf8');
const match = /window\.CANVAS_BUILD\s*=\s*(\{.*?\});/.exec(manifestRaw);
if(!match){
    console.error('BUILD CONSISTENCY FAILED: manifest.js missing or invalid');
    process.exit(1);
}
const manifest = JSON.parse(match[1]);
if(!manifest.buildId) errors.push('manifest missing buildId');

const referenced = new Set(['manifest.js']);
const allFiles = [manifest.core, manifest.lucide, ...Object.values(manifest.chunks || {})].filter(Boolean);
for(const name of allFiles){
    referenced.add(name);
    const file = path.join(BUILD, name);
    if(!fs.existsSync(file)){
        errors.push(`missing build file: ${name}`);
        continue;
    }
    const m2 = /^(.*)-([0-9a-f]{12})\.js$/.exec(name);
    if(!m2){
        errors.push(`build file not content-hashed: ${name}`);
        continue;
    }
    const content = fs.readFileSync(file);
    const hash = crypto.createHash('sha1').update(content).digest('hex').slice(0, 12);
    if(hash !== m2[2]) errors.push(`hash mismatch for ${name}: expected ${m2[2]}, got ${hash}`);
}

for(const file of fs.readdirSync(BUILD)){
    if(/^[a-z0-9-]+-[0-9a-f]{12}\.js$/.test(file) && !referenced.has(file)){
        errors.push(`orphan build file not referenced by manifest: ${file}`);
    }
}

const html = fs.readFileSync(CANVAS_HTML, 'utf8');
if(!html.includes(manifest.core)) errors.push(`canvas.html missing core reference: ${manifest.core}`);
if(!html.includes(manifest.lucide)) errors.push(`canvas.html missing lucide reference: ${manifest.lucide}`);
if(/\/static\/js\/build\/manifest\.js/.test(html)) errors.push('canvas.html still loads runtime manifest.js');
const inlineMatch = /window\.CANVAS_BUILD\s*=\s*(\{.*?\});/.exec(html);
if(!inlineMatch){
    errors.push('canvas.html missing inline CANVAS_BUILD config');
} else {
    try {
        const inline = JSON.parse(inlineMatch[1]);
        if(inline.buildId !== manifest.buildId) errors.push('canvas.html inline buildId mismatch');
        const chunkNames = Object.keys(manifest.chunks || {});
        for(const name of chunkNames){
            if(inline.chunks?.[name] !== manifest.chunks[name]) errors.push(`canvas.html inline chunk mapping mismatch: ${name}`);
        }
    } catch(e){
        errors.push('canvas.html inline CANVAS_BUILD unparseable');
    }
}

if(errors.length){
    console.error('BUILD CONSISTENCY FAILED:');
    for(const e of errors) console.error('  - ' + e);
    process.exit(1);
}
console.log('BUILD CONSISTENCY OK  buildId=' + manifest.buildId);
for(const name of allFiles){
    console.log(`  ${name}  ${fs.statSync(path.join(BUILD, name)).size}B`);
}
