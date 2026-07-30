function refreshIcons(){ if(window.lucide) lucide.createIcons(); }
function langIsEn(){ return window.StudioI18n?.lang?.() === 'en'; }
function escapeHtml(str){ return String(str == null ? '' : str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
function L(zh, en){ return langIsEn() ? en : zh; }

const promptInput = document.getElementById('homePrompt');
const promptForm = document.getElementById('promptForm');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('homeStatus');
const recentGrid = document.getElementById('recentGrid');
const homeThemeBtn = document.getElementById('homeThemeBtn');
const homeLanguageBtn = document.getElementById('homeLanguageBtn');
let currentMode = 'text';
let canvases = [];
let projects = [];
let selectedProjectId = localStorage.getItem('canvasListCurrentProjectId') || '';
let statusTimer = null;
let projectMenuProjectId = null;
let pendingDeleteProjectId = null;
let homeFocus = 'hero';
let homeWheelGate = 0;
const LOCAL_PROJECTS_KEY = 'innerverse_local_projects';
const LOCAL_CANVASES_KEY = 'innerverse_local_canvases';

function readLocalArray(key){
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value.filter(item => item && item.id) : [];
    } catch(e) {
        return [];
    }
}

function writeLocalArray(key, list){
    try { localStorage.setItem(key, JSON.stringify(list || [])); } catch(e) {}
}

function mergeById(primary=[], fallback=[]){
    const map = new Map();
    [...fallback, ...primary].forEach(item => {
        if(item?.id) map.set(item.id, {...map.get(item.id), ...item});
    });
    return [...map.values()];
}

function localId(prefix){
    const random = crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(16).slice(2)}`;
    return `${prefix}_${String(random).replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function persistLocalProject(project){
    if(!project?.id || project.id === 'default') return project;
    const list = readLocalArray(LOCAL_PROJECTS_KEY);
    const index = list.findIndex(item => item.id === project.id);
    const next = {...project, local:true};
    if(index >= 0) list[index] = {...list[index], ...next};
    else list.push(next);
    writeLocalArray(LOCAL_PROJECTS_KEY, list);
    return next;
}

function persistLocalCanvas(canvas){
    if(!canvas?.id) return canvas;
    const list = readLocalArray(LOCAL_CANVASES_KEY);
    const index = list.findIndex(item => item.id === canvas.id);
    const now = Date.now();
    const next = {
        id: canvas.id,
        title: canvas.title || L('新画布','New canvas'),
        icon: canvas.icon || 'layers',
        kind: canvas.kind || 'classic',
        project: canvas.project || 'default',
        created_at: canvas.created_at || now,
        updated_at: canvas.updated_at || now,
        node_count: Number(canvas.node_count || canvas.nodes?.length || 0),
        local:true,
        nodes: canvas.nodes || [],
        connections: canvas.connections || [],
        viewport: canvas.viewport || {x:0, y:0, scale:1},
        logs: canvas.logs || []
    };
    if(index >= 0) list[index] = {...list[index], ...next};
    else list.push(next);
    writeLocalArray(LOCAL_CANVASES_KEY, list);
    return next;
}

function createLocalProject(name){
    const now = Date.now();
    return persistLocalProject({
        id: localId('project'),
        name: (name || L('新创作项目','New creative project')).slice(0, 60),
        order: now,
        created_at: now,
        updated_at: now,
        canvas_count: 0
    });
}

function createLocalCanvas({title, projectId, mode}={}){
    const now = Date.now();
    return persistLocalCanvas({
        id: localId('canvas'),
        title: title || L('新画布','New canvas'),
        icon: mode === 'text' ? 'sparkles' : 'layers',
        kind: 'classic',
        project: projectId || 'default',
        created_at: now,
        updated_at: now,
        nodes: [],
        connections: [],
        viewport: {x:0, y:0, scale:1}
    });
}

function showStatus(text){
    if(!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('show', Boolean(text));
    clearTimeout(statusTimer);
    if(text) statusTimer = setTimeout(() => statusEl.classList.remove('show'), 2200);
}

function applyHomeStaticCopy(){
    document.title = L('方寸万象', 'Innerverse');
    const setText = (selector, zh, en) => {
        const el = document.querySelector(selector);
        if(el) el.textContent = L(zh, en);
    };
    setText('.hero-kicker', '方寸万象', 'Innerverse');
    if(promptInput) promptInput.placeholder = L('描述你的创作需求……', 'Describe your creative request...');
    setText('#attachBtn span', '从素材开始', 'Start from assets');
    setText('#startBtn span', '开始创作', 'Start creating');
    setText('#recentTitleBtn h2', '项目', 'Projects');
    setText('#recentTitleBtn p', '所有项目都在这里，点击项目直接进入画布。', 'All projects are here. Click one to enter its canvas.');
    setText('#projectQuickCreate span', '新建项目', 'New project');
}

function applyLanguage(){
    if(window.StudioI18n) window.StudioI18n.apply();
    applyHomeStaticCopy();
    setMode(currentMode);
    if(canvases.length || projects.length) {
        renderRecent();
    }
}

function openShellPage(id){
    if(id === 'canvas' || id === 'projects'){
        focusProjectsSection();
        return;
    }
    try {
        if(window.parent && window.parent !== window && typeof window.parent.switchUI === 'function'){
            const trigger = window.parent.document.querySelector(`[onclick*="'${id}'"],[onclick*='"${id}"']`);
            window.parent.switchUI(trigger, id);
            return;
        }
    } catch(e) {}
    if(id === 'asset-manager') window.location.href = '/static/asset-manager.html';
}
window.openShellPage = openShellPage;

function currentTheme(){
    try {
        if(window.parent && window.parent !== window && window.parent.StudioTheme) return window.parent.StudioTheme.get();
    } catch(e) {}
    return window.StudioTheme ? window.StudioTheme.get() : (localStorage.getItem('studio_theme') || 'light');
}

function syncHomeHeaderControls(){
    const dark = currentTheme() === 'dark';
    if(homeThemeBtn) {
        homeThemeBtn.innerHTML = dark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        homeThemeBtn.title = dark ? L('切换为浅色主题','Switch to light theme') : L('切换为深色主题','Switch to dark theme');
        homeThemeBtn.setAttribute('aria-label', homeThemeBtn.title);
    }
    if(homeLanguageBtn) {
        homeLanguageBtn.querySelector('span').textContent = langIsEn() ? 'EN' : '中文';
        homeLanguageBtn.title = L('切换语言','Switch language');
        homeLanguageBtn.setAttribute('aria-label', homeLanguageBtn.title);
    }
    refreshIcons();
}

function toggleHomeTheme(){
    try {
        if(window.parent && window.parent !== window && typeof window.parent.toggleTheme === 'function'){
            window.parent.toggleTheme();
            setTimeout(syncHomeHeaderControls, 80);
            return;
        }
    } catch(e) {}
    if(window.StudioTheme) window.StudioTheme.set(currentTheme() === 'dark' ? 'light' : 'dark');
    syncHomeHeaderControls();
}

function toggleHomeLanguage(){
    try {
        if(window.parent && window.parent !== window && typeof window.parent.toggleLanguage === 'function'){
            window.parent.toggleLanguage();
            setTimeout(() => {
                applyLanguage();
                syncHomeHeaderControls();
            }, 80);
            return;
        }
    } catch(e) {}
    if(window.StudioI18n) window.StudioI18n.toggle();
    applyLanguage();
    syncHomeHeaderControls();
}

window.toggleHomeTheme = toggleHomeTheme;
window.toggleHomeLanguage = toggleHomeLanguage;

function focusProjectsSection(){
    homeFocus = 'projects';
    document.querySelector('.home-shell')?.classList.add('projects-focused');
    try {
        if(window.parent && window.parent !== window) {
            window.parent.postMessage({type:'home:section-focus', section:'projects'}, window.location.origin);
        }
    } catch(e) {}
}

function focusHeroSection(){
    homeFocus = 'hero';
    document.querySelector('.home-shell')?.classList.remove('projects-focused');
    try {
        if(window.parent && window.parent !== window) {
            window.parent.postMessage({type:'home:section-focus', section:'home'}, window.location.origin);
        }
    } catch(e) {}
}

function onHomeWheel(event){
    const now = Date.now();
    if(now - homeWheelGate < 650) return;
    if(homeFocus === 'hero' && event.deltaY > 18) {
        event.preventDefault();
        homeWheelGate = now;
        focusProjectsSection();
        return;
    }
    if(homeFocus === 'projects' && event.deltaY < -18) {
        const grid = event.target.closest?.('.recent-grid');
        if(grid && grid.scrollTop > 0) return;
        event.preventDefault();
        homeWheelGate = now;
        focusHeroSection();
    }
}

function handleHostMessage(event){
    if(event.origin && event.origin !== location.origin) return;
    const data = event.data || {};
    if(data.type === 'home:navigate' && data.section === 'projects') focusProjectsSection();
    if(data.type === 'home:navigate' && data.section === 'home') focusHeroSection();
    if(data.type === 'studio-theme' || data.type === 'studio-lang') setTimeout(syncHomeHeaderControls, 0);
}
window.addEventListener('message', handleHostMessage);

function setMode(mode){
    currentMode = mode || 'text';
    if(currentMode === 'assets') openShellPage('asset-manager');
}

function formatTime(value){
    if(!value) return '--';
    const raw = Number(value);
    const time = raw < 10000000000 ? raw * 1000 : raw;
    const date = new Date(time);
    if(Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString(langIsEn() ? 'en-US' : 'zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function canvasUrl(canvas, opts={}){
    const params = new URLSearchParams({
        id: canvas.id,
        project: canvas.project || 'default',
        v: '2026.07.30.0924'
    });
    if(opts.prompt) params.set('initial_prompt', opts.prompt);
    if(opts.mode) params.set('initial_mode', opts.mode);
    return canvas.kind === 'smart'
        ? `/static/smart-canvas.html?${params.toString()}`
        : `/static/canvas.html?${params.toString()}`;
}

function openCanvas(canvas){
    if(!canvas?.id) return;
    window.location.href = canvasUrl(canvas);
}

async function createCanvasInProject({title, projectId, prompt='', mode=currentMode}={}){
    const payload = {
        title: title || L('新画布','New canvas'),
        icon: mode === 'text' ? 'sparkles' : 'layers',
        kind:'classic',
        project: projectId || 'default',
        board_x:0,
        board_y:0
    };
    try {
        const res = await fetch('/api/canvases', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(payload)
        });
        if(!res.ok) throw new Error('create canvas failed');
        const data = await res.json();
        return persistLocalCanvas(data.canvas || payload);
    } catch(err) {
        console.warn('using local canvas fallback', err);
        return createLocalCanvas({title: payload.title, projectId: payload.project, mode});
    }
}

async function startCreativeProject(prompt='', mode=currentMode){
    if(mode === 'assets'){
        openShellPage('asset-manager');
        return;
    }
    startBtn.disabled = true;
    showStatus(L('正在创建画布…','Creating canvas...'));
    try {
        const nameSeed = (prompt || '').trim().slice(0, 24);
        const projectName = nameSeed || L('新创作项目','New creative project');
        let project;
        try {
            const projectRes = await fetch('/api/projects', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({name: projectName})
            });
            if(!projectRes.ok) throw new Error('create project failed');
            const projectData = await projectRes.json();
            project = persistLocalProject(projectData.project || {});
        } catch(projectErr) {
            console.warn('using local project fallback', projectErr);
            project = createLocalProject(projectName);
        }
        const canvas = await createCanvasInProject({
            title: nameSeed || L('新画布','New canvas'),
            projectId: project.id || 'default',
            prompt,
            mode
        });
        window.location.href = canvasUrl(canvas, {prompt, mode});
    } catch(err){
        console.error(err);
        showStatus(L('创建失败，请稍后重试','Create failed, please retry'));
    } finally {
        startBtn.disabled = false;
    }
}

function projectName(projectId){
    return projects.find(p => p.id === projectId)?.name || L('未归属项目','Unassigned project');
}

function canvasesInProject(projectId){
    return canvases.filter(c => !c.deleted_at && (c.project || 'default') === (projectId || 'default'));
}

function latestCanvasInProject(projectId){
    return canvasesInProject(projectId)
        .slice()
        .sort((a, b) => Number(b.updated_at || b.created_at || 0) - Number(a.updated_at || a.created_at || 0))[0] || null;
}

async function openProjectCanvas(projectId){
    const id = projectId || projects.find(p => p.id !== 'default')?.id || '';
    if(!id) {
        startCreativeProject('', 'canvas');
        return;
    }
    const existing = latestCanvasInProject(id);
    if(existing) {
        openCanvas(existing);
        return;
    }
    showStatus(L('正在创建画布…','Creating canvas...'));
    try {
        const canvas = await createCanvasInProject({title:L('新画布','New canvas'), projectId:id, mode:'canvas'});
        openCanvas(canvas);
    } catch(err){
        console.error(err);
        showStatus(L('创建失败，请稍后重试','Create failed, please retry'));
    }
}

function closeProjectMenu(){
    projectMenuProjectId = null;
    document.removeEventListener('click', closeProjectMenu);
    renderRecent();
}

function startProjectRename(projectId){
    const project = projects.find(p => p.id === projectId);
    const row = recentGrid.querySelector(`[data-project-open="${CSS.escape(projectId)}"]`);
    const nameEl = row?.querySelector('.project-name,.name');
    if(!project || !nameEl || nameEl.querySelector('input')) return;
    projectMenuProjectId = null;
    pendingDeleteProjectId = null;
    const input = document.createElement('input');
    input.className = 'home-project-name-input';
    input.type = 'text';
    input.maxLength = 60;
    input.value = project.name || '';
    nameEl.replaceChildren(input);
    input.focus();
    input.select();
    let finished = false;
    const finish = async commit => {
        if(finished) return;
        finished = true;
        const nextName = input.value.trim();
        if(commit && nextName && nextName !== project.name) await renameProject(projectId, nextName);
        else renderRecent();
    };
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', event => {
        event.stopPropagation();
        if(event.key === 'Enter') {
            event.preventDefault();
            finish(true);
        }
        if(event.key === 'Escape') {
            event.preventDefault();
            finish(false);
        }
    });
}

async function renameProject(projectId, name){
    const project = projects.find(p => p.id === projectId);
    const prevName = project?.name;
    if(project) project.name = name;
    renderRecent();
    showStatus(L('项目已重命名','Project renamed'));
    try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({name})
        });
        if(!res.ok) throw new Error('rename project failed');
        await loadHomeData();
    } catch(err){
        console.error(err);
        if(project) persistLocalProject({...project, name, updated_at:Date.now()});
        showStatus(L('项目已重命名','Project renamed'));
        loadHomeData();
    }
}

async function deleteProject(projectId){
    const project = projects.find(p => p.id === projectId);
    if(!project || projectId === 'default') return;
    pendingDeleteProjectId = null;
    projectMenuProjectId = null;
    showStatus(L('正在删除项目…','Deleting project...'));
    try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {method:'DELETE'});
        if(!res.ok) throw new Error('delete project failed');
        canvases.forEach(canvas => {
            if((canvas.project || 'default') === projectId) canvas.project = 'default';
        });
        projects = projects.filter(p => p.id !== projectId);
        if(selectedProjectId === projectId) selectedProjectId = projects.find(p => p.id !== projectId && p.id !== 'default')?.id || '';
        if(selectedProjectId) localStorage.setItem('canvasListCurrentProjectId', selectedProjectId);
        else localStorage.removeItem('canvasListCurrentProjectId');
        renderRecent();
        showStatus(L('项目已删除','Project deleted'));
    } catch(err){
        console.error(err);
        writeLocalArray(LOCAL_PROJECTS_KEY, readLocalArray(LOCAL_PROJECTS_KEY).filter(item => item.id !== projectId));
        writeLocalArray(LOCAL_CANVASES_KEY, readLocalArray(LOCAL_CANVASES_KEY).map(item => (item.project || 'default') === projectId ? {...item, project:'default'} : item));
        projects = projects.filter(p => p.id !== projectId);
        canvases = canvases.map(item => (item.project || 'default') === projectId ? {...item, project:'default'} : item);
        renderRecent();
        showStatus(L('项目已删除','Project deleted'));
    }
}

function renderRecent(){
    const recentProjects = projects
        .filter(project => project.id !== 'default')
        .slice()
        .sort((a, b) => {
            const ca = latestCanvasInProject(a.id);
            const cb = latestCanvasInProject(b.id);
            return Number(cb?.updated_at || cb?.created_at || b.updated_at || b.created_at || 0) - Number(ca?.updated_at || ca?.created_at || a.updated_at || a.created_at || 0);
        })
        .slice(0, 8);
    const cards = [
        `<button class="project-card new" type="button" data-new-canvas>
            <div class="project-preview"><span class="plus">+</span></div>
            <div class="project-meta"><p class="project-name">${L('新建项目','New Project')}</p><p class="project-sub">${L('创建空白画布','Create a blank canvas')}</p></div>
        </button>`,
        ...recentProjects.map(project => {
            const latest = latestCanvasInProject(project.id);
            const count = canvasesInProject(project.id).length;
            const menuOpen = projectMenuProjectId === project.id;
            const confirmOpen = pendingDeleteProjectId === project.id;
            const sub = count
                ? `${count} ${L('个画布','canvases')} · ${formatTime(latest?.updated_at || latest?.created_at)}`
                : L('暂无画布，点击后自动创建','No canvas yet; click to create one');
            return `<div class="project-card" role="button" tabindex="0" data-project-open="${escapeHtml(project.id)}">
            <button class="project-card-more" type="button" data-project-menu="${escapeHtml(project.id)}" title="${L('项目选项','Project options')}" aria-label="${L('项目选项','Project options')}"><i data-lucide="more-horizontal"></i></button>
            ${menuOpen ? `<div class="project-options-popover" data-project-popover>
                <button type="button" class="project-option-item" data-project-rename="${escapeHtml(project.id)}"><i data-lucide="pencil"></i><span>${L('修改名字','Rename')}</span></button>
                <button type="button" class="project-option-item danger" data-project-delete="${escapeHtml(project.id)}"><i data-lucide="trash-2"></i><span>${L('删除项目','Delete project')}</span></button>
            </div>` : ''}
            <div class="project-preview"><i data-lucide="folder-open"></i></div>
            <div class="project-meta"><p class="project-name">${escapeHtml(project.name || L('未命名项目','Untitled project'))}</p><p class="project-sub">${escapeHtml(sub)}</p></div>
            ${confirmOpen ? `<div class="project-delete-confirm">
                <p>${L('删除项目','Delete project')}「${escapeHtml(project.name || '')}」？</p>
                <div>
                    <button type="button" class="confirm-danger" data-project-delete-confirm="${escapeHtml(project.id)}">${L('删除','Delete')}</button>
                    <button type="button" class="confirm-ghost" data-project-delete-cancel>${L('取消','Cancel')}</button>
                </div>
            </div>` : ''}
        </div>`;
        })
    ];
    recentGrid.innerHTML = cards.join('');
    recentGrid.querySelector('[data-new-canvas]')?.addEventListener('click', () => startCreativeProject('', 'canvas'));
    recentGrid.querySelectorAll('[data-project-open]').forEach(card => {
        card.addEventListener('click', event => {
            if(event.target.closest('button,[data-project-popover],input')) return;
            openProjectCanvas(card.dataset.projectOpen || '');
        });
        card.addEventListener('keydown', event => {
            if(event.key !== 'Enter' && event.key !== ' ') return;
            if(event.target.closest('button,input')) return;
            event.preventDefault();
            openProjectCanvas(card.dataset.projectOpen || '');
        });
    });
    recentGrid.querySelectorAll('[data-project-menu]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const projectId = btn.dataset.projectMenu || '';
            pendingDeleteProjectId = null;
            projectMenuProjectId = projectMenuProjectId === projectId ? null : projectId;
            document.removeEventListener('click', closeProjectMenu);
            if(projectMenuProjectId) setTimeout(() => document.addEventListener('click', closeProjectMenu), 0);
            renderRecent();
        });
    });
    recentGrid.querySelectorAll('[data-project-rename]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            const projectId = btn.dataset.projectRename || '';
            projectMenuProjectId = null;
            renderRecent();
            requestAnimationFrame(() => startProjectRename(projectId));
        });
    });
    recentGrid.querySelectorAll('[data-project-delete]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            if(btn.disabled) return;
            pendingDeleteProjectId = btn.dataset.projectDelete || null;
            projectMenuProjectId = null;
            renderRecent();
        });
    });
    recentGrid.querySelectorAll('[data-project-delete-confirm]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            deleteProject(btn.dataset.projectDeleteConfirm || '');
        });
    });
    recentGrid.querySelectorAll('[data-project-delete-cancel]').forEach(btn => {
        btn.addEventListener('click', event => {
            event.stopPropagation();
            pendingDeleteProjectId = null;
            renderRecent();
        });
    });
    refreshIcons();
}

async function loadHomeData(){
    try {
        const [projectRes, canvasRes] = await Promise.all([fetch('/api/projects'), fetch('/api/canvases')]);
        const remoteProjects = projectRes.ok ? (await projectRes.json()).projects || [] : [];
        const remoteCanvases = canvasRes.ok ? (await canvasRes.json()).canvases || [] : [];
        projects = mergeById(remoteProjects, readLocalArray(LOCAL_PROJECTS_KEY)).filter(p => p.id !== 'default');
        canvases = mergeById(remoteCanvases, readLocalArray(LOCAL_CANVASES_KEY));
        renderRecent();
    } catch(err){
        console.error(err);
        projects = readLocalArray(LOCAL_PROJECTS_KEY).filter(p => p.id !== 'default');
        canvases = readLocalArray(LOCAL_CANVASES_KEY);
        renderRecent();
        showStatus(L('已使用本地项目数据','Using local project data'));
    }
}

document.getElementById('projectQuickCreate')?.addEventListener('click', () => startCreativeProject('', 'canvas'));
window.addEventListener('wheel', onHomeWheel, {passive:false});
promptForm.addEventListener('submit', e => {
    e.preventDefault();
    startCreativeProject(promptInput.value.trim(), currentMode);
});
document.getElementById('attachBtn')?.addEventListener('click', () => openShellPage('asset-manager'));

if(window.StudioI18n) StudioI18n.apply();
applyHomeStaticCopy();
setMode('text');
loadHomeData();
syncHomeHeaderControls();
refreshIcons();
