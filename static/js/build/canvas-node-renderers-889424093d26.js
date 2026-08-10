(()=>{function N(t){var O,B;const a=document.createElement("div");a.className="generator-body";const b=t.msgenModel||"zimage",p=MS_GEN_MODELS[b]||MS_GEN_MODELS.zimage,C=generatorSources(t),v=orderedSources(t,C),m=v.filter(e=>{var o;return(o=e.refs)==null?void 0:o.some(c=>["image","video","audio"].includes(mediaKindForRef(c)))}),P=v.filter(e=>{var o;return e.prompt&&!((o=e.refs)!=null&&o.length)}),w=v.flatMap(e=>e.refs||[]),d=b==="custom",r=!!(p.supportsImage||p.acceptsImage);t.msCustomModel=t.msCustomModel||modelscopeImageModels()[0]||"Tongyi-MAI/Z-Image-Turbo";const S=currentMsModelId(b,t),h=modelscopeLorasForModel(S),$=h.find(e=>String(e.id||"").trim()===String(t.msLoraId||"").trim())||h[0],y=!!t.msLoraEnabled,i=(B=t.msLoraStrength)!=null?B:Number((O=$==null?void 0:$.strength)!=null?O:.8),l=Math.max(1,Math.min(8,Number(t.count||1))),g=isCanvasGeneratorComposerOpen(t),s=hasInlineGeneratedContent(t);a.innerHTML=`
        <div class="canvas-gen-shell ${g?"composer-open":"composer-closed"}">
            <div class="canvas-gen-stage ${s?"has-inline-output":""}" data-stage="Image">
                <div class="canvas-gen-stage-head">
                    <span><i data-lucide="sparkles" class="w-3.5 h-3.5"></i></span>
                    ${s?`<span class="canvas-gen-output-count">${inlineGeneratedOutputItems(t).length||(t._pending||[]).length}</span>`:""}
                </div>
                <div class="canvas-gen-stage-content">
                    <div class="input-list ms-img-list"></div>
                </div>
            </div>
            <div class="canvas-gen-composer ${g?"is-open":"is-collapsed"}">
                <div class="canvas-gen-composer-tools">
                    <button type="button" class="canvas-gen-icon active" title="${escapeHtml(tr("canvas.modelscopeGenerate"))}"><i data-lucide="sparkles" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-tool-divider"></span>
                    <button type="button" class="canvas-gen-icon" onclick="pickAndConnectUpload('${t.id}', event)" title="\u4E0A\u4F20\u53C2\u8003\u7D20\u6750"><i data-lucide="plus" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-mode-copy">${escapeHtml(tr("canvas.modelscopeGenerate"))}</span>
                    <button type="button" class="canvas-gen-panel-close" data-close-composer title="${langIsEn()?"Collapse":"\u6536\u8D77"}"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div class="ms-model-tabs">
                    ${Object.entries(MS_GEN_MODELS).map(([e,o])=>`<button type="button" data-model="${e}" class="${b===e?"active":""}">${escapeHtml(o.labelKey?tr(o.labelKey):o.label)}</button>`).join("")}
                </div>
                <div class="prompt-list"></div>
                <div class="ms-controls">
                    <div class="gen-settings">
                ${d?`
                <div class="gen-settings-row">
                    <select class="select-lite ms-custom-model-select">${modelscopeImageModelOptions(t.msCustomModel)}</select>
                </div>
                `:""}
                <div class="gen-settings-row">
                    <select class="select-lite resolution compact-select" data-field="msResolution">
                        <option value="1k">1K</option>
                        <option value="2k">2K</option>
                        <option value="4k">4K</option>
                    <option value="custom">${tr("canvas.custom")}</option>
                </select>
                <select class="select-lite ratio compact-select" data-field="msRatio">
                    <option value="square">1:1</option>
                    <option value="portrait">2:3</option>
                    <option value="landscape">3:2</option>
                        <option value="portrait43">3:4</option>
                        <option value="landscape43">4:3</option>
                        <option value="story">9:16</option>
                        <option value="wide">16:9</option>
                        <option value="ultrawide">21:9</option>
                        <option value="ultratall">9:21</option>
                        <option value="custom">${tr("canvas.custom")}</option>
                    </select>
                    <div class="gen-count-row">
                        <div class="gen-stepper">
                            <button class="gen-step-btn" data-ms-step="-1" type="button" title="${tr("canvas.decrease")}" aria-label="${tr("canvas.decreaseCount")}"><i data-lucide="chevron-left" class="w-3.5 h-3.5"></i></button>
                            <input class="gen-count-input ms-count-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${l}">
                            <button class="gen-step-btn" data-ms-step="1" type="button" title="${tr("canvas.increase")}" aria-label="${tr("canvas.increaseCount")}"><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                </div>
                <div class="gen-settings-row ms-custom-ratio-row" style="display:none">
                    <label class="field">
                        <div class="setting-title">${tr("canvas.ratioWidth")}</div>
                        <input class="setting-input ms-custom-ratio-w-input" type="number" min="1" step="1" value="${escapeHtml(t.msCustomRatioWidth||"")}" placeholder="4">
                    </label>
                    <label class="field">
                        <div class="setting-title">${tr("canvas.ratioHeight")}</div>
                        <input class="setting-input ms-custom-ratio-h-input" type="number" min="1" step="1" value="${escapeHtml(t.msCustomRatioHeight||"")}" placeholder="3">
                    </label>
                </div>
                <div class="gen-settings-row ms-custom-size-row" style="display:none">
                    <label class="field">
                        <div class="setting-title">${tr("canvas.width")}</div>
                        <input class="setting-input ms-custom-w-input" type="number" min="64" step="64" value="${escapeHtml(t.msCustomWidth||"")}" placeholder="Auto">
                    </label>
                    <label class="field">
                        <div class="setting-title">${tr("canvas.height")}</div>
                        <input class="setting-input ms-custom-h-input" type="number" min="64" step="64" value="${escapeHtml(t.msCustomHeight||"")}" placeholder="Auto">
                    </label>
                    <button class="secondary-btn ms-fit-size-btn" type="button" style="height:32px;align-self:flex-end;padding:0 10px;font-size:11px">${tr("canvas.fitImageSize")}</button>
                </div>
                ${h.length?`
                <div class="gen-settings-row">
                    <label class="setting-check" style="cursor:pointer">
                        <input type="checkbox" class="ms-lora-check" ${t.msLoraEnabled?"checked":""}>
                        <span style="font-size:11px;font-weight:700">${tr("canvas.enableLora")}</span>
                    </label>
                </div>
                ${t.msLoraEnabled?`
                <div class="gen-settings-row">
                    <label class="field" style="flex:1">
                        <div class="setting-title">LoRA</div>
                        <select class="select-lite ms-lora-select">${modelscopeLoraOptions(h,String(($==null?void 0:$.id)||"").trim())}</select>
                    </label>
                </div>
                <div class="gen-settings-row">
                    <label class="field" style="flex:1">
                        <div class="setting-title" style="display:flex;justify-content:space-between">
                            <span>${tr("canvas.loraStrength")}</span><span class="ms-lora-strength-val">${i.toFixed(2)}</span>
                        </div>
                        <input type="range" class="canvas-range ms-lora-strength-slider" min="0.1" max="1.0" step="0.05" value="${i}">
                    </label>
                </div>`:""}`:""}
                ${h.length?"":`<div class="gen-settings-row"><div style="color:var(--faint);font-size:11px;font-weight:700;line-height:1.45">${tr("canvas.noLoraForModel")}</div></div>`}
                    </div>
                    <div class="gen-run-row">
                        <button class="gen-btn ${t.running?"running":""}" ${t.running?"disabled":""}>
                            <i data-lucide="zap" class="w-4 h-4"></i>${t.running?tr("canvas.generating"):tr("canvas.msGenerate")}
                        </button>
                        ${cascadeBtnHtml(t)}
                    </div>
                    ${retryBarHtml(t)}
                </div>
            </div>
        </div>
    `,a.querySelectorAll(".ms-model-tabs button").forEach(e=>{e.onclick=o=>{o.stopPropagation(),t.msgenModel!==e.dataset.model&&(t.msLoraId="",delete t.msLoraStrength,t.msLoraEnabled=!1),t.msgenModel=e.dataset.model,render(),scheduleSave()}});const n=a.querySelector(".ms-custom-model-select");n&&(n.onmousedown=e=>e.stopPropagation(),n.onclick=e=>e.stopPropagation(),n.onchange=e=>{e.stopPropagation(),t.msCustomModel=e.target.value,t.msLoraId="",delete t.msLoraStrength,t.msLoraEnabled=!1,scheduleSave(),render()});const f=a.querySelector('[data-field="msRatio"]'),q=a.querySelector('[data-field="msResolution"]');if(f&&q){const e=a.querySelector(".ms-custom-ratio-row"),o=a.querySelector(".ms-custom-size-row"),c=a.querySelector(".ms-custom-ratio-w-input"),R=a.querySelector(".ms-custom-ratio-h-input"),G=a.querySelector(".ms-custom-w-input"),W=a.querySelector(".ms-custom-h-input"),T=a.querySelector(".ms-fit-size-btn");if((!t.msCustomRatioWidth||!t.msCustomRatioHeight)&&t.msCustomRatio){const u=String(t.msCustomRatio||"");if(u.includes(":")){const[I,k]=u.split(":");t.msCustomRatioWidth=t.msCustomRatioWidth||I,t.msCustomRatioHeight=t.msCustomRatioHeight||k}}if((!t.msCustomWidth||!t.msCustomHeight)&&t.msCustomSize){const u=parseSizeValue(t.msCustomSize);t.msCustomWidth=t.msCustomWidth||(u==null?void 0:u.width)||"",t.msCustomHeight=t.msCustomHeight||(u==null?void 0:u.height)||""}const z=()=>{const u=t.msRatio&&[...f.options].some(I=>I.value===t.msRatio)?t.msRatio:"square";f.value=u,q.value=t.msResolution||"1k",f.disabled=t.msResolution==="custom",e.style.display=t.msRatio==="custom"?"flex":"none",o.style.display=t.msResolution==="custom"?"flex":"none",c.value=t.msCustomRatioWidth||"",R.value=t.msCustomRatioHeight||"",G.value=t.msCustomWidth||"",W.value=t.msCustomHeight||"",T&&(T.disabled=!w.some(I=>I.url))};f.onmousedown=u=>u.stopPropagation(),f.onclick=u=>u.stopPropagation(),f.onchange=u=>{u.stopPropagation(),t.msRatio=u.target.value,t.msRatio!=="custom"&&(t.msCustomRatio="",t.msCustomRatioWidth="",t.msCustomRatioHeight=""),z(),scheduleSave()},q.onmousedown=u=>u.stopPropagation(),q.onclick=u=>u.stopPropagation(),q.onchange=u=>{u.stopPropagation(),t.msResolution=u.target.value,t.msResolution==="custom"?t.msRatio="":t.msRatio?(t.msCustomSize="",t.msCustomWidth="",t.msCustomHeight=""):(t.msRatio="square",t.msCustomSize="",t.msCustomWidth="",t.msCustomHeight=""),z(),scheduleSave()},[c,R].forEach(u=>{u.onmousedown=I=>I.stopPropagation(),u.onclick=I=>I.stopPropagation(),u.oninput=()=>{t.msCustomRatioWidth=c.value,t.msCustomRatioHeight=R.value,t.msCustomRatio=t.msCustomRatioWidth&&t.msCustomRatioHeight?`${t.msCustomRatioWidth}:${t.msCustomRatioHeight}`:"",t.msRatio="custom",z(),scheduleSave()}}),[G,W].forEach(u=>{u.onmousedown=I=>I.stopPropagation(),u.onclick=I=>I.stopPropagation(),u.oninput=()=>{t.msCustomWidth=G.value,t.msCustomHeight=W.value,t.msCustomSize=t.msCustomWidth&&t.msCustomHeight?`${t.msCustomWidth}x${t.msCustomHeight}`:"",t.msResolution="custom",t.msRatio="",z(),scheduleSave()}}),T&&(T.onmousedown=u=>u.stopPropagation(),T.onclick=async u=>{u.stopPropagation();const I=w.find(k=>k.url);if(I)try{const k=await getImageDimensions(I.url);t.msCustomWidth=k.width,t.msCustomHeight=k.height,t.msCustomSize=`${k.width}x${k.height}`,t.msResolution="custom",t.msRatio="",z(),scheduleSave()}catch(k){showErrorModal(tr("canvas.imageReadFailed"))}}),z()}const M=a.querySelector(".ms-count-input");M&&(M.onmousedown=e=>e.stopPropagation(),M.onclick=e=>e.stopPropagation(),M.oninput=e=>{t.count=Math.max(1,Math.min(8,Number(e.target.value)||1)),scheduleSave()},M.onblur=e=>{e.target.value=String(Math.max(1,Math.min(8,Number(t.count||1))))},a.querySelectorAll("[data-ms-step]").forEach(e=>{e.onclick=o=>{o.stopPropagation();const c=Math.max(1,Math.min(8,Number(t.count||1)+Number(e.dataset.msStep||0)));t.count=c,M.value=String(c),scheduleSave()}}));const L=a.querySelector(".ms-lora-check");L&&(L.onchange=e=>{var o;t.msLoraEnabled=e.target.checked,t.msLoraEnabled&&!t.msLoraId&&h[0]&&(t.msLoraId=String(h[0].id||"").trim(),t.msLoraStrength=Number((o=h[0].strength)!=null?o:.8)),scheduleSave(),render()});const E=a.querySelector(".ms-lora-select");E&&(E.onmousedown=e=>e.stopPropagation(),E.onclick=e=>e.stopPropagation(),E.onchange=e=>{var c,R;t.msLoraId=e.target.value;const o=h.find(G=>String(G.id||"").trim()===t.msLoraId);t.msLoraStrength=Number((R=(c=o==null?void 0:o.strength)!=null?c:t.msLoraStrength)!=null?R:.8),scheduleSave(),render()});const x=a.querySelector(".ms-lora-strength-slider");if(x&&(x.onmousedown=e=>e.stopPropagation(),x.onclick=e=>e.stopPropagation(),x.oninput=e=>{t.msLoraStrength=parseFloat(e.target.value);const o=a.querySelector(".ms-lora-strength-val");o&&(o.textContent=t.msLoraStrength.toFixed(2)),scheduleSave()}),a.querySelectorAll(".setting-check").forEach(e=>{e.onmousedown=c=>c.stopPropagation();const o=e.querySelector('input[type="checkbox"]');o&&(e.onclick=c=>{c.stopPropagation(),c.preventDefault(),o.checked=!o.checked,o.dispatchEvent(new Event("change"))},o.onclick=c=>c.stopPropagation())}),r){const e=a.querySelector(".ms-img-list");renderImageInputList(e,t,m)}renderPromptPreview(a.querySelector(".prompt-list"),P);const H=a.querySelector(".canvas-gen-stage-content");return H&&(s?renderInlineGeneratedOutputs(H,t):r||(H.innerHTML=canvasEmptyImageStageHtml())),a.querySelector(".gen-btn").onclick=e=>{e.stopPropagation(),runCanvasGenerate(t.id)},bindCascadeButtons(a,t.id),bindCanvasInputPanelToggle(a,t),a}function A(t){const a=document.createElement("div");a.className="loop-body",t.count=loopCount(t),t.loopStart=Math.max(1,Number(t.loopStart)||1),t.imageBatchSize=Math.max(1,Math.min(100,Number(t.imageBatchSize)||1)),t.mode=t.mode==="parallel"?"parallel":"serial",t.showPrompt=!!t.showPrompt,t.imageInput=!!t.imageInput,t.videoInput=!1;const b=loopInputImageRefs(t,{index:t.loopStart}).length,p=t.showPrompt?loopInputPromptItems(t).length:0,C=p>0,v=findLoopCascadeTarget(t.id),m=v?computeCascadeOrder(v):[],P=v?isCascadeActive(v)?`<div class="gen-run-row"><button class="gen-cascade-btn gen-cascade-stop" type="button" data-loop-cascade-stop="${v}" ${isCascadeStopping(v)?"disabled":""}><i data-lucide="square" class="w-4 h-4"></i><span>${isCascadeStopping(v)?"\u505C\u6B62\u4E2D\u2026":"\u505C\u6B62\u8FD0\u884C"}</span></button></div>`:`<div class="gen-run-row"><button class="gen-cascade-btn" type="button" data-loop-cascade="${v}" title="\u4ECE\u5F53\u524D\u5FAA\u73AF\u8282\u70B9\u542F\u52A8\u6574\u6761\u5DE5\u4F5C\u6D41"><i data-lucide="play-circle" class="w-4 h-4"></i><span>\u5F00\u59CB ${m.length||1} \u4E2A\u8282\u70B9 \xD7 ${t.count} ${tr("canvas.loopRounds")}</span></button></div>`:"";a.innerHTML=`
        <div class="loop-count-row">
            <div class="loop-run-row">
                <div class="loop-count-group">
                    <span class="loop-count-label">${tr("canvas.loopCount")}</span>
                    <input class="loop-count-input" type="number" min="1" max="100" step="1" value="${t.count}">
                </div>
                <div class="seg loop-mode">
                    <button type="button" data-loop-mode="serial" class="${t.mode!=="parallel"?"active":""}">${tr("canvas.loopSerial")}</button>
                    <button type="button" data-loop-mode="parallel" class="${t.mode==="parallel"?"active":""}">${tr("canvas.loopParallel")}</button>
                </div>
            </div>
            <div class="loop-toggle-row">
                <button class="loop-toggle loop-image-toggle ${t.imageInput?"active":""}" type="button"><i data-lucide="image" class="w-3.5 h-3.5"></i>${tr("canvas.loopImageToggle")}</button>
                <button class="loop-toggle loop-prompt-toggle ${t.showPrompt?"active":""}" type="button"><i data-lucide="text-cursor-input" class="w-3.5 h-3.5"></i>${tr("canvas.loopPromptToggle")}</button>
            </div>
        </div>
        ${t.imageInput?`<div class="loop-image-panel">
            <div class="loop-image-row">
                <span class="loop-count-label">${tr("canvas.loopImageStart")}</span>
                <input class="loop-count-input loop-image-start-input" type="number" min="1" max="9999" step="1" value="${t.loopStart}">
                <span class="loop-count-label">${tr("canvas.loopBatchSize")}</span>
                <input class="loop-count-input loop-batch-input" type="number" min="1" max="100" step="1" value="${t.imageBatchSize}">
            </div>
            <div class="loop-image-hint loop-image-hint-only">${b?trf("canvas.loopImageWillOutput",{n:b}):tr("canvas.loopImageEmpty")}</div>
        </div>`:""}
        ${t.showPrompt?`<div class="loop-prompt-panel ${C?"has-upstream":""}">
            <div class="loop-field">
                <div class="loop-variable-editor ${C?"is-disabled":""}" contenteditable="${C?"false":"true"}" data-placeholder="${escapeAttr(tr("canvas.loopVariablePlaceholder"))}">${loopVariableHtml(t.variablePrompt||"")}</div>
            </div>
            ${C?`<div class="loop-prompt-hint">\u5DF2\u8BC6\u522B ${p} \u6761\u63D0\u793A\u8BCD\uFF0C\u6309\u8BA1\u6570\u8F6E\u6D41\u8F93\u51FA</div>`:""}
            <div class="loop-start-row">
                <button class="loop-token-btn loop-counter-token-btn" type="button" data-token="\u300A\u8BA1\u6570\u300B">${tr("canvas.counterToken")}</button>
                <span class="loop-count-label">${tr("canvas.loopStart")}</span>
                <input class="loop-count-input loop-start-input" type="number" min="1" max="9999" step="1" value="${t.loopStart}">
            </div>
        </div>`:""}
        ${P}
    `;const w=a.querySelector(".loop-count-input"),d=a.querySelector(".loop-variable-editor"),r=a.querySelector(".loop-prompt-toggle"),S=a.querySelector(".loop-image-toggle");d&&(d.onmousedown=s=>s.stopPropagation(),d.onclick=s=>s.stopPropagation(),d.onwheel=s=>s.stopPropagation());const h=()=>{const s=a.querySelector(".loop-preview:last-child");s&&(s.textContent=renderLoopPrompt(t,{index:1,total:loopCount(t)})||tr("canvas.noPromptMeta"))},$=()=>{const s=a.querySelector(".loop-image-hint-only");if(!s)return;const n=loopInputImageRefs(t,{index:t.loopStart}).length;s.textContent=n?trf("canvas.loopImageWillOutput",{n}):tr("canvas.loopImageEmpty")},y=s=>{a.querySelectorAll(".loop-image-start-input, .loop-start-input").forEach(n=>{n!==s&&n.value!==String(t.loopStart)&&(n.value=t.loopStart)})};w.oninput=s=>{t.count=loopCount({count:s.target.value}),s.target.value=t.count,h();const n=a.querySelector("[data-loop-cascade]");if(n){const f=n.querySelector("span");f&&(f.textContent=`\u5F00\u59CB ${m.length||1} \u4E2A\u8282\u70B9 \xD7 ${t.count} ${tr("canvas.loopRounds")}`)}if(v){const f=document.querySelector(`.node[data-id="${v}"]`),q=f==null?void 0:f.querySelector("[data-cascade]");if(q){const M=q.querySelector("span");if(M){const L=computeCascadeOrder(v);M.textContent=`\u4E00\u952E\u8FD0\u884C ${L.length} \u4E2A\u8282\u70B9 \xD7 ${t.count} ${tr("canvas.loopRounds")}`}}}scheduleSave()};const i=a.querySelector(".loop-start-input");i&&(i.onmousedown=s=>s.stopPropagation(),i.onclick=s=>s.stopPropagation(),i.oninput=s=>{t.loopStart=Math.max(1,Number(s.target.value)||1),$(),y(s.target),scheduleSave(),syncGeneratorInputs(),refreshGeneratorInputViews()});const l=a.querySelector(".loop-image-start-input");l&&(l.onmousedown=s=>s.stopPropagation(),l.onclick=s=>s.stopPropagation(),l.oninput=s=>{t.loopStart=Math.max(1,Number(s.target.value)||1),$(),y(s.target),scheduleSave(),syncGeneratorInputs(),refreshGeneratorInputViews()});const g=a.querySelector(".loop-batch-input");return g&&(g.onmousedown=s=>s.stopPropagation(),g.onclick=s=>s.stopPropagation(),g.oninput=s=>{t.imageBatchSize=Math.max(1,Math.min(100,Number(s.target.value)||1)),s.target.value=t.imageBatchSize,$(),scheduleSave(),syncGeneratorInputs(),refreshGeneratorInputViews()}),a.querySelectorAll("[data-loop-mode]").forEach(s=>{s.onclick=n=>{n.stopPropagation(),t.mode=s.dataset.loopMode==="parallel"?"parallel":"serial",render(),scheduleSave()}}),r.onclick=s=>{s.stopPropagation();const n=!t.showPrompt;t.showPrompt=n,autoSizeLoopNode(t,n),autoSizeLoopForPanels(t),n||(connections=connections.filter(f=>f.to!==t.id||canConnect(f.from,t.id))),render(),scheduleSave(),syncGeneratorInputs(),refreshGeneratorInputViews()},d&&(d.oninput=s=>{t.variablePrompt=loopEditorText(d),h(),scheduleSave(),syncGeneratorInputs(),refreshGeneratorInputViews()},d.addEventListener("click",s=>{var f;const n=s.target.closest(".loop-token-chip button");n&&(s.preventDefault(),s.stopPropagation(),(f=n.closest(".loop-token-chip"))==null||f.remove(),t.variablePrompt=loopEditorText(d),h(),scheduleSave(),syncGeneratorInputs(),refreshGeneratorInputViews())})),a.querySelectorAll("[data-token]").forEach(s=>{s.onclick=n=>{n.stopPropagation();const f=s.dataset.token||"";d&&(insertLoopToken(d,f),t.variablePrompt=loopEditorText(d),d.focus(),h(),scheduleSave(),syncGeneratorInputs(),refreshGeneratorInputViews())}}),S&&(S.onclick=s=>{s.stopPropagation(),t.imageInput=!t.imageInput,t.imageInput?(t.loopStart=Math.max(1,Number(t.loopStart)||1),t.imageBatchSize=Math.max(1,Math.min(100,Number(t.imageBatchSize)||1))):connections=connections.filter(n=>n.to!==t.id||canConnect(n.from,t.id)),autoSizeLoopForPanels(t),render(),scheduleSave(),syncGeneratorInputs(),refreshGeneratorInputViews()}),a.querySelectorAll("[data-loop-cascade]").forEach(s=>{s.onmousedown=n=>n.stopPropagation(),s.onclick=n=>{n.stopPropagation(),runNodeCascade(s.dataset.loopCascade)}}),a.querySelectorAll("[data-loop-cascade-stop]").forEach(s=>{s.onmousedown=n=>n.stopPropagation(),s.onclick=n=>{n.stopPropagation(),requestCascadeStop(s.dataset.loopCascadeStop)}}),a}function _(t){const a=document.createElement("div");a.className="llm-body";const b=t.mode||"node";t.llmProvider=resolveChatProviderId(t.llmProvider||"comfly");const p=t.llmProvider;p==="modelscope"&&(t.model=t.llmMsModel||t.model),providerChatModels(p).includes(t.model)||(t.model=providerChatModels(p)[0]||t.model);const C=chatModelOptions(t.model,p),v=llmInputImages(t),m=llmInputVideos(t),P=[v.length?`${v.length} \u5F20\u56FE\u7247`:"",m.length?`${m.length} \u4E2A\u89C6\u9891`:""].filter(Boolean).join(" \xB7 "),w=P?`<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;background:rgba(16,185,129,.12);color:#047857;font-size:10.5px;font-weight:700;width:fit-content;line-height:1.4"><i data-lucide="${m.length&&!v.length?"video":"image"}" class="w-3 h-3"></i>\u5DF2\u8FDE\u63A5 ${P} \xB7 \u9700\u9009\u652F\u6301\u89C6\u89C9/\u89C6\u9891\u7684\u6A21\u578B</div>`:"";t.showSystem=!!t.showSystem,a.innerHTML=`
        <div class="llm-row">
            <select class="select-lite llm-provider-select" style="flex:1">${chatProviderOptions(p)}</select>
            <select class="select-lite llm-model">${C}</select>
            <div class="llm-mode"><button data-mode="node">${tr("canvas.nodeMode")}</button><button data-mode="chat">${tr("canvas.chatMode")}</button></div>
            <button class="llm-sys-toggle ${t.showSystem?"active":""}" type="button">System</button>
        </div>
        ${w}
        ${t.showSystem?`<textarea class="llm-system" placeholder="${tr("canvas.systemPrompt")}">${escapeHtml(t.systemPrompt||"")}</textarea>`:""}
        <div class="llm-node-pane"></div>
        <div class="llm-chat-pane"></div>
    `;const d=a.querySelector(".llm-provider-select"),r=a.querySelector(".llm-model");d.value=p,r.value=resolveChatModel(t.model,p),[d,r].forEach(y=>{y.onmousedown=i=>i.stopPropagation(),y.onclick=i=>i.stopPropagation()}),d.onchange=y=>{y.stopPropagation(),t.llmProvider=y.target.value;const i=providerChatModels(t.llmProvider);t.model=i[0]||"",t.llmProvider==="modelscope"&&(t.llmMsModel=t.model),render(),scheduleSave()},r.onchange=y=>{y.stopPropagation(),t.model=y.target.value,(t.llmProvider||"comfly")==="modelscope"&&(t.llmMsModel=y.target.value),scheduleSave()},a.querySelector(".llm-sys-toggle").onclick=y=>{y.stopPropagation(),t.showSystem=!t.showSystem,render(),scheduleSave()};const S=a.querySelector(".llm-system");S&&(S.oninput=y=>{t.systemPrompt=y.target.value,scheduleSave()},bindScrollableText(S)),a.querySelectorAll("[data-mode]").forEach(y=>{y.classList.toggle("active",b===y.dataset.mode),y.onclick=i=>{i.stopPropagation(),t.mode=y.dataset.mode,render(),scheduleSave()}});const h=a.querySelector(".llm-node-pane"),$=a.querySelector(".llm-chat-pane");return b==="chat"?(h.style.display="none",renderLLMChatPane($,t)):($.style.display="none",renderLLMNodePane(h,t)),a}function V(t){const a=document.createElement("div");a.className="generator-body";const b=generatorSources(t),p=orderedSources(t,b),C=p.filter(e=>{var o;return(o=e.refs)==null?void 0:o.some(c=>["image","video","audio"].includes(mediaKindForRef(c)))}),v=p.filter(e=>{var o;return e.prompt&&!((o=e.refs)!=null&&o.length)});sanitizeImageNodeProviderModel(t),normalizeApiNodeSizeChoice(t);const m=isCanvasGeneratorComposerOpen(t),P=hasInlineGeneratedContent(t);a.innerHTML=`
        <div class="canvas-gen-shell ${m?"composer-open":"composer-closed"}">
            <div class="canvas-gen-stage ${P?"has-inline-output":""}" data-stage="Image">
                <div class="canvas-gen-stage-head">
                    <span><i data-lucide="sparkles" class="w-3.5 h-3.5"></i></span>
                    ${P?`<span class="canvas-gen-output-count">${inlineGeneratedOutputItems(t).length||(t._pending||[]).length}</span>`:""}
                </div>
                <div class="canvas-gen-stage-content">
                    <div class="input-list"></div>
                </div>
            </div>
            <div class="canvas-gen-composer ${m?"is-open":"is-collapsed"}">
                <div class="canvas-gen-composer-tools">
                    <button type="button" class="canvas-gen-icon active" title="${escapeHtml(tr("canvas.apiGenerate"))}"><i data-lucide="sparkles" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-tool-divider"></span>
                    <button type="button" class="canvas-gen-icon" onclick="pickAndConnectUpload('${t.id}', event)" title="\u4E0A\u4F20\u53C2\u8003\u7D20\u6750"><i data-lucide="plus" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-mode-copy">${escapeHtml(tr("canvas.apiGenerate"))}</span>
                    <button type="button" class="canvas-gen-panel-close" data-close-composer title="${langIsEn()?"Collapse":"\u6536\u8D77"}"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div class="prompt-list mb-3"></div>
                <div class="gen-settings">
            <div class="gen-settings-row">
                <select class="select-lite provider-select">${providerOptions(t.apiProvider)}</select>
                <select class="select-lite model-select">${imageModelOptions(t.model,t.apiProvider)}</select>
            </div>
            <div class="gen-settings-row api-size-row">
                <select class="select-lite resolution compact-select" data-field="resolution">
                    <option value="auto">\u81EA\u52A8</option>
                    <option value="1k">1K</option>
                    <option value="2k">2K</option>
                    <option value="4k">4K</option>
                    <option value="custom">${tr("canvas.custom")}</option>
                </select>
                <select class="select-lite ratio compact-select" data-field="ratio">
                    <option value="square">1:1</option>
                    <option value="portrait">2:3</option>
                    <option value="landscape">3:2</option>
                    <option value="portrait43">3:4</option>
                    <option value="landscape43">4:3</option>
                    <option value="story">9:16</option>
                    <option value="wide">16:9</option>
                    <option value="ultrawide">21:9</option>
                    <option value="ultratall">9:21</option>
                    <option value="source">${tr("canvas.adaptiveRatio")}</option>
                    <option value="custom">${tr("canvas.custom")}</option>
                </select>
                <select class="select-lite quality-select">
                    <option value="auto">Q auto</option>
                    <option value="low">Q low</option>
                    <option value="medium">Q med</option>
                    <option value="high">Q high</option>
                </select>
                <div class="gen-count-row">
                    <div class="gen-stepper">
                        <button class="gen-step-btn" data-step="-1" type="button" title="${tr("canvas.decrease")}" aria-label="${tr("canvas.decreaseCount")}"><i data-lucide="chevron-left" class="w-3.5 h-3.5"></i></button>
                        <input class="gen-count-input" type="text" inputmode="numeric" pattern="[0-9]*" value="${Math.max(1,Math.min(8,Number(t.count||1)))}">
                        <button class="gen-step-btn" data-step="1" type="button" title="${tr("canvas.increase")}" aria-label="${tr("canvas.increaseCount")}"><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>
            </div>
            <div class="gen-settings-row custom-ratio-row" style="display:none">
                <label class="field">
                    <div class="setting-title">${tr("canvas.ratioWidth")}</div>
                    <input class="setting-input custom-ratio-w-input" type="number" min="1" step="1" value="${escapeHtml(t.customRatioWidth||"")}" placeholder="4">
                </label>
                <label class="field">
                    <div class="setting-title">${tr("canvas.ratioHeight")}</div>
                    <input class="setting-input custom-ratio-h-input" type="number" min="1" step="1" value="${escapeHtml(t.customRatioHeight||"")}" placeholder="3">
                </label>
            </div>
            <div class="gen-settings-row custom-size-row" style="display:none">
                <label class="field">
                    <div class="setting-title">${tr("canvas.width")}</div>
                    <input class="setting-input custom-w-input" type="number" min="64" step="64" value="${escapeHtml(t.customWidth||"")}" placeholder="Auto">
                </label>
                <label class="field">
                    <div class="setting-title">${tr("canvas.height")}</div>
                    <input class="setting-input custom-h-input" type="number" min="64" step="64" value="${escapeHtml(t.customHeight||"")}" placeholder="Auto">
                </label>
                <button class="secondary-btn fit-size-btn" type="button" style="height:32px;align-self:flex-end;padding:0 10px;font-size:11px">${tr("canvas.fitImageSize")}</button>
            </div>
                </div>
                <div class="gen-run-row">
                    <button class="gen-btn ${t.running?"running":""}" ${t.running?"disabled":""}><i data-lucide="zap" class="w-4 h-4"></i>${t.running?tr("canvas.generating"):tr("canvas.apiGenerate")}</button>
                    ${cascadeBtnHtml(t)}
                </div>
                ${retryBarHtml(t)}
            </div>
        </div>
    `;const w=a.querySelector(".provider-select"),d=a.querySelector(".model-select");w.onmousedown=e=>e.stopPropagation(),w.onclick=e=>e.stopPropagation(),w.onchange=e=>{e.stopPropagation(),t.apiProvider=e.target.value;const o=providerImageModels(t.apiProvider);o.includes(resolveImageModel(t.model))||(t.model=o[0]||""),t._apiResolutionUserSet=!1,t.resolution=defaultApiImageResolution(t.model),d.innerHTML=imageModelOptions(t.model,t.apiProvider),x(),q(),scheduleSave()},d.onmousedown=e=>e.stopPropagation(),d.onclick=e=>e.stopPropagation(),d.onchange=e=>{e.stopPropagation(),t.model=e.target.value,t._apiResolutionUserSet=!1,t.resolution!=="custom"&&(t.resolution=defaultApiImageResolution(t.model)),x(),q(),scheduleSave()};const r=a.querySelector(".ratio"),S=a.querySelector(".resolution"),h=a.querySelector(".quality-select"),$=a.querySelector(".custom-ratio-row"),y=a.querySelector(".custom-size-row"),i=a.querySelector(".custom-ratio-w-input"),l=a.querySelector(".custom-ratio-h-input"),g=a.querySelector(".custom-w-input"),s=a.querySelector(".custom-h-input"),n=a.querySelector(".fit-size-btn"),f=p.flatMap(e=>e.refs||[]),q=()=>{h.disabled=!1,["auto","low","medium","high"].includes(String(t.quality||"auto"))||(t.quality="auto"),h.value=t.quality||"auto"};(()=>{if((!t.customRatioWidth||!t.customRatioHeight)&&t.customRatio){const e=String(t.customRatio||"");if(e.includes(":")){const[o,c]=e.split(":");t.customRatioWidth=t.customRatioWidth||o,t.customRatioHeight=t.customRatioHeight||c}}if((!t.customWidth||!t.customHeight)&&t.customSize){const e=parseSizeValue(t.customSize);t.customWidth=t.customWidth||(e==null?void 0:e.width)||"",t.customHeight=t.customHeight||(e==null?void 0:e.height)||""}})();let L=0;const E=async()=>{if(t.ratio!=="source")return;const e=f.find(c=>c.url),o=++L;if(!e){t.customRatio="",t.customRatioWidth="",t.customRatioHeight="",i.value="",l.value="";return}try{const c=await getImageDimensions(e.url);if(o!==L||t.ratio!=="source")return;const R=ratioPartsFromDimensions(c.width,c.height);t.customRatioWidth=String(R.width),t.customRatioHeight=String(R.height),t.customRatio=`${R.width}:${R.height}`,i.value=t.customRatioWidth,l.value=t.customRatioHeight,scheduleSave()}catch(c){}},x=()=>{normalizeApiNodeSizeChoice(t);const e=S.querySelector('option[value="auto"]');e&&(e.disabled=!isGptImageAutoSizeModel(resolveImageModel(t.model)));const o=r.querySelector('option[value="square"]');o&&(o.disabled=!1,o.title="");const c=t.ratio&&[...r.options].some(R=>R.value===t.ratio)?t.ratio:"square";r.value=c,S.value=t.resolution||defaultApiImageResolution(t.model),r.disabled=t.resolution==="custom"||t.resolution==="auto",$.style.display=t.resolution!=="auto"&&(t.ratio==="custom"||t.ratio==="source")?"flex":"none",y.style.display=t.resolution==="custom"?"flex":"none",i.disabled=t.ratio==="source",l.disabled=t.ratio==="source",i.value=t.customRatioWidth||"",l.value=t.customRatioHeight||"",g.value=t.customWidth||"",s.value=t.customHeight||"",n&&(n.disabled=!f.some(R=>R.url)),q(),t.ratio==="source"&&E()};h.onmousedown=e=>e.stopPropagation(),h.onclick=e=>e.stopPropagation(),h.onchange=e=>{e.stopPropagation(),t.quality=e.target.value,scheduleSave()},r.onmousedown=e=>e.stopPropagation(),r.onclick=e=>e.stopPropagation(),r.onchange=e=>{e.stopPropagation(),t.ratio=e.target.value,normalizeApiNodeSizeChoice(t),(t.ratio!=="custom"&&t.ratio!=="source"||t.ratio==="source")&&(t.customRatio="",t.customRatioWidth="",t.customRatioHeight=""),x(),scheduleSave()},S.onmousedown=e=>e.stopPropagation(),S.onclick=e=>e.stopPropagation(),S.onchange=e=>{e.stopPropagation(),t.resolution=e.target.value,t._apiResolutionUserSet=!0,t.resolution==="custom"?t.ratio="":t.resolution==="auto"?(t.ratio||(t.ratio="square"),t.customSize="",t.customWidth="",t.customHeight=""):t.ratio?(t.customSize="",t.customWidth="",t.customHeight=""):(t.ratio="square",t.customSize="",t.customWidth="",t.customHeight=""),normalizeApiNodeSizeChoice(t),x(),scheduleSave()},[i,l].forEach(e=>{e.onmousedown=o=>o.stopPropagation(),e.onclick=o=>o.stopPropagation(),e.oninput=o=>{t.customRatioWidth=i.value,t.customRatioHeight=l.value,t.customRatio=t.customRatioWidth&&t.customRatioHeight?`${t.customRatioWidth}:${t.customRatioHeight}`:"",t.ratio="custom",x(),scheduleSave()}}),[g,s].forEach(e=>{e.onmousedown=o=>o.stopPropagation(),e.onclick=o=>o.stopPropagation(),e.oninput=o=>{t.customWidth=g.value,t.customHeight=s.value,t.customSize=t.customWidth&&t.customHeight?`${t.customWidth}x${t.customHeight}`:"",t.resolution="custom",t._apiResolutionUserSet=!0,t.ratio="",x(),scheduleSave()}}),n&&(n.onmousedown=e=>e.stopPropagation(),n.onclick=async e=>{e.stopPropagation();const o=f.find(c=>c.url);if(o)try{const c=await getImageDimensions(o.url);t.customWidth=c.width,t.customHeight=c.height,t.customSize=`${c.width}x${c.height}`,t.resolution="custom",t._apiResolutionUserSet=!0,t.ratio="",x(),scheduleSave()}catch(c){showErrorModal(tr("canvas.imageReadFailed"))}}),x();const H=a.querySelector(".gen-count-input");H.onmousedown=e=>e.stopPropagation(),H.onclick=e=>e.stopPropagation(),H.oninput=e=>{const o=Math.max(1,Math.min(8,Number(e.target.value)||1));t.count=o,scheduleSave()},H.onblur=e=>{e.target.value=String(Math.max(1,Math.min(8,Number(t.count||1))))},a.querySelectorAll("[data-step]").forEach(e=>{e.onclick=o=>{o.stopPropagation();const c=Math.max(1,Math.min(8,Number(t.count||1)+Number(e.dataset.step||0)));t.count=c,H.value=String(c),scheduleSave()}});const O=a.querySelector(".input-list");renderImageInputList(O,t,C),renderPromptPreview(a.querySelector(".prompt-list"),v);const B=a.querySelector(".canvas-gen-stage-content");return B&&P&&renderInlineGeneratedOutputs(B,t),a.querySelector(".gen-btn").onclick=e=>{e.stopPropagation(),runCanvasGenerate(t.id)},bindCascadeButtons(a,t.id),bindCanvasInputPanelToggle(a,t),a}function F(t){const a=document.createElement("div");a.className="generator-body";const b=generatorSources(t),p=orderedSources(t,b),C=p.filter(i=>{var l;return(l=i.refs)==null?void 0:l.some(g=>["image","video","audio"].includes(mediaKindForRef(g)))}),v=p.filter(i=>{var l;return i.prompt&&!((l=i.refs)!=null&&l.length)});sanitizeVideoNodeProviderModel(t),t.model=t.model||"veo3.1-fast";const m=hasInlineGeneratedContent(t),P=isCanvasGeneratorComposerOpen(t),w=inlineGeneratedOutputItems(t).some(i=>mediaKindForOutputItem(i)==="video"),d=m&&w?"Video":"Image",r=m&&w?"play-square":"image",S=m?`<span class="canvas-gen-output-count">${inlineGeneratedOutputItems(t).length||(t._pending||[]).length}</span>`:"";a.innerHTML=`
        <div class="canvas-gen-shell canvas-video-template ${P?"composer-open":"composer-closed"}">
            <div class="canvas-gen-stage video-stage ${m?"has-inline-output":""}" data-stage="${escapeHtml(d)}">
                <div class="canvas-gen-stage-head">
                    <span><i data-lucide="${r}" class="w-3.5 h-3.5"></i></span>
                    ${m?S:""}
                </div>
                <div class="canvas-gen-stage-content"></div>
            </div>
            <div class="canvas-gen-composer ${P?"is-open":"is-collapsed"}">
                <div class="canvas-gen-composer-tools">
                    <button type="button" class="canvas-gen-icon active" title="\u89C6\u9891"><i data-lucide="clapperboard" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-tool-divider"></span>
                    <button type="button" class="canvas-gen-icon" onclick="pickAndConnectUpload('${t.id}', event, 'image/*,video/*,audio/*')" title="\u4E0A\u4F20\u53C2\u8003\u7D20\u6750"><i data-lucide="plus" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-mode-copy">\u8F93\u5165\u5206\u955C\u6216\u52A8\u6001\u63CF\u8FF0\u751F\u6210\u89C6\u9891</span>
                    <button type="button" class="canvas-gen-panel-close" data-close-composer title="${langIsEn()?"Collapse":"\u6536\u8D77"}"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div class="prompt-list"></div>
                <div class="gen-settings comfy-settings canvas-video-settings-wrap">
                    <div class="canvas-gen-prompt-card">
                        <textarea class="setting-input canvas-gen-prompt-input video-prompt" data-field="prompt" placeholder="${langIsEn()?"Describe the video you want to generate":"\u63CF\u8FF0\u4EFB\u4F55\u4F60\u60F3\u751F\u6210\u7684\u89C6\u9891\u5185\u5BB9"}">${escapeHtml(t.prompt||"")}</textarea>
                    </div>
                    ${canvasVideoOptionBar(t)}
                </div>
                <div class="canvas-gen-bottom">
                    ${canvasComposerRunButtonHtml(t,"video-run")}
                    ${cascadeBtnHtml(t)}
                </div>
                ${retryBarHtml(t)}
            </div>
        </div>
    `;const h=a.querySelector(".video-prompt");h.onmousedown=i=>i.stopPropagation(),h.onclick=i=>i.stopPropagation(),h.oninput=i=>{i.stopPropagation(),t.prompt=i.target.value,scheduleSave()},a.querySelectorAll("[data-video-model]").forEach(i=>{i.onmousedown=l=>l.stopPropagation(),i.onclick=l=>{l.stopPropagation(),selectVideoModel(t.id,i.dataset.videoModel)}}),a.querySelectorAll("[data-video-duration], [data-video-aspect], [data-video-resolution]").forEach(i=>{i.onmousedown=l=>l.stopPropagation(),i.onclick=l=>{l.stopPropagation();const g=i.dataset.videoDuration?"video-duration":i.dataset.videoAspect?"video-aspect":"video-resolution";selectVideoComposerOption(t.id,g,i.dataset.videoDuration||i.dataset.videoAspect||i.dataset.videoResolution||"")}}),a.querySelectorAll("[data-video-toggle]").forEach(i=>{i.onmousedown=l=>l.stopPropagation(),i.onclick=l=>{l.stopPropagation();const g=i.dataset.videoToggle;t[g]=!t[g],g==="multimodal"&&t.multimodal&&(t.useFrameRoles=!1),g==="useFrameRoles"&&t.useFrameRoles&&(t.multimodal=!1),render(),scheduleSave()}}),a.querySelectorAll("[data-video-temp-sh]").forEach(i=>{i.onmousedown=l=>l.stopPropagation(),i.onclick=async l=>{l.stopPropagation();try{await uploadCanvasVideosToCloud(t.id)}catch(g){showErrorModal(g.message||"\u4E91\u7AEF\u4E0A\u4F20\u5931\u8D25","\u4E0A\u4F20\u4E91\u7AEF")}}}),a.querySelectorAll("[data-video-manual-url]").forEach(i=>{i.onmousedown=l=>l.stopPropagation(),i.onclick=async l=>{l.stopPropagation();try{await setCanvasManualVideoUrl(t.id)}catch(g){showErrorModal(g.message||"\u8BBE\u7F6E\u89C6\u9891\u7F51\u5740\u5931\u8D25","\u8F93\u5165\u7F51\u5740")}}});const $=a.querySelector(".canvas-gen-stage-content");m?renderInlineGeneratedOutputs($,t):$&&($.innerHTML=canvasEmptyImageStageHtml()),renderPromptPreview(a.querySelector(".prompt-list"),v);const y=a.querySelector(".comfy-settings");return y&&bindCanvasComposerOptionBar(y,t),a.querySelector(".video-run").onclick=i=>{i.stopPropagation(),runCanvasGenerate(t.id)},bindCascadeButtons(a,t.id),bindCanvasInputPanelToggle(a,t),a}function D(t){const a=document.createElement("div");a.className="rh-body",t.rhParams=t.rhParams||{};const b=ensureRhNodeSelection(t),p=rhSelectedEntryRef(t),C=rhMediaSources(t),v=rhActiveFields(t),m=(p==null?void 0:p.kind)||rhCurrentKind(t),P=(p==null?void 0:p.id)||(m==="workflow"?t.workflowId||"":t.webappId||""),w=p?runningHubEntryKey(p.kind,p.id):"",d=(b==null?void 0:b.note)||(b==null?void 0:b.description)||"",r=isCanvasGeneratorComposerOpen(t),S=hasInlineGeneratedContent(t);m==="model"&&(t.model=(p==null?void 0:p.id)||t.rhModel||t.model||"",normalizeApiNodeSizeChoice(t)),a.innerHTML=`
        <div class="canvas-gen-shell ${r?"composer-open":"composer-closed"}">
            <div class="canvas-gen-stage ${S?"has-inline-output":""}" data-stage="Image">
                <div class="canvas-gen-stage-head">
                    <span><i data-lucide="workflow" class="w-3.5 h-3.5"></i></span>
                    ${S?`<span class="canvas-gen-output-count">${inlineGeneratedOutputItems(t).length||(t._pending||[]).length}</span>`:""}
                </div>
                <div class="canvas-gen-stage-content">
                    <div class="input-list rh-input-list"></div>
                </div>
            </div>
            <div class="canvas-gen-composer ${r?"is-open":"is-collapsed"}">
                <div class="canvas-gen-composer-tools">
                    <button type="button" class="canvas-gen-icon active" title="${escapeHtml(tr("canvas.rhRun"))}"><i data-lucide="workflow" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-tool-divider"></span>
                    <button type="button" class="canvas-gen-icon" onclick="pickAndConnectUpload('${t.id}', event)" title="\u4E0A\u4F20\u53C2\u8003\u7D20\u6750"><i data-lucide="plus" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-mode-copy">${escapeHtml(tr("canvas.rhRun"))}</span>
                    <button type="button" class="canvas-gen-panel-close" data-close-composer title="${langIsEn()?"Collapse":"\u6536\u8D77"}"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div class="rh-top">
            <label class="field rh-webapp-field">
                <div class="setting-title">RunningHub \u914D\u7F6E</div>
                <select class="select-lite rh-entry-select">${rhEntryOptions(w)}</select>
            </label>
            <label class="field rh-payment-field" style="${m==="model"?"display:none":""}">
                <div class="setting-title">Key</div>
                <select class="select-lite rh-payment-select">${rhPaymentOptions(t)}</select>
            </label>
            <label class="field rh-machine-field" style="${m==="model"?"display:none":""}">
                <div class="setting-title">\u663E\u5B58</div>
                <select class="select-lite rh-machine-select">
                    <option value="" ${t.instanceType?"":"selected"}>24G</option>
                    <option value="plus" ${t.instanceType==="plus"?"selected":""}>48G</option>
                </select>
            </label>
        </div>
                <div class="rh-prompt-list"></div>
                ${m==="model"?rhModelSettingsHtml(t):""}
                <div class="rh-param-head">
                    <span>${m==="model"?"\u6A21\u578B API \u53C2\u6570":m==="workflow"?tr("canvas.rhWorkflowParams"):tr("canvas.rhParams")}</span>
                    <span>${v.length}</span>
                </div>
                <div class="rh-param-list"></div>
                <div class="gen-run-row">
                    <button class="gen-btn rh-run ${t.running?"running":""}" ${t.running?"disabled":""}><i data-lucide="workflow" class="w-4 h-4"></i>${t.running?tr("canvas.rhRunning"):tr("canvas.rhRun")}</button>
                    ${cascadeBtnHtml(t)}
                </div>
                ${retryBarHtml(t)}
            </div>
        </div>
    `;const h=a.querySelector(".rh-entry-select");h&&(h.onchange=l=>{const g=parseRunningHubEntryKey(l.target.value),s=g?runningHubAllEntries().find(n=>n.kind===g.kind&&n.id===g.id):null;s&&applyRhEntrySelection(t,s),t.rhParams={},t.rhRandomValues={},render(),scheduleSave()});const $=a.querySelector(".rh-payment-select");$&&($.onchange=l=>{t.rhPayment=l.target.value==="wallet"?"wallet":"free",scheduleSave()});const y=a.querySelector(".rh-machine-select");y&&(y.onchange=l=>{t.instanceType=l.target.value==="plus"?"plus":"",scheduleSave()}),m==="model"?renderPromptPreview(a.querySelector(".rh-prompt-list"),C.sources.filter(l=>{var g;return l.prompt&&!((g=l.refs)!=null&&g.length)})):renderRhPromptFields(a.querySelector(".rh-prompt-list"),t,v),renderRhInputs(a.querySelector(".rh-input-list"),t,C),renderRhParams(a.querySelector(".rh-param-list"),t,v,C),m==="model"&&bindRhModelControls(a,t,C);const i=a.querySelector(".canvas-gen-stage-content");return i&&S&&renderInlineGeneratedOutputs(i,t),a.querySelector(".rh-run").onclick=l=>{l.stopPropagation(),runCanvasGenerate(t.id)},bindCascadeButtons(a,t.id),bindCanvasInputPanelToggle(a,t),refreshIcons(),a}function K(t){if(typeof window.ltxMigrateLegacySegments=="function"?window.ltxMigrateLegacySegments(t):typeof ltxMigrateLegacySegments=="function"&&ltxMigrateLegacySegments(t),ltxDirectorSyncSeconds(t),!t.ltxTimelineData){const r=Math.max(1,Number(t.durationFrames)||120);t.ltxTimelineData=JSON.stringify({segments:[{id:uid("ltxseg"),start:0,length:r,prompt:"",type:"text"}],audioSegments:[]})}const a=document.createElement("div");a.className="ltx-director-body";const b=orderedSources(t,generatorSources(t)),p=b.filter(r=>{var S;return r.prompt&&!((S=r.refs)!=null&&S.length)}),C=b.map(r=>({...r,refs:imageRefsOnly(r.refs||[])})).filter(r=>{var S;return(S=r.refs)==null?void 0:S.length}),v=isCanvasGeneratorComposerOpen(t),m=hasInlineGeneratedContent(t);a.innerHTML=`
        <div class="canvas-gen-shell ${v?"composer-open":"composer-closed"}">
            <div class="canvas-gen-stage ${m?"has-inline-output":""}" data-stage="Image">
                <div class="canvas-gen-stage-head">
                    <span><i data-lucide="film" class="w-3.5 h-3.5"></i></span>
                    ${m?`<span class="canvas-gen-output-count">${inlineGeneratedOutputItems(t).length||(t._pending||[]).length}</span>`:""}
                </div>
                <div class="canvas-gen-stage-content">
                    <div class="input-list mt-1"></div>
                </div>
            </div>
            <div class="canvas-gen-composer ${v?"is-open":"is-collapsed"}">
                <div class="canvas-gen-composer-tools">
                    <button type="button" class="canvas-gen-icon active" title="${escapeHtml(tr("canvas.ltxDirector"))}"><i data-lucide="film" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-tool-divider"></span>
                    <button type="button" class="canvas-gen-icon" onclick="pickAndConnectUpload('${t.id}', event)" title="\u4E0A\u4F20\u53C2\u8003\u7D20\u6750"><i data-lucide="plus" class="w-4 h-4"></i></button>
                    <span class="canvas-gen-mode-copy">${escapeHtml(tr("canvas.ltxDirector"))}</span>
                    <button type="button" class="canvas-gen-panel-close" data-close-composer title="${langIsEn()?"Collapse":"\u6536\u8D77"}"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
                <div class="prompt-list"></div>
                <div class="ltx-params-row" data-ltx-params>
                    <label class="field"><span class="setting-title">${tr("canvas.ltxDurationSec")}</span><input class="setting-input" data-ltx-duration-seconds type="number" min="0.1" max="1000" step="0.01"></label>
                    <label class="field"><span class="setting-title">${tr("canvas.ltxDurationFrames")}</span><input class="setting-input" data-ltx-duration-frames type="number" min="1" max="10000" step="1"></label>
                    <label class="field"><span class="setting-title">${tr("canvas.ltxFps")}</span><input class="setting-input" data-ltx-frame-rate type="number" min="1" max="240" step="1"></label>
                    <label class="field"><span class="setting-title">${tr("canvas.width")}</span><input class="setting-input" data-ltx-width type="number" min="0" max="8192" step="32" title="0 = auto"></label>
                    <label class="field"><span class="setting-title">${tr("canvas.height")}</span><input class="setting-input" data-ltx-height type="number" min="0" max="8192" step="32" title="0 = auto"></label>
                </div>
                <div class="ltx-director-timeline-host" data-ltx-timeline-host></div>
                <div class="gen-run-row">
                    <button class="comfy-run ltx-run ${t.running?"running":""}" ${t.running?"disabled":""}><i data-lucide="film" class="w-4 h-4"></i>${t.running?tr("canvas.ltxRunning"):tr("canvas.ltxRun")}</button>
                    ${cascadeBtnHtml(t)}
                </div>
                ${retryBarHtml(t)}
            </div>
        </div>
    `,renderPromptPreview(a.querySelector(".prompt-list"),p),bindLTXParamsRow(a,t),ltxSyncConnectedImagesToTimeline(t),renderComfyImages(a.querySelector(".input-list"),t,C);const P=a.querySelector(".canvas-gen-stage-content");P&&m&&renderInlineGeneratedOutputs(P,t);const w=a.querySelector("[data-ltx-timeline-host]");if(w&&window.CanvasLTXTimelineEditor)if(t._ltxEditor&&t._ltxEditor.wrapper)w.appendChild(t._ltxEditor.wrapper),t._ltxEditor.container=w,t._ltxEditor._onCanvasCommit=()=>scheduleSave(),t._ltxEditor._onCanvasResize=()=>{updateLTXNodeElementSize(t),scheduleSave()};else{destroyLTXEditor(t);try{const r=new window.CanvasLTXTimelineEditor(t,w,null);r._onCanvasCommit=()=>scheduleSave(),r._onCanvasResize=()=>{updateLTXNodeElementSize(t),scheduleSave()},t._ltxEditor=r}catch(r){console.error("LTX timeline editor init failed",r),w.innerHTML=`<div class="text-[11px] text-red-500 p-2">${escapeHtml(tr("canvas.ltxTimelineLoadFailed"))}</div>`}}else w&&(w.innerHTML=`<div class="text-[11px] text-red-500 p-2">${escapeHtml(tr("canvas.ltxTimelineScriptMissing"))}</div>`);const d=a.querySelector(".ltx-run");return d&&(d.onmousedown=r=>r.stopPropagation(),d.onclick=r=>{r.stopPropagation(),r.preventDefault(),runCanvasGenerate(t.id)}),bindCascadeButtons(a,t.id),bindCanvasInputPanelToggle(a,t),a}window.renderMsGenBody=N;window.renderGeneratorBody=V;window.renderLoopBody=A;window.renderVideoBody=F;window.renderRhBody=D;window.renderLLMBody=_;window.renderLTXDirectorBody=K;window.renderMsGenBody=N;window.renderLoopBody=A;window.renderLLMBody=_;window.renderGeneratorBody=V;window.renderVideoBody=F;window.renderRhBody=D;window.renderLTXDirectorBody=K;})();
