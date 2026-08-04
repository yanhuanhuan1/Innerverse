import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = fs.readFileSync(path.join(ROOT, 'static', 'js', 'canvas.js'), 'utf8');
const lines = SRC.split('\n');

const starts = [];
const declRe = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/;
const letRe = /^(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*[=;]/;
lines.forEach((line, i) => {
    const f = declRe.exec(line);
    if(f) starts.push({ name: 'fn ' + f[1], line: i });
    else {
        const l = letRe.exec(line);
        if(l && !line.startsWith(' ') && !line.startsWith('\t')) starts.push({ name: 'var ' + l[1], line: i });
    }
});

const blocks = [];
for(let i = 0; i < starts.length; i++){
    const start = starts[i];
    const endLine = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    const bytes = lines.slice(start.line, endLine).join('\n').length;
    blocks.push({ name: start.name, bytes });
}
blocks.sort((a, b) => b.bytes - a.bytes);

const total = SRC.length;
console.log(`canvas.js total: ${total}B (${(total / 1024).toFixed(1)}KB), top-level blocks: ${blocks.length}`);
console.log('\nTop 45 blocks by source size:');
for(const b of blocks.slice(0, 45)){
    console.log(`  ${String(b.bytes).padStart(7)}B  ${(b.bytes / total * 100).toFixed(1).padStart(5)}%  ${b.name}`);
}
