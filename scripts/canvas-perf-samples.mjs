// 建立大型画布性能样本并测量 API 响应大小 / 耗时（本地运行，需服务已启动）
const BASE = process.argv[2] || 'http://127.0.0.1:3000';

function makeNodes(n, kind){
    const nodes = [];
    for(let i = 0; i < n; i++){
        const x = (i % 40) * 320;
        const y = Math.floor(i / 40) * 260;
        if(kind === 'text'){
            nodes.push({ id: `p_${i}`, type: 'prompt', x, y, text: 'sample prompt ' + i });
        } else if(kind === 'image'){
            nodes.push({ id: `i_${i}`, type: 'image', x, y, url: '/assets/input/ai_ref_4cb27bfd4e53.jpg', name: 'img', mediaKind: 'image' });
        } else if(kind === 'video'){
            nodes.push({ id: `v_${i}`, type: 'video', x, y, prompt: 'video ' + i, apiProvider: 'apimart', model: 'wan2.6', duration: 5, aspectRatio: '16:9', generatedOutputs: [] });
        } else {
            const t = i % 3;
            if(t === 0) nodes.push({ id: `p_${i}`, type: 'prompt', x, y, text: 'mixed ' + i });
            else if(t === 1) nodes.push({ id: `i_${i}`, type: 'image', x, y, url: '/assets/input/ai_ref_4cb27bfd4e53.jpg', name: 'img', mediaKind: 'image' });
            else nodes.push({ id: `v_${i}`, type: 'video', x, y, prompt: 'video ' + i, apiProvider: 'apimart', model: 'wan2.6', duration: 5, aspectRatio: '16:9', generatedOutputs: [] });
        }
    }
    return nodes;
}

function makeConnections(nodes){
    const conns = [];
    for(let i = 1; i < nodes.length; i++){
        if(i % 3 === 0) continue;
        conns.push({ id: `c_${i}`, from: nodes[i - 1].id, to: nodes[i].id });
    }
    return conns;
}

async function measure(sample){
    const { label, nodes, connections } = sample;
    const create = await fetch(BASE + '/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'perf-sample-' + label, icon: 'layers', kind: 'classic', project: 'default' }),
    });
    const created = await create.json();
    const cid = created.canvas.id;
    const payload = {
        title: 'perf-sample-' + label,
        icon: 'layers',
        kind: 'classic',
        nodes,
        connections,
        viewport: { x: 0, y: 0, scale: 1 },
        logs: [],
        settings: {},
        base_updated_at: Number(created.canvas.updated_at || 0),
    };
    const bodyStr = JSON.stringify(payload);
    const t0 = performance.now();
    const put = await fetch(BASE + '/api/canvases/' + cid, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
    });
    const putMs = performance.now() - t0;
    const putOk = put.ok;
    const t1 = performance.now();
    const get = await fetch(BASE + '/api/canvases/' + cid);
    const text = await get.text();
    const getMs = performance.now() - t1;
    const t2 = performance.now();
    JSON.parse(text);
    const parseMs = performance.now() - t2;
    console.log([
        label.padEnd(10),
        String(nodes.length).padStart(5),
        String(connections.length).padStart(5),
        String(bodyStr.length).padStart(9) + 'B',
        String(getMs.toFixed(0)).padStart(6) + 'ms',
        String(parseMs.toFixed(1)).padStart(7) + 'ms',
        String(putMs.toFixed(0)).padStart(6) + 'ms',
        putOk ? 'OK' : 'PUT-FAIL',
    ].join(' | '));
}

console.log('label      nodes  conns     PUT-body    GET     parse     PUT');
const sizes = [
    ['20-text', 20, 'text'],
    ['20-mixed', 20, 'mixed'],
    ['100-mixed', 100, 'mixed'],
    ['300-mixed', 300, 'mixed'],
    ['800-text', 800, 'text'],
    ['800-mixed', 800, 'mixed'],
];
for(const [label, n, kind] of sizes){
    const nodes = makeNodes(n, kind);
    const connections = makeConnections(nodes);
    await measure({ label, nodes, connections });
}
