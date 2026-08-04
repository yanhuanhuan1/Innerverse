// 无限画布前端构建：核心/分块压缩 + Lucide 精简 + 内容 hash + 清单
// 用法：node build.mjs
import { build } from 'esbuild';
import * as lucide from 'lucide';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const JS_DIR = path.join(ROOT, 'static', 'js');
const BUILD_DIR = path.join(JS_DIR, 'build');
const CSS_DIR = path.join(ROOT, 'static', 'css');

fs.rmSync(BUILD_DIR, { recursive: true, force: true });
fs.mkdirSync(BUILD_DIR, { recursive: true });

function hash(content){
  return crypto.createHash('sha1').update(content).digest('hex').slice(0, 12);
}

function topLevelDecls(src){
  const funcs = new Set();
  const lets = new Set();
  const consts = new Set();
  for(const line of src.split('\n')){
    let m = line.match(/^let\s+([A-Za-z_$][\w$]*)/);
    if(m && !line.startsWith(' ') && !line.startsWith('\t')) lets.add(m[1]);
    m = line.match(/^var\s+([A-Za-z_$][\w$]*)/);
    if(m && !line.startsWith(' ') && !line.startsWith('\t')) lets.add(m[1]);
    m = line.match(/^const\s+([A-Za-z_$][\w$]*)/);
    if(m && !line.startsWith(' ') && !line.startsWith('\t')) consts.add(m[1]);
    m = line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/);
    if(m && !line.startsWith(' ') && !line.startsWith('\t')) funcs.add(m[1]);
  }
  const skip = new Set(['window','document','console','localStorage','sessionStorage','performance','navigator','fetch','crypto']);
  return {
    funcs: [...funcs].filter(n => !skip.has(n)),
    lets: [...lets].filter(n => !skip.has(n)),
    consts: [...consts].filter(n => !skip.has(n)),
  };
}

function exposureFooter(src){
  const { funcs, lets, consts } = topLevelDecls(src);
  const lines = funcs.map(n => `window.${n} = ${n};`);
  for(const n of lets){
    // let/var 可能被核心重新赋值（nodes/canvas/...），用 get/set 访问器保持同步
    lines.push(
      `Object.defineProperty(window, ${JSON.stringify(n)}, { configurable: true, enumerable: true, get(){ return ${n}; }, set(v){ ${n} = v; } });`
    );
  }
  for(const n of consts){
    lines.push(
      `Object.defineProperty(window, ${JSON.stringify(n)}, { configurable: true, enumerable: true, get(){ return ${n}; } });`
    );
  }
  return lines.join('\n') + '\n';
}

async function minifyFile(logicalName, sourcePath){
  const src = fs.readFileSync(sourcePath, 'utf8');
  const footer = exposureFooter(src);
  const result = await build({
    stdin: { contents: src + '\n' + footer, sourcefile: logicalName + '.js', loader: 'js' },
    write: false,
    minify: true,
    format: 'iife',
    target: ['es2018'],
    logLevel: 'warning',
  });
  const code = result.outputFiles[0].text;
  // 生产页面不暴露源码映射
  const clean = code.replace(/\/\/# sourceMappingURL=[^\n]*\n?/g, '');
  const h = hash(clean);
  const fileName = `${logicalName}-${h}.js`;
  fs.writeFileSync(path.join(BUILD_DIR, fileName), clean);
  fs.writeFileSync(path.join(BUILD_DIR, logicalName + '.js'), clean); // 非 hash 副本，供无清单回退/调试
  return { fileName, size: clean.length, rawSize: src.length };
}

// ---------- 1) Lucide 精简 ----------
function kebab(name){
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
const allIconNames = new Set(Object.keys(lucide.icons).map(kebab));
const LEGACY_ICON_ALIASES = {
  'minimize-2': 'minimize',
  'grid-3x3': 'grid',
  'undo-2': 'undo',
  'redo-2': 'redo',
  'trash-2': 'trash',
  'file-plus-2': 'file-plus',
  'settings-2': 'settings',
  'dice-5': 'dices',
};
const usedIcons = new Set();
const staticIconNames = new Set();
const scanFiles = [
  'static/canvas.html',
  'static/js/canvas.js',
  'static/js/canvas-logs.js',
  'static/js/canvas-lightbox.js',
  'static/js/canvas-export.js',
  'static/js/canvas-workflows.js',
  'static/js/canvas-node-renderers.js',
  'static/js/canvas-media.js',
];
for(const rel of scanFiles){
  const p = path.join(ROOT, rel);
  if(!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  for(const m of text.matchAll(/data-lucide="([^"\s]+)"/g)){
    const name = m[1];
    if(name && !name.includes('$') && !name.includes('{') && !name.includes('}')){
      staticIconNames.add(name.toLowerCase());
      usedIcons.add(name.toLowerCase());
    }
  }
  for(const m of text.matchAll(/'([A-Za-z0-9-]+)'|"([A-Za-z0-9-]+)"/g)){
    const name = m[1] || m[2];
    const lowered = String(name).toLowerCase();
    if(allIconNames.has(lowered)) usedIcons.add(lowered);
  }
}
// 动态图标兜底集合（画布节点/面板中由变量传入的常见图标）
for(const name of ['sparkles','image-up','zap','box','workflow','play-square','image','clapperboard','file-text','file','video','mic','music','layout-grid','more-horizontal','chevron-up','pause','maximize','minimize','scan','loader','loader-2','sun','moon','rotate-cw','rotate-ccw','undo','redo','move','grip-vertical','copy','check','plus','x','download','upload','trash-2','settings','refresh-cw','play','image-off','images','arrow-right','arrow-left','eye','link','type','film','square','circle','chevron-down']){
  if(allIconNames.has(name)) usedIcons.add(name);
}

function pascal(name){
  return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
// 旧名 → 新名：按新名取数据，同时注册旧名与别名
const iconData = new Map(); // pascalName -> 元素数组
const iconRegs = new Map(); // pascalName -> [注册名...]
const missingStatic = [...staticIconNames].filter(n => !allIconNames.has(n));
console.log('static icons total:', staticIconNames.size, 'missing in lucide package:', JSON.stringify(missingStatic));
for(const name of usedIcons){
  const target = LEGACY_ICON_ALIASES[name] || name;
  const pascalName = pascal(target);
  const data = lucide.icons[pascalName];
  if(!data){
    console.warn('icon data missing:', name, '->', target, '->', pascalName);
    continue;
  }
  iconData.set(pascalName, data);
  if(!iconRegs.has(pascalName)) iconRegs.set(pascalName, []);
  const list = iconRegs.get(pascalName);
  if(!list.includes(name)) list.push(name);
}
const iconObj = {};
for(const [pascalName, names] of iconRegs){
  for(const n of names) iconObj[n] = iconData.get(pascalName);
}
const lucideImpl = `
(function(){
  var ICONS = ${JSON.stringify(iconObj)};
  function pascal(name){ return String(name).replace(/^([a-z0-9])|[\\s-]+(\\w)/g, function(_, a, b){ return b ? b.toUpperCase() : a.toUpperCase(); }); }
  function createSvg(tag, attrs, children){
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for(var k in attrs){ el.setAttribute(k, String(attrs[k])); }
    if(children && children.length){
      for(var i = 0; i < children.length; i++){
        var child = children[i];
        if(Array.isArray(child)) el.appendChild(createSvg(child[0], child[1] || {}, child[2] || []));
      }
    }
    return el;
  }
  function createIcons(opts){
    opts = opts || {};
    var nameAttr = opts.nameAttr || 'data-lucide';
    var icons = opts.icons || ICONS;
    var attrs = opts.attrs || {};
    var base = { xmlns:'http://www.w3.org/2000/svg', width:24, height:24, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':2, 'stroke-linecap':'round', 'stroke-linejoin':'round' };
    var elements = document.querySelectorAll('[' + nameAttr + ']');
    var result = [];
    Array.prototype.forEach.call(elements, function(el){
      var name = el.getAttribute(nameAttr);
      if(name == null) return;
      var p = pascal(name);
      var data = icons[p] || icons[name];
      if(!data){ console.warn('lucide icon not found: ' + name); return; }
      var elAttrs = {};
      Array.prototype.forEach.call(el.attributes, function(a){ elAttrs[a.name] = a.value; });
      var hasAria = false;
      for(var k in elAttrs){ if(k.indexOf('aria-') === 0 || k === 'role' || k === 'title'){ hasAria = true; break; } }
      var merged = {};
      for(var k2 in base) merged[k2] = base[k2];
      merged['data-lucide'] = name;
      if(!hasAria) merged['aria-hidden'] = 'true';
      for(var k3 in attrs) merged[k3] = attrs[k3];
      for(var k4 in elAttrs) merged[k4] = elAttrs[k4];
      var cls = ['lucide', 'lucide-' + name];
      if(el.getAttribute('class')) cls.push(el.getAttribute('class'));
      if(opts.attrs && opts.attrs.class) cls.push(opts.attrs.class);
      merged['class'] = cls.join(' ');
      var svg = createSvg('svg', merged, data);
      el.parentNode && el.parentNode.replaceChild(svg, el);
      result.push(svg);
    });
    return result;
  }
  window.lucide = { createIcons: createIcons, icons: ICONS };
})();
`;
const lucideCode = lucideImpl;
const lucideHash = hash(lucideCode);
const lucideFile = `lucide-slim-${lucideHash}.js`;
fs.writeFileSync(path.join(BUILD_DIR, lucideFile), lucideCode);
fs.writeFileSync(path.join(BUILD_DIR, 'lucide-slim.js'), lucideCode);
console.log('lucide icons used:', usedIcons.size, 'size:', lucideCode.length);

// ---------- 2) 核心与分块 ----------
const core = await minifyFile('canvas-core', path.join(JS_DIR, 'canvas.js'));
const chunks = {};
for(const name of ['canvas-logs', 'canvas-lightbox', 'canvas-export', 'canvas-workflows', 'canvas-node-renderers', 'canvas-media']){
  chunks[name] = await minifyFile(name, path.join(JS_DIR, name + '.js'));
}

// ---------- 3) 清单 ----------
const manifest = {
  core: core.fileName,
  lucide: lucideFile,
  chunks: Object.fromEntries(Object.entries(chunks).map(([k, v]) => [k, v.fileName])),
};
const manifestCode = `window.CANVAS_BUILD = ${JSON.stringify(manifest)};\n`;
fs.writeFileSync(path.join(BUILD_DIR, 'manifest.js'), manifestCode);

// ---------- 4) 更新 canvas.html 引用 ----------
const htmlPath = path.join(ROOT, 'static', 'canvas.html');
let html = fs.readFileSync(htmlPath, 'utf8');
// 移除旧的 build 引用（容忍 ?v= 后缀），再插入当前产物
html = html.replace(/<script defer src="\/static\/(?:vendor\/js\/lucide\.js|js\/build\/lucide-slim-[^"']+)(\?v=[^"']*)?"?><\/script>/, '');
html = html.replace(/<script src="\/static\/js\/build\/manifest\.js(\?v=[^"']*)?"?><\/script>/, '');
html = html.replace(/<script defer src="\/static\/js\/build\/canvas-core-[^"']+(\?v=[^"']*)?"?><\/script>/, '');
html = html.replace(/<script defer src="\/static\/js\/canvas\.js(\?v=[^"']*)?"?><\/script>/, '');
const lucideTag = `    <script defer src="/static/js/build/${lucideFile}"></script>`;
const coreTags = `    <script src="/static/js/build/manifest.js"></script>\n    <script defer src="/static/js/build/${core.fileName}"></script>`;
// 插到 </head> 前（保持 CSS 之后）
html = html.replace('</head>', `${lucideTag}\n${coreTags}\n</head>`);
html = html.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
fs.writeFileSync(htmlPath, html);

console.log('=== BUILD RESULT ===');
console.log('lucide:', lucideFile, lucideCode.length + 'B');
console.log('core:', core.fileName, core.size + 'B (raw ' + core.rawSize + 'B)');
for(const [k, v] of Object.entries(chunks)){
  console.log(k + ':', v.fileName, v.size + 'B (raw ' + v.rawSize + 'B)');
}
console.log('manifest:', JSON.stringify(manifest));
