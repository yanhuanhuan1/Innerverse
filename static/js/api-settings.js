let providers = [];
let selectedId = 'apimart';
let fetchedModels = { image: [], chat: [], video: [], all: [] };
let pickerCat = 'all';

const APIMART_DEFAULT_BASE_URL = 'https://api.apimart.ai';
const APIMART_DEFAULT_IMAGE_MODELS = [
    'gpt-image-2',
    'gpt-image-2-official',
    'gpt-image-1-official',
    'gemini-3.1-flash-image-preview',
    'gemini-3.1-flash-image-preview-official',
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image-preview',
    'doubao-seedream-5-0-lite',
    'doubao-seedream-5-0-pro',
    'wan2.7-image-pro',
    'wan2.7-image',
    'qwen-image-2.0',
    'qwen-image-3.0',
    'z-image-turbo',
    'grok-imagine-1.5-apimart',
    'midjourney'
];
const APIMART_DEFAULT_CHAT_MODELS = [
    'gpt-5.5',
    'gpt-5.1',
    'gpt-5',
    'gpt-4.1',
    'gpt-4o',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash'
];
const APIMART_DEFAULT_VIDEO_MODELS = [
    'veo3.1-fast',
    'veo3.1-quality',
    'veo3.1-lite',
    'veo3.1-fast-official',
    'veo3.1-quality-official',
    'sora-2',
    'sora-2-pro',
    'doubao-seedance-2.0',
    'doubao-seedance-1-5-pro',
    'doubao-seedance-1-0-pro-quality',
    'doubao-seedance-1-0-pro-fast',
    'kling-v3',
    'kling-v3-omni',
    'kling-video-o1',
    'kling-v2-6',
    'MiniMax-Hailuo-02',
    'wan2.7',
    'wan2.7-r2v',
    'wan2.7-videoedit',
    'wan2.6',
    'wan2.6-i2v-flash',
    'wan2.5-preview',
    'pixverse-v6',
    'viduq3-pro',
    'viduq3-turbo',
    'viduq3-mix',
    'viduq3',
    'skyreels-v4-fast',
    'skyreels-v4-std',
    'happyhorse-1.1',
    'happyhorse-1.0',
    'grok-imagine-1.5-video-apimart',
    'gemini-omni-flash-preview'
];

const statusEl = document.getElementById('status');
const providerList = document.getElementById('providerList');
const editorTitle = document.getElementById('editorTitle');
const nameInput = document.getElementById('nameInput');
const idInput = document.getElementById('idInput');
const idPreview = document.getElementById('idPreview');
const baseInput = document.getElementById('baseInput');
const keyInput = document.getElementById('keyInput');
const keyHint = document.getElementById('keyHint');
const protocolInput = document.getElementById('protocolInput');
const imageRequestModeInput = document.getElementById('imageRequestModeInput');
const verifyResult = document.getElementById('verifyResult');
const imageModelList = document.getElementById('imageModelList');
const chatModelList = document.getElementById('chatModelList');
const videoModelList = document.getElementById('videoModelList');
const fetchModelsBtn = document.getElementById('fetchModelsBtn');
const openPickerBtn = document.getElementById('openPickerBtn');
const recommendApiOverlay = document.getElementById('recommendApiOverlay');
const recommendApiList = document.getElementById('recommendApiList');
const modelPickerOverlay = document.getElementById('modelPickerOverlay');
const pickerFilter = document.getElementById('pickerFilter');
const pickerList = document.getElementById('pickerList');
const pickerCount = document.getElementById('pickerCount');
const sumImage = document.getElementById('sumImage');
const sumChat = document.getElementById('sumChat');
const sumVideo = document.getElementById('sumVideo');
const sumUnsel = document.getElementById('sumUnsel');

function tr(key){ return window.StudioI18n ? window.StudioI18n.t(key) : key; }
function setStatus(text){ if(statusEl) statusEl.textContent = text || ''; }
function refreshIcons(){ if(window.lucide) lucide.createIcons(); }
function escapeHtml(str){ return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
function unique(list){ return [...new Set((list || []).map(v => String(v || '').trim()).filter(Boolean))]; }
function normalizeProvider(raw = {}){
    return {
        id: 'apimart',
        name: 'APIMart',
        base_url: String(raw.base_url || APIMART_DEFAULT_BASE_URL).trim() || APIMART_DEFAULT_BASE_URL,
        protocol: 'apimart',
        image_request_mode: raw.image_request_mode || 'openai',
        image_generation_endpoint: raw.image_generation_endpoint || '',
        image_edit_endpoint: raw.image_edit_endpoint || '',
        enabled: true,
        primary: true,
        has_key: !!raw.has_key,
        key_preview: raw.key_preview || '',
        image_models: unique([...(raw.image_models || []), ...APIMART_DEFAULT_IMAGE_MODELS]),
        chat_models: unique([...(raw.chat_models || []), ...APIMART_DEFAULT_CHAT_MODELS]),
        video_models: unique([...(raw.video_models || []), ...APIMART_DEFAULT_VIDEO_MODELS]),
        model_names: raw.model_names || {},
        model_protocols: raw.model_protocols || {}
    };
}
function provider(){
    if(!providers.length) providers = [normalizeProvider()];
    return providers[0];
}
function payloadProvider(extra = {}){
    const item = provider();
    return {
        id: 'apimart',
        name: 'APIMart',
        base_url: item.base_url || APIMART_DEFAULT_BASE_URL,
        protocol: 'apimart',
        image_request_mode: item.image_request_mode || 'openai',
        image_generation_endpoint: item.image_generation_endpoint || '',
        image_edit_endpoint: item.image_edit_endpoint || '',
        enabled: true,
        primary: true,
        image_models: unique(item.image_models),
        chat_models: unique(item.chat_models),
        video_models: unique(item.video_models),
        model_names: item.model_names || {},
        model_protocols: item.model_protocols || {},
        ...extra
    };
}
function renderProviderList(){
    const item = provider();
    providerList.innerHTML = `
        <button class="provider-card provider-card-sortable active ${item.has_key ? 'has-key' : 'missing-key'}" type="button">
            <span class="provider-mark"><i data-lucide="${item.has_key ? 'key-round' : 'key'}" class="w-4 h-4"></i></span>
            <span class="provider-info">
                <div class="provider-name">APIMart</div>
                <div class="provider-meta">${escapeHtml(item.base_url || APIMART_DEFAULT_BASE_URL)}</div>
            </span>
            <span class="provider-side-meta">
                <span class="provider-status-dot"></span>
                <span class="provider-protocol-pill">APIMART</span>
            </span>
        </button>
    `;
    refreshIcons();
}
function renderEditor(){
    const item = provider();
    if(editorTitle) editorTitle.textContent = 'APIMart';
    if(nameInput) nameInput.value = 'APIMart';
    if(idInput) idInput.value = 'apimart';
    if(idPreview) idPreview.textContent = 'apimart';
    if(baseInput) baseInput.value = item.base_url || APIMART_DEFAULT_BASE_URL;
    if(protocolInput) protocolInput.value = 'apimart';
    if(imageRequestModeInput) imageRequestModeInput.value = item.image_request_mode || 'openai';
    if(keyInput) keyInput.value = '';
    if(keyHint) keyHint.textContent = item.has_key ? `${tr('api.keySaved')}${item.key_preview || '******'}` : tr('api.noKey');
    renderProviderList();
    renderModels('image', imageModelList);
    renderModels('chat', chatModelList);
    renderModels('video', videoModelList);
}
function syncEditor(){
    const item = provider();
    item.base_url = (baseInput?.value || APIMART_DEFAULT_BASE_URL).trim().replace(/\/+$/, '') || APIMART_DEFAULT_BASE_URL;
    item.protocol = 'apimart';
    item.image_request_mode = imageRequestModeInput?.value || 'openai';
}
function modelList(kind){
    const item = provider();
    return kind === 'chat' ? item.chat_models : kind === 'video' ? item.video_models : item.image_models;
}
function setModelList(kind, values){
    const item = provider();
    if(kind === 'chat') item.chat_models = unique(values);
    else if(kind === 'video') item.video_models = unique(values);
    else item.image_models = unique(values);
}
function renderModels(kind, host){
    if(!host) return;
    const values = modelList(kind);
    if(!values.length){
        host.innerHTML = `<div class="empty">${tr('api.noModels')}</div>`;
        return;
    }
    host.innerHTML = values.map((model, index) => `
        <div class="model-row">
            <input value="${escapeHtml(model)}" onchange="updateModel('${kind}', ${index}, this.value)">
            <button class="icon-btn" type="button" onclick="removeModel('${kind}', ${index})"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
        </div>
    `).join('');
    refreshIcons();
}
function addModel(kind){
    const values = modelList(kind);
    values.push('');
    setModelList(kind, values);
    renderEditor();
}
function updateModel(kind, index, value){
    const values = modelList(kind);
    values[index] = value;
    setModelList(kind, values);
}
function removeModel(kind, index){
    const values = modelList(kind);
    values.splice(index, 1);
    setModelList(kind, values);
    renderEditor();
}
function showVerifyResult(html){
    if(!verifyResult) return;
    verifyResult.style.display = html ? 'block' : 'none';
    verifyResult.innerHTML = html || '';
}
async function saveProviders(extra = {}){
    syncEditor();
    setStatus(tr('api.saving'));
    try {
        const res = await fetch('/api/providers', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify([payloadProvider(extra)])
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.detail || tr('api.saveFailed'));
        providers = [normalizeProvider((data.providers || [])[0] || provider())];
        renderEditor();
        setStatus(tr('api.saved'));
        broadcastStudioApiChange('providers-changed');
        return true;
    } catch(err) {
        setStatus(err.message || tr('api.saveFailed'));
        return false;
    }
}
async function saveKeyOnly(){
    const key = (keyInput?.value || '').trim();
    if(!key){ setStatus(tr('api.enterApiKey')); return false; }
    return saveProviders({ api_key: key });
}
async function clearKeyOnly(){
    if(!confirm(tr('api.confirmClearKey'))) return false;
    return saveProviders({ clear_key: true });
}
async function loadProviders(){
    setStatus(tr('api.loading'));
    try {
        const res = await fetch('/api/providers');
        const data = await res.json();
        if(!res.ok) throw new Error(data.detail || tr('api.loadFailed'));
        providers = [normalizeProvider((data.providers || [])[0] || {})];
        selectedId = 'apimart';
        renderEditor();
        setStatus('');
    } catch(err) {
        providers = [normalizeProvider()];
        renderEditor();
        setStatus(err.message || tr('api.loadFailed'));
    }
}
async function testConnection(){
    syncEditor();
    setStatus(tr('api.testingUrl'));
    showVerifyResult('');
    try {
        const res = await fetch('/api/providers/test-connection', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                provider_id: 'apimart',
                base_url: provider().base_url,
                api_key: (keyInput?.value || '').trim() || undefined,
                protocol: 'apimart',
                image_request_mode: provider().image_request_mode || 'openai'
            })
        });
        const data = await res.json();
        if(!res.ok || data.ok === false) throw new Error(data.message || data.detail || tr('api.urlInvalid'));
        applyFetchedModels(data);
        showVerifyResult(`<span style="color:#15803d;font-size:11px;font-weight:800">✓ ${tr('api.urlValid')} · ${data.model_count || data.total || 0} models</span>`);
        setStatus(tr('api.urlValid'));
    } catch(err) {
        showVerifyResult(`<span style="color:#dc2626;font-size:11px;font-weight:800">${escapeHtml(err.message || tr('api.urlInvalid'))}</span>`);
        setStatus(err.message || tr('api.urlInvalid'));
    }
}
async function probeAsync(){
    syncEditor();
    setStatus(tr('api.testingUrl'));
    try {
        const res = await fetch('/api/providers/probe-async', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                provider_id: 'apimart',
                base_url: provider().base_url,
                api_key: (keyInput?.value || '').trim() || undefined,
                protocol: 'apimart',
                image_request_mode: provider().image_request_mode || 'openai'
            })
        });
        const data = await res.json();
        if(!res.ok || data.ok === false) throw new Error(data.message || data.detail || tr('api.urlInvalid'));
        showVerifyResult(`<span style="color:#15803d;font-size:11px;font-weight:800">✓ ${escapeHtml(data.message || tr('api.urlValid'))}</span>`);
        setStatus(data.message || tr('api.urlValid'));
    } catch(err) {
        showVerifyResult(`<span style="color:#dc2626;font-size:11px;font-weight:800">${escapeHtml(err.message || tr('api.urlInvalid'))}</span>`);
        setStatus(err.message || tr('api.urlInvalid'));
    }
}
function applyFetchedModels(data){
    fetchedModels = {
        image: unique(data.image_models || []),
        chat: unique(data.chat_models || []),
        video: unique(data.video_models || []),
        all: unique(data.all || [])
    };
    if(openPickerBtn){
        openPickerBtn.disabled = fetchedModels.all.length === 0;
        openPickerBtn.style.opacity = fetchedModels.all.length ? '1' : '.5';
    }
}
async function fetchModels(){
    syncEditor();
    setStatus(tr('api.fetchingModels'));
    if(fetchModelsBtn) fetchModelsBtn.disabled = true;
    try {
        const res = await fetch('/api/providers/fetch-models', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                provider_id: 'apimart',
                base_url: provider().base_url,
                api_key: (keyInput?.value || '').trim() || undefined,
                protocol: 'apimart',
                image_request_mode: provider().image_request_mode || 'openai'
            })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.detail || tr('api.loadFailed'));
        applyFetchedModels(data);
        if(fetchedModels.all.length) openModelPicker();
        setStatus(`${tr('api.fetchModels')} OK`);
    } catch(err) {
        setStatus(err.message || tr('api.loadFailed'));
    } finally {
        if(fetchModelsBtn) fetchModelsBtn.disabled = false;
    }
}
function selectPickerCat(cat){
    pickerCat = cat || 'all';
    renderModelPicker();
}
function pickerEntries(){
    const q = (pickerFilter?.value || '').trim().toLowerCase();
    const source = pickerCat === 'image' ? fetchedModels.image : pickerCat === 'chat' ? fetchedModels.chat : pickerCat === 'video' ? fetchedModels.video : fetchedModels.all;
    return unique(source).filter(model => !q || model.toLowerCase().includes(q));
}
function renderModelPicker(){
    document.querySelectorAll('.picker-cat-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.cat === pickerCat));
    document.querySelector('[data-cat="all"] .cat-count')?.replaceChildren(document.createTextNode(String(fetchedModels.all.length)));
    document.querySelector('[data-cat="image"] .cat-count')?.replaceChildren(document.createTextNode(String(fetchedModels.image.length)));
    document.querySelector('[data-cat="chat"] .cat-count')?.replaceChildren(document.createTextNode(String(fetchedModels.chat.length)));
    document.querySelector('[data-cat="video"] .cat-count')?.replaceChildren(document.createTextNode(String(fetchedModels.video.length)));
    const entries = pickerEntries();
    if(pickerCount) pickerCount.textContent = `${entries.length} / ${fetchedModels.all.length}`;
    if(sumImage) sumImage.textContent = `生图 ${fetchedModels.image.length}`;
    if(sumChat) sumChat.textContent = `LLM ${fetchedModels.chat.length}`;
    if(sumVideo) sumVideo.textContent = `视频 ${fetchedModels.video.length}`;
    if(sumUnsel) sumUnsel.textContent = '未选 0';
    if(!pickerList) return;
    pickerList.innerHTML = entries.map(model => `<label class="picker-model-row"><input type="checkbox" checked value="${escapeHtml(model)}"><span>${escapeHtml(model)}</span></label>`).join('');
}
function openModelPicker(){
    if(!modelPickerOverlay) return;
    modelPickerOverlay.style.display = 'flex';
    renderModelPicker();
}
function closeModelPicker(){
    if(modelPickerOverlay) modelPickerOverlay.style.display = 'none';
}
function applyModelPicker(){
    const selected = [...(pickerList?.querySelectorAll('input:checked') || [])].map(input => input.value);
    const selectedSet = new Set(selected);
    setModelList('image', fetchedModels.image.filter(model => selectedSet.has(model)));
    setModelList('chat', fetchedModels.chat.filter(model => selectedSet.has(model)));
    setModelList('video', fetchedModels.video.filter(model => selectedSet.has(model)));
    closeModelPicker();
    renderEditor();
}
function openRecommendApi(){
    if(!recommendApiOverlay) return;
    if(recommendApiList){
        recommendApiList.innerHTML = `
            <div class="recommend-api-card">
                <div class="recommend-api-title">APIMart</div>
                <div class="recommend-api-desc">${escapeHtml(tr('api.recommendApimartSummary'))}</div>
                <button class="action-btn primary-btn" type="button" onclick="closeRecommendApi()">OK</button>
            </div>
        `;
    }
    recommendApiOverlay.style.display = 'flex';
    refreshIcons();
}
function closeRecommendApi(){
    if(recommendApiOverlay) recommendApiOverlay.style.display = 'none';
}
function broadcastStudioApiChange(type='providers-changed'){
    try {
        localStorage.setItem('studio_api_updated_at', String(Date.now()));
        localStorage.setItem('studio_api_update_type', type);
        window.parent?.postMessage({type:'studio-api-changed', change:type, updated_at:Date.now()}, '*');
    } catch(e) {}
}

recommendApiOverlay?.addEventListener('mousedown', event => {
    if(event.target === recommendApiOverlay) closeRecommendApi();
});
modelPickerOverlay?.addEventListener('mousedown', event => {
    if(event.target === modelPickerOverlay) closeModelPicker();
});
window.addEventListener('message', event => {
    if(event.data?.type === 'studio-theme' && window.StudioTheme) window.StudioTheme.set(event.data.theme);
    if(event.data?.type === 'studio-lang' && window.StudioI18n) {
        window.StudioI18n.set(event.data.lang);
        renderEditor();
    }
});
window.addEventListener('studio-lang-change', renderEditor);
window.onload = () => {
    if(window.StudioTheme) window.StudioTheme.apply();
    if(window.StudioI18n) window.StudioI18n.apply();
    loadProviders();
};
