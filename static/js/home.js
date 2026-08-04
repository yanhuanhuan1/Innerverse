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
const emailLoginBtn = document.getElementById('emailLoginBtn');
const emailLoginModal = document.getElementById('emailLoginModal');
const emailLoginForm = document.getElementById('emailLoginForm');
const authTitle = document.getElementById('authTitle');
const authDesc = document.getElementById('authDesc');
const authLoginTab = document.getElementById('authLoginTab');
const authRegisterTab = document.getElementById('authRegisterTab');
const authNameLabel = document.getElementById('authNameLabel');
const loginNameInput = document.getElementById('loginNameInput');
const loginEmailInput = document.getElementById('loginEmailInput');
const loginPasswordInput = document.getElementById('loginPasswordInput');
const loginCodeInput = document.getElementById('loginCodeInput');
const sendEmailCodeBtn = document.getElementById('sendEmailCodeBtn');
const verifyEmailCodeBtn = document.getElementById('verifyEmailCodeBtn');
const emailCodeFallbackBtn = document.getElementById('emailCodeFallbackBtn');
const authCodeFields = document.getElementById('authCodeFields');
const emailLoginHint = document.getElementById('emailLoginHint');
const homeUserBox = document.getElementById('homeUserBox');
const homeUserAvatar = document.getElementById('homeUserAvatar');
const homeUserName = document.getElementById('homeUserName');
const homeLogoutBtn = document.getElementById('homeLogoutBtn');
let currentMode = 'text';
let canvases = [];
let projects = [];
let currentUser = null;
let selectedProjectId = localStorage.getItem('canvasListCurrentProjectId') || '';
let statusTimer = null;
let projectMenuProjectId = null;
let pendingDeleteProjectId = null;
let homeFocus = 'hero';
let homeWheelGate = 0;
let emailCodeCooldownTimer = null;
let authMode = 'login';
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
    setText('#emailLoginBtn span', '登录', 'Sign in');
    setText('#authLoginTab', '登录', 'Sign in');
    setText('#authRegisterTab', '注册', 'Create account');
    setText('#emailCodeFallbackBtn', authMode === 'code' ? '使用密码登录' : '使用邮箱验证码登录', authMode === 'code' ? 'Use password sign-in' : 'Use email code instead');
    setText('#verifyEmailCodeBtn', authMode === 'register' ? '注册并登录' : '登录', authMode === 'register' ? 'Create account' : 'Sign in');
    if(authMode) setAuthMode(authMode, {silent:true});
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

function isAuthError(res){
    return res && (res.status === 401 || res.status === 403);
}

function updateAuthUI(){
    const loggedIn = Boolean(currentUser && currentUser.id);
    if(emailLoginBtn) emailLoginBtn.hidden = loggedIn;
    if(homeUserBox) homeUserBox.hidden = !loggedIn;
    if(loggedIn) {
        if(homeUserName) homeUserName.textContent = currentUser.nickname || currentUser.email || L('用户','User');
        if(homeUserAvatar) {
            homeUserAvatar.src = currentUser.avatar_url || '/static/images/logo.png';
            homeUserAvatar.alt = currentUser.nickname || '';
        }
    }
    refreshIcons();
}

async function loadCurrentUser(){
    try {
        const res = await fetch('/api/auth/me', {cache:'no-store'});
        if(!res.ok) {
            currentUser = null;
            updateAuthUI();
            return null;
        }
        const data = await res.json();
        currentUser = data.user || null;
        updateAuthUI();
        return currentUser;
    } catch(e) {
        currentUser = null;
        updateAuthUI();
        return null;
    }
}

function setEmailLoginHint(text, isError=false){
    if(!emailLoginHint) return;
    emailLoginHint.textContent = text || '';
    emailLoginHint.classList.toggle('error', Boolean(isError));
}

function setAuthMode(mode, options={}){
    authMode = ['login','register','code'].includes(mode) ? mode : 'login';
    const isRegister = authMode === 'register';
    const isCode = authMode === 'code';
    authLoginTab?.classList.toggle('active', authMode === 'login' || isCode);
    authRegisterTab?.classList.toggle('active', isRegister);
    if(authTitle) authTitle.textContent = isRegister ? L('创建账号','Create account') : L('邮箱登录','Email sign-in');
    if(authDesc) authDesc.textContent = isRegister
        ? L('填写用户名、邮箱、验证码和密码。注册前必须先验证邮箱。','Choose a username, email, code, and password. Email verification is required before creating the account.')
        : (isCode ? L('验证码登录作为备用方式，可能需要等待邮件送达。','Email code sign-in is a fallback and may take a moment to arrive.')
            : L('使用邮箱和密码登录。第一次使用请先注册账号。','Sign in with your email and password. Create an account first if this is your first time.'));
    if(authNameLabel) authNameLabel.hidden = !isRegister;
    if(authCodeFields) authCodeFields.hidden = !(isRegister || isCode);
    // 切换模式时清掉残留值，避免密码登录带上一份无意义的旧验证码/用户名。
    if(!isCode && !isRegister && loginCodeInput) loginCodeInput.value = '';
    if(!isRegister && loginNameInput) loginNameInput.value = '';
    if(loginCodeInput) loginCodeInput.required = isRegister || isCode;
    if(loginPasswordInput) {
        loginPasswordInput.closest('label').hidden = isCode;
        loginPasswordInput.required = !isCode;
        loginPasswordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
    }
    if(loginNameInput) loginNameInput.required = isRegister;
    if(verifyEmailCodeBtn) verifyEmailCodeBtn.textContent = isRegister ? L('注册并登录','Create account') : L('登录','Sign in');
    if(emailCodeFallbackBtn) emailCodeFallbackBtn.textContent = isCode ? L('使用密码登录','Use password sign-in') : L('使用邮箱验证码登录','Use email code instead');
    if(!options.silent) setEmailLoginHint('');
    refreshIcons();
}

function openEmailLogin(){
    if(!emailLoginModal) return;
    emailLoginModal.hidden = false;
    setAuthMode('login', {silent:true});
    setEmailLoginHint('');
    setTimeout(() => loginEmailInput?.focus(), 30);
    refreshIcons();
}

function closeEmailLogin(){
    if(!emailLoginModal) return;
    emailLoginModal.hidden = true;
    setEmailLoginHint('');
}

function setEmailCodeCooldown(seconds){
    clearInterval(emailCodeCooldownTimer);
    let left = Number(seconds || 0);
    if(!sendEmailCodeBtn) return;
    const render = () => {
        if(left <= 0) {
            sendEmailCodeBtn.disabled = false;
            sendEmailCodeBtn.textContent = L('获取验证码','Send code');
            clearInterval(emailCodeCooldownTimer);
            return;
        }
        sendEmailCodeBtn.disabled = true;
        sendEmailCodeBtn.textContent = `${left}s`;
        left -= 1;
    };
    render();
    emailCodeCooldownTimer = setInterval(render, 1000);
}

async function sendEmailCode(){
    const email = (loginEmailInput?.value || '').trim();
    if(!email) {
        setEmailLoginHint(L('请输入邮箱','Enter your email'), true);
        loginEmailInput?.focus();
        return;
    }
    try {
        sendEmailCodeBtn.disabled = true;
        setEmailLoginHint(L('正在发送验证码……','Sending verification code...'));
        const res = await fetch('/api/auth/email/start', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({email})
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) throw new Error(data.detail || 'send failed');
        setEmailLoginHint(L('验证码已发送，请检查邮箱。','Code sent. Check your inbox.'));
        loginCodeInput?.focus();
        setEmailCodeCooldown(45);
    } catch(err) {
        console.error(err);
        setEmailLoginHint(err.message || L('验证码发送失败','Failed to send code'), true);
        if(sendEmailCodeBtn) sendEmailCodeBtn.disabled = false;
    }
}

async function verifyEmailCode(){
    const email = (loginEmailInput?.value || '').trim();
    const code = (loginCodeInput?.value || '').trim();
    if(!email || code.length < 6) {
        setEmailLoginHint(L('请输入邮箱和 6 位验证码','Enter email and 6-digit code'), true);
        return;
    }
    try {
        verifyEmailCodeBtn.disabled = true;
        setEmailLoginHint(L('正在登录……','Signing in...'));
        const res = await fetch('/api/auth/email/verify', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({email, code})
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) throw new Error(data.detail || 'verify failed');
        currentUser = data.user || null;
        closeEmailLogin();
        updateAuthUI();
        await loadHomeData();
        showStatus(L('已登录','Signed in'));
    } catch(err) {
        console.error(err);
        setEmailLoginHint(err.message || L('登录失败','Sign in failed'), true);
    } finally {
        if(verifyEmailCodeBtn) verifyEmailCodeBtn.disabled = false;
    }
}

async function submitEmailPasswordAuth(){
    const email = (loginEmailInput?.value || '').trim();
    const password = (loginPasswordInput?.value || '');
    const nickname = (loginNameInput?.value || '').trim();
    const code = (loginCodeInput?.value || '').trim();
    if(!email) {
        setEmailLoginHint(L('请输入邮箱','Enter your email'), true);
        loginEmailInput?.focus();
        return;
    }
    if(authMode === 'register' && !nickname) {
        setEmailLoginHint(L('请输入用户名','Enter a username'), true);
        loginNameInput?.focus();
        return;
    }
    if(password.length < 8) {
        setEmailLoginHint(L('密码至少需要 8 位','Password must be at least 8 characters'), true);
        loginPasswordInput?.focus();
        return;
    }
    if(authMode === 'register' && code.length < 6) {
        setEmailLoginHint(L('请先获取并输入 6 位邮箱验证码','Send and enter the 6-digit email code first'), true);
        loginCodeInput?.focus();
        return;
    }
    const endpoint = authMode === 'register' ? '/api/auth/email/register' : '/api/auth/email/login';
    const body = authMode === 'register' ? {email, password, nickname, code} : {email, password};
    try {
        verifyEmailCodeBtn.disabled = true;
        setEmailLoginHint(authMode === 'register' ? L('正在创建账号……','Creating account...') : L('正在登录……','Signing in...'));
        const res = await fetch(endpoint, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) throw new Error(data.detail || 'auth failed');
        currentUser = data.user || null;
        closeEmailLogin();
        updateAuthUI();
        await loadHomeData();
        showStatus(authMode === 'register' ? L('账号已创建','Account created') : L('已登录','Signed in'));
    } catch(err) {
        console.error(err);
        setEmailLoginHint(err.message || L('登录失败','Sign in failed'), true);
    } finally {
        if(verifyEmailCodeBtn) verifyEmailCodeBtn.disabled = false;
    }
}

function submitEmailAuth(){
    if(authMode === 'code') return verifyEmailCode();
    return submitEmailPasswordAuth();
}

async function logout(){
    try { await fetch('/api/auth/logout', {method:'POST'}); } catch(e) {}
    currentUser = null;
    projects = [];
    canvases = [];
    updateAuthUI();
    renderRecent();
    showStatus(L('已退出登录','Logged out'));
}

function requireLogin(){
    if(currentUser && currentUser.id) return true;
    showStatus(L('请先登录','Please sign in first'));
    openEmailLogin();
    return false;
}
window.addEventListener('message', handleHostMessage);

function initialHomeParams(){
    try { return new URLSearchParams(window.location.search); } catch(e) { return new URLSearchParams(); }
}

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
    // 自 2026.08 起经典画布是唯一画布引擎，所有画布统一打开经典画布。
    return `/static/canvas.html?${params.toString()}`;
}

// ===== 画布预加载：悬停/聚焦时预热静态资源与画布数据，点击跳转不等待预取 =====
const canvasPrefetch = {
    inflight: new Set(),
    done: new Set(),
    assetsDone: new Set(),
    controllers: new Map(),
    timers: new Map(),
    queue: [],
    active: 0,
    limit: 2
};
const CANVAS_PREFETCH_DELAY = 90;
const CANVAS_ASSET_VERSION = '2026.08.04.perf2';
const HOME_WARMUP_KEY = 'canvas_home_warmup_at';
const HOME_WARMUP_INTERVAL = 5 * 60 * 1000;
function scheduleHomeWarmup(){
    try {
        const last = Number(sessionStorage.getItem(HOME_WARMUP_KEY) || 0);
        if(Date.now() - last < HOME_WARMUP_INTERVAL) return;
        sessionStorage.setItem(HOME_WARMUP_KEY, String(Date.now()));
    } catch(e) {}
    // 页面加载完成后延迟触发一次生产预热（函数初始化 + Neon 连接 + SELECT 1），失败静默。
    setTimeout(() => {
        try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 5000);
            fetch('/api/warmup', {credentials:'same-origin', cache:'no-store', signal: controller.signal}).catch(() => {});
        } catch(e) {}
    }, 700);
}
function canvasPrefetchAssets(id){
    if(!id || canvasPrefetch.assetsDone.has(id)) return;
    const canvas = latestCanvasInProject(id);
    if(!canvas) return;
    canvasPrefetch.assetsDone.add(id);
    const add = (href, as) => {
        try {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = href;
            if(as) link.as = as;
            document.head.appendChild(link);
            setTimeout(() => { try { link.remove(); } catch(e){} }, 15000);
        } catch(e) {}
    };
    add(canvasUrl(canvas), 'document');
    add('/static/css/canvas.css?v=' + CANVAS_ASSET_VERSION, 'style');
    add('/static/css/canvas-tailwind.css?v=2026.08.04.perf1', 'style');
    add('/static/js/build/manifest.js', 'script');
    // 核心与 lucide 文件名带内容 hash：先读清单拿到准确文件名再预取
    try {
        fetch('/static/js/build/manifest.js', {cache:'force-cache'})
            .then(r => r.text())
            .then(text => {
                const m = /window\.CANVAS_BUILD\s*=\s*(\{.*?\});/.exec(text);
                if(m){
                    const manifest = JSON.parse(m[1]);
                    if(manifest.core) add('/static/js/build/' + manifest.core, 'script');
                    if(manifest.lucide) add('/static/js/build/' + manifest.lucide, 'script');
                }
            })
            .catch(() => {
                add('/static/js/canvas.js?v=' + CANVAS_ASSET_VERSION, 'script');
            });
    } catch(e) {}
    add('/static/vendor/fonts/inter-2.ttf', 'font');
    add('/static/vendor/fonts/inter-4.ttf', 'font');
}
function canvasPrefetchPump(){
    while(canvasPrefetch.active < canvasPrefetch.limit && canvasPrefetch.queue.length){
        const id = canvasPrefetch.queue.shift();
        if(canvasPrefetch.done.has(id) || canvasPrefetch.inflight.has(id)) continue;
        canvasPrefetchStart(id);
    }
}
function canvasPrefetchStart(id){
    const canvas = latestCanvasInProject(id);
    if(!canvas || canvasPrefetch.inflight.has(id) || canvasPrefetch.done.has(id)) return;
    canvasPrefetch.inflight.add(id);
    canvasPrefetch.active++;
    const controller = new AbortController();
    canvasPrefetch.controllers.set(id, controller);
    fetch(`/api/canvases/${encodeURIComponent(canvas.id)}`, {credentials:'same-origin', cache:'default', signal: controller.signal})
        .then(res => {
            if(res.ok){
                canvasPrefetch.done.add(id);
                try { sessionStorage.setItem('canvas_prefetched_' + canvas.id, '1'); } catch(e) {}
                try { res.json(); } catch(e) {}
            }
        })
        .catch(() => {})
        .finally(() => {
            canvasPrefetch.inflight.delete(id);
            canvasPrefetch.controllers.delete(id);
            canvasPrefetch.active = Math.max(0, canvasPrefetch.active - 1);
            canvasPrefetchPump();
        });
}
function canvasPrefetchRequest(id){
    canvasPrefetchAssets(id);
    if(!id || canvasPrefetch.inflight.has(id) || canvasPrefetch.done.has(id)) return;
    if(canvasPrefetch.active >= canvasPrefetch.limit){
        if(!canvasPrefetch.queue.includes(id)) canvasPrefetch.queue.push(id);
        return;
    }
    canvasPrefetchStart(id);
}
function canvasPrefetchCancel(id){
    const controller = canvasPrefetch.controllers.get(id);
    if(controller) { try { controller.abort(); } catch(e){} }
    canvasPrefetch.inflight.delete(id);
    canvasPrefetch.controllers.delete(id);
}
function bindCanvasPrefetch(card, id){
    const schedule = () => {
        clearTimeout(canvasPrefetch.timers.get(id));
        canvasPrefetch.timers.set(id, setTimeout(() => canvasPrefetchRequest(id), CANVAS_PREFETCH_DELAY));
    };
    const cancel = () => {
        const timer = canvasPrefetch.timers.get(id);
        if(timer){ clearTimeout(timer); canvasPrefetch.timers.delete(id); }
        canvasPrefetchCancel(id);
    };
    card.addEventListener('mouseenter', schedule);
    card.addEventListener('focus', schedule);
    card.addEventListener('touchstart', schedule, {passive:true});
    // 指针按下意味着马上要点击跳转：取消待触发的预取，避免与正式打开竞争。
    card.addEventListener('pointerdown', () => { clearTimeout(canvasPrefetch.timers.get(id)); canvasPrefetch.timers.delete(id); });
    card.addEventListener('mouseleave', cancel);
    card.addEventListener('blur', cancel);
    card.addEventListener('click', () => { clearTimeout(canvasPrefetch.timers.get(id)); canvasPrefetch.timers.delete(id); });
}

function openCanvas(canvas){
    if(!canvas?.id) return;
    try {
        performance.mark('project_click');
        const body = JSON.stringify({route: 'home', marks: [{name: 'project_click', t: Math.round(performance.now())}]});
        if(navigator.sendBeacon) navigator.sendBeacon('/api/perf', new Blob([body], {type: 'application/json'}));
    } catch(e) {}
    window.location.href = canvasUrl(canvas);
}

async function createCanvasInProject({title, projectId, prompt='', mode=currentMode}={}){
    if(!requireLogin()) throw new Error('auth required');
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
        if(isAuthError(res)) {
            currentUser = null;
            updateAuthUI();
            throw new Error('auth required');
        }
        if(!res.ok) throw new Error('create canvas failed');
        const data = await res.json();
        return data.canvas || payload;
    } catch(err) {
        console.error(err);
        throw err;
    }
}

async function startCreativeProject(prompt='', mode=currentMode){
    if(mode === 'assets'){
        openShellPage('asset-manager');
        return;
    }
    if(!requireLogin()) return;
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
            if(isAuthError(projectRes)) {
                currentUser = null;
                updateAuthUI();
                throw new Error('auth required');
            }
            if(!projectRes.ok) throw new Error('create project failed');
            const projectData = await projectRes.json();
            project = projectData.project || {};
        } catch(projectErr) {
            console.error(projectErr);
            throw projectErr;
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
    if(!requireLogin()) return;
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
        if(isAuthError(res)) {
            currentUser = null;
            updateAuthUI();
            throw new Error('auth required');
        }
        if(!res.ok) throw new Error('rename project failed');
        await loadHomeData();
    } catch(err){
        console.error(err);
        if(project && prevName != null) project.name = prevName;
        showStatus(L('重命名失败，请稍后重试','Rename failed, please retry'));
        loadHomeData();
    }
}

async function deleteProject(projectId){
    if(!requireLogin()) return;
    const project = projects.find(p => p.id === projectId);
    if(!project || projectId === 'default') return;
    pendingDeleteProjectId = null;
    projectMenuProjectId = null;
    showStatus(L('正在删除项目…','Deleting project...'));
    try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {method:'DELETE'});
        if(isAuthError(res)) {
            currentUser = null;
            updateAuthUI();
            throw new Error('auth required');
        }
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
        await loadHomeData();
        showStatus(L('删除失败，请稍后重试','Delete failed, please retry'));
    }
}

function renderRecent(){
    if(!currentUser) {
        recentGrid.innerHTML = `<button class="project-card new" type="button" data-auth-login>
            <div class="project-preview"><span class="plus">+</span></div>
            <div class="project-meta"><p class="project-name">${L('邮箱登录后开始','Sign in with email')}</p><p class="project-sub">${L('登录后项目会按用户隔离保存','Projects are private after sign-in')}</p></div>
        </button>`;
        recentGrid.querySelector('[data-auth-login]')?.addEventListener('click', openEmailLogin);
        refreshIcons();
        return;
    }
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
        bindCanvasPrefetch(card, card.dataset.projectOpen || '');
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
    if(!currentUser) {
        projects = [];
        canvases = [];
        renderRecent();
        return;
    }
    try {
        const [projectRes, canvasRes] = await Promise.all([fetch('/api/projects'), fetch('/api/canvases')]);
        if(isAuthError(projectRes) || isAuthError(canvasRes)) {
            currentUser = null;
            updateAuthUI();
            projects = [];
            canvases = [];
            renderRecent();
            return;
        }
        const remoteProjects = projectRes.ok ? (await projectRes.json()).projects || [] : [];
        const remoteCanvases = canvasRes.ok ? (await canvasRes.json()).canvases || [] : [];
        projects = remoteProjects.filter(p => p.id !== 'default');
        canvases = remoteCanvases;
        renderRecent();
    } catch(err){
        console.error(err);
        projects = [];
        canvases = [];
        renderRecent();
        showStatus(L('项目加载失败，请稍后重试','Failed to load projects'));
    }
}

function renderLocalHomeData(){
    const localProjects = readLocalArray(LOCAL_PROJECTS_KEY).filter(p => p.id !== 'default');
    const localCanvases = readLocalArray(LOCAL_CANVASES_KEY);
    if(!localProjects.length && !localCanvases.length) return false;
    projects = mergeById(projects, localProjects).filter(p => p.id !== 'default');
    canvases = mergeById(canvases, localCanvases);
    renderRecent();
    return true;
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
emailLoginBtn?.addEventListener('click', openEmailLogin);
authLoginTab?.addEventListener('click', () => setAuthMode('login'));
authRegisterTab?.addEventListener('click', () => setAuthMode('register'));
emailCodeFallbackBtn?.addEventListener('click', () => setAuthMode(authMode === 'code' ? 'login' : 'code'));
sendEmailCodeBtn?.addEventListener('click', sendEmailCode);
emailLoginForm?.addEventListener('submit', event => {
    event.preventDefault();
    submitEmailAuth();
});
emailLoginModal?.querySelectorAll('[data-close-email-login]').forEach(el => el.addEventListener('click', closeEmailLogin));
loginCodeInput?.addEventListener('input', () => {
    loginCodeInput.value = loginCodeInput.value.replace(/\D/g, '').slice(0, 6);
});
homeLogoutBtn?.addEventListener('click', logout);
loadCurrentUser().then(loadHomeData);
scheduleHomeWarmup();
if(initialHomeParams().get('section') === 'projects') focusProjectsSection();
syncHomeHeaderControls();
refreshIcons();
