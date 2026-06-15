let tabs=[{
  name:"Tab 1",
  data:{},
  changes:[],
  deletions:[],
  additions:[],
  url:"",
  mode:"fetch",
  asyncProtocol:"off",
  rawJson:"",
  script:"",
  asyncTriggerMethod:"POST",
  asyncTriggerUrl:"",
  asyncResponseMethod:"GET",
  asyncResponseUrl:"",
  asyncIdField:"",
  asyncIdPath:[]
}];

let currentTab=0;
let renamingTabIndex=-1;
let data={},changes=[],deletions=[],additions=[],collapsed={};
let asyncIdField="";
let asyncIdPath=[];
const {
  TAB_LIMIT,
  MAX_TAB_NAME_LEN,
  MAX_IMPORT_FILE_BYTES,
  MAX_SHARE_HASH_CHARS,
  MAX_SHARE_BYTES,
  clampString,
  sanitizeTabState,
  bytesToBase64Url,
  base64UrlToBytes,
  isArrayIndexSegment,
  isSafeJsIdentifier,
  formatPath,
  formatReadablePath,
  buildTrackedModsScript,
  buildTrackedObject,
  setValueAtPath,
  deleteValueAtPath
} = globalThis.JediMockCore;
const {
  sanitizeJson,
  computeLineDiff,
  inlineDiff
} = globalThis.JediMockDiffCore;
const {
  wildcardToRegex,
  generateRulesScript
} = globalThis.JediMockScriptGen;
const {
  buildSessionPayload,
  sanitizeStoredPayload
} = globalThis.JediMockSessionStore;

/* THEME */
function toggleTheme(){
  const html=document.documentElement;
  const isLight=html.getAttribute("data-theme")==="light";
  html.setAttribute("data-theme", isLight?"dark":"light");
  const btn=document.getElementById("themeBtn");
  if(btn){
    const sunSvg=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    const moonSvg=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    btn.innerHTML=(isLight?sunSvg:moonSvg)+`<span class="theme-label">Toggle theme</span>`;
  }
  persistSession();
}

/* TEMPLATES */
const TEMPLATES={
  empty:{ json:"{}", statusCode:"200", delay:0 },
  emptyArray:{ json:"[]", statusCode:"200", delay:0 },
  "401":{ json:'{"error":"Unauthorized","message":"Authentication required"}', statusCode:"401", delay:0 },
  "403":{ json:'{"error":"Forbidden","message":"You do not have permission to access this resource"}', statusCode:"403", delay:0 },
  "404":{ json:'{"error":"Not Found","message":"The requested resource could not be found"}', statusCode:"404", delay:0 },
  "500":{ json:'{"error":"Internal Server Error","message":"An unexpected error occurred. Please try again later"}', statusCode:"500", delay:0 },
  timeout:{ json:"{}", statusCode:"200", delay:30000 },
  slow:{ json:"{}", statusCode:"200", delay:3000 },
};

function applyTemplate(name){
  const t=TEMPLATES[name];
  if(!t) return;
  jsonInput.value=t.json;
  loadJson();
  document.getElementById("statusCode").value=t.statusCode;
  document.getElementById("responseDelay").value=t.delay;
  // Reset generated output so user must re-generate with correct URL
  const _out=document.getElementById("output");
  const _os=document.getElementById("outputSection");
  if(_out) _out.textContent="";
  if(_os)  _os.classList.add("hidden");
}

/* CLIPBOARD PASTE */
async function pasteFromClipboard(){
  try{
    const text=await navigator.clipboard.readText();
    if(!text.trim()){ console.warn("Clipboard is empty"); return; }
    jsonInput.value=text;
  }catch(e){
    // fallback: focus textarea so user can Ctrl+V
    jsonInput.focus();
    jsonInput.select();
    console.warn("Auto-paste unavailable");
  }
}

/* TABS */
function renderTabs(){
  const el=document.getElementById("tabs");
  el.replaceChildren();

  tabs.forEach((t,i)=>{
    const tab=document.createElement("div");
    tab.className="tab"+(i===currentTab?" active":"");
    if(i===renamingTabIndex){
      const input=document.createElement("input");
      input.id="tabRenameInput";
      input.type="text";
      input.maxLength=MAX_TAB_NAME_LEN;
      input.value=t.name;
      input.setAttribute("aria-label","Rename tab");
      input.style.cssText="flex:1;min-width:0;background:var(--surface2);border:1px solid var(--accent);border-radius:5px;padding:4px 6px;color:var(--text);font-size:12px;outline:none";
      input.onclick=(e)=>e.stopPropagation();
      input.onkeydown=(e)=>{
        if(e.key==="Enter"){
          e.preventDefault();
          commitTabRename(i, input.value);
        }
        if(e.key==="Escape"){
          e.preventDefault();
          cancelTabRename();
        }
      };
      input.onblur=()=>commitTabRename(i, input.value);
      tab.appendChild(input);
    } else {
      const name=document.createElement("span");
      name.textContent=t.name;
      tab.appendChild(name);
    }
    if(tabs.length>1){
      const closeBtn=document.createElement("span");
      closeBtn.className="tab-close";
      closeBtn.textContent="×";
      closeBtn.onclick=(e)=>closeTab(e,i);
      tab.appendChild(closeBtn);
    }
    tab.onclick=()=>{ if(renamingTabIndex!==i) switchTab(i); };
    tab.ondblclick=()=>startRenameTab(i);
    tab.oncontextmenu=(e)=>{ e.preventDefault(); showTabContextMenu(e, i); };
    el.appendChild(tab);
  });

  const add=document.createElement("button");
  add.className="tab tab-add";
  add.textContent="+";
  add.title=tabs.length>=TAB_LIMIT?"Tab limit reached ("+TAB_LIMIT+")":"Add tab";
  add.disabled=tabs.length>=TAB_LIMIT;
  add.onclick=addTab;
  el.appendChild(add);

  // Footer count
  const countEl=document.getElementById("tabCount");
  if(countEl) countEl.textContent=tabs.length===1?`1/1 tab`:`${currentTab+1}/${tabs.length} tabs`;

  // Show jump menu only when there are enough tabs to need it
  const jumpEl=document.getElementById("tabJump");
  if(jumpEl) jumpEl.style.display=tabs.length>5?"flex":"none";

  // Rebuild dropdown
  const dd=document.getElementById("tabDropdown");
  if(dd){
    dd.replaceChildren();
    tabs.forEach((t,i)=>{
      const item=document.createElement("div");
      item.className="tab-dropdown-item"+(i===currentTab?" active":"");
      const num=document.createElement("span");
      num.className="tab-dropdown-num";
      num.textContent=String(i+1);
      const label=document.createElement("span");
      label.style.flex="1";
      label.style.overflow="hidden";
      label.style.textOverflow="ellipsis";
      label.style.whiteSpace="nowrap";
      label.textContent=t.name;
      item.append(num,label);
      item.onclick=()=>{ switchTab(i); closeDropdown(); };
      dd.appendChild(item);
    });
  }
}

function startRenameTab(i){
  hideTabContextMenu();
  if(i<0||i>=tabs.length) return;
  renamingTabIndex=i;
  renderTabs();
  setTimeout(()=>{
    const input=document.getElementById("tabRenameInput");
    if(input){
      input.focus();
      input.select();
    }
  },0);
}

function commitTabRename(i, rawName){
  if(i<0||i>=tabs.length) return cancelTabRename();
  const nextName=clampString(rawName, MAX_TAB_NAME_LEN).trim() || tabs[i].name;
  tabs[i].name=nextName;
  renamingTabIndex=-1;
  renderTabs();
  persistSession();
}

function cancelTabRename(){
  if(renamingTabIndex===-1) return;
  renamingTabIndex=-1;
  renderTabs();
}

let dropdownOpen=false;
function toggleDropdown(){
  const dd=document.getElementById("tabDropdown");
  const btn=document.getElementById("tabJumpBtn");
  const arrow=document.getElementById("tabJumpArrow");
  dropdownOpen=!dropdownOpen;
  dd.classList.toggle("hidden",!dropdownOpen);
  if(arrow) arrow.textContent=dropdownOpen?"▼":"▲";
  if(dropdownOpen){
    // Position using fixed coords so it always stays on screen
    const rect=btn.getBoundingClientRect();
    const spaceBelow=window.innerHeight-rect.bottom;
    const spaceAbove=rect.top;
    const ddHeight=Math.min(280, window.innerHeight*0.5);
    if(spaceBelow>=ddHeight||spaceBelow>=spaceAbove){
      // Open downward
      dd.style.top=(rect.bottom+4)+"px";
      dd.style.bottom="";
    } else {
      // Open upward
      dd.style.bottom=(window.innerHeight-rect.top+4)+"px";
      dd.style.top="";
    }
    dd.style.right=(window.innerWidth-rect.right)+"px";
    setTimeout(()=>{
      const active=dd.querySelector(".active");
      if(active) active.scrollIntoView({block:"nearest"});
    },0);
  }
}

function closeDropdown(){
  const dd=document.getElementById("tabDropdown");
  const arrow=document.getElementById("tabJumpArrow");
  dropdownOpen=false;
  if(dd) dd.classList.add("hidden");
  if(arrow) arrow.textContent="▲";
}

// Close dropdown when clicking outside
document.addEventListener("click",(e)=>{
  if(dropdownOpen && !document.getElementById("tabJump").contains(e.target)){
    closeDropdown();
  }
});

function addTab(){
  if(tabs.length>=TAB_LIMIT) return;
  renamingTabIndex=-1;
  saveState(); // persist current tab before switching away
  tabs.push({name:"Tab "+(tabs.length+1),data:{},changes:[],deletions:[],additions:[],url:"",mode:"fetch",asyncProtocol:"off",rawJson:"",script:"",asyncTriggerMethod:"POST",asyncTriggerUrl:"",asyncResponseMethod:"GET",asyncResponseUrl:"",asyncIdField:"",asyncIdPath:[],asyncCaptureField:""});
  persistSession();
  currentTab=tabs.length-1;
  loadState();
  renderTabs();
}

function closeTab(e,i){
  e.stopPropagation();
  renamingTabIndex=-1;
  saveState(); // persist current tab before any index shift
  tabs.splice(i,1);
  currentTab=Math.min(currentTab, tabs.length-1);
  loadState();
  renderTabs();
  persistSession();
}

function switchTab(i){
  renamingTabIndex=-1;
  saveState();
  persistSession();
  currentTab=i;
  // mockOnlyBtns always visible in sidebar (data-sidebar marker)
  const mb=document.getElementById("mockOnlyBtns");
  if(mb && !mb.dataset.sidebar) mb.style.display="";
  loadState();
  renderTabs();
}

/* STATE */
function saveState(){
  const t=tabs[currentTab];
  if(!t) return;
  const g=id=>document.getElementById(id);
  t.url=urlInput?urlInput.value:"";
  const modeEl=document.querySelector("input[name=mode]:checked");
  t.mode="fetch"; // unified — always fetch+xhr
  const asyncEl=document.querySelector("input[name=asyncMode]:checked");
  if(asyncEl){
    const av=asyncEl.value;
    t.asyncProtocol=av==="off"?"off":"fetch"; // unified — just off or on
  }
  t.data=data;
  t.changes=changes;
  t.deletions=deletions;
  t.additions=additions;
  t.rawJson=jsonInput?jsonInput.value:"";
  t.script=output?output.textContent:"";
  t.asyncTriggerMethod=g("asyncTriggerMethod")?g("asyncTriggerMethod").value:"POST";
  t.asyncTriggerUrl=g("asyncTriggerUrl")?g("asyncTriggerUrl").value:"";
  t.asyncResponseMethod=g("asyncResponseMethod")?g("asyncResponseMethod").value:"GET";
  t.asyncResponseUrl=g("asyncResponseUrl")?g("asyncResponseUrl").value:"";
  t.asyncIdField=asyncIdField;
  t.asyncIdPath=[...asyncIdPath];
  t.statusCode=g("statusCode")?g("statusCode").value||"200":"200";
  t.responseDelay=g("responseDelay")?parseInt(g("responseDelay").value)||0:0;
  saveRulesToTab();
  saveTargetToTab();
  saveModesToTab();
  // Explicitly save to tab object for persistence
  if(tabs[currentTab]){
    tabs[currentTab].interceptTarget = getInterceptTarget();
    tabs[currentTab].responseMode = getResponseMode();
    tabs[currentTab].requestBodyMode = getRequestBodyMode();
  }
  if(tabs[currentTab]){
    const ta = document.getElementById('requestBodyInput');
    tabs[currentTab].requestBody = ta ? ta.value : '';
    tabs[currentTab].reqData = reqData;
    tabs[currentTab].reqChanges = reqChanges;
    tabs[currentTab].reqDeletions = reqDeletions;
    tabs[currentTab].reqAdditions = reqAdditions;
    tabs[currentTab].reqCollapsed = reqCollapsed;
    tabs[currentTab].fallbackEnabled = getFallbackEnabled();
    tabs[currentTab].fallbackTimeout = getFallbackTimeout();
    tabs[currentTab].fallbackEnabledAsync = getFallbackEnabledAsync();
    tabs[currentTab].fallbackTimeoutAsync = getFallbackTimeoutAsync();
    // scriptUpToDate is managed separately — don't overwrite with global state
  }
}

function loadState(){
  _loadingState = true;
  try{
    const t=tabs[currentTab];

    urlInput.value=t.url||"";
    jsonInput.value=t.rawJson||"";

    document.querySelectorAll("input[name=mode]")
      .forEach(r=>r.checked=r.value===t.mode);
    document.querySelectorAll("input[name=asyncMode]")
      .forEach(r=>r.checked=r.value===(t.asyncProtocol||"off"));

    data=t.data||{};
    changes=t.changes||[];
    deletions=t.deletions||[];
    additions=t.additions||[];
    collapsed={};
    asyncIdField=t.asyncIdField||"";
    asyncIdPath=resolveAsyncIdPath(t);
    if(!asyncIdField && asyncIdPath.length) asyncIdField=formatReadablePath(asyncIdPath);

    document.getElementById("asyncTriggerMethod").value=t.asyncTriggerMethod||"POST";
    document.getElementById("asyncTriggerUrl").value=t.asyncTriggerUrl||"";
    document.getElementById("asyncResponseMethod").value=t.asyncResponseMethod||"GET";
    document.getElementById("asyncResponseUrl").value=t.asyncResponseUrl||"";

    const scEl=document.getElementById("statusCode");
    if(scEl) scEl.value=t.statusCode||"200";
    const rdEl=document.getElementById("responseDelay");
    if(rdEl) rdEl.value=t.responseDelay||0;

    output.textContent=t.script||"";

    loadRulesFromTab();
    loadTargetFromTab();
    loadModesFromTab();
    onModeChange();
    render();
    updateVisibility();
  }catch(e){
    _loadingState = false;
    throw e;
  }
}

function onModeChange(){
  const _isAsyncMode = document.querySelector('input[name="asyncMode"]:checked')?.value !== 'off';
  const tg = document.getElementById('targetGroup');
  if(tg) tg.style.display = _isAsyncMode ? 'none' : 'flex';
  // Hide response mode toggle in async mode — async is always replace by nature
  const rmt = document.getElementById('responseModeToggle');
  if(rmt) rmt.style.display = _isAsyncMode ? 'none' : 'flex';
  onTargetChange();
  const asyncProtocol=document.querySelector("input[name=asyncMode]:checked").value;
  const urlCard=document.getElementById("urlCard");
  const asyncCard=document.getElementById("asyncCard");
  const isAsync=asyncProtocol!=="off";
  urlCard.classList.toggle("hidden", isAsync);
  asyncCard.classList.toggle("hidden", !isAsync);

  // Disable intercept mode pill when async is active
  // interceptPill always enabled — user can switch freely

  // Update tab name based on mode
  updateTabName();
}

function updateTabName(){
  const asyncProtocol=document.querySelector("input[name=asyncMode]:checked").value;
  const isAsync=asyncProtocol!=="off";
  const nameVal = isAsync
    ? (document.getElementById("asyncResponseUrl").value||document.getElementById("asyncTriggerUrl").value)
    : urlInput.value;
  tabs[currentTab].name=nameVal||("Tab "+(currentTab+1));
  renderTabs();
}

/* VISIBILITY */
function updateVisibility(){
  const hasData = Object.keys(data).length > 0;
  const target = typeof getInterceptTarget === 'function' ? getInterceptTarget() : 'response';
  const isRequestOnly = target === 'request';
  const includesRequest = target === 'request' || target === 'both';
  const hasReqData = reqData && Object.keys(reqData).length > 0;
  const reqBodyFilled = !!document.getElementById('requestBodyInput')?.value?.trim();

  const vc  = document.getElementById("viewerCard");
  const gs  = document.getElementById("genSection");
  const os  = document.getElementById("outputSection");
  const op  = document.getElementById("output");
  const roc = document.getElementById("responseOptionsCard");
  const rrc = document.getElementById("responseRulesCard");
  const jsc = document.getElementById("jsonCard");

  // Viewer: response data loaded AND not request-only AND not replace mode
  if(vc)  vc.classList.toggle("hidden", !hasData || isRequestOnly || (typeof getResponseMode==='function' && getResponseMode()==='replace'));

  // Response options + rules: only with response data AND not request-only
  if(roc) roc.classList.toggle("hidden", !hasData || isRequestOnly);
  if(rrc) rrc.classList.toggle("hidden", !hasData || isRequestOnly);

  // JSON card: hide in request-only mode
  if(jsc) jsc.classList.toggle("hidden", isRequestOnly);

  // Generate: show when response data OR request body loaded
  const canGenerate = hasData || (includesRequest && (hasReqData || reqBodyFilled));
  if(gs)  gs.classList.toggle("hidden", !canGenerate);

  // Output section
  if(os) os.classList.toggle("hidden", !op || !op.textContent);
}

/* COLLAPSE */
function toggleSection(type){
  const section=document.getElementById(type+"Section");
  const icon=document.getElementById(type+"Toggle");
  if(!section) return;
  const hidden=section.classList.toggle("hidden");
  if(icon){
    icon.textContent=hidden?"▶":"▼";
    icon.className="toggle-icon "+(hidden?"closed":"open");
  }
}

/* JSON */
function loadJson(){
  let parsed;
  if(!jsonInput.value.trim()){
    jsonInput.style.borderColor="var(--red)";
    setTimeout(()=>jsonInput.style.borderColor="",2000);
    const orig=jsonInput.placeholder;
    jsonInput.placeholder="⚠ Paste your JSON here first!";
    setTimeout(()=>jsonInput.placeholder=orig,2000);
    jsonInput.focus();
    return;
  }
  try{
    parsed=JSON.parse(jsonInput.value);
  }catch{
    jsonInput.style.borderColor="var(--red)";
    setTimeout(()=>jsonInput.style.borderColor="",2000);
    const _ji=document.getElementById("jsonInput"); if(_ji){_ji.style.borderColor="var(--red)";setTimeout(()=>_ji.style.borderColor="",2000);} console.error("Invalid JSON");
    edFlash('⚠ Invalid JSON — fix it before loading', 'var(--red)');
    return;
  }

  data=parsed;
  changes=[];
  deletions=[];
  additions=[];
  collapsed={};
  updateChangesBadge();
  updateVisibility();
  render();
  markScriptOutdated();
}

/* TREE */
function render(){
  const v=document.getElementById("viewerSection");
  v.replaceChildren();
  walk(data,[],v);
  updateChangesBadge();
  updateDiffPanel();
  buildAsyncFieldSelectors();
}

let _allLeaves=[];

function buildAsyncFieldSelectors(){
  _allLeaves=[];
  function collectLeaves(obj, path){
    if(typeof obj!=="object"||obj===null){
      _allLeaves.push({
        label: formatReadablePath(path),
        path: [...path]
      });
      return;
    }
    Object.keys(obj).forEach(k=>collectLeaves(obj[k],[...path,k]));
  }
  collectLeaves(data,[]);
  updateSelectedDisplay();
  const q=document.getElementById("idFieldSearch");
  if(q&&q.value.trim()) filterFieldPills();
  else {
    const el=document.getElementById("idFieldList");
    if(el) el.replaceChildren();
  }
}

function onIdFieldSelected(){
  markScriptOutdated();
}

function filterFieldPills(){
  const q=document.getElementById("idFieldSearch").value.trim().toLowerCase();
  const container=document.getElementById("idFieldList");
  if(!container) return;
  if(!q){ container.replaceChildren(); return; }
  const matches=_allLeaves.filter(leaf=>leaf.label.toLowerCase().includes(q));
  container.replaceChildren();
  if(matches.length===0){
    const empty=document.createElement('span');
    empty.style.fontSize='12px';
    empty.style.color='var(--text-dim)';
    empty.textContent='No fields match';
    container.appendChild(empty);
    return;
  }
  matches.slice(0,30).forEach(leaf=>{
    const pill=document.createElement("span");
    const selected=JSON.stringify(leaf.path)===JSON.stringify(asyncIdPath);
    pill.className="id-field-pill"+(selected?" selected":"");
    pill.textContent=leaf.label;
    pill.title=leaf.label;
    pill.onclick=()=>{
      const samePath = JSON.stringify(asyncIdPath)===JSON.stringify(leaf.path);
      asyncIdField=samePath?"":leaf.label;
      asyncIdPath=samePath?[]:[...leaf.path];
      updateSelectedDisplay();
      onIdFieldSelected();
      filterFieldPills();
    };
    container.appendChild(pill);
  });
  if(matches.length>30){
    const more=document.createElement("span");
    more.style.cssText="font-size:11px;color:var(--text-dim);margin-left:4px";
    more.textContent="+"+(matches.length-30)+" more, keep typing…";
    container.appendChild(more);
  }
}

function updateSelectedDisplay(){
  const el=document.getElementById("idFieldSelected");
  if(!el) return;
  el.textContent=asyncIdField?"Selected: "+asyncIdField:"";
}

function parseLegacyAsyncPath(pathStr){
  if(!pathStr) return [];
  return String(pathStr).split(".").filter(Boolean);
}

function resolveAsyncIdPath(tabLike){
  if(tabLike && Array.isArray(tabLike.asyncIdPath) && tabLike.asyncIdPath.length) return [...tabLike.asyncIdPath];
  if(asyncIdPath && asyncIdPath.length) return [...asyncIdPath];
  return parseLegacyAsyncPath(tabLike && tabLike.asyncIdField ? tabLike.asyncIdField : asyncIdField);
}

function getValueAtPath(obj, path){
  try{
    let ref = obj;
    for(const segment of path) ref = ref[segment];
    return ref;
  }catch(e){
    return undefined;
  }
}

function getOriginalValue(path){
  try{
    let o=JSON.parse(tabs[currentTab].rawJson||"{}");
    for(const k of path) o=o[k];
    return o;
  }catch{ return undefined; }
}

function resetField(path){
  const orig=getOriginalValue(path);
  if(orig===undefined) return;
  let o=data;
  for(let i=0;i<path.length-1;i++) o=o[path[i]];
  o[path[path.length-1]]=orig;
  const pathKey=JSON.stringify(path);
  changes=changes.filter(ch=>JSON.stringify(ch.path)!==pathKey);
  render();
}

/* Show inline add-field form under an object/array node */
function showAddForm(obj, path, childrenEl){
  if(childrenEl.querySelector(".add-form")) return;
  const isArr=Array.isArray(obj);
  const form=document.createElement("div");
  form.className="add-form";

  let keyInput=null;
  if(!isArr){
    keyInput=document.createElement("input");
    keyInput.className="add-key";
    keyInput.placeholder="key";
    form.appendChild(keyInput);
    const sep=document.createElement("span");
    sep.className="add-form-sep";
    sep.textContent=":";
    form.appendChild(sep);
  }

  const valInput=document.createElement("input");
  valInput.className="add-val";
  valInput.placeholder="value";
  form.appendChild(valInput);

  const okBtn=document.createElement("button");
  okBtn.className="add-form-ok";
  okBtn.textContent="✓ Add";

  const cancelBtn=document.createElement("button");
  cancelBtn.className="add-form-cancel";
  cancelBtn.textContent="✕";

  form.appendChild(okBtn);
  form.appendChild(cancelBtn);
  childrenEl.appendChild(form);
  (keyInput||valInput).focus();

  const commit=()=>{
    const rawVal=valInput.value;
    let val=rawVal;
    if(rawVal==="true") val=true;
    else if(rawVal==="false") val=false;
    else if(rawVal==="null") val=null;
    else if(rawVal!==""&&!isNaN(rawVal)) val=Number(rawVal);

    if(isArr){
      obj.push(val);
      const newPath=[...path, obj.length-1];
      additions=additions.filter(a=>JSON.stringify(a.path)!==JSON.stringify(newPath));
      additions.push({path:newPath, value:val});
    } else {
      const k=keyInput.value.trim();
      if(!k){ keyInput.focus(); return; }
      obj[k]=val;
      const newPath=[...path, k];
      additions=additions.filter(a=>JSON.stringify(a.path)!==JSON.stringify(newPath));
      additions.push({path:newPath, value:val});
    }
    render();
  };

  okBtn.onclick=(e)=>{ e.stopPropagation(); commit(); };
  cancelBtn.onclick=(e)=>{ e.stopPropagation(); form.remove(); };
  valInput.onkeydown=(e)=>{ if(e.key==="Enter") commit(); if(e.key==="Escape") form.remove(); };
  if(keyInput) keyInput.onkeydown=(e)=>{ if(e.key==="Enter") valInput.focus(); if(e.key==="Escape") form.remove(); };
}

function deleteNode(path, obj, key){
  const pathKey=JSON.stringify(path);
  const isAdded=additions.some(a=>JSON.stringify(a.path)===pathKey);
  if(isAdded){
    // Undo addition: just remove from live data and additions list
    if(Array.isArray(obj)) obj.splice(Number(key),1);
    else delete obj[key];
    additions=additions.filter(a=>JSON.stringify(a.path)!==pathKey);
  } else {
    // Track deletion
    const alreadyDeleted=deletions.some(d=>JSON.stringify(d)===pathKey);
    if(alreadyDeleted){
      // Undo deletion
      deletions=deletions.filter(d=>JSON.stringify(d)!==pathKey);
    } else {
      deletions.push(path);
    }
  }
  render();
}

function walk(obj,path,parent){
  if(typeof obj==="object" && obj!==null){
    const isArray=Array.isArray(obj);
    Object.keys(obj).forEach(key=>{
      const div=document.createElement("div");
      div.className="node";
      const newPath=[...path,key];
      const pathKey=JSON.stringify(newPath);
      const isDeleted=deletions.some(d=>JSON.stringify(d)===pathKey);
      const isAdded=additions.some(a=>JSON.stringify(a.path)===pathKey);

      if(typeof obj[key]==="object" && obj[key]!==null){
        const isCollapsed=collapsed[pathKey]||false;
        const isArr=Array.isArray(obj[key]);
        const childCount=Object.keys(obj[key]).length;

        const header=document.createElement("div");
        header.className="node-header";
        if(isDeleted) header.style.cssText="opacity:0.4;text-decoration:line-through;pointer-events:none";

        const arrow=document.createElement("span");
        arrow.className="tree-arrow";
        arrow.textContent=isCollapsed?"▶":"▼";

        const keySpan=document.createElement("span");
        keySpan.className="tree-key-obj";
        keySpan.textContent=isArray?`[${key}]`:key;

        const brace=document.createElement("span");
        brace.className="tree-brace";
        brace.textContent=" "+(isArr?"[":"{");

        header.appendChild(arrow);
        header.appendChild(keySpan);
        header.appendChild(brace);

        if(isArr){
          const badge=document.createElement("span");
          badge.className="array-badge";
          badge.textContent=childCount;
          header.appendChild(badge);
        }

        const count=document.createElement("span");
        count.style.cssText="color:var(--text-dim);font-size:11px;margin-left:4px";
        count.textContent=isCollapsed?(isArr?`${childCount} items`:`${childCount} keys`):"";
        header.appendChild(count);

        if(isAdded){
          const lbl=document.createElement("span");
          lbl.className="node-added-label";
          lbl.textContent="added";
          header.appendChild(lbl);
        } else if(isDeleted){
          const lbl=document.createElement("span");
          lbl.className="node-deleted-label";
          lbl.textContent="deleted";
          header.appendChild(lbl);
        }

        if(!isDeleted){
          const addBtn=document.createElement("button");
          addBtn.className="add-btn";
          addBtn.title="Add field";
          addBtn.textContent="+";
          addBtn.onclick=(e)=>{ e.stopPropagation(); showAddForm(obj[key], newPath, children); };
          header.appendChild(addBtn);

          const delBtn=document.createElement("button");
          delBtn.className="delete-btn";
          delBtn.title="Delete this node";
          delBtn.textContent="✕";
          delBtn.onclick=(e)=>{ e.stopPropagation(); deleteNode(newPath, obj, key); };
          header.appendChild(delBtn);
        } else {
          const undoBtn=document.createElement("button");
          undoBtn.className="delete-btn";
          undoBtn.style.display="inline";
          undoBtn.title="Undo delete";
          undoBtn.textContent="↺";
          undoBtn.onclick=(e)=>{ e.stopPropagation(); deleteNode(newPath, obj, key); };
          header.appendChild(undoBtn);
        }

        div.appendChild(header);

        const children=document.createElement("div");
        children.className="node-children";
        children.style.display=isCollapsed?"none":"block";

        const closing=document.createElement("div");
        closing.className="tree-brace";
        closing.style.cssText="padding:1px 4px;color:var(--text-dim)";
        closing.textContent=isArr?"]":"}";

        header.onclick=(e)=>{
          if(e.target.classList.contains("add-btn")||e.target.classList.contains("delete-btn")) return;
          e.stopPropagation();
          collapsed[pathKey]=!collapsed[pathKey];
          const col=collapsed[pathKey];
          arrow.textContent=col?"▶":"▼";
          children.style.display=col?"none":"block";
          closing.style.display=col?"none":"block";
          count.textContent=col?(isArr?`${childCount} items`:`${childCount} keys`):"";
        };

        parent.appendChild(div);
        div.appendChild(children);
        div.appendChild(closing);
        walk(obj[key],newPath,children);
      } else {
        const changed=changes.some(ch=>JSON.stringify(ch.path)===pathKey);
        const val=obj[key];

        const keySpan=document.createElement("span");
        keySpan.className="tree-key";
        keySpan.textContent=(isArray?`[${key}]`:key)+": ";

        const valSpan=document.createElement("span");
        if(isAdded){
          valSpan.className="value-string"; // will be styled via node-added
        } else if(changed){
          valSpan.className="value-changed";
        } else if(typeof val==="string"){
          valSpan.className="value-string";
        } else if(typeof val==="number"){
          valSpan.className="value-number";
        } else if(typeof val==="boolean"){
          valSpan.className="value-bool";
        } else {
          valSpan.className="value-null";
        }
        valSpan.textContent=typeof val==="string"?`"${val}"`:String(val);

        div.className="node node-leaf"+(isAdded?" node-added":"")+(isDeleted?" node-deleted":"");
        div.style.display="flex";
        div.style.alignItems="center";
        div.appendChild(keySpan);
        div.appendChild(valSpan);

        if(isAdded){
          const lbl=document.createElement("span");
          lbl.className="node-added-label";
          lbl.textContent="added";
          div.appendChild(lbl);
        }

        if(isDeleted){
          const lbl=document.createElement("span");
          lbl.className="node-deleted-label";
          lbl.textContent="deleted";
          div.appendChild(lbl);
          // undo button
          const undoBtn=document.createElement("button");
          undoBtn.className="delete-btn";
          undoBtn.style.display="inline";
          undoBtn.title="Undo delete";
          undoBtn.textContent="↺";
          undoBtn.onclick=(e)=>{ e.stopPropagation(); deleteNode(newPath, obj, key); };
          div.appendChild(undoBtn);
        } else {
          if(changed){
            const resetBtn=document.createElement("button");
            resetBtn.className="field-reset-btn";
            resetBtn.title="Restore original";
            resetBtn.textContent="↺";
            resetBtn.onclick=(e)=>{ e.stopPropagation(); resetField(newPath); };
            div.appendChild(resetBtn);
          }

          if(!isAdded){
            const delBtn=document.createElement("button");
            delBtn.className="delete-btn";
            delBtn.title="Delete this field";
            delBtn.textContent="✕";
            delBtn.onclick=(e)=>{ e.stopPropagation(); deleteNode(newPath, obj, key); };
            div.appendChild(delBtn);
          } else {
            // Added field: show remove button
            const delBtn=document.createElement("button");
            delBtn.className="delete-btn";
            delBtn.style.display="inline";
            delBtn.title="Remove added field";
            delBtn.textContent="✕";
            delBtn.onclick=(e)=>{ e.stopPropagation(); deleteNode(newPath, obj, key); };
            div.appendChild(delBtn);
          }

          div.onclick=()=>{
            if(div.querySelector("input")) return;
            const original=obj[key];
            const input=document.createElement("input");
            input.className="inline-edit";
            input.value=typeof original==="string"?original:String(original);

            // Capture context NOW at click time, not at blur time
            const _isReq = window._renderFn==='req';
            const _rerender = _isReq ? renderReqTree : render;
            const _changes = _isReq ? reqChanges : changes;
            const _additions = _isReq ? reqAdditions : additions;

            div.style.display="flex";
            div.style.alignItems="center";
            div.replaceChildren(keySpan, input);
            input.focus();
            input.select();

            const commit = () => {
              let val=isNaN(input.value)||input.value===""?input.value:Number(input.value);
              if(String(val)===String(original)){ _rerender(); return; }
              obj[key]=val;
              const idx = _changes.findIndex(ch=>JSON.stringify(ch.path)===pathKey);
              if(!isAdded){
                if(idx!==-1) _changes[idx].value=val;
                else _changes.push({path:newPath,value:val});
              } else {
                const ai = _additions.findIndex(a=>JSON.stringify(a.path)===pathKey);
                if(ai!==-1) _additions[ai].value=val;
                else _additions.push({path:newPath,value:val});
              }
              _rerender();
            };

            input.onblur = commit;
            input.onkeydown=(e)=>{
              if(e.key==="Enter"){ e.preventDefault(); commit(); }
              if(e.key==="Escape"){ obj[key]=original; _rerender(); }
            };
          };
        }

        parent.appendChild(div);
      }
    });

    // Root-level "add field" button (always visible at bottom of root)
    if(path.length===0){
      const addRootBtn=document.createElement("button");
      addRootBtn.style.cssText="margin-top:8px;font-size:12px;padding:4px 10px;background:transparent;border:1px dashed rgba(74,222,128,0.3);color:var(--green);border-radius:4px;cursor:pointer;";
      addRootBtn.textContent="+ Add field";
      addRootBtn.onclick=()=>{ showAddForm(obj,[],parent); addRootBtn.remove(); };
      parent.appendChild(addRootBtn);
    }
  }
}

function updateChangesBadge(){
  if(changes.length > 0 || deletions.length > 0 || additions.length > 0) markScriptOutdated();
  // Update req badge if in req context
  const badge=document.getElementById("changesBadge");
  if(!badge) return;
  const total=changes.length+deletions.length+additions.length;
  if(total>0){
    badge.classList.remove("hidden");
    badge.textContent=total+" change"+(total!==1?"s":"");
  } else {
    badge.classList.add("hidden");
  }
}

function updateDiffPanel(){
  const panel=document.getElementById("diffPanel");
  const list=document.getElementById("diffList");
  if(!panel||!list) return;
  const total=changes.length+deletions.length+additions.length;
  if(total===0){ panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  list.replaceChildren();

  changes.forEach(ch=>{
    const orig=getOriginalValue(ch.path);
    const row=document.createElement("div");
    row.className="diff-row";
    const pathStr=ch.path.map(p=>isNaN(p)?p:`[${p}]`).join(".");
    const origStr=orig===undefined?"?":(typeof orig==="string"?`"${orig}"`:String(orig));
    const newStr=typeof ch.value==="string"?`"${ch.value}"`:String(ch.value);
    appendDiffRowSummary(row, pathStr, newStr, "diff-val");
    const resetBtn=document.createElement("button");
    resetBtn.className="diff-reset-btn";
    resetBtn.title="Restore to "+origStr;
    resetBtn.textContent="↺";
    resetBtn.onclick=()=>resetField(ch.path);
    row.appendChild(resetBtn);
    list.appendChild(row);
  });

  deletions.forEach(path=>{
    const row=document.createElement("div");
    row.className="diff-row";
    const pathStr=path.map(p=>isNaN(p)?p:`[${p}]`).join(".");
    appendDiffRowSummary(row, pathStr, "deleted", "diff-val-del");
    const undoBtn=document.createElement("button");
    undoBtn.className="diff-reset-btn";
    undoBtn.title="Undo deletion";
    undoBtn.textContent="↺";
    undoBtn.onclick=()=>{ deletions=deletions.filter(d=>JSON.stringify(d)!==JSON.stringify(path)); render(); };
    row.appendChild(undoBtn);
    list.appendChild(row);
  });

  additions.forEach(a=>{
    const row=document.createElement("div");
    row.className="diff-row";
    const pathStr=a.path.map(p=>isNaN(p)?p:`[${p}]`).join(".");
    const valStr=typeof a.value==="string"?`"${a.value}"`:String(a.value);
    appendDiffRowSummary(row, pathStr, `${valStr} (added)`, "diff-val-add");
    list.appendChild(row);
  });
}

/* Fetch + XHR: patches changes, applies deletions, injects additions */
function markScriptOutdated(){
  if(_loadingState) return; // don't mark outdated during state load
  // Only show outdated if a script has been generated
  const op = document.getElementById('output');
  if(!op || !op.textContent) return;
  const btn = document.getElementById('generateBtn');
  const os = document.getElementById('outputSection');
  if(btn){
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Regenerate';
    btn.style.background = 'var(--yellow, #f59e0b)';
    btn.style.border = 'none';
    btn.style.color = '#000';
  }
  if(os){
    let badge = document.getElementById('scriptOutdatedBadge');
    if(!badge){
      badge = document.createElement('div');
      badge.id = 'scriptOutdatedBadge';
      badge.style.cssText = 'font-size:11px;color:#f59e0b;display:flex;align-items:center;gap:5px;margin-top:8px';
      badge.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Script is outdated — click Regenerate to update';
      os.appendChild(badge);
    }
    badge.style.display = 'flex';
  }
  // Dim copy button
  const copyBtn = document.getElementById('copyScriptBtn');
  if(copyBtn){ copyBtn.style.opacity = '0.4'; copyBtn.title = 'Script is outdated — regenerate first'; }
  _scriptUpToDate = false;
  if(tabs && tabs[currentTab]) tabs[currentTab].scriptUpToDate = false;
}

function markScriptCurrent(){
  _scriptUpToDate = true;
  if(tabs && tabs[currentTab]) tabs[currentTab].scriptUpToDate = true;
  const btn = document.getElementById('generateBtn');
  if(btn){
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate Script';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.border = '';
  }
  const badge = document.getElementById('scriptOutdatedBadge');
  if(badge) badge.style.display = 'none';
  const copyBtn = document.getElementById('copyScriptBtn');
  if(copyBtn){ copyBtn.style.opacity = ''; copyBtn.title = ''; }
}

function generateWithFeedback(){
  const btn = document.getElementById('generateBtn');
  const defaultLabel = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate Script';
  if(btn){
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 0.6s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Generating...';
    btn.disabled = true;
    setTimeout(()=>{
      generate();
      btn.innerHTML = defaultLabel;
      btn.style.background = '';
      btn.style.color = '';
      btn.disabled = false;
    }, 50);
    return;
  }
  generate();
}

// Spin animation for loader
if(!document.getElementById('jedimock-spin-style')){
  const s = document.createElement('style');
  s.id = 'jedimock-spin-style';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
}

function generate(){
  saveState();
  const t=tabs[currentTab];
  const asyncProtocol=t.asyncProtocol||"off";
  const isAsync=asyncProtocol!=="off";
  if(!isAsync && !t.url.trim()){
    urlInput.focus();
    urlInput.style.borderColor="var(--red)";
    setTimeout(()=>urlInput.style.borderColor="",2000);
    urlInput.placeholder="⚠ Enter a URL first!";
    setTimeout(()=>urlInput.placeholder="e.g. /api/users",2000);
    return;
  }
  const target = getInterceptTarget ? getInterceptTarget() : 'response';
  const isRequestOnly = target === 'request';
  const includesRequest = target === 'request' || target === 'both';
  const hasReqBody = includesRequest && (
    (reqData && Object.keys(reqData).length > 0) ||
    !!(document.getElementById('requestBodyInput')?.value?.trim())
  );

  if(!isRequestOnly && (!t.rawJson.trim()||Object.keys(t.data).length===0)){
    const ji=document.getElementById("jsonInput");
    if(ji){
      ji.focus();
      ji.style.borderColor="var(--red)";
      setTimeout(()=>ji.style.borderColor="",2000);
      const orig=ji.placeholder;
      ji.placeholder="⚠ Paste JSON and click Load JSON first!";
      setTimeout(()=>ji.placeholder=orig,2000);
    }
    const btn=document.querySelector('[onclick="loadJson()"]');
    if(btn){
      const origText=btn.textContent;
      const origBg=btn.style.background;
      btn.textContent="⚠ Load JSON first!";
      btn.style.background="var(--red)";
      setTimeout(()=>{ btn.textContent=origText; btn.style.background=origBg; },2000);
    }
    const jsonSection=document.getElementById("jsonSection");
    if(jsonSection&&jsonSection.classList.contains("hidden")) toggleSection("json");
    return;
  }

  if(includesRequest && !hasReqBody){
    const ri=document.getElementById("requestBodyInput");
    if(ri){ ri.focus(); ri.style.borderColor="var(--red)"; setTimeout(()=>ri.style.borderColor="",2000); }
    edFlash('⚠ Paste a request body and click Load JSON first','var(--red)');
    return;
  }
  if(isAsync){
    if(!t.asyncTriggerUrl.trim()){
      const el=document.getElementById("asyncTriggerUrl");
      if(el){ el.focus(); el.style.borderColor="var(--red)"; setTimeout(()=>el.style.borderColor="",2000); }
      edFlash('⚠ Enter the trigger URL for Async ID mode', 'var(--red)');
      return;
    }
    if(!t.asyncResponseUrl.trim()){
      const el=document.getElementById("asyncResponseUrl");
      if(el){ el.focus(); el.style.borderColor="var(--red)"; setTimeout(()=>el.style.borderColor="",2000); }
      edFlash('⚠ Enter the response URL pattern for Async ID mode', 'var(--red)');
      return;
    }
    const selectedAsyncPath = resolveAsyncIdPath(t);
    if(selectedAsyncPath.length===0){
      const el=document.getElementById("idFieldSearch");
      if(el){ el.focus(); el.style.borderColor="var(--red)"; setTimeout(()=>el.style.borderColor="",2000); }
      edFlash('⚠ Select the ID field to capture from the trigger response', 'var(--red)');
      return;
    }
  }
  let script="";
  const fallbackEnabled = getFallbackEnabled();
  const fallbackTimeout = getFallbackTimeout();
  const fallbackEnabledAsync = getFallbackEnabledAsync();
  const fallbackTimeoutAsync = getFallbackTimeoutAsync();
  try {

  const mods = buildTrackedModsScript('data', t.changes, t.deletions, t.additions, '          ');
  const fallbackMods = buildTrackedModsScript('_fbData', t.changes, t.deletions, t.additions, '        ');

  // ── UNIFIED INTERCEPT SCRIPT (patches both fetch AND XHR) ──
  if(!isAsync){
const _rulesScript = (rulesEnabled && rules.length > 0) ? generateRulesScript(rules) : '';
const _urlMatch = t.url.includes('*') ? `new RegExp(${JSON.stringify(wildcardToRegex(t.url))}).test(url)` : `url.includes(${JSON.stringify(t.url)})`;
const interceptTarget = getInterceptTarget();
const reqBodyMods = (interceptTarget==='request'||interceptTarget==='both') ? getRequestBodyMods() : null;
const _reqBodyScript = reqBodyMods ? `
  const _reqMods = ${JSON.stringify(reqBodyMods)};
  const _reqMode = "${getRequestBodyMode()}";
  function _applyReqMods(bodyStr){
    try{
      if(_reqMode==='replace') return JSON.stringify(_reqMods);
      const b=JSON.parse(bodyStr||'{}'); Object.assign(b,_reqMods); return JSON.stringify(b);
    }catch(e){
      console.warn('%c⚠ JediMock warning', 'color:#fbbf24;font-weight:bold;font-size:12px', {
        message: 'Request body merge skipped because the outgoing body was not valid JSON',
        error: e.message
      });
      return bodyStr;
    }
  }` : '';
script=`(function(){
  const _fetch = window.fetch;
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;
  const _jmPattern = ${JSON.stringify(t.url)};
  const _jmTab = ${JSON.stringify(t.name||'Tab '+(currentTab+1))};
  const _jmFallbackMs = ${fallbackEnabled ? fallbackTimeout * 1000 : 0};
  let _jmHandled = false;
${_rulesScript}
${_reqBodyScript}
  function _jmIsFallbackError(e){
    return e && (e.message === 'jm_timeout' || e.message === 'Failed to fetch' || e.name === 'TypeError');
  }
  function _jmBuildFallbackResponse(url, reason){
    console.log('%c⚡ JediMock fallback', 'color:#00D4FF;font-weight:bold;font-size:12px', { url, reason, tab: _jmTab });
    const _fbData = ${JSON.stringify(t.data)};
${fallbackEnabled ? fallbackMods : ''}
    return new Response(JSON.stringify(_fbData), {
      status: ${t.statusCode||200},
      headers: { 'Content-Type': 'application/json' }
    });
  }
  // ── ACTIVATION LOG ──
  (()=>{
    const _info = { url: _jmPattern, target: '${interceptTarget}', mode: '${getResponseMode()}' };
    ${rulesEnabled && rules.length > 0 ? `_info.rules = ${rules.length};` : ''}
    ${fallbackEnabled ? `_info.fallback = '${fallbackTimeout}s';` : ''}
    console.log('%c⚡ JediMock active', 'color:#00D4FF;font-weight:bold;font-size:12px', _info);
  })();

  // ── FETCH INTERCEPT ──
  window.fetch = async (url, options={}) => {
    // Normalize url — handle fetch(Request) and fetch(URL) patterns
    if (url instanceof Request) { if(!options || Object.keys(options).length===0) options={}; url = url.url; }
    else if (typeof url !== 'string') url = String(url);
    if (${_urlMatch}) {
      _jmHandled = true;
      setTimeout(()=>_jmHandled=false,0);
      const _jmRunFetchIntercept = async () => {
        ${reqBodyMods ? `// Modify request body
        if(options.body) options = {...options, body: _applyReqMods(options.body)};` : ''}
        ${interceptTarget==='request' ? `// Request-only mode — send modified request, return real response
        const res = await _fetch(url, options);
        console.log('%c⚡ JediMock request modified', 'color:#00D4FF;font-weight:bold;font-size:12px', { tab: _jmTab, url, time: new Date().toLocaleTimeString() });
        return res;` : getResponseMode()==='replace' ? `// Replace mode — return full JSON directly, skip real response
        const _mockStatus=${t.statusCode||200}; const _mockDelay=${t.responseDelay||0};
        let data = ${JSON.stringify(t.data)};
${mods}
        if(_mockDelay>0) await new Promise(r=>setTimeout(r,_mockDelay));
        console.log('%c⚡ JediMock replaced', 'color:#00D4FF;font-weight:bold;font-size:12px', { tab: _jmTab, url, status: _mockStatus, mode: 'Replace', time: new Date().toLocaleTimeString() });
        return new Response(JSON.stringify(data), { status: _mockStatus, headers: { "Content-Type": "application/json" } });` : `const res = await _fetch(url, options);
        try {
          let data = await res.clone().json();
${mods}
          ${(rulesEnabled && rules.length > 0) ? 'const _jmR = _jmGetResponse(data); data = _jmR.data; const _mockStatus = _jmR.status; const _mockDelay = _jmR.delay;' : `const _mockStatus=${t.statusCode||200}; const _mockDelay=${t.responseDelay||0};`}
          if(_mockDelay>0) await new Promise(r=>setTimeout(r,_mockDelay));
          console.log('%c⚡ JediMock intercepted', 'color:#00D4FF;font-weight:bold;font-size:12px', {
            tab: _jmTab, pattern: _jmPattern, url,
            status: _mockStatus, target: '${interceptTarget}', delay: _mockDelay+'ms',
            time: new Date().toLocaleTimeString()
          });
          return new Response(JSON.stringify(data), {
            status: _mockStatus,
            headers: { "Content-Type": "application/json" }
          });
        } catch(e) {
          console.log('%c⚡ JediMock error', 'color:#f87171;font-weight:bold', {
            url,
            error: e.message,
            hint: 'Response merge requires a JSON response body. Switch to Replace mode for non-JSON endpoints.'
          });
          return res;
        }`}
      };
      if(_jmFallbackMs > 0){
        try {
          return await Promise.race([
            _jmRunFetchIntercept(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('jm_timeout')), _jmFallbackMs))
          ]);
        } catch(e) {
          if(_jmIsFallbackError(e)) return _jmBuildFallbackResponse(url, e.message);
          throw e;
        }
      }
      return _jmRunFetchIntercept();
    }
    return _fetch(url, options);
  };

  // ── XHR INTERCEPT ──
  XMLHttpRequest.prototype.open = function(method, url) {
    this._jmUrl = url; this._jmMethod = method;
    return _xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const url = this._jmUrl || '';
    if(_jmHandled) return _xhrSend.apply(this, arguments);
    if (typeof url === "string" && ${_urlMatch}) {
      ${reqBodyMods ? `// Modify request body
      if(body) body = _applyReqMods(body);` : ''}
      ${interceptTarget==='request' ? `// Request-only — send modified, return real response
      console.log('%c⚡ JediMock request modified (XHR)', 'color:#00D4FF;font-weight:bold;font-size:12px', { tab: _jmTab, url, time: new Date().toLocaleTimeString() });
      return _xhrSend.apply(this, [body]);` : getResponseMode()==='replace' ? `// Replace mode — skip real request entirely, return mock data directly
      const _xhrMock = this;
      const _mockStatus=${t.statusCode||200}; const _mockDelay=${t.responseDelay||0};
      let data = ${JSON.stringify(t.data)};
${mods}
      const _mockBody = JSON.stringify(data);
      setTimeout(function() {
        Object.defineProperty(_xhrMock, "responseText", { value: _mockBody, writable:true, configurable:true });
        Object.defineProperty(_xhrMock, "response",     { value: _mockBody, writable:true, configurable:true });
        Object.defineProperty(_xhrMock, "status",       { value: _mockStatus, writable:true, configurable:true });
        Object.defineProperty(_xhrMock, "readyState",   { value: 4, writable:true, configurable:true });
        _xhrMock.dispatchEvent(new Event("load"));
        _xhrMock.dispatchEvent(new Event("readystatechange"));
        console.log('%c⚡ JediMock replaced (XHR)', 'color:#00D4FF;font-weight:bold;font-size:12px', {
          tab: _jmTab, pattern: _jmPattern, url,
          status: _mockStatus, target: '${interceptTarget}', mode: 'Replace/XHR',
          time: new Date().toLocaleTimeString()
        });
      }, _mockDelay||0);
      return;` : `// Merge mode — let real request fire, then merge changes into response
      // Covers both xhr.onload = fn and addEventListener('load') patterns
      const _jmXhr = this;
      const _jmDoMerge = function() {
        try {
          let data = JSON.parse(_jmXhr.responseText);
${mods}
          ${(rulesEnabled && rules.length > 0) ? 'const _jmR = _jmGetResponse(data); data = _jmR.data; const _mockStatus = _jmR.status;' : `const _mockStatus=${t.statusCode||200};`}
          const modified = JSON.stringify(data);
          Object.defineProperty(_jmXhr, "responseText", { value: modified, writable:true, configurable:true });
          Object.defineProperty(_jmXhr, "response",     { value: modified, writable:true, configurable:true });
          Object.defineProperty(_jmXhr, "status",       { value: _mockStatus, writable:true, configurable:true });
          console.log('%c⚡ JediMock intercepted', 'color:#00D4FF;font-weight:bold;font-size:12px', {
            tab: _jmTab, pattern: _jmPattern, url,
            status: _mockStatus, target: '${interceptTarget}', mode: 'Merge/XHR',
            time: new Date().toLocaleTimeString()
          });
        } catch(e) {
          console.log('%c⚡ JediMock error', 'color:#f87171;font-weight:bold', {
            url,
            error: e.message,
            hint: 'XHR merge requires a JSON response body. Switch to Replace mode for non-JSON endpoints.'
          });
        }
      };
      // Intercept onload property assignment (covers xhr.onload = fn pattern)
      let _jmUserOnload = null;
      Object.defineProperty(this, 'onload', {
        configurable: true,
        set: function(fn) { _jmUserOnload = fn; },
        get: function() { return _jmUserOnload; }
      });
      // readystatechange at state 4 fires before 'load' event — merge runs first
      this.addEventListener("readystatechange", function() {
        if (this.readyState === 4) {
          _jmDoMerge();
          if (typeof _jmUserOnload === 'function') {
            try { _jmUserOnload.call(this, { type: 'load', target: this, currentTarget: this }); } catch(e) {}
          }
        }
      });
      return _xhrSend.apply(this, [body]);`}
    }
    return _xhrSend.apply(this, arguments);
  };
  // ── CLEANUP: restore originals on page unload ──
  window.addEventListener('beforeunload', function _jmCleanup() {
    window.fetch = _fetch;
    XMLHttpRequest.prototype.open = _xhrOpen;
    XMLHttpRequest.prototype.send = _xhrSend;
    window.removeEventListener('beforeunload', _jmCleanup);
  });
})();`;
  }

  if((t.asyncProtocol||"off")!=="off"){
    const asyncProtocol=t.asyncProtocol;
    const triggerMethod=t.asyncTriggerMethod||"POST";
    const triggerUrl=t.asyncTriggerUrl||"";
    const responseMethod=t.asyncResponseMethod||"GET";
    const responseUrl=t.asyncResponseUrl||"";
    const triggerUrlLiteral=JSON.stringify(triggerUrl);
    const triggerMethodLiteral=JSON.stringify(triggerMethod);
    const responseMethodLiteral=JSON.stringify(responseMethod);
    const responseUrlLiteral=JSON.stringify(responseUrl);
    const idFieldPath=resolveAsyncIdPath(t);
    const idFieldLabel=t.asyncIdField||formatReadablePath(idFieldPath);
    const idPath=idFieldPath.length?formatPath(idFieldPath):"";
    // Compute placeholder value from pasted JSON so we can replace it in the mock
    const placeholderId = idFieldPath.length ? getValueAtPath(t.data, idFieldPath) : null;
    const placeholderJson=JSON.stringify(placeholderId);
    const mockJson=JSON.stringify(t.data,null,2);

    // Smart URL matching:
    // If * is in the query string (e.g. /api/jobs/status?id=*) → extract ID from query param
    // If * is in the path (e.g. /api/jobs/*/status) → extract ID from path segment
    // If no * → just match URL contains the pattern, use _capturedId only
    const hasQueryStar = responseUrl.includes("?") && responseUrl.split("?")[1].includes("*");
    const hasPathStar = !hasQueryStar && responseUrl.includes("*");

    // For URL matching: always match on the base path (before ?)
    const basePath = responseUrl.split("?")[0];
    // Escape the base path for use in contains-check (no regex needed here)
    const basePathEscaped = JSON.stringify(basePath); // used as a string literal in generated script

    // Query param name that holds the ID (e.g. "transactionId" from ?transactionId=*)
    let queryParamName = "";
    if(hasQueryStar){
      const qs = responseUrl.split("?")[1];
      const parts = qs.split("&");
      for(const part of parts){
        if(part.includes("=*")){ queryParamName = part.split("=")[0]; break; }
      }
    }

    // Path pattern for path-star case
    const pathPattern = hasPathStar
      ? responseUrl.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace("\\*","([^/?]+)")
      : "";
    const pathPatternLiteral = JSON.stringify(pathPattern);
    const queryParamNameLiteral = JSON.stringify(queryParamName);

script=`(function(){
  let _capturedId = null;
  const _placeholderId = ${placeholderJson};
  const _mockData = ${mockJson};

  function replaceIdInObject(obj, placeholder, realId) {
    if(placeholder === null || placeholder === undefined) return;
    Object.keys(obj).forEach(k => {
      if(obj[k] === placeholder) obj[k] = realId;
      else if(typeof obj[k] === "object" && obj[k] !== null) replaceIdInObject(obj[k], placeholder, realId);
    });
  }

  function _jmWarn(msg, extra) {
    console.warn('%c⚠ JediMock warning', 'color:#fbbf24;font-weight:bold;font-size:12px', Object.assign({ tab: ${JSON.stringify(t.name||'Tab '+(currentTab+1))}, message: msg }, extra || {}));
  }

  function _matchesResponseUrl(url) {
    if(!url.includes(${basePathEscaped})) return false;
${hasPathStar ? `    return url.match(new RegExp(${pathPatternLiteral}));` : `    return true;`}
  }

  function _extractIdFromUrl(url) {
${hasQueryStar ? `    try {
      const u = new URL(url, location.href);
      return u.searchParams.get(${queryParamNameLiteral}) || null;
    } catch(e) { return null; }` :
hasPathStar ? `    const m = url.match(new RegExp(${pathPatternLiteral}));
    return m ? m[1] : null;` :
`    return null; // ID comes from _capturedId only`}
  }

  // ── ACTIVATION LOG ──
  console.log('%c⚡ JediMock active', 'color:#00D4FF;font-weight:bold;font-size:12px', {
    url: ${JSON.stringify(triggerUrl)}, mode: 'Async ID',
    trigger: '${t.asyncTriggerMethod||"POST"}', response: ${JSON.stringify(t.asyncResponseUrl||'')}, field: ${JSON.stringify(idFieldLabel)}
    ${fallbackEnabledAsync ? `, fallback: '${fallbackTimeoutAsync}s'` : ''}
  });

  // ── UNIFIED ASYNC (patches both fetch AND XHR) ──
  const _fetch = window.fetch;
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSend = XMLHttpRequest.prototype.send;

  // FETCH async
  window.fetch = async (url, options={}) => {
    const method = (options.method||"GET").toUpperCase();
    // Trigger: capture ID
    if (typeof url === "string" && url.includes(${triggerUrlLiteral}) && method === ${triggerMethodLiteral}) {
      const res = await _fetch(url, options);
      try {
        const body = await res.clone().json();
        _capturedId = body${idPath};
        if(_capturedId === undefined) _jmWarn('Selected Async ID field was not found in the trigger response', { url, field: ${JSON.stringify(idFieldLabel)} });
        console.log('%c⚡ JediMock [Async] Captured ID:', 'color:#00D4FF;font-weight:bold', _capturedId);
      } catch(e) { _jmWarn('Trigger response was not valid JSON, so no Async ID was captured', { url, error: e.message }); }
      return res;
    }
    // Response: inject ID
    if (typeof url === "string" && _matchesResponseUrl(url) && method === ${responseMethodLiteral}) {
      const id = _capturedId ?? _extractIdFromUrl(url);
      const data = JSON.parse(JSON.stringify(_mockData));
${mods}
      if (id !== null) replaceIdInObject(data, _placeholderId, id);
      console.log('%c⚡ JediMock [Async] Responding', 'color:#00D4FF;font-weight:bold', { url, id });
      return new Response(JSON.stringify(data), { status: ${t.statusCode||200}, headers: { "Content-Type": "application/json" } });
    }
    return _fetch(url, options);
  };

  // XHR async
  XMLHttpRequest.prototype.open = function(method, url) {
    this._jmUrl = url; this._jmMethod = method;
    return _xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    const url = this._jmUrl || "";
    const method = (this._jmMethod || "GET").toUpperCase();
    // Trigger: capture ID
    if (url.includes(${triggerUrlLiteral}) && method === ${triggerMethodLiteral}) {
      this.addEventListener("load", function() {
        try {
          const b = JSON.parse(this.responseText);
          _capturedId = b${idPath};
          if(_capturedId === undefined) _jmWarn('Selected Async ID field was not found in the trigger XHR response', { url, field: ${JSON.stringify(idFieldLabel)} });
          console.log('%c⚡ JediMock [Async/XHR] Captured ID:', 'color:#00D4FF;font-weight:bold', _capturedId);
        } catch(e) { _jmWarn('Trigger XHR response was not valid JSON, so no Async ID was captured', { url, error: e.message }); }
      });
    }
    // Response: inject ID
    if (_matchesResponseUrl(url) && method === ${responseMethodLiteral}) {
      const id = _capturedId ?? _extractIdFromUrl(url);
      const data = JSON.parse(JSON.stringify(_mockData));
${mods}
      if (id !== null) replaceIdInObject(data, _placeholderId, id);
      Object.defineProperty(this, "responseText", { value: JSON.stringify(data), writable:true, configurable:true });
      Object.defineProperty(this, "response",     { value: JSON.stringify(data), writable:true, configurable:true });
      Object.defineProperty(this, "status",       { value: ${t.statusCode||200},  writable:true, configurable:true });
      console.log('%c⚡ JediMock [Async/XHR] Responding', 'color:#00D4FF;font-weight:bold', { url, id });
      setTimeout(() => this.dispatchEvent(new Event("load")), ${t.responseDelay||0});
      return;
    }
    return _xhrSend.apply(this, arguments);
  };
${fallbackEnabledAsync ? `
  // FALLBACK TIMER: if response URL never fires at all, fire mock after timeout using captured ID
  setTimeout(() => {
    if(_capturedId === null) return; // no trigger fired yet
    const responsePattern = ${responseUrlLiteral};
    const constructedUrl = responsePattern.replace('*', _capturedId);
    const data = JSON.parse(JSON.stringify(_mockData));
${mods}
    replaceIdInObject(data, _placeholderId, _capturedId);
    console.log('%c⚡ JediMock [Async] fallback timer', 'color:#00D4FF;font-weight:bold;font-size:12px', { constructedUrl, id: _capturedId });
    // Dispatch a custom event so app code listening can react
    window.dispatchEvent(new CustomEvent('jm-async-fallback', {
      detail: { url: constructedUrl, data, id: _capturedId }
    }));
  }, _jmAsyncFallbackMs);` : ``}
})();`;
  }

  if((t.asyncProtocol||"off")!=="off"){
    const fsField=t.firestoreField||"";
    const fsValue=t.firestoreValue||"";
    if(fsField){
      let fsValueExpr=JSON.stringify(fsValue);
      if(fsValue==="true") fsValueExpr="true";
      else if(fsValue==="false") fsValueExpr="false";
      else if(fsValue==="null") fsValueExpr="null";
      else if(fsValue!==""&&!isNaN(fsValue)) fsValueExpr=fsValue;
      script+=`

(function(){
  const _targetField="${fsField}";
  const _targetValue=${fsValueExpr};
  function wrapOnSnapshot(orig){
    return function(...args){
      return orig.apply(this,args.map(arg=>{
        if(typeof arg==="function") return function(snap){
          const d=Object.assign({},snap.data?snap.data():{});
          d[_targetField]=_targetValue;
          arg({...snap,data:()=>d,exists:true});
        };
        if(arg&&typeof arg==="object"&&arg.next) return {...arg,next:function(snap){
          const d=Object.assign({},snap.data?snap.data():{});
          d[_targetField]=_targetValue;
          arg.next({...snap,data:()=>d,exists:true});
        }};
        return arg;
      }));
    };
  }
  function patch(){
    const fb=window.firebase;
    if(!fb||!fb.firestore) return false;
    [fb.firestore.DocumentReference,fb.firestore.Query].forEach(cls=>{
      if(cls&&cls.prototype&&cls.prototype.onSnapshot)
        cls.prototype.onSnapshot=wrapOnSnapshot(cls.prototype.onSnapshot);
    });
    console.log("[AsyncMock] Firestore patched —",_targetField,"=",_targetValue);
    return true;
  }
  if(!patch()){ setTimeout(patch,500); setTimeout(patch,2000); }
})();`;
    }
  }

  tabs[currentTab].script=script;
  output.textContent=script;
  // Populate meta info card
  _jmBuildMeta(t, typeof interceptTarget!=='undefined'?interceptTarget:'response', getResponseMode(), rulesEnabled, rules);
  markScriptCurrent();
  updateVisibility();
  } catch(e) {
    // Generate failed — show visible error
    console.error('JediMock generate error:', e);
    edFlash('⚠ Script generation failed: ' + e.message, 'var(--red)');
  }
}

function exportConfig(){
  saveState();
  const safeTabs=tabs.map((t,i)=>sanitizeTabState(t, "Tab "+(i+1)));
  const blob=new Blob([JSON.stringify({version:1,tabs:safeTabs},null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="jedimock-config.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importConfig(event){
  const file=event.target.files[0];
  if(!file) return;
  if(file.size > MAX_IMPORT_FILE_BYTES){
    edFlash("⚠ Config file is too large", "var(--red)");
    event.target.value="";
    return;
  }
  const reader=new FileReader();
  reader.onload=(e)=>{
    try{
      const imported=JSON.parse(e.target.result);
      if(!imported.tabs||!Array.isArray(imported.tabs)) throw new Error("Invalid format");
      tabs=imported.tabs.slice(0, TAB_LIMIT).map((t,i)=>sanitizeTabState(t, "Tab "+(i+1)));
      currentTab=0;
      data={};changes=[];deletions=[];additions=[];asyncIdField="";asyncIdPath=[];
      loadState();
      renderTabs();
      // Flash the import label button
      const importBtns=document.querySelectorAll(".btn-ghost");
      const importBtn=[...importBtns].find(b=>b.textContent.includes("Import"));
      if(importBtn){
        const orig=importBtn.textContent;
        importBtn.textContent="✓ Imported!";
        importBtn.style.color="var(--green)";
        setTimeout(()=>{importBtn.textContent=orig;importBtn.style.color="";},1500);
      }
    }catch(err){ edFlash && edFlash("⚠ Failed to import: "+err.message,"var(--red)"); console.error("Import failed:",err); }
    event.target.value="";
  };
  reader.readAsText(file);
}

function copyScript(){
  const raw=(document.getElementById("output")||{}).textContent||"";
  if(!raw){ edFlash('⚠ Generate a script first', 'var(--red)'); return; }
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(raw)
      .then(()=>flashCopy())
      .catch(()=>fallbackCopy(raw, raw));
  } else {
    fallbackCopy(raw, raw);
  }
}

function fallbackCopy(text, raw){
  const ta=document.createElement("textarea");
  ta.value=text;
  ta.style.cssText="position:fixed;top:-9999px;left:-9999px;opacity:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try{
    document.execCommand("copy");
    flashCopy();
    document.body.removeChild(ta);
  } catch(e){
    document.body.removeChild(ta);
    // Clipboard completely blocked — show script temporarily so user can copy manually
    showScriptFallback(raw);
  }
}

function showScriptFallback(raw){
  // Show the script in a modal so user can manually select+copy
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  const safeRaw = escHtml(raw);
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:700px;width:100%;max-height:80vh;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;font-weight:600;color:var(--text)">⚠ Clipboard blocked — select all and copy manually</span>
        <button onclick="this.closest('.jm-fallback-overlay').remove()" style="background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;padding:0;line-height:1">✕</button>
      </div>
      <textarea readonly style="flex:1;min-height:300px;font-family:'SF Mono','Fira Code',monospace;font-size:11px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px;color:var(--text);resize:vertical;line-height:1.4" onclick="this.select()">${safeRaw}</textarea>
      <div style="font-size:11px;color:var(--text-dim)">Click the text area, then Ctrl/⌘+A to select all, then Ctrl/⌘+C to copy.</div>
    </div>
  `;
  overlay.className = 'jm-fallback-overlay';
  overlay.onclick = (e) => { if(e.target===overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  // Auto-select the textarea
  setTimeout(()=>{ const ta=overlay.querySelector('textarea'); if(ta) ta.select(); }, 100);
}

function flashCopy(){
  const btn=document.getElementById('copyScriptBtn') || document.querySelector("[onclick='copyScript()']");
  if(!btn) return;
  const orig=btn.innerHTML;
  const origBg=btn.style.background;
  btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 12 4 6"/></svg> Copied!';
  btn.style.background='var(--green)';
  btn.style.color='#000';
  setTimeout(()=>{ btn.innerHTML=orig; btn.style.background=origBg; btn.style.color=''; }, 1800);
}

function resetAll(){
  if(!confirm("Reset this tab? This clears the URL, JSON, tree edits, and generated script for the current tab.")) return;
  tabs[currentTab]={name:"Tab "+(currentTab+1),data:{},changes:[],deletions:[],additions:[],url:"",mode:"fetch",asyncProtocol:"off",rawJson:"",script:"",asyncTriggerMethod:"POST",asyncTriggerUrl:"",asyncResponseMethod:"GET",asyncResponseUrl:"",asyncIdField:"",asyncIdPath:[],asyncCaptureField:"",firestoreField:"",firestoreValue:""};
  data={};
  changes=[];
  deletions=[];
  additions=[];
  collapsed={};
  asyncIdField="";
  asyncIdPath=[];
  const _ji=document.getElementById("jsonInput");
  const _ui=document.getElementById("urlInput");
  const _op=document.getElementById("output");
  if(_ji) _ji.value="";
  if(_ui) _ui.value="";
  if(_op) _op.textContent="";
  _scriptUpToDate = false;
  if(tabs[currentTab]) tabs[currentTab].scriptUpToDate = false;
  document.querySelector("input[name=asyncMode][value=off]").checked=true;
  document.getElementById("asyncTriggerMethod").value="POST";
  document.getElementById("asyncTriggerUrl").value="";
  document.getElementById("asyncResponseMethod").value="GET";
  document.getElementById("asyncResponseUrl").value="";
  document.getElementById("firestoreField").value="";
  document.getElementById("firestoreValue").value="";
  document.getElementById("idFieldSearch").value="";
  document.getElementById("idFieldList").replaceChildren();
  document.getElementById("idFieldSelected").textContent="";
  const badge = document.getElementById('scriptOutdatedBadge');
  if(badge) badge.style.display = 'none';
  const copyBtn = document.getElementById('copyScriptBtn');
  if(copyBtn){ copyBtn.style.opacity = ''; copyBtn.title = ''; }
  const btn = document.getElementById('generateBtn');
  if(btn){
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate Script';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.border = '';
  }
  onModeChange();
  updateChangesBadge();
  updateVisibility();
  renderTabs();
}

renderTabs();

/* ── SHAREABLE LINK ── */
async function compressToBase64(str){
  const bytes=new TextEncoder().encode(str);
  if(bytes.length > MAX_SHARE_BYTES) throw new Error("Share payload is too large");
  const cs=new CompressionStream("deflate-raw");
  const writer=cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const compressed=await new Response(cs.readable).arrayBuffer();
  return bytesToBase64Url(new Uint8Array(compressed));
}

async function decompressFromBase64(b64){
  if(!b64 || b64.length > MAX_SHARE_HASH_CHARS) throw new Error("Shared link is too large");
  const bytes=base64UrlToBytes(b64);
  if(bytes.length > MAX_SHARE_BYTES) throw new Error("Shared link payload is too large");
  const ds=new DecompressionStream("deflate-raw");
  const writer=ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader=ds.readable.getReader();
  const decoder=new TextDecoder();
  let total=0;
  let text="";
  while(true){
    const { value, done } = await reader.read();
    if(done) break;
    total += value.byteLength;
    if(total > MAX_SHARE_BYTES){
      reader.cancel().catch(()=>{});
      throw new Error("Shared link expands beyond the allowed size");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

function showTransientToast(message, tone = "ok"){
  const toast=document.createElement("div");
  const color = tone === "error" ? "var(--red)" : tone === "warn" ? "var(--yellow)" : "var(--green)";
  toast.textContent=message;
  toast.style.cssText=`position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid ${color};color:${color};padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;transition:opacity 0.3s`;
  document.body.appendChild(toast);
  setTimeout(()=>{toast.style.opacity="0";setTimeout(()=>toast.remove(),300);},2500);
}

async function shareTab(){
  saveState();
  const btn=document.getElementById("shareBtn");
  const t=tabs[currentTab];
  try{
    const json=JSON.stringify({version:1,tab:sanitizeTabState(t, t?.name || "Shared Tab")});
    const hash=await compressToBase64(json);
    const url=location.href.split("#")[0]+"#share="+hash;
    history.replaceState(null,"",url);
    // Try clipboard API, fall back to execCommand
    let copied=false;
    try{
      await navigator.clipboard.writeText(url);
      copied=true;
    }catch(e){
      try{
        const ta=document.createElement("textarea");
        ta.value=url;
        ta.style.cssText="position:fixed;top:-9999px;opacity:0";
        document.body.appendChild(ta);
        ta.focus();ta.select();
        copied=document.execCommand("copy");
        document.body.removeChild(ta);
      }catch(e2){}
    }
    const origHTML=btn.innerHTML;
    btn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ${copied?"Link copied!":"URL updated!"}`;
    btn.style.color="var(--green)";
    setTimeout(()=>{btn.innerHTML=origHTML;btn.style.color="";},2000);
  }catch(e){
    console.error("Share failed:",e);
    edFlash("⚠ Could not create a share link: " + e.message, "var(--red)");
  }
}

async function loadSharedTab(){
  const hash=location.hash;
  if(!hash.startsWith("#share=")) return;
  const encoded=hash.slice(7);
  if(!encoded) return;
  try{
    const json=await decompressFromBase64(encoded);
    const imported=JSON.parse(json);
    if(!imported.tab) return;
    const newTab=sanitizeTabState(imported.tab, "Shared Tab");
    tabs.push(newTab);
    currentTab=tabs.length-1;
    data=newTab.data||{};
    changes=newTab.changes||[];
    deletions=newTab.deletions||[];
    additions=newTab.additions||[];
    asyncIdField=newTab.asyncIdField||"";
    asyncIdPath=resolveAsyncIdPath(newTab);
    loadState();
    renderTabs();
    // Clear hash so refresh doesn't reload it
    history.replaceState(null,"",location.href.split("#")[0]);
    showTransientToast("Shared tab loaded.");
  }catch(e){
    console.error("Failed to load shared tab:",e);
    history.replaceState(null,"",location.href.split("#")[0]);
    showTransientToast("Could not load that shared tab.", "error");
  }
}

/* ── TAB CONTEXT MENU ── */
let contextMenuTabIndex=-1;

function showTabContextMenu(e, i){
  contextMenuTabIndex=i;
  const menu=document.getElementById("tabContextMenu");
  const closeItem=document.getElementById("contextCloseItem");
  closeItem.style.display=tabs.length>1?"flex":"none";
  menu.classList.remove("hidden");
  // Position
  const x=Math.min(e.clientX, window.innerWidth-170);
  const y=Math.min(e.clientY, window.innerHeight-120);
  menu.style.left=x+"px";
  menu.style.top=y+"px";
}

function hideTabContextMenu(){
  document.getElementById("tabContextMenu").classList.add("hidden");
  contextMenuTabIndex=-1;
}

document.addEventListener("click", hideTabContextMenu);
document.addEventListener("keydown", e=>{ if(e.key==="Escape") hideTabContextMenu(); });

function duplicateTab(i){
  hideTabContextMenu();
  if(i<0||i>=tabs.length) return;
  saveState();
  const src=tabs[i];
  const copy=JSON.parse(JSON.stringify(src));
  copy.name=src.name+" (copy)";
  tabs.splice(i+1,0,copy);
  currentTab=i+1;
  loadState();
  renderTabs();
}

function renameTab(i){
  startRenameTab(i);
}

function closeTabFromMenu(i){
  hideTabContextMenu();
  if(tabs.length<=1) return;
  if(i===currentTab) saveState();
  const e={stopPropagation:()=>{}};
  closeTab(e,i);
}

/* ── UTILITIES ── */
function escHtml(s){ if(s===null||s===undefined) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function appendDiffRowSummary(row, pathStr, valueStr, valueClass){
  const path = document.createElement("span");
  path.className = "diff-path";
  path.title = pathStr;
  path.textContent = pathStr;

  const arrow = document.createElement("span");
  arrow.className = "diff-arrow";
  arrow.textContent = "→";

  const value = document.createElement("span");
  value.className = valueClass;
  value.title = valueStr;
  value.textContent = valueStr;

  row.append(path, arrow, value);
}
function flattenJson(obj,prefix,result={}){
  if(typeof obj!=="object"||obj===null){ result[prefix||"(root)"]=obj; return result; }
  Object.keys(obj).forEach(k=>{
    const p=prefix?(Array.isArray(obj)?prefix+"["+k+"]":prefix+"."+k):(Array.isArray(obj)?"["+k+"]":k);
    flattenJson(obj[k],p,result);
  });
  return result;
}
function maxDepth(obj,d=0){ if(typeof obj!=="object"||obj===null) return d; return Math.max(d,...Object.values(obj).map(v=>maxDepth(v,d+1))); }
function formatBytes(b){ if(b<1024) return b+"B"; if(b<1024*1024) return (b/1024).toFixed(1)+"KB"; return (b/1024/1024).toFixed(1)+"MB"; }
function setStatus(id,msg,type){
  const el=document.getElementById(id); if(!el) return;
  el.textContent=msg; el.className="status-msg"+(type?" "+type:"");
  if(msg) setTimeout(()=>{ if(el.textContent===msg){ el.textContent=""; el.className="status-msg"; }},2500);
}
async function pasteToEl(id, cb){
  try{
    const text=await navigator.clipboard.readText();
    const el=document.getElementById(id);
    if(!el) return;
    el.value=text; el.dispatchEvent(new Event("input"));
    if(cb) cb();
  }catch(e){ console.warn("Clipboard API unavailable"); }
}
function copyDiffSide(side, btn){
  let text = '';
  const ta = document.getElementById('diff'+side);
  const textEl = document.getElementById('diff'+side+'Text');
  if(textEl && textEl.children.length > 0){
    text = [...textEl.querySelectorAll('.diff-line')].map(el=>el.textContent).join('\n');
  } else if(ta) {
    text = ta.value;
  }
  if(!text) return;
  const tmp = document.createElement('textarea');
  tmp.value = text;
  tmp.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(tmp);
  tmp.focus(); tmp.select();
  try { document.execCommand('copy'); } catch(e) {}
  document.body.removeChild(tmp);
  if(navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
  // Feedback
  if(btn){ const orig=btn.textContent; btn.textContent='✓ Copied'; btn.style.color='var(--green)'; setTimeout(()=>{ btn.textContent=orig; btn.style.color=''; },1500); }
}

function copyText(text){
  try{ navigator.clipboard.writeText(text); }catch(e){
    const ta=document.createElement("textarea"); ta.value=text;
    ta.style.cssText="position:fixed;top:-9999px;opacity:0"; document.body.appendChild(ta);
    ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
  }
}

/* ── TOOL SWITCHER ── */
function switchTool(name){
  document.querySelectorAll(".tool-panel").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".tool-nav-btn,.sidebar-nav-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById("panel-"+name).classList.add("active");
  document.getElementById("nav-"+name).classList.add("active");
  // Show Import/Export/Share only on Mock tool
  const mb=document.getElementById("mockOnlyBtns");
  if(mb) mb.style.display = name==="mock" ? "block" : "none";
  // Show Getting started only on Mock
  const gs=document.getElementById("gettingStartedBtn");
  if(gs) gs.classList.toggle("js-hidden", name!=="mock");
  persistSession();
}

/* ── BEAUTIFIER ── */
function beautifyLive(){
  const v=document.getElementById("beautInput").value.trim();
  if(!v){ document.getElementById("beautStatus").textContent=""; return; }
  try{
    JSON.parse(v);
    document.getElementById("beautInput").className="json-textarea success";
    document.getElementById("beautStatus").textContent="";
  }catch(e){
    document.getElementById("beautInput").className="json-textarea error";
  }
}

function updateBeautGutter(side){
  const ta=document.getElementById('beaut'+side);
  const gt=document.getElementById('beaut'+side+'Gutter');
  const lbl=document.getElementById('beaut'+side+'Label');
  if(!ta||!gt) return;
  const lines=ta.value===''?1:ta.value.split('\n').length;
  if(gt.children.length!==lines){
    renderLineNumberGutter(gt, lines);
  }
  gt.scrollTop=ta.scrollTop;
  if(lbl) lbl.textContent=ta.value?'('+lines+' lines)':'';
}

function beautCopySide(side){
  const ta=document.getElementById(side==='input'?'beautInput':'beautOutput');
  if(!ta||!ta.value) return;
  const tmp=document.createElement('textarea');
  tmp.value=ta.value;
  tmp.style.cssText='position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(tmp);
  tmp.focus(); tmp.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(tmp);
  if(navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(()=>{});
  setStatus("beautStatus","✓ Copied!","ok");
}

function beautSwap(){
  const i=document.getElementById("beautInput");
  const o=document.getElementById("beautOutput");
  const tmp=i.value; i.value=o.value; o.value=tmp;
  updateBeautGutter('Input'); updateBeautGutter('Output');
}

function doBeautify(){
  const v=document.getElementById("beautInput").value.trim();
  if(!v) return;
  try{
    const parsed=JSON.parse(sanitizeJson(v));
    document.getElementById("beautOutput").value=JSON.stringify(parsed,null,2);
    updateBeautGutter('Output');
    setStatus("beautStatus","✓ Beautified","ok");
  }catch(e){ setStatus("beautStatus","✕ "+e.message,"err"); }
}

function doMinify(){
  const v=document.getElementById("beautInput").value.trim();
  if(!v) return;
  try{
    const parsed=JSON.parse(sanitizeJson(v));
    document.getElementById("beautOutput").value=JSON.stringify(parsed);
    updateBeautGutter('Output');
    setStatus("beautStatus","✓ Minified","ok");
  }catch(e){ setStatus("beautStatus","✕ "+e.message,"err"); }
}

function copyBeaut(){ beautCopySide('output'); }

function clearBeaut(){
  document.getElementById("beautInput").value="";
  document.getElementById("beautOutput").value="";
  document.getElementById("beautStatus").textContent="";
  updateBeautGutter('Input'); updateBeautGutter('Output');
}

function renderLineNumberGutter(gutterEl, lines){
  if(!gutterEl) return;
  const next = [];
  for(let i = 1; i <= lines; i++){
    const span = document.createElement('span');
    span.textContent = String(i);
    next.push(span);
  }
  gutterEl.replaceChildren(...next);
}

/* ── DIFF ── */

let diffLines=[], diffDiffIdxs=[], diffCurrentIdx=-1;

function updateDiffGutter(side){
  const ta=document.getElementById('diff'+side);
  const gt=document.getElementById('diff'+side+'Gutter');
  if(!ta||!gt) return;
  const lines=ta.value.split('\n').length;
  if(gt.children.length!==lines){
    renderLineNumberGutter(gt, lines);
  }
  gt.scrollTop=ta.scrollTop;
  const lbl=document.getElementById('diff'+side+'InputLabel');
  if(lbl) lbl.textContent=ta.value?'('+lines+' lines)':'';
}

function editAndCompare(){
  // Show input, hide output
  document.getElementById("diffInputRow").style.display="grid";
  document.getElementById("diffOutputRow").style.display="none";
  document.getElementById("diffStats").textContent="";
  document.getElementById("diffNavLabel").textContent="";
  document.querySelector('[onclick="doDiff()"]').style.display="";
  document.getElementById("editCompareBtn").style.display="none";
}

function doDiff(){
  const left=document.getElementById("diffLeft").value.trimEnd();
  const right=document.getElementById("diffRight").value.trimEnd();
  if(!left||!right){ setStatus("diffStatus","Paste text in both panels","err"); return; }

  const leftLines=left.split("\n");
  const rightLines=right.split("\n");
  diffLines=computeLineDiff(leftLines,rightLines);

  const added=diffLines.filter(l=>l.type==="add").length;
  const removed=diffLines.filter(l=>l.type==="remove").length;
  const same=diffLines.filter(l=>l.type==="same").length;

  const totalDiffs=diffLines.filter(p=>p.type!=='same').length;
  const statsEl=document.getElementById("diffStats");
  statsEl.textContent= totalDiffs===0 ? '✓ Identical' : totalDiffs+' diff'+(totalDiffs===1?'':'s');
  statsEl.style.color= totalDiffs===0 ? 'var(--green)' : 'var(--red)';

  // Build navigation index — first line of each diff block
  diffDiffIdxs=[];
  let inBlock=false;
  diffLines.forEach((p,i)=>{
    if(p.type!=="same"&&!inBlock){ diffDiffIdxs.push(i); inBlock=true; }
    if(p.type==="same") inBlock=false;
  });
  diffCurrentIdx=-1;

  renderDiff();

  // Show output panels, hide raw textareas
  document.getElementById("diffInputRow").style.display="none";
  document.getElementById("diffOutputRow").style.display="grid";
  document.querySelector('[onclick="doDiff()"]').style.display="none";
  document.getElementById("editCompareBtn").style.display="";
  document.getElementById("diffLeftLabel").textContent="("+leftLines.length+" lines)";
  document.getElementById("diffRightLabel").textContent="("+rightLines.length+" lines)";

  document.getElementById("diffNavLabel").textContent=diffDiffIdxs.length?"0 / "+diffDiffIdxs.length:"";
  setStatus("diffStatus","","");
}

function renderDiff(){
  const lNums=document.getElementById("diffLeftNums");
  const rNums=document.getElementById("diffRightNums");
  const lHL=document.getElementById("diffLeftHL");
  const rHL=document.getElementById("diffRightHL");
  const lText=document.getElementById("diffLeftText");
  const rText=document.getElementById("diffRightText");
  const lScroll=document.getElementById("diffLeftScroll");
  const rScroll=document.getElementById("diffRightScroll");

  let lNHtml='', rNHtml='';
  let lHLHtml='', rHLHtml='';
  let lTHtml='', rTHtml='';
  let lLine=1, rLine=1;

  diffLines.forEach((p,i)=>{
    const idx=' data-idx="'+i+'"';
    if(p.type==='same'){
      lNHtml+='<span>'+lLine+'</span>'; lLine++;
      rNHtml+='<span>'+rLine+'</span>'; rLine++;
      lHLHtml+='<div class="diff-highlight-line"></div>';
      rHLHtml+='<div class="diff-highlight-line"></div>';
      lTHtml+='<span class="diff-line"'+idx+'>'+escHtml(p.l)+'</span>';
      rTHtml+='<span class="diff-line"'+idx+'>'+escHtml(p.r)+'</span>';
    } else if(p.type==='change'){
      lNHtml+='<span>'+lLine+'</span>'; lLine++;
      rNHtml+='<span>'+rLine+'</span>'; rLine++;
      lHLHtml+='<div class="diff-highlight-line diff-hl-left"></div>';
      rHLHtml+='<div class="diff-highlight-line diff-hl-right"></div>';
      const inl=inlineDiff(p.l||'', p.r||'', escHtml);
      lTHtml+='<span class="diff-line diff-line-changed"'+idx+'>'+inl.left+'</span>';
      rTHtml+='<span class="diff-line diff-line-changed"'+idx+'>'+inl.right+'</span>';
    } else if(p.type==='remove'){
      lNHtml+='<span>'+lLine+'</span>'; lLine++;
      rNHtml+='<span style="opacity:0">-</span>';
      lHLHtml+='<div class="diff-highlight-line diff-hl-left"></div>';
      rHLHtml+='<div class="diff-highlight-line diff-hl-empty"></div>';
      lTHtml+='<span class="diff-line diff-line-changed"'+idx+'>'+escHtml(p.l)+'</span>';
      rTHtml+='<span class="diff-line diff-empty-line"'+idx+'> </span>';
    } else {
      lNHtml+='<span style="opacity:0">-</span>';
      rNHtml+='<span>'+rLine+'</span>'; rLine++;
      lHLHtml+='<div class="diff-highlight-line diff-hl-empty"></div>';
      rHLHtml+='<div class="diff-highlight-line diff-hl-right"></div>';
      lTHtml+='<span class="diff-line diff-empty-line"'+idx+'> </span>';
      rTHtml+='<span class="diff-line diff-line-changed"'+idx+'>'+escHtml(p.r)+'</span>';
    }
  });

  lNums.innerHTML=lNHtml;
  rNums.innerHTML=rNHtml;
  lHL.innerHTML=lHLHtml;
  rHL.innerHTML=rHLHtml;
  lText.innerHTML=lTHtml;
  rText.innerHTML=rTHtml;

  // Sync scroll: vertical syncs both panels + line nums; horizontal independent
  let syncing=false;
  const syncScroll=(src,srcNums,other,otherNums)=>{
    if(syncing) return; syncing=true;
    other.scrollTop=src.scrollTop;
    srcNums.scrollTop=src.scrollTop;
    otherNums.scrollTop=src.scrollTop;
    // Sync highlight layer horizontal
    src.querySelector('.diff-highlights').style.transform='translateX('+(-src.scrollLeft)+'px)';
    setTimeout(()=>syncing=false,0);
  };
  lScroll.onscroll=()=>{
    lNums.scrollTop=lScroll.scrollTop;
    if(!syncing){ syncing=true; rScroll.scrollTop=lScroll.scrollTop; rNums.scrollTop=lScroll.scrollTop; setTimeout(()=>syncing=false,0); }
  };
  rScroll.onscroll=()=>{
    rNums.scrollTop=rScroll.scrollTop;
    if(!syncing){ syncing=true; lScroll.scrollTop=rScroll.scrollTop; lNums.scrollTop=rScroll.scrollTop; setTimeout(()=>syncing=false,0); }
  };
}

function diffNav(dir){
  if(!diffDiffIdxs.length) return;
  if(diffCurrentIdx===-1) diffCurrentIdx=dir===1?0:diffDiffIdxs.length-1;
  else{
    diffCurrentIdx+=dir;
    if(diffCurrentIdx<0) diffCurrentIdx=diffDiffIdxs.length-1;
    if(diffCurrentIdx>=diffDiffIdxs.length) diffCurrentIdx=0;
  }
  // Remove old highlights
  document.querySelectorAll(".diff-current").forEach(el=>el.classList.remove("diff-current"));
  const lineIdx=diffDiffIdxs[diffCurrentIdx];
  // Highlight all lines in this diff block
  let k=lineIdx;
  while(k<diffLines.length&&diffLines[k].type!=="same"){
    document.querySelectorAll('[data-idx="'+k+'"]').forEach(el=>el.classList.add("diff-current"));
    k++;
  }
  // Scroll to the diff block - find the actual DOM element and scrollIntoView
  const targetLine=document.getElementById("diffLeftText").querySelector('[data-idx="'+lineIdx+'"]');
  const targetLine2=document.getElementById("diffRightText").querySelector('[data-idx="'+lineIdx+'"]');
  if(targetLine){
    const lScroll=document.getElementById("diffLeftScroll");
    const rScroll=document.getElementById("diffRightScroll");
    const lNums=document.getElementById("diffLeftNums");
    const rNums=document.getElementById("diffRightNums");
    // Calculate position: each line is 20px high
    const scrollTo=lineIdx*20 - lScroll.clientHeight/2 + 10;
    const newTop=Math.max(0, scrollTo);
    lScroll.scrollTop=newTop;
    rScroll.scrollTop=newTop;
    lNums.scrollTop=newTop;
    rNums.scrollTop=newTop;
  }
  document.getElementById("diffNavLabel").textContent=(diffCurrentIdx+1)+" / "+diffDiffIdxs.length;
}

function toggleDiffFullscreen(){
  const panel=document.getElementById("panel-diff");
  const btn=document.getElementById("diffFullscreenBtn");
  const isFS=panel.classList.toggle("diff-fullscreen");
  btn.textContent=isFS?"⛶ Exit FS":"⛶ Fullscreen";
  if(isFS){
    document.body.style.overflow="hidden";
  } else {
    document.body.style.overflow="";
  }
}

function expandDiffInputs(){
  const btn=document.getElementById("diffExpandBtn");
  const card=document.querySelector("#panel-diff .card");
  const isExpanded=card.style.height!=="";
  card.style.height=isExpanded?"":"calc(100vh - 50px)";
  btn.textContent=isExpanded?"⤢ Expand":"⤡ Collapse";
}

function swapDiff(){
  const l=document.getElementById("diffLeft").value;
  const r=document.getElementById("diffRight").value;
  document.getElementById("diffLeft").value=r;
  document.getElementById("diffRight").value=l;
  updateDiffGutter("Left"); updateDiffGutter("Right");
  if(document.getElementById("diffOutputRow").style.display!=="none") doDiff();
}

function clearDiff(){
  document.getElementById("diffLeft").value="";
  document.getElementById("diffRight").value="";
  document.getElementById("diffInputRow").style.display="grid";
  document.getElementById("diffOutputRow").style.display="none";
  ["diffLeftNums","diffRightNums","diffLeftHL","diffRightHL","diffLeftText","diffRightText"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.replaceChildren();
  });
  document.getElementById("diffStats").textContent="";
  document.getElementById("diffStatus").textContent="";
  document.getElementById("diffNavLabel").textContent="";
  diffLines=[];diffDiffIdxs=[];diffCurrentIdx=-1;
  document.querySelector('[onclick="doDiff()"]').style.display="";
  document.getElementById("editCompareBtn").style.display="none";
  updateDiffGutter("Left"); updateDiffGutter("Right");
}

/* ── VALIDATOR ── */
let validErrorLines   = [];  // sorted 1-based line numbers with errors
let validCurrentErrIdx = -1;

function updateValidGutter(){
  const ta  = document.getElementById("validInput");
  const gt  = document.getElementById("validGutter");
  const lbl = document.getElementById("validInputLabel");
  if(!ta||!gt) return;
  const lines = ta.value==='' ? 1 : ta.value.split("\n").length;
  if(gt.children.length !== lines)
    renderLineNumberGutter(gt, lines);
  gt.scrollTop = ta.scrollTop;
  if(lbl) lbl.textContent = ta.value ? `(${lines} lines)` : "";
}

/* Render red highlight strips (absolutely positioned behind textarea) */
function renderValidHighlights(errorLineSet){
  const hl = document.getElementById("validHL");
  if(!hl) return;
  if(!errorLineSet || errorLineSet.size===0){ hl.replaceChildren(); return; }
  const lineH = 20;
  const blocks = [];
  errorLineSet.forEach(ln=>{
    const top = (ln-1)*lineH;
    const block = document.createElement("div");
    block.dataset.vline = String(ln);
    block.style.position = "absolute";
    block.style.left = "0";
    block.style.right = "0";
    block.style.top = top + "px";
    block.style.height = lineH + "px";
    block.style.background = "rgba(248,113,113,0.18)";
    block.style.pointerEvents = "none";
    blocks.push(block);
  });
  hl.replaceChildren(...blocks);
}

function setValidCurrentHighlight(lineNum){
  const hl = document.getElementById("validHL");
  if(!hl) return;
  hl.querySelectorAll("[data-vline]").forEach(el=>{
    const ln = parseInt(el.dataset.vline);
    el.style.background = ln===lineNum ? "rgba(248,113,113,0.38)" : "rgba(248,113,113,0.18)";
    el.style.outline    = ln===lineNum ? "1.5px solid rgba(248,113,113,0.6)" : "";
  });
}

function syncValidScroll(){
  const ta = document.getElementById("validInput");
  const gt = document.getElementById("validGutter");
  const hl = document.getElementById("validHL");
  if(ta && gt) gt.scrollTop = ta.scrollTop;
  // Shift the inner strip container up by scrollTop so strips track lines
  if(ta && hl) hl.style.transform = `translateY(-${ta.scrollTop}px)`;
}

function onValidInput(){
  updateValidGutter();
  syncValidScroll();
  renderValidHighlights(new Set());
  validErrorLines=[]; validCurrentErrIdx=-1;
  document.getElementById("validNavLabel").textContent="";
  document.getElementById("validPrevBtn").style.display="none";
  document.getElementById("validNextBtn").style.display="none";
}

function validCopy(btn){
  const v = document.getElementById("validInput").value;
  if(!v) return;
  if(navigator.clipboard) navigator.clipboard.writeText(v).catch(()=>{});
  else {
    const tmp=document.createElement("textarea");
    tmp.value=v; tmp.style.cssText="position:fixed;opacity:0";
    document.body.appendChild(tmp); tmp.focus(); tmp.select();
    try{ document.execCommand("copy"); }catch(e){}
    document.body.removeChild(tmp);
  }
  const orig=btn.textContent; btn.textContent="✓ Copied"; btn.style.color="var(--green)";
  setTimeout(()=>{ btn.textContent=orig; btn.style.color=""; },1500);
}

function lintJson(src){
  const errors=[];
  const lines=src.split('\n');

  function getLineCol(idx){
    const before=src.substring(0,idx).split('\n');
    return {line:before.length, col:before[before.length-1].length+1, text:lines[before.length-1]||''};
  }

  let i=0;
  const len=src.length;
  function skipWs(){ while(i<len&&/[\s]/.test(src[i])) i++; }

  // afterUnterm: set when an unterminated string fires, cleared once we've
  // skipped past the bad line. Suppresses only immediate cascade noise
  // (missing comma, expected colon) but NOT unclosed-bracket errors.
  let afterUnterm = false;

  function skipToNextLine(){
    while(i<len && src[i]!=='\n') i++;
    // don't skip the \n itself so parent parseObject can keep counting
  }

  function parseString(){
    const start=i;
    i++; // opening "
    while(i<len){
      if(src[i]==='\\'){i+=2;continue;}
      if(src[i]==='"'){i++;return true;}
      if(src[i]==='\n'){
        errors.push({...getLineCol(start), msg:'Unterminated string literal'});
        afterUnterm=true;
        return false;
      }
      i++;
    }
    errors.push({...getLineCol(start), msg:'Unterminated string literal'});
    afterUnterm=true;
    return false;
  }

  function parseNumber(){
    if(src[i]==='-') i++;
    while(i<len&&/\d/.test(src[i])) i++;
    if(src[i]==='.'){i++;while(i<len&&/\d/.test(src[i]))i++;}
    if(src[i]==='e'||src[i]==='E'){i++;if(src[i]==='+'||src[i]==='-')i++;while(i<len&&/\d/.test(src[i]))i++;}
  }

  function parseValue(){
    skipWs();
    if(i>=len) return true;
    const ch=src[i];
    if(ch==='"'){ if(!parseString()) return false; }
    else if(ch==='{') parseObject();
    else if(ch==='[') parseArray();
    else if(ch==='-'||/\d/.test(ch)) parseNumber();
    else if(src.startsWith('true',i)) i+=4;
    else if(src.startsWith('false',i)) i+=5;
    else if(src.startsWith('null',i)) i+=4;
    else{ errors.push({...getLineCol(i), msg:`Unexpected token '${ch}'`}); i++; }
    return true;
  }

  function expectComma(closingChar, afterValuePos){
    if(afterUnterm){ afterUnterm=false; return false; } // clear flag, stop cascading
    skipWs();
    if(i>=len||src[i]===closingChar) return false;
    if(src[i]===','){
      i++; skipWs();
      if(src[i]===closingChar){ errors.push({...getLineCol(i-1), msg:'Trailing comma'}); return false; }
      return true;
    }
    if(src[i]==='"'||src[i]==='{'||src[i]==='['||/\d|-/.test(src[i])||
       src.startsWith('true',i)||src.startsWith('false',i)||src.startsWith('null',i)){
      errors.push({...getLineCol(afterValuePos), msg:'Missing comma'});
      return true;
    }
    return false;
  }

  function parseObject(){
    const openPos=i;
    i++; skipWs();
    if(i<len&&src[i]==='}'){i++;return;}
    while(i<len){
      skipWs();
      if(i>=len||src[i]==='}'){if(src[i]==='}')i++;return;}
      if(src[i]!=='"'){
        const km=src.substring(i).match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/);
        if(km){
          errors.push({...getLineCol(i), msg:`Key "${km[1]}" must be wrapped in double quotes`});
          i+=km[0].length;
        } else { i++;continue; }
      } else {
        if(!parseString()){
          // Key was unterminated: skip rest of line and continue looking for '}'
          skipToNextLine();
          afterUnterm=false; // reset so we don't cascade further
          continue;
        }
      }
      skipWs();
      if(src[i]===':') i++;
      else if(!afterUnterm) errors.push({...getLineCol(i), msg:"Expected ':' after property key"});
      afterUnterm=false;
      skipWs();
      const ok=parseValue();
      if(!ok){
        // Value was unterminated: skip rest of line, continue looking for '}'
        skipToNextLine();
        afterUnterm=false;
        continue;
      }
      const afterVal=i;
      if(!expectComma('}', afterVal)) break;
    }
    skipWs();
    if(i<len&&src[i]==='}') i++;
    else errors.push({...getLineCol(openPos), msg:"Unclosed object — missing '}'"});
  }

  function parseArray(){
    const openPos=i;
    i++; skipWs();
    if(i<len&&src[i]===']'){i++;return;}
    while(i<len){
      if(src[i]===']'){i++;return;}
      const ok=parseValue();
      if(!ok){
        skipToNextLine();
        afterUnterm=false;
        continue;
      }
      const afterVal=i;
      if(!expectComma(']', afterVal)) break;
    }
    skipWs();
    if(i<len&&src[i]===']') i++;
    else errors.push({...getLineCol(openPos), msg:"Unclosed array — missing ']'"});
  }

  try{
    parseValue();
    skipWs();
    if(i<len&&!afterUnterm) errors.push({...getLineCol(i), msg:'Unexpected content after end of JSON'});
  }catch(e){}

  // Deduplicate same-line same-msg errors
  const seen=new Set();
  return errors.filter(e=>{
    const k=`${e.line}:${e.msg}`;
    if(seen.has(k)) return false;
    seen.add(k); return true;
  });
}


function doValidate(){
  const ta  = document.getElementById("validInput");
  const v   = ta ? ta.value : "";
  const status = document.getElementById("validStatus");
  const stats  = document.getElementById("validStats");
  const errors = document.getElementById("validErrors");
  const wrap   = document.getElementById("validInputWrap");

  validErrorLines=[]; validCurrentErrIdx=-1;
  renderValidHighlights(new Set());
  updateValidNav();

  if(!v.trim()){
    status.textContent="Paste JSON and click Validate";
    status.style.color="var(--text-muted)";
    stats.style.display="none";
    errors.replaceChildren();
    wrap.style.borderColor="";
    document.getElementById("validPrevBtn").style.display="none";
    document.getElementById("validNextBtn").style.display="none";
    return;
  }

  try{
    const parsed=JSON.parse(sanitizeJson(v));
    status.textContent="✓ Valid JSON";
    status.style.color="var(--green)";
    wrap.style.borderColor="var(--green)";
    const flat=flattenJson(parsed,"");
    const keys=Object.keys(flat).length;
    const depth=maxDepth(parsed);
    const size=new Blob([v]).size;
    const root=Array.isArray(parsed)?"Array":typeof parsed==="object"?"Object":typeof parsed;
    stats.style.display="flex";
    const statItems = [
      [String(keys), " fields"],
      [String(depth), " max depth"],
      [formatBytes(size), ""],
      [root, " root"]
    ].map(([value, suffix])=>{
      const item = document.createElement("div");
      item.className = "valid-stat";
      const strong = document.createElement("strong");
      strong.textContent = value;
      item.appendChild(strong);
      if(suffix) item.appendChild(document.createTextNode(suffix));
      return item;
    });
    stats.replaceChildren(...statItems);
    const okRow = document.createElement("div");
    okRow.style.color = "var(--green)";
    okRow.style.padding = "12px 14px";
    okRow.style.fontFamily = "\"SF Mono\",monospace";
    okRow.style.fontSize = "12px";
    okRow.textContent = "All " + v.split('\n').length + " lines valid ✓";
    errors.replaceChildren(okRow);
    document.getElementById("validPrevBtn").style.display="none";
    document.getElementById("validNextBtn").style.display="none";
  }catch(e){
    const errs = lintJson(v);
    const count = errs.length;
    status.textContent="✕ " + (count>0 ? count+" error"+(count>1?"s":"") : "Invalid JSON");
    status.style.color="var(--red)";
    wrap.style.borderColor="var(--red)";
    stats.style.display="none";

    if(count===0){
      const row = document.createElement("div");
      row.style.padding = "12px 14px";
      row.style.color = "var(--red)";
      row.style.fontFamily = "\"SF Mono\",monospace";
      row.style.fontSize = "12px";
      row.textContent = e.message;
      errors.replaceChildren(row);
      return;
    }

    // Sort errors by line number
    errs.sort((a,b)=>a.line-b.line);

    const errLineSet = new Set(errs.map(er=>er.line));
    validErrorLines  = [...errLineSet].sort((a,b)=>a-b);
    renderValidHighlights(errLineSet);

    const errorRows = errs.map((err,idx)=>{
      const row = document.createElement("div");
      row.dataset.erridx = String(idx);
      row.style.display = "flex";
      row.style.gap = "0";
      row.style.padding = "7px 14px";
      row.style.borderBottom = "1px solid rgba(248,113,113,0.12)";
      row.style.cursor = "pointer";
      row.style.alignItems = "flex-start";
      row.onclick = ()=>validJumpTo(idx);
      row.onmouseover = ()=>{ row.style.background = "rgba(248,113,113,0.07)"; };
      row.onmouseout = ()=>{ row.style.background = ""; };

      const line = document.createElement("span");
      line.style.minWidth = "72px";
      line.style.fontFamily = "'SF Mono',monospace";
      line.style.fontSize = "12px";
      line.style.color = "var(--red)";
      line.style.fontWeight = "600";
      line.style.flexShrink = "0";
      line.textContent = "→ L" + err.line;

      const body = document.createElement("span");
      body.style.flex = "1";
      body.style.minWidth = "0";

      const msg = document.createElement("div");
      msg.style.fontSize = "11px";
      msg.style.color = "var(--text-muted)";
      msg.style.marginBottom = "2px";
      msg.textContent = err.msg;

      const text = document.createElement("div");
      text.style.fontFamily = "'SF Mono',monospace";
      text.style.fontSize = "12px";
      text.style.color = "var(--text)";
      text.style.whiteSpace = "pre";
      text.style.overflow = "hidden";
      text.style.textOverflow = "ellipsis";
      text.textContent = err.text;

      body.append(msg, text);
      row.append(line, body);
      return row;
    });
    errors.replaceChildren(...errorRows);

    document.getElementById("validPrevBtn").style.display="";
    document.getElementById("validNextBtn").style.display="";
    validJumpTo(0);
  }
}

function repairJson(src){
  let out = '';
  let i = 0;
  const len = src.length;

  function skipWs(){ while(i<len && /\s/.test(src[i])) i++; }

  function readString(){
    // Collect a string value, auto-closing if unterminated at EOL/EOF
    let s = '"';
    i++; // skip opening "
    while(i<len){
      const ch = src[i];
      if(ch === '\\'){
        s += ch + (src[i+1]||'');
        i += 2; continue;
      }
      if(ch === '"'){ s += '"'; i++; return s; }
      if(ch === '\n' || ch === '\r'){ s += '"'; return s; } // auto-close
      s += ch; i++;
    }
    return s + '"'; // auto-close at EOF
  }

  function readValue(){
    skipWs();
    if(i>=len) return '';
    const ch = src[i];
    if(ch==='"') return readString();
    if(ch==='{') return readObject();
    if(ch==='[') return readArray();
    // number
    if(ch==='-'||/\d/.test(ch)){
      let n='';
      if(src[i]==='-') n+=src[i++];
      while(i<len&&/[\d.eE+\-]/.test(src[i])) n+=src[i++];
      return n;
    }
    // bare word: true/false/null or unquoted string value
    let word='';
    while(i<len&&/[^\s,\}\]:]/.test(src[i])) word+=src[i++];
    if(word==='true'||word==='false'||word==='null') return word;
    return word ? JSON.stringify(word) : '';
  }

  function readObject(){
    let s = '{';
    i++; // skip {
    skipWs();
    if(i<len&&src[i]==='}'){i++;return '{}';}
    let first=true;
    while(i<len){
      skipWs();
      if(i>=len||src[i]==='}') break;
      // Skip leading comma noise
      if(src[i]===','){i++;skipWs();continue;}
      if(!first) s+=',';
      first=false;
      // Read key
      let key;
      if(src[i]==='"'){
        key=readString();
      } else {
        // unquoted key
        let k='';
        while(i<len&&!/[\s:,\}\]]/.test(src[i])) k+=src[i++];
        key=k?JSON.stringify(k):'"?"';
      }
      s+=key;
      skipWs();
      if(i<len&&src[i]===':') i++;
      s+=':';
      skipWs();
      const val=readValue();
      s+=val||'null';
      skipWs();
      // consume trailing comma if present
      if(i<len&&src[i]===','){i++;skipWs();}
    }
    if(i<len&&src[i]==='}') i++;
    return s+'}';
  }

  function readArray(){
    let s = '[';
    i++; // skip [
    skipWs();
    if(i<len&&src[i]===']'){i++;return '[]';}
    let first=true;
    while(i<len){
      skipWs();
      if(i>=len||src[i]===']') break;
      if(src[i]===','){i++;skipWs();continue;}
      if(!first) s+=',';
      first=false;
      const val=readValue();
      s+=val||'null';
      skipWs();
      if(i<len&&src[i]===','){i++;skipWs();}
    }
    if(i<len&&src[i]===']') i++;
    return s+']';
  }

  try{
    skipWs();
    return readValue();
  }catch(e){
    return src;
  }
}

function fixAndBeautify(){
  const ta=document.getElementById("validInput");
  const v = ta ? ta.value.trim() : "";
  if(!v) return;
  let parsed=null;
  const repaired=repairJson(v);
  for(const attempt of [v, repaired, repaired+"}", repaired+"]", repaired+"}}", repaired+"]]"]){
    try{ parsed=JSON.parse(attempt); break; }catch(e){
      try{ parsed=JSON.parse(sanitizeJson(attempt)); break; }catch(e2){}
    }
  }
  if(parsed!==null){
    ta.value=JSON.stringify(parsed,null,2);
    updateValidGutter();
    doValidate();
  } else { doValidate(); }
}

/* Jump to a specific error index (used by error list click + Prev/Next) */
function validJumpTo(idx){
  const errs = document.getElementById("validErrors").querySelectorAll("[data-erridx]");
  if(!errs.length) return;
  idx = Math.max(0, Math.min(idx, errs.length-1));
  validCurrentErrIdx = idx;

  // Highlight active row in error list
  errs.forEach((el,i)=>{
    el.style.background = i===idx ? "rgba(248,113,113,0.13)" : "";
    el.style.outline    = i===idx ? "1px solid rgba(248,113,113,0.4)" : "";
  });
  errs[idx].scrollIntoView({block:"nearest"});

  // Find the line number for this error
  const lineNum = parseInt(errs[idx].querySelector("span").textContent.replace("→ L",""));

  // Brighten the current error strip
  setValidCurrentHighlight(lineNum);

  // Scroll the textarea to the error line
  const ta = document.getElementById("validInput");
  if(ta){
    const lineH = 20;
    const targetScroll = (lineNum-1)*lineH - ta.clientHeight/2 + lineH/2;
    ta.scrollTop = Math.max(0, targetScroll);
    syncValidScroll();
  }

  updateValidNav();
}

function validNav(dir){
  if(!validErrorLines.length) return;
  // Map current error idx → its line → find position in validErrorLines
  const errs = document.getElementById("validErrors").querySelectorAll("[data-erridx]");
  if(!errs.length) return;
  // Step through errors directly
  const next = validCurrentErrIdx + dir;
  const clamped = Math.max(0, Math.min(next, errs.length-1));
  validJumpTo(clamped);
}

function updateValidNav(){
  const label  = document.getElementById("validNavLabel");
  const errs   = document.getElementById("validErrors").querySelectorAll("[data-erridx]");
  const total  = errs.length;
  if(!label) return;
  if(total===0){ label.textContent=""; return; }
  const cur = validCurrentErrIdx>=0 ? validCurrentErrIdx+1 : 0;
  label.textContent = cur+" / "+total;
}

function scrollToValidLine(line){ validJumpTo(line); } // legacy compat

function clearValid(){
  validErrorLines = [];
  validCurrentErrIdx = -1;
  document.getElementById("validStatus").textContent="Paste JSON and click Validate";
  document.getElementById("validStatus").style.color="var(--text-muted)";
  document.getElementById("validStats").style.display="none";
  document.getElementById("validErrors").replaceChildren();
  document.getElementById("validInputWrap").style.borderColor="";
  document.getElementById("validNavLabel").textContent="";
  document.getElementById("validPrevBtn").style.display="none";
  document.getElementById("validNextBtn").style.display="none";
  renderValidHighlights(new Set());
  const ta=document.getElementById("validInput");
  if(ta){ ta.value=""; updateValidGutter(); }
}


// Sync validator gutter on scroll
document.addEventListener("DOMContentLoaded",()=>{
  const ta=document.getElementById("validInput");
  if(ta) ta.addEventListener("scroll", syncValidScroll);

});

// Sync diff input line numbers on scroll
document.addEventListener("DOMContentLoaded",()=>{
  ['Left','Right'].forEach(side=>{
    const ta=document.getElementById('diff'+side);
    const ln=document.getElementById('diff'+side+'InputNums');
    if(ta&&ln) ta.addEventListener('scroll',()=>{ ln.scrollTop=ta.scrollTop; });
  });
});

// Init diff line numbers
updateDiffGutter('Left'); updateDiffGutter('Right');
updateBeautGutter('Input'); updateBeautGutter('Output');

// Escape exits fullscreen
document.addEventListener("keydown",(e)=>{
  // Escape: exit diff fullscreen or close context menu
  if(e.key==="Escape"){
    closeShortcuts();
    const ob=document.getElementById("onboardingOverlay");
    if(ob&&ob.style.display!=="none"){ dismissOnboarding(); return; }
    if(document.getElementById("panel-diff").classList.contains("diff-fullscreen")) toggleDiffFullscreen();
    if(document.getElementById("panel-editor").classList.contains("editor-fullscreen")) toggleEditorFullscreen();
    return;
  }
  if(e.key==="?" && !e.ctrlKey && !e.metaKey && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)){
    showShortcuts(); return;
  }
  if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key==="C"){
    const active = document.querySelector('.nav-btn.active');
    if(active && active.id==='nav-mock'){ e.preventDefault(); copyScript(); return; }
  }
  if((e.ctrlKey||e.metaKey) && e.shiftKey && e.key==="V"){
    e.preventDefault();
    switchTool("mock");
    setTimeout(toggleCurlImport, 100);
    return;
  }

  const ctrl = e.ctrlKey||e.metaKey;
  if(!ctrl) return;

  // Don't fire shortcuts when typing inside an input/textarea
  const tag = document.activeElement&&document.activeElement.tagName;
  const inInput = tag==="TEXTAREA"||(tag==="INPUT"&&document.activeElement.type!=="radio"&&document.activeElement.type!=="checkbox");

  // Ctrl+1/2/3/4 — switch tools
  if(e.key==="1"){ e.preventDefault(); switchTool("mock"); return; }
  if(e.key==="2"){ e.preventDefault(); switchTool("editor"); return; }
  if(e.key==="3"){ e.preventDefault(); switchTool("beautifier"); return; }
  if(e.key==="4"){ e.preventDefault(); switchTool("diff"); return; }
  if(e.key==="5"){ e.preventDefault(); switchTool("validator"); return; }

  // Ctrl+T — new tab (mock tool only)
  if(e.key==="t"&&document.getElementById("panel-mock").classList.contains("active")){
    e.preventDefault(); addTab(); return;
  }

  if(inInput) return; // remaining shortcuts don't apply while typing

  // Ctrl+Enter — primary action for active tool
  if(e.key==="Enter"){
    e.preventDefault();
    const active=[...document.querySelectorAll(".tool-panel.active")][0];
    if(!active) return;
    if(active.id==="panel-mock")       generate();
    else if(active.id==="panel-beautifier") doBeautify();
    else if(active.id==="panel-diff")  doDiff();
    else if(active.id==="panel-validator") doValidate();
    return;
  }
});


/* ════════════════════════════════════════════════════════
   JSON EDITOR TOOL
   ════════════════════════════════════════════════════════ */

let edData        = null;   // live JSON object
let edScope       = 'all';  // 'all' | 'selected'
let edLevel       = 1;      // which depth level bulk ops target
let edSelected    = new Set(); // path-keys of selected nodes
let edSelectMode  = false;
let edHistory     = [];     // [{desc, icon, snapshot}]
let edCollapsed   = {};

// ── Helpers ──────────────────────────────────────────────
function edDeepClone(o){ return JSON.parse(JSON.stringify(o)); }

function edPushHistory(desc, icon){
  edHistory.unshift({ desc, icon, snapshot: edDeepClone(edData) });
  if(edHistory.length > 20) edHistory.pop();
  edRenderHistory();
}

function edGetNodesAtLevel(obj, targetDepth, currentDepth=1, parentPath=[]){
  // Returns array of {ref: parentObj, key, path} for each node at targetDepth
  if(!obj || typeof obj !== 'object') return [];
  const results = [];
  Object.keys(obj).forEach(key => {
    const path = [...parentPath, key];
    if(currentDepth === targetDepth){
      results.push({ ref: obj, key, path });
    } else if(typeof obj[key] === 'object' && obj[key] !== null){
      results.push(...edGetNodesAtLevel(obj[key], targetDepth, currentDepth+1, path));
    }
  });
  return results;
}

// Returns the CONTAINER objects whose direct children live at edLevel.
// e.g. edLevel=1 → block1, block2, block3 (root's children that are objects)
// e.g. edLevel=2 → grandchildren of root that are objects
function edGetContainersForLevel(){
  if(edLevel <= 1){
    // Level 1: each root-level key that holds an object is a container
    return Object.keys(edData)
      .filter(k => typeof edData[k] === 'object' && edData[k] !== null)
      .map(k => ({ ref: edData, key: k, obj: edData[k], path: [k] }));
  }
  // For deeper levels: nodes at edLevel-1 that are objects become containers
  const parents = edGetNodesAtLevel(edData, edLevel - 1);
  return parents
    .filter(n => typeof n.ref[n.key] === 'object' && n.ref[n.key] !== null)
    .map(n => ({ ref: n.ref, key: n.key, obj: n.ref[n.key], path: n.path }));
}

function edGetScopedNodes(){
  // For tree highlighting / checkbox selection — still returns nodes AT edLevel
  const all = edGetNodesAtLevel(edData, edLevel);
  if(edScope === 'all') return all;
  return all.filter(n => edSelected.has(JSON.stringify(n.path)));
}

function edGetScopedContainers(){
  const all = edGetContainersForLevel();
  if(edScope === 'all') return all;
  // In selected mode: only include containers whose path is selected
  // Selection is on level-edLevel nodes, so we filter containers that have ≥1 selected child
  return all.filter(c => {
    const childKeys = Object.keys(c.obj);
    return childKeys.some(k => edSelected.has(JSON.stringify([...c.path, k])));
  });
}

function edCountAtLevel(obj, depth, cur=1){
  if(!obj||typeof obj!=='object') return 0;
  if(cur===depth) return Object.keys(obj).length;
  return Object.values(obj).reduce((s,v)=>s+edCountAtLevel(v,depth,cur+1),0);
}

function edGetMaxDepth(obj, d=0){
  if(typeof obj!=='object'||obj===null) return d;
  return Math.max(d,...Object.values(obj).map(v=>edGetMaxDepth(v,d+1)));
}

function edFlash(msg, color='var(--green)'){
  const bar = document.getElementById('edScopeInfo');
  if(!bar) return;
  const prev = bar.textContent;
  bar.style.color = color;
  bar.textContent = msg;
  setTimeout(()=>{ bar.style.color=''; edUpdateScopeInfo(); },2000);
}

// ── Load / Clear ─────────────────────────────────────────
function edLoadJson(){
  const ta = document.getElementById('edPasteArea');
  const raw = ta ? ta.value.trim() : '';
  if(!raw){
    if(ta){ ta.style.borderColor='var(--red)'; setTimeout(()=>ta.style.borderColor='',2000); ta.focus(); }
    return;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch(e){
    if(ta){ ta.style.borderColor='var(--red)'; setTimeout(()=>ta.style.borderColor='',2000); }
    edFlash('⚠ Invalid JSON', 'var(--red)'); return;
  }
  edData = parsed;
  edHistory = [];
  edSelected = new Set();
  edCollapsed = {};
  edLevelSelected = false;
  // Reset dropdown to None
  const _sel = document.getElementById('edLevelSelect');
  if(_sel) _sel.value = 0;
  edBuildLevelSelect();
  edRenderTree();
  edRenderHistory();
  edUpdateStats();
}

function edClear(){
  edData = null;
  edHistory = [];
  edSelected = new Set();
  edCollapsed = {};
  const tree = document.getElementById('edTree');
  if(tree){
    const empty = document.createElement('div');
    empty.className = 'editor-empty';
    const icon = document.createElement('div');
    icon.className = 'editor-empty-icon';
    icon.textContent = '✎';
    const text = document.createElement('div');
    text.textContent = 'Paste JSON above and click Load JSON';
    empty.append(icon, text);
    tree.replaceChildren(empty);
  }
  document.getElementById('edStats').textContent = '';
  const history = document.getElementById('edHistory');
  if(history){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No operations yet';
    history.replaceChildren(empty);
  }
  const removeSuggestions = document.getElementById('edRemoveSuggestions');
  if(removeSuggestions) removeSuggestions.replaceChildren();
  edBuildLevelSelect();
  edUpdateScopeInfo();
}

// ── Output ───────────────────────────────────────────────
function edGetJson(){ return JSON.stringify(edData, null, 2); }

function edCopyJson(btn){
  if(!edData){ edFlash('⚠ Nothing to copy','var(--red)'); return; }
  const text = edGetJson();
  if(navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
  const orig = btn.textContent;
  btn.textContent = '✓ Copied'; btn.style.color = 'var(--green)';
  setTimeout(()=>{ btn.textContent=orig; btn.style.color=''; },1500);
}

function edDownloadJson(){
  if(!edData){ edFlash('⚠ Nothing to download','var(--red)'); return; }
  const blob = new Blob([edGetJson()], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'edited.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function edSendToValidator(){
  if(!edData){ edFlash('⚠ Nothing to send','var(--red)'); return; }
  switchTool('validator');
  const ta = document.getElementById('validInput');
  if(ta){ ta.value = edGetJson(); onValidInput(); }
}

// ── Level select ─────────────────────────────────────────
function edBuildLevelSelect(){
  const sel = document.getElementById('edLevelSelect');
  if(!sel) return;
  const maxD = edData ? edGetMaxDepth(edData) : 1;
  sel.replaceChildren();

  // None — default
  const noneOpt = document.createElement('option');
  noneOpt.value = 0;
  noneOpt.textContent = 'None';
  sel.appendChild(noneOpt);

  for(let d=1; d<=Math.max(maxD,1); d++){
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d===1 ? 'Level 1 (root children)' : `Level ${d}`;
    sel.appendChild(opt);
  }

  // Default to None
  edLevelSelected = false;
  sel.value = 0;

  sel.onchange = ()=>{
    const v = parseInt(sel.value);
    if(v === 0){
      edLevelSelected = false;
      const tree = document.getElementById('edTree');
      if(tree){
        tree.classList.remove('ed-tree-leveled');
        tree.querySelectorAll('.ed-lane-target,.ed-lane-ancestor').forEach(el=>{
          el.classList.remove('ed-lane-target','ed-lane-ancestor');
        });
      }
      const legend = document.getElementById('edLevelLegend');
      if(legend) legend.querySelectorAll('.ed-level-pill').forEach(p=>p.classList.remove('active'));
      edUpdateScopeInfo();
      return;
    }
    edLevel = v;
    edLevelSelected = true;
    // Auto-expand tree to selected level
    edExpandToLevel(v);
    edUpdateScopeInfo();
    edApplyLaneHighlight();
    const legend = document.getElementById('edLevelLegend');
    if(legend) legend.querySelectorAll('.ed-level-pill').forEach(p=>{
      p.classList.toggle('active', parseInt(p.dataset.level)===v);
    });
  };

  edBuildLevelLegend();
  edUpdateScopeInfo();
}

function edUpdateScopeInfo(){
  const el = document.getElementById('edScopeInfo');
  if(!el) return;
  if(!edData){ el.textContent='Load JSON to begin'; return; }
  const containers = edGetContainersForLevel();
  const total = containers.length;
  const inScope = edGetScopedContainers().length;
  if(edScope==='all'){
    el.textContent = `${total} block${total!==1?'s':''} at level ${edLevel} will be affected`;
  } else {
    el.textContent = `${inScope} of ${total} selected at level ${edLevel}`;
  }
}

// ── Scope ────────────────────────────────────────────────
function edSetScope(s){
  edScope = s;
  document.getElementById('edScopeAll').classList.toggle('active', s==='all');
  document.getElementById('edScopeSelected').classList.toggle('active', s==='selected');
  // Toggle select mode visually
  if(s==='selected' && !edSelectMode){
    document.getElementById('edSelectMode').checked = true;
    edToggleSelectMode();
  }
  edUpdateScopeInfo();
}

function _edToggleSelectModeOld(){} // replaced by edToggleSelectMode in new features

// ── Tree rendering ───────────────────────────────────────
function edRenderTree(){
  const container = document.getElementById('edTree');
  if(!edData){ return; }
  container.replaceChildren();
  // For huge JSON, cap rendering to avoid stack overflow
  const totalKeys = (function countAll(o){ if(typeof o!=='object'||!o) return 1; return Object.values(o).reduce((s,v)=>s+countAll(v),0); })(edData);
  if(totalKeys > 5000){
    // Render a warning + top-level only for huge JSON
    edRenderHugeTree(container);
  } else {
    edWalk(edData, [], container, 1);
  }
  edUpdateRemoveSuggestions();
  edBuildLevelLegend();
  setTimeout(edApplyLaneHighlight, 0);
}

function edRenderHugeTree(container){
  // For huge JSON: render only the first level, with expand-on-click
  const banner = document.createElement('div');
  banner.style.cssText = 'padding:8px 12px;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:6px;margin-bottom:8px;font-size:12px;color:var(--text-muted)';
  banner.textContent = '⚡ Large JSON detected — showing top-level only. Click any node to expand it. Use bulk ops normally.';
  container.appendChild(banner);
  // Render only depth 1
  edWalkShallow(edData, [], container, 1);
}

function edWalkShallow(obj, path, parent, depth){
  if(typeof obj !== 'object' || obj === null) return;
  const isArr = Array.isArray(obj);
  const keys = Object.keys(obj);
  const MAX_SHOWN = 200;
  keys.slice(0, MAX_SHOWN).forEach(key=>{
    const newPath = [...path, key];
    const pathKey = JSON.stringify(newPath);
    const val = obj[key];
    const isObj = typeof val === 'object' && val !== null;
    const isAtLevel = depth === edLevel;
    const isSelected = edSelected.has(pathKey);

    const div = document.createElement('div');
    const depthClass = `ed-depth-${Math.min(depth,6)}`;
    div.className = 'node ' + depthClass + (isAtLevel && isSelected ? ' editor-node-selected' : '');
    div.dataset.pathKey = pathKey;
    div.dataset.depth = depth;

    if(isObj){
      const isChildArr = Array.isArray(val);
      const childCount = Object.keys(val).length;
      // Always start collapsed in huge mode; delete stale state so click toggles correctly
      edCollapsed[pathKey] = true;
      const isCollapsed = true;

      const header = document.createElement('div');
      header.className = 'node-header';
      header.style.cursor = 'pointer';

      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow';
      arrow.textContent = isCollapsed ? '▶' : '▼';

      const dot = document.createElement('span');
      dot.className = `ed-depth-dot ed-depth-dot-${Math.min(depth,6)}`;

      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key-obj';
      keySpan.textContent = (isArr ? `[${key}]` : key);

      const brace = document.createElement('span');
      brace.className = 'tree-brace';
      brace.textContent = ' ' + (isChildArr ? '[' : '{');

      const count = document.createElement('span');
      count.style.cssText = 'color:var(--text-dim);font-size:11px;margin-left:4px';
      count.textContent = `${childCount} ${isChildArr?'items':'keys'}`;

      header.append(arrow, dot, keySpan, brace, count);

      const children = document.createElement('div');
      children.className = 'node-children';
      children.style.display = isCollapsed ? 'none' : 'block';

      const closing = document.createElement('div');
      closing.className = 'tree-brace';
      closing.style.cssText = 'padding:1px 4px;color:var(--text-dim)';
      closing.textContent = isChildArr ? ']' : '}';
      closing.style.display = isCollapsed ? 'none' : 'block';

      header.onclick = (e)=>{
        if(e.target.classList.contains('add-btn')||e.target.classList.contains('delete-btn')) return;
        e.stopPropagation();
        e.preventDefault();
        // Read current state from DOM (so edExpandAll/edCollapseAll stay in sync)
        const currentlyExpanded = children.style.display !== 'none';
        const expand = !currentlyExpanded;
        edCollapsed[pathKey] = !expand;
        div._isExpanded = expand;
        arrow.textContent = expand ? '▼' : '▶';
        children.style.display = expand ? 'block' : 'none';
        closing.style.display = expand ? 'block' : 'none';
        // Lazy render children only on first expand
        if(expand && !children.dataset.rendered){
          children.dataset.rendered = '1';
          edWalkShallow(val, newPath, children, depth+1);
          setTimeout(edApplyLaneHighlight, 0);
        }
      };

      div.appendChild(header);
      div.appendChild(children);
      div.appendChild(closing);
      parent.appendChild(div);
    } else {
      div.className += ' node-leaf';
      div.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer';

      const leafDot = document.createElement('span');
      leafDot.className = `ed-depth-dot ed-depth-dot-${Math.min(depth,6)}`;

      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      keySpan.textContent = (isArr ? `[${key}]` : key) + ': ';

      const valSpan = document.createElement('span');
      if(typeof val==='string') valSpan.className='value-string';
      else if(typeof val==='number') valSpan.className='value-number';
      else if(typeof val==='boolean') valSpan.className='value-bool';
      else valSpan.className='value-null';
      valSpan.textContent = typeof val==='string' ? `"${val}"` : String(val);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '✕';
      delBtn.onclick = (e)=>{ e.stopPropagation(); edDeleteNode(obj, key, newPath); };

      div.append(leafDot, keySpan, valSpan, delBtn);
      parent.appendChild(div);
    }
  });

  if(keys.length > MAX_SHOWN){
    const more = document.createElement('div');
    more.style.cssText = 'padding:6px 12px;color:var(--text-dim);font-size:12px';
    more.textContent = `… and ${keys.length - MAX_SHOWN} more keys (use bulk ops to operate on all)`;
    parent.appendChild(more);
  }
}

function edIsAtTargetLevel(depth){ return depth === edLevel; }

/* Inline add-field form for editor tree (mirrors mock's showAddForm) */
function edShowAddForm(parentObj, parentPath, childrenEl){
  if(childrenEl.querySelector('.add-form')) return;
  const isArr = Array.isArray(parentObj);
  const form = document.createElement('div');
  form.className = 'add-form';

  if(!isArr){
    const keyInput = document.createElement('input');
    keyInput.className = 'add-form-key';
    keyInput.placeholder = 'key';
    form.appendChild(keyInput);
    const colon = document.createElement('span');
    colon.textContent = ':';
    colon.style.color = 'var(--text-dim)';
    form.appendChild(colon);
  }

  const valInput = document.createElement('input');
  valInput.className = 'add-form-val';
  valInput.placeholder = isArr ? 'value' : 'value';
  form.appendChild(valInput);

  const okBtn = document.createElement('button');
  okBtn.className = 'add-form-ok';
  okBtn.textContent = '✓';
  form.appendChild(okBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'add-form-cancel';
  cancelBtn.textContent = '✕';
  form.appendChild(cancelBtn);

  childrenEl.appendChild(form);
  const firstInput = form.querySelector('input');
  if(firstInput) firstInput.focus();

  const commit = ()=>{
    const rawKey = isArr ? String(Object.keys(parentObj).length) : form.querySelector('.add-form-key').value.trim();
    if(!rawKey && !isArr) return;
    let val = valInput.value;
    if(val==='null') val=null;
    else if(val==='true') val=true;
    else if(val==='false') val=false;
    else if(val!==''&&!isNaN(val)) val=Number(val);
    edPushHistory(`Add "${rawKey}"`, '➕');
    if(isArr) parentObj.push(val);
    else parentObj[rawKey]=val;
    edRenderTree(); edUpdateStats(); edBuildLevelSelect();
  };

  okBtn.onclick=(e)=>{ e.stopPropagation(); commit(); };
  cancelBtn.onclick=(e)=>{ e.stopPropagation(); form.remove(); };
  valInput.onkeydown=(e)=>{ if(e.key==='Enter') commit(); if(e.key==='Escape') form.remove(); };
  const ki=form.querySelector('.add-form-key');
  if(ki) ki.onkeydown=(e)=>{ if(e.key==='Enter') valInput.focus(); if(e.key==='Escape') form.remove(); };
}

/* Delete a node from editor data */
function edDeleteNode(obj, key, path){
  edPushHistory(`Delete "${key}"`, '🗑');
  if(Array.isArray(obj)) obj.splice(Number(key),1);
  else delete obj[key];
  edSelected.delete(JSON.stringify(path));
  edRenderTree(); edUpdateStats(); edBuildLevelSelect(); edUpdateRemoveSuggestions();
}

function edWalk(obj, path, parent, depth){
  if(typeof obj !== 'object' || obj === null) return;
  const isArr = Array.isArray(obj);
  Object.keys(obj).forEach(key=>{
    const newPath = [...path, key];
    const pathKey = JSON.stringify(newPath);
    const val = obj[key];
    const isObj = typeof val === 'object' && val !== null;
    const isCollapsed = edCollapsed[pathKey] || false;
    const isAtLevel = depth === edLevel;
    const isSelected = edSelected.has(pathKey);

    const div = document.createElement('div');
    const depthClass = `ed-depth-${Math.min(depth, 6)}`;
    div.className = 'node ' + depthClass + (isAtLevel && isSelected ? ' editor-node-selected' : '');
    div.dataset.pathKey = pathKey;
    div.dataset.depth = depth;

    if(isObj){
      const isChildArr = Array.isArray(val);
      const childCount = Object.keys(val).length;
      const header = document.createElement('div');
      header.className = 'node-header';
      header.style.cursor = 'pointer';

      // Checkbox for selection (select mode)
      if(edSelectMode && isAtLevel){
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'ed-check';
        chk.checked = isSelected;
        chk.style.marginRight = '6px';
        chk.onclick = (e)=>{ e.stopPropagation(); edToggleSelect(pathKey, div, chk); };
        header.appendChild(chk);
      }

      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow';
      arrow.textContent = isCollapsed ? '▶' : '▼';

      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key-obj';
      keySpan.style.display = 'inline-flex';
      keySpan.style.alignItems = 'center';

      // Depth color dot
      const dot = document.createElement('span');
      dot.className = `ed-depth-dot ed-depth-dot-${Math.min(depth,6)}`;
      keySpan.appendChild(dot);

      const keyText = document.createElement('span');
      keyText.textContent = isArr ? `[${key}]` : key;
      keySpan.appendChild(keyText);

      // Click key to rename
      keySpan.title = 'Click to rename key';
      keySpan.ondblclick = (e)=>{
        e.stopPropagation();
        if(isArr) return; // can't rename array indices
        const inp = document.createElement('input');
        inp.className = 'inline-edit';
        inp.value = key;
        inp.style.width = Math.max(60, key.length*9)+'px';
        keySpan.replaceWith(inp);
        inp.focus(); inp.select();
        const commitKey = ()=>{
          const newKey = inp.value.trim();
          if(newKey && newKey !== key){
            edPushHistory(`Rename "${key}" → "${newKey}"`, '✏️');
            const entries = Object.entries(obj);
            const idx = entries.findIndex(([k])=>k===key);
            entries[idx][0] = newKey;
            Object.keys(obj).forEach(k=>delete obj[k]);
            entries.forEach(([k,v])=>obj[k]=v);
          }
          edRenderTree(); edUpdateStats();
        };
        inp.onblur = commitKey;
        inp.onkeydown = (e)=>{ if(e.key==='Enter') inp.blur(); if(e.key==='Escape') edRenderTree(); };
      };

      const brace = document.createElement('span');
      brace.className = 'tree-brace';
      brace.textContent = ' ' + (isChildArr ? '[' : '{');

      if(isChildArr){ const badge=document.createElement('span'); badge.className='array-badge'; badge.textContent=childCount; header.append(arrow,keySpan,brace,badge); }
      else { header.append(arrow,keySpan,brace); }

      const count = document.createElement('span');
      count.style.cssText = 'color:var(--text-dim);font-size:11px;margin-left:4px';
      count.textContent = isCollapsed ? (isChildArr?`${childCount} items`:`${childCount} keys`) : '';
      header.appendChild(count);

      // Level badge
      if(isAtLevel){
        const lvlBadge = document.createElement('span');
        lvlBadge.style.cssText='margin-left:6px;font-size:10px;padding:1px 6px;border-radius:10px;background:rgba(99,102,241,.2);color:var(--accent);font-weight:600';
        lvlBadge.textContent='L'+depth;
        header.appendChild(lvlBadge);
      }

      // + Add button
      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.title = 'Add field inside this node';
      addBtn.textContent = '+';
      addBtn.onclick = (e)=>{ e.stopPropagation(); if(!isCollapsed){ edCollapsed[pathKey]=false; } children.style.display='block'; closing.style.display='block'; edShowAddForm(val, newPath, children); };
      header.appendChild(addBtn);

      // ✕ Delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.title = 'Delete this node';
      delBtn.textContent = '✕';
      delBtn.onclick = (e)=>{ e.stopPropagation(); edDeleteNode(obj, key, newPath); };
      header.appendChild(delBtn);

      const children = document.createElement('div');
      children.className = 'node-children';
      children.style.display = isCollapsed ? 'none' : 'block';

      const closing = document.createElement('div');
      closing.className = 'tree-brace';
      closing.style.cssText = 'padding:1px 4px;color:var(--text-dim)';
      closing.textContent = isChildArr ? ']' : '}';
      closing.style.display = isCollapsed ? 'none' : 'block';

      header.onclick = (e)=>{
        if(e.target.classList.contains('add-btn')||e.target.classList.contains('delete-btn')||e.target.type==='checkbox') return;
        e.stopPropagation();
        edCollapsed[pathKey] = !edCollapsed[pathKey];
        const col = edCollapsed[pathKey];
        arrow.textContent = col ? '▶' : '▼';
        children.style.display = col ? 'none' : 'block';
        closing.style.display = col ? 'none' : 'block';
        count.textContent = col ? (isChildArr?`${childCount} items`:`${childCount} keys`) : '';
      };

      div.appendChild(header);
      div.appendChild(children);
      div.appendChild(closing);
      parent.appendChild(div);
      edWalk(val, newPath, children, depth+1);

    } else {
      // Leaf node — click value to edit, double-click key to rename
      div.className += ' node-leaf ' + depthClass;
      div.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer';

      // Depth dot for leaf
      const leafDot = document.createElement('span');
      leafDot.className = `ed-depth-dot ed-depth-dot-${Math.min(depth,6)}`;
      div.appendChild(leafDot);

      // Checkbox
      if(edSelectMode && isAtLevel){
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'ed-check';
        chk.checked = isSelected;
        chk.onclick = (e)=>{ e.stopPropagation(); edToggleSelect(pathKey, div, chk); };
        div.appendChild(chk);
      }

      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      keySpan.textContent = (isArr ? `[${key}]` : key) + ': ';
      keySpan.title = 'Double-click to rename key';
      keySpan.ondblclick = (e)=>{
        e.stopPropagation();
        if(isArr) return;
        const inp = document.createElement('input');
        inp.className = 'inline-edit';
        inp.value = key;
        inp.style.width = Math.max(60, key.length*9)+'px';
        const origSpan = keySpan.cloneNode(true);
        keySpan.replaceWith(inp);
        inp.focus(); inp.select();
        const commitKey = ()=>{
          const newKey = inp.value.trim();
          if(newKey && newKey !== key){
            edPushHistory(`Rename "${key}" → "${newKey}"`, '✏️');
            const entries = Object.entries(obj);
            const idx = entries.findIndex(([k])=>k===key);
            entries[idx][0] = newKey;
            Object.keys(obj).forEach(k=>delete obj[k]);
            entries.forEach(([k,v])=>obj[k]=v);
          }
          edRenderTree(); edUpdateStats();
        };
        inp.onblur = commitKey;
        inp.onkeydown = (e)=>{ if(e.key==='Enter') inp.blur(); if(e.key==='Escape') edRenderTree(); };
      };

      const valSpan = document.createElement('span');
      if(typeof val==='string') valSpan.className='value-string';
      else if(typeof val==='number') valSpan.className='value-number';
      else if(typeof val==='boolean') valSpan.className='value-bool';
      else valSpan.className='value-null';
      valSpan.textContent = typeof val==='string' ? `"${val}"` : String(val);
      valSpan.title = 'Click to edit value';

      // ✕ delete button
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.title = 'Delete this field';
      delBtn.textContent = '✕';
      delBtn.onclick = (e)=>{ e.stopPropagation(); edDeleteNode(obj, key, newPath); };

      div.append(keySpan, valSpan, delBtn);

      // Click value to edit inline
      const startEdit = ()=>{
        if(div.querySelector('input.inline-edit')) return;
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'inline-edit';
        inp.value = typeof val==='string' ? val : String(val);
        valSpan.replaceWith(inp);
        inp.focus(); inp.select();
        const commit = ()=>{
          let v = inp.value;
          if(v==='null') v=null;
          else if(v==='true') v=true;
          else if(v==='false') v=false;
          else if(v!==''&&!isNaN(v)) v=Number(v);
          if(JSON.stringify(v)!==JSON.stringify(val)){ edPushHistory(`Edit "${key}"`, '✏️'); }
          obj[key]=v; edRenderTree(); edUpdateStats();
        };
        inp.onblur = commit;
        inp.onkeydown = (e)=>{ if(e.key==='Enter') inp.blur(); if(e.key==='Escape'){ obj[key]=val; edRenderTree(); } };
      };

      valSpan.onclick = (e)=>{ e.stopPropagation(); startEdit(); };
      div.onclick = (e)=>{ if(e.target===div) startEdit(); };

      parent.appendChild(div);
    }
  });
}

function edToggleSelect(pathKey, div, chk){
  if(edSelected.has(pathKey)){ edSelected.delete(pathKey); div.classList.remove('editor-node-selected'); }
  else { edSelected.add(pathKey); div.classList.add('editor-node-selected'); }
  chk.checked = edSelected.has(pathKey);
  edUpdateScopeInfo();
}

// ── Stats ────────────────────────────────────────────────
function edUpdateStats(){
  const el = document.getElementById('edStats');
  if(!el||!edData) return;
  const size = new Blob([JSON.stringify(edData)]).size;
  const depth = edGetMaxDepth(edData);
  function countAll(o){ if(typeof o!=='object'||!o) return 1; return Object.values(o).reduce((s,v)=>s+countAll(v),0); }
  el.textContent = `${countAll(edData)} fields · depth ${depth} · ${size<1024?size+'B':(size/1024).toFixed(1)+'KB'}`;
}

// ── Remove suggestions ───────────────────────────────────
function edUpdateRemoveSuggestions(){
  const container = document.getElementById('edRemoveSuggestions');
  if(!container||!edData) return;
  // Collect all keys at current level
  const containers = edGetContainersForLevel();
  const keySet = new Set();
  containers.forEach(c=>{ if(c.obj&&typeof c.obj==='object'&&!Array.isArray(c.obj)){ Object.keys(c.obj).forEach(k=>keySet.add(k)); } });
  container.replaceChildren();
  [...keySet].slice(0,12).forEach(k=>{
    const pill = document.createElement('span');
    pill.className='id-field-pill';
    pill.textContent=k;
    pill.title='Click to fill remove field';
    pill.onclick=()=>{ document.getElementById('edRemoveKey').value=k; };
    container.appendChild(pill);
  });
}

// ── History ──────────────────────────────────────────────
function edRenderHistory(){
  const el = document.getElementById('edHistory');
  if(!el) return;
  if(edHistory.length===0){
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No operations yet';
    el.replaceChildren(empty);
    return;
  }
  el.replaceChildren();
  edHistory.forEach((item,idx)=>{
    const row = document.createElement('div');
    row.className = 'history-item';
    const icon = document.createElement('span');
    icon.className = 'history-item-icon';
    icon.textContent = item.icon;
    const desc = document.createElement('span');
    desc.className = 'history-item-desc';
    desc.title = item.desc;
    desc.textContent = item.desc;
    row.append(icon, desc);
    if(idx===0){
      const undo = document.createElement('button');
      undo.className = 'history-undo-btn';
      undo.textContent = '↩';
      undo.onclick = ()=>edUndo();
      row.appendChild(undo);
    }
    el.appendChild(row);
  });
}

function edUndo(){
  if(!edHistory.length){ edFlash('Nothing to undo','var(--text-muted)'); return; }
  const prev = edHistory.shift();
  edData = prev.snapshot;
  edRenderTree(); edUpdateStats(); edRenderHistory();
  edFlash(`↩ Undid: ${prev.desc}`);
}

// ── Expand / Collapse all ────────────────────────────────
function edExpandAll(){
  const tree = document.getElementById('edTree');
  if(!tree) return;
  // Expand all already-rendered nodes directly in the DOM
  tree.querySelectorAll('.node').forEach(node=>{
    const header = node.querySelector(':scope > .node-header');
    const children = node.querySelector(':scope > .node-children');
    const closing = node.querySelector(':scope > .tree-brace');
    const arrow = header && header.querySelector('.tree-arrow');
    if(!children) return;
    // Lazy-render if not yet rendered (huge mode)
    if(!children.dataset.rendered){
      children.dataset.rendered = '1';
      const pathKey = node.dataset.pathKey;
      const depth = parseInt(node.dataset.depth||1);
      // Resolve the object at this path
      let path = []; try { path = pathKey ? JSON.parse(pathKey) : []; } catch(e) { path = []; }
      let obj = edData;
      for(const k of path) obj = obj?.[k];
      if(obj && typeof obj === 'object') edWalkShallow(obj, path, children, depth+1);
    }
    children.style.display = 'block';
    if(closing) closing.style.display = 'block';
    if(arrow) arrow.textContent = '▼';
    const pk = node.dataset.pathKey;
    if(pk) edCollapsed[pk] = false;
    // Update the closure _isExpanded if possible — not accessible, so re-sync via DOM
    node._isExpanded = true;
  });
  setTimeout(edApplyLaneHighlight, 0);
}

function edCollapseAll(){
  const tree = document.getElementById('edTree');
  if(!tree) return;
  tree.querySelectorAll('.node').forEach(node=>{
    const header = node.querySelector(':scope > .node-header');
    const children = node.querySelector(':scope > .node-children');
    const closing = node.querySelector(':scope > .tree-brace');
    const arrow = header && header.querySelector('.tree-arrow');
    if(children) children.style.display = 'none';
    if(closing) closing.style.display = 'none';
    if(arrow) arrow.textContent = '▶';
    const pk = node.dataset.pathKey;
    if(pk) edCollapsed[pk] = true;
    node._isExpanded = false;
  });
  setTimeout(edApplyLaneHighlight, 0);
}

// ── Bulk Add ─────────────────────────────────────────────
function edAddTypeChange(){
  const t = document.getElementById('edAddType').value;
  const vi = document.getElementById('edAddValue');
  const hint = document.getElementById('edAddHint');
  const needsInput = t==='value'||t==='number';
  vi.style.display = needsInput ? '' : 'none';
  if(!needsInput) vi.value='';

  const hints = {
    empty_obj: '💡 Adds {} — then increase level to bulk-add inside it, or use + on the node',
    empty_arr: '💡 Adds [] — then use the + button on the node to push items in',
    random_uuid: '💡 Every block gets a guaranteed unique UUID',
    random_str: '💡 Each block gets a different random 8-char string',
    random_num: '💡 Each block gets a random number 0–9999',
    random_bool: '💡 Each block gets true or false randomly',
    timestamp: '💡 Current ISO timestamp — same for all blocks',
    auto_increment: '💡 Adds 1, 2, 3… — set the start value in the value field',
  };
  if(hint){
    hint.textContent = hints[t] || '';
    hint.style.display = hints[t] ? '' : 'none';
  }
}

function edMakeRandomValue(type){
  switch(type){
    case 'random_str': return Math.random().toString(36).slice(2,10);
    case 'random_uuid': return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
    case 'random_num': return Math.floor(Math.random()*10000);
    case 'random_bool': return Math.random()>0.5;
    case 'timestamp': return new Date().toISOString();
    default: return null;
  }
}


/* Guard: blocks any bulk op when no level is selected */
function edRequireLevel(){
  if(!edData){ edFlash('⚠ Load JSON first', 'var(--red)'); return false; }
  if(!edLevelSelected){
    // Flash the scope card and dropdown
    const sel = document.getElementById('edLevelSelect');
    if(sel){
      sel.style.outline = '2px solid var(--red)';
      setTimeout(()=> sel.style.outline = '', 2000);
    }
    const info = document.getElementById('edScopeInfo');
    if(info){
      const prev = info.textContent;
      info.style.color = 'var(--red)';
      info.textContent = '⚠ Select a target level first!';
      setTimeout(()=>{ info.textContent = prev; info.style.color = 'var(--accent)'; }, 2000);
    }
    // Scroll scope card into view
    const scopeCard = document.getElementById('edScopeInfo');
    if(scopeCard) scopeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    edFlash('⚠ Select a target level in Scope first', 'var(--red)');
    return false;
  }
  return true;
}
function edBulkAdd(){
  if(!edRequireLevel()) return;
  const key = document.getElementById('edAddKey').value.trim();
  if(!key){ edFlash('⚠ Enter a field name','var(--red)'); return; }
  const type = document.getElementById('edAddType').value;
  const rawVal = document.getElementById('edAddValue').value;

  let value;
  const isAutoInc = type==='auto_increment';
  switch(type){
    case 'value':
      if(rawVal==='null') value=null;
      else if(rawVal==='true') value=true;
      else if(rawVal==='false') value=false;
      else if(rawVal!==''&&!isNaN(rawVal)) value=Number(rawVal);
      else value=rawVal;
      break;
    case 'empty': value=''; break;
    case 'null': value=null; break;
    case 'true': value=true; break;
    case 'false': value=false; break;
    case 'number': value=Number(rawVal)||0; break;
    case 'empty_obj': value={}; break;
    case 'empty_arr': value=[]; break;
    case 'auto_increment': value=1; break; // per-block counter below
    default: value=edMakeRandomValue(type);
  }

  const containers = edGetScopedContainers();
  if(!containers.length){ edFlash('⚠ No containers in scope','var(--red)'); return; }

  let affected=0;
  let autoCounter=isAutoInc ? (Number(rawVal)||1) : 1;
  edPushHistory(`Add "${key}" to ${containers.length} node${containers.length!==1?'s':''}`, '➕');
  containers.forEach(c=>{
    let v;
    if(isAutoInc){ v=autoCounter++; }
    else if(type.startsWith('random')){ v=edMakeRandomValue(type); }
    else { v=typeof value==='object'&&value!==null?edDeepClone(value):value; }

    if(Array.isArray(c.obj)){
      if(key){ c.obj.push({[key]: v}); }
      else { c.obj.push(v); }
      affected++;
    } else {
      c.obj[key] = v;
      affected++;
    }
  });

  edRenderTree(); edUpdateStats(); edUpdateScopeInfo();
  edFlash(`✓ Added "${key}" to ${affected} node${affected!==1?'s':''}`);
}

// ── Bulk Remove ──────────────────────────────────────────
function edBulkRemove(){
  if(!edRequireLevel()) return;
  const key = document.getElementById('edRemoveKey').value.trim();
  if(!key){ edFlash('⚠ Enter a field name','var(--red)'); return; }

  const containers = edGetScopedContainers();
  if(!containers.length){ edFlash('⚠ No containers in scope','var(--red)'); return; }

  let affected=0;
  edPushHistory(`Remove "${key}" from ${containers.length} node${containers.length!==1?'s':''}`, '🗑');
  containers.forEach(c=>{
    if(key in c.obj){ delete c.obj[key]; affected++; }
  });

  edRenderTree(); edUpdateStats(); edUpdateScopeInfo(); edUpdateRemoveSuggestions();
  if(affected===0) edFlash(`⚠ "${key}" not found in scope`, 'var(--red)');
  else edFlash(`✓ Removed "${key}" from ${affected} node${affected!==1?'s':''}`);
}

// ── Bulk Rename ──────────────────────────────────────────
function edBulkRename(){
  if(!edRequireLevel()) return;
  const from = document.getElementById('edRenameFrom').value.trim();
  const to   = document.getElementById('edRenameTo').value.trim();
  if(!from||!to){ edFlash('⚠ Fill both fields','var(--red)'); return; }
  if(from===to){ edFlash('⚠ Names are the same','var(--red)'); return; }

  const containers = edGetScopedContainers();
  let affected=0;
  edPushHistory(`Rename "${from}" → "${to}"`, '✏️');
  containers.forEach(c=>{
    if(from in c.obj){
      // Preserve key order by rebuilding the object
      const entries = Object.entries(c.obj);
      const idx = entries.findIndex(([k])=>k===from);
      if(idx!==-1){ entries[idx][0]=to; }
      Object.keys(c.obj).forEach(k=>delete c.obj[k]);
      entries.forEach(([k,v])=>c.obj[k]=v);
      affected++;
    }
  });

  edRenderTree(); edUpdateStats();
  if(affected===0) edFlash(`⚠ "${from}" not found in scope`, 'var(--red)');
  else edFlash(`✓ Renamed "${from}" → "${to}" in ${affected} node${affected!==1?'s':''}`);
}

// ── Bulk Edit Value ──────────────────────────────────────
function edBulkEditValue(){
  if(!edRequireLevel()) return;
  const key  = document.getElementById('edEditKey').value.trim();
  const raw  = document.getElementById('edEditValue').value;
  if(!key){ edFlash('⚠ Enter a field name','var(--red)'); return; }

  let value;
  if(raw==='null') value=null;
  else if(raw==='true') value=true;
  else if(raw==='false') value=false;
  else if(raw!==''&&!isNaN(raw)) value=Number(raw);
  else value=raw;

  const containers = edGetScopedContainers();
  let affected=0;
  edPushHistory(`Set "${key}" = ${JSON.stringify(value)}`, '🔄');
  containers.forEach(c=>{
    if(key in c.obj){ c.obj[key]=value; affected++; }
  });

  edRenderTree(); edUpdateStats();
  if(affected===0) edFlash(`⚠ "${key}" not found in scope`, 'var(--red)');
  else edFlash(`✓ Updated "${key}" in ${affected} node${affected!==1?'s':''}`);
}

// ── Sort keys ────────────────────────────────────────────
function edSortKeys(){
  if(!edRequireLevel()) return;
  const dir = document.getElementById('edSortDir').value;
  let affected=0;

  edPushHistory(`Sort keys ${dir==='asc'?'A→Z':'Z→A'} at level ${edLevel}`, '⬆️');

  function sortObj(obj){
    const keys = Object.keys(obj).sort((a,b)=>dir==='asc'?a.localeCompare(b):b.localeCompare(a));
    const sorted={};
    keys.forEach(k=>sorted[k]=obj[k]);
    return sorted;
  }

  const containers = edGetScopedContainers();
  containers.forEach(c=>{
    if(!Array.isArray(c.obj)){
      const sorted=sortObj(c.obj);
      Object.keys(c.obj).forEach(k=>delete c.obj[k]);
      Object.assign(c.obj,sorted);
      affected++;
    }
  });

  edRenderTree(); edUpdateStats();
  edFlash(`✓ Sorted ${affected} node${affected!==1?'s':''}`);
}

/* end JSON Editor */


/* ── EDITOR: NEW FEATURES ────────────────────────────────── */

function edSwitchTab(tab){
  ['bulk','analytics','schema','history'].forEach(t=>{
    const btn  = document.getElementById('edTab'+t.charAt(0).toUpperCase()+t.slice(1));
    const pane = document.getElementById('edPane'+t.charAt(0).toUpperCase()+t.slice(1));
    if(btn)  btn.classList.toggle('active', t===tab);
    if(pane) pane.style.display = t===tab ? 'flex' : 'none';
  });
}



// Send to beautifier
function edSendToBeautifier(){
  if(!edData){ edFlash('⚠ Nothing to send','var(--red)'); return; }
  switchTool('beautifier');
  const ta=document.getElementById('beautInput');
  if(ta){ ta.value=edGetJson(); ta.dispatchEvent(new Event('input')); updateBeautGutter('Input'); }
}

// Status bar helper
function edSetStatus(msg, color='var(--text-dim)'){
  const el=document.getElementById('edStatusBar');
  if(el){
    el.textContent=msg;
    el.style.color=color;
  }
}

/* ── SEARCH ── */
let edSearchMatches=[];
let edSearchIdx=0;

function edDoSearch(){
  const q=(document.getElementById('edSearch').value||'').trim().toLowerCase();
  const countEl=document.getElementById('edSearchCount');
  const tree=document.getElementById('edTree');

  // Clear previous
  tree.querySelectorAll('.ed-search-match,.ed-search-match-current').forEach(el=>{
    el.classList.remove('ed-search-match','ed-search-match-current');
  });
  tree.querySelectorAll('.node,.node-leaf').forEach(el=>el.classList.remove('ed-node-hidden'));
  edSearchMatches=[]; edSearchIdx=0;

  if(!q){ if(countEl) countEl.textContent=''; return; }

  // Walk all leaf/header spans and mark matches
  tree.querySelectorAll('.tree-key,.tree-key-obj,.value-string,.value-number,.value-bool,.value-null').forEach(span=>{
    const txt=(span.textContent||'').toLowerCase();
    if(txt.includes(q)){
      span.classList.add('ed-search-match');
      edSearchMatches.push(span);
    }
  });

  // Hide nodes that have no match inside them
  tree.querySelectorAll('.node').forEach(node=>{
    const hasMatch=node.querySelector('.ed-search-match');
    if(!hasMatch) node.classList.add('ed-node-hidden');
  });

  if(countEl) countEl.textContent=edSearchMatches.length?`${edSearchMatches.length} match${edSearchMatches.length!==1?'es':''}` : 'No matches';
  if(edSearchMatches.length){ edSearchMatches[0].classList.add('ed-search-match-current'); edSearchMatches[0].scrollIntoView({block:'nearest'}); }
}

/* ── AUTO-INCREMENT support in edBulkAdd ── */
let _edAutoIncrementCounter=1;

/* ── CONDITIONAL OP ── */
function edConditionalOp(){
  if(!edRequireLevel()) return;
  const condKey=document.getElementById('edCondKey').value.trim();
  const condOp=document.getElementById('edCondOp').value;
  const condVal=document.getElementById('edCondVal').value.trim();
  const setKey=document.getElementById('edCondSetKey').value.trim();
  const setRaw=document.getElementById('edCondSetVal').value.trim();
  const resultEl=document.getElementById('edCondResult');

  if(!condKey&&condOp!=='exists'&&condOp!=='missing'){ resultEl.textContent='⚠ Enter a condition field'; return; }
  if(!setKey){ resultEl.textContent='⚠ Enter a field to set'; return; }

  let setValue=setRaw;
  if(setRaw==='null') setValue=null;
  else if(setRaw==='true') setValue=true;
  else if(setRaw==='false') setValue=false;
  else if(setRaw!==''&&!isNaN(setRaw)) setValue=Number(setRaw);

  const containers=edGetScopedContainers();
  let affected=0;

  const passes=(obj)=>{
    switch(condOp){
      case 'eq': return String(obj[condKey])===condVal || obj[condKey]===setValue;
      case 'neq': return String(obj[condKey])!==condVal;
      case 'contains': return String(obj[condKey]||'').includes(condVal);
      case 'exists': return condKey in obj;
      case 'missing': return !(condKey in obj);
      default: return false;
    }
  };

  edPushHistory(`Conditional: WHERE ${condKey} ${condOp} "${condVal}" → SET ${setKey}`, '⚙️');
  containers.forEach(c=>{
    if(typeof c.obj==='object'&&c.obj!==null&&passes(c.obj)){
      c.obj[setKey]=setValue; affected++;
    }
  });

  edRenderTree(); edUpdateStats();
  resultEl.style.color=affected?'var(--green)':'var(--red)';
  resultEl.textContent=affected?`✓ Applied to ${affected} block${affected!==1?'s':''}`:`⚠ No blocks matched condition`;
}

/* ── FIND & REPLACE ── */
function edFindReplace(){
  if(!edRequireLevel()) return;
  const findRaw=document.getElementById('edFindVal').value;
  const replaceRaw=document.getElementById('edReplaceVal').value;
  const useRegex=document.getElementById('edFindRegex').checked;
  const caseSensitive=document.getElementById('edFindCaseSensitive').checked;
  const resultEl=document.getElementById('edFindResult');

  if(!findRaw){ resultEl.textContent='⚠ Enter a search value'; return; }

  let replaceVal=replaceRaw;
  if(replaceRaw==='null') replaceVal=null;
  else if(replaceRaw==='true') replaceVal=true;
  else if(replaceRaw==='false') replaceVal=false;
  else if(replaceRaw!==''&&!isNaN(replaceRaw)) replaceVal=Number(replaceRaw);

  let replaced=0;

  const matches=(val)=>{
    if(val===null||val===undefined) return String(val)===findRaw;
    const str=String(val);
    if(useRegex){
      try{ return new RegExp(findRaw, caseSensitive?'':'i').test(str); }
      catch(e){ return false; }
    }
    return caseSensitive ? str===findRaw : str.toLowerCase()===findRaw.toLowerCase();
  };

  const deepReplace=(obj)=>{
    if(typeof obj!=='object'||obj===null) return;
    Object.keys(obj).forEach(k=>{
      if(matches(obj[k])){ obj[k]=replaceVal; replaced++; }
      else if(typeof obj[k]==='object'&&obj[k]!==null) deepReplace(obj[k]);
    });
  };

  edPushHistory(`Find "${findRaw}" → Replace "${replaceRaw}"`, '🔍');
  deepReplace(edData);
  edRenderTree(); edUpdateStats();
  resultEl.style.color=replaced?'var(--green)':'var(--red)';
  resultEl.textContent=replaced?`✓ Replaced ${replaced} value${replaced!==1?'s':''}`:`⚠ No matches found`;
}

/* ── TYPE CAST ── */
function edTypeCast(){
  if(!edRequireLevel()) return;
  const key=document.getElementById('edCastKey').value.trim();
  const to=document.getElementById('edCastTo').value;
  if(!key){ edFlash('⚠ Enter a field name','var(--red)'); return; }

  const cast=(val)=>{
    if(to==='string') return String(val??'');
    if(to==='number'){ const n=Number(val); return isNaN(n)?0:n; }
    if(to==='boolean') return Boolean(val)&&val!=='false'&&val!=='0'&&val!==null;
    if(to==='null') return null;
    return val;
  };

  const containers=edGetScopedContainers();
  let affected=0;
  edPushHistory(`Cast "${key}" to ${to}`, '🔀');
  containers.forEach(c=>{
    if(key in c.obj){ c.obj[key]=cast(c.obj[key]); affected++; }
  });

  edRenderTree(); edUpdateStats();
  if(affected===0) edFlash(`⚠ "${key}" not found in scope`,'var(--red)');
  else edFlash(`✓ Cast "${key}" to ${to} in ${affected} block${affected!==1?'s':''}`);
}

/* ── FLATTEN / UNFLATTEN ── */
function edFlatten(){
  if(!edData){ edFlash('⚠ Load JSON first','var(--red)'); return; }
  const flat={};
  const walk=(obj,prefix)=>{
    Object.keys(obj).forEach(k=>{
      const path=prefix?`${prefix}.${k}`:k;
      if(typeof obj[k]==='object'&&obj[k]!==null&&!Array.isArray(obj[k])) walk(obj[k],path);
      else flat[path]=obj[k];
    });
  };
  edPushHistory('Flatten JSON','⬇');
  walk(edData,'');
  edData=flat;
  edRenderTree(); edUpdateStats(); edBuildLevelSelect();
  edFlash('✓ JSON flattened to dot-notation keys');
}

function edUnflatten(){
  if(!edData){ edFlash('⚠ Load JSON first','var(--red)'); return; }
  const result={};
  Object.keys(edData).forEach(key=>{
    const parts=key.split('.');
    let cur=result;
    parts.forEach((p,i)=>{
      if(i===parts.length-1) cur[p]=edData[key];
      else { if(!cur[p]||typeof cur[p]!=='object') cur[p]={}; cur=cur[p]; }
    });
  });
  edPushHistory('Unflatten JSON','⬆');
  edData=result;
  edRenderTree(); edUpdateStats(); edBuildLevelSelect();
  edFlash('✓ JSON unflattened from dot-notation keys');
}

/* ── DEDUPE ── */
function edDedupeBlocks(){
  if(!edData){ edFlash('⚠ Load JSON first','var(--red)'); return; }
  const seen=new Set();
  let removed=0;
  if(Array.isArray(edData)){
    edPushHistory('Dedupe array items','✦');
    const orig=edData.length;
    edData=edData.filter(item=>{ const k=JSON.stringify(item); if(seen.has(k)){ removed++; return false; } seen.add(k); return true; });
  } else {
    edPushHistory('Dedupe object blocks','✦');
    Object.keys(edData).forEach(k=>{ const v=JSON.stringify(edData[k]); if(seen.has(v)){ delete edData[k]; removed++; } else seen.add(v); });
  }
  edRenderTree(); edUpdateStats();
  if(removed) edFlash(`✓ Removed ${removed} duplicate${removed!==1?'s':''}`);
  else edFlash('✓ No duplicates found');
}

/* ── ANALYTICS ── */
function edMakeAnalyticsSection(title, color){
  const section = document.createElement('div');
  section.className = 'ed-analytics-section';
  const heading = document.createElement('div');
  heading.className = 'ed-analytics-title';
  if(color) heading.style.color = color;
  heading.textContent = title;
  section.appendChild(heading);
  return section;
}

function edMakeAnalyticsRow(keyText, valueText, valueClass){
  const row = document.createElement('div');
  row.className = 'ed-analytics-row';
  const key = document.createElement('span');
  key.className = 'ed-analytics-key';
  key.textContent = keyText;
  const value = document.createElement('span');
  value.className = valueClass || 'ed-analytics-val';
  value.textContent = valueText;
  row.append(key, value);
  return row;
}

function edRunAnalytics(){
  const out = document.getElementById('edAnalyticsOut');
  if(!out) return;
  if(!edData){ out.textContent='Load JSON first.'; return; }
  const containers=edGetContainersForLevel();
  const allKeys=new Set();
  const keyTypes={}; // key → {string:n, number:n, ...}
  const keyVals={}; // key → Map(val→count)
  const keyMissing={}; // key → count missing

  // Gather all keys across containers
  containers.forEach(c=>{
    Object.keys(c.obj).forEach(k=>{
      allKeys.add(k);
      const t=c.obj[k]===null?'null':Array.isArray(c.obj[k])?'array':typeof c.obj[k];
      if(!keyTypes[k]) keyTypes[k]={};
      keyTypes[k][t]=(keyTypes[k][t]||0)+1;
      if(!keyVals[k]) keyVals[k]=new Map();
      const sv=JSON.stringify(c.obj[k]);
      keyVals[k].set(sv,(keyVals[k].get(sv)||0)+1);
    });
    // Track missing
    allKeys.forEach(k=>{ if(!(k in c.obj)) keyMissing[k]=(keyMissing[k]||0)+1; });
  });

  const total=containers.length;
  if(total===0){
    const empty = document.createElement('div');
    empty.style.color = 'var(--text-dim)';
    empty.textContent = 'No blocks at this level. Try changing the scope level.';
    out.replaceChildren(empty);
    return;
  }

  const fragments = [];
  const overview = edMakeAnalyticsSection('Overview');
  overview.appendChild(edMakeAnalyticsRow(`Total blocks at level ${edLevel}`, String(total)));
  overview.appendChild(edMakeAnalyticsRow('Unique keys', String(allKeys.size)));
  fragments.push(overview);

  const report = edMakeAnalyticsSection('Field Report');
  [...allKeys].sort().forEach(k=>{
    const missing=keyMissing[k]||0;
    const present=total-missing;
    const pct=Math.round(present/total*100);
    const types=keyTypes[k]||{};
    const vals=keyVals[k]||new Map();
    const topVals=[...vals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([v,n])=>`${v}×${n}`).join(', ');

    const block = document.createElement('div');
    block.style.padding = '6px 0';
    block.style.borderBottom = '1px solid rgba(255,255,255,.05)';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '3px';

    const key = document.createElement('span');
    key.className = 'ed-analytics-key';
    key.textContent = k;

    const badges = document.createElement('span');
    badges.style.display = 'flex';
    badges.style.gap = '4px';
    badges.style.alignItems = 'center';

    if(missing){
      const missingBadge = document.createElement('span');
      missingBadge.className = 'ed-missing-badge';
      missingBadge.textContent = `missing ${missing}`;
      badges.appendChild(missingBadge);
    }
    Object.entries(types).forEach(([t,n])=>{
      const badge = document.createElement('span');
      badge.className = `ed-type-badge ed-type-${t}`;
      badge.textContent = t + (n>1 ? ` ×${n}` : '');
      badges.appendChild(badge);
    });
    header.append(key, badges);

    const bar = document.createElement('div');
    bar.className = 'ed-analytics-bar';
    bar.style.width = `${pct}%`;
    bar.style.opacity = '.7';

    const foot = document.createElement('div');
    foot.style.fontSize = '10px';
    foot.style.color = 'var(--text-dim)';
    foot.style.marginTop = '3px';
    foot.textContent = `${present}/${total} blocks · Top: ${topVals||'—'}`;

    block.append(header, bar, foot);
    report.appendChild(block);
  });
  fragments.push(report);

  // Type inconsistencies
  const inconsistent=[...allKeys].filter(k=>Object.keys(keyTypes[k]||{}).length>1);
  if(inconsistent.length){
    const section = edMakeAnalyticsSection('⚠ Type Inconsistencies', 'var(--red)');
    inconsistent.forEach(k=>{
      const types=Object.entries(keyTypes[k]).map(([t,n])=>`${t}×${n}`).join(', ');
      section.appendChild(edMakeAnalyticsRow(k, types, 'ed-analytics-warn'));
    });
    fragments.push(section);
  }

  // Missing fields
  const missing=Object.entries(keyMissing).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]);
  if(missing.length){
    const section = edMakeAnalyticsSection('⚠ Missing Fields', 'var(--red)');
    missing.forEach(([k,n])=>{
      section.appendChild(edMakeAnalyticsRow(k, `missing in ${n} block${n!==1?'s':''}`, 'ed-analytics-warn'));
    });
    fragments.push(section);
  }

  out.replaceChildren(...fragments);
  edFlash(`✓ Analysis complete — ${allKeys.size} keys across ${total} blocks`);
}

/* ── SCHEMA ── */
let _edLastSchema=null;

function edDetectSchema(){
  if(!edData){ document.getElementById('edSchemaOut').textContent='Load JSON first.'; return; }

  const inferType=(val)=>{
    if(val===null) return {type:'null'};
    if(Array.isArray(val)){
      if(val.length===0) return {type:'array',items:{}};
      const itemSchemas=val.map(v=>inferType(v));
      return {type:'array',items:itemSchemas[0]};
    }
    if(typeof val==='object'){
      const props={};
      Object.keys(val).forEach(k=>props[k]=inferType(val[k]));
      return {type:'object',properties:props,required:Object.keys(val)};
    }
    if(typeof val==='boolean') return {type:'boolean'};
    if(typeof val==='number') return Number.isInteger(val)?{type:'integer'}:{type:'number'};
    return {type:'string'};
  };

  const mergeSchemas=(a,b)=>{
    if(!a) return b;
    if(!b) return a;
    if(a.type!==b.type) return {oneOf:[a,b]};
    if(a.type==='object'){
      const allKeys=new Set([...Object.keys(a.properties||{}),...Object.keys(b.properties||{})]);
      const props={};
      allKeys.forEach(k=>props[k]=mergeSchemas(a.properties?.[k],b.properties?.[k]));
      const req=(a.required||[]).filter(k=>(b.required||[]).includes(k));
      return {type:'object',properties:props,required:req};
    }
    return a;
  };

  // Infer from all blocks at current level
  const containers=edGetContainersForLevel();
  let schema=null;
  if(containers.length){
    containers.forEach(c=>{ schema=mergeSchemas(schema,inferType(c.obj)); });
  } else {
    schema=inferType(edData);
  }

  const fullSchema={"$schema":"http://json-schema.org/draft-07/schema#",...schema};
  _edLastSchema=fullSchema;
  document.getElementById('edSchemaOut').textContent=JSON.stringify(fullSchema,null,2);
  edFlash('✓ Schema detected');
}

function edCopySchema(btn){
  if(!_edLastSchema){ edFlash('⚠ Run Detect Schema first','var(--red)'); return; }
  const text=JSON.stringify(_edLastSchema,null,2);
  if(navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
  const orig=btn.textContent; btn.textContent='✓ Copied'; btn.style.color='var(--green)';
  setTimeout(()=>{ btn.textContent=orig; btn.style.color=''; },1500);
}

/* ── SELECT MODE BUTTON ── */
function edToggleSelectMode(){
  edSelectMode=!edSelectMode;
  const btn=document.getElementById('edSelectModeBtn');
  if(btn){
    btn.textContent=edSelectMode?'☑ Select ON':'☐ Select';
    btn.style.background=edSelectMode?'var(--accent)':'';btn.style.color=edSelectMode?'var(--surface)':'';;
    btn.style.color=edSelectMode?'#fff':'';
  }
  if(!edSelectMode){ edSelected.clear(); if(edScope==='selected') edSetScope('all'); }
  edRenderTree(); edUpdateScopeInfo();
}

/* ── AUTO-INCREMENT in edBulkAdd ── (patch into existing edBulkAdd) */

/* end new features */


/* ── GENERATE BLOCKS ── */
let _edGenType = 'object'; // 'object' | 'array'
let _edGenMode = 'replace'; // 'replace' | 'merge'

function edSetGenType(t){
  _edGenType = t;
  document.getElementById('edGenTypeObj').classList.toggle('active', t==='object');
  document.getElementById('edGenTypeArr').classList.toggle('active', t==='array');
  // Hide prefix when array mode
  const prefixEl = document.getElementById('edGenPrefix');
  if(prefixEl) prefixEl.style.opacity = t==='array' ? '0.4' : '1';
  edUpdateGenPreview();
}

function edSetGenMode(m){
  _edGenMode = m;
  document.getElementById('edGenModeReplace').classList.toggle('active', m==='replace');
  document.getElementById('edGenModeMerge').classList.toggle('active', m==='merge');
}

function edUpdateGenPreview(){
  const from = parseInt(document.getElementById('edGenFrom').value) || 1;
  const to   = parseInt(document.getElementById('edGenTo').value)   || 1;
  const prefix = document.getElementById('edGenPrefix').value.trim() || 'block';
  const count = Math.max(0, to - from + 1);
  const fl = document.getElementById('edGenFromLabel');
  const tl = document.getElementById('edGenToLabel');
  const cl = document.getElementById('edGenCountLabel');
  if(fl) fl.textContent = from;
  if(tl) tl.textContent = to;
  if(cl){
    cl.textContent = count;
    cl.style.color = count > 1000 ? 'var(--red)' : count > 0 ? 'var(--green)' : 'var(--red)';
  }
}

// Wire live preview updates
document.addEventListener('DOMContentLoaded', ()=>{
  const fromEl = document.getElementById('edGenFrom');
  const toEl   = document.getElementById('edGenTo');
  const prefEl = document.getElementById('edGenPrefix');
  if(fromEl) fromEl.addEventListener('input', edUpdateGenPreview);
  if(toEl)   toEl.addEventListener('input',   edUpdateGenPreview);
  if(prefEl) prefEl.addEventListener('input',  edUpdateGenPreview);
});

function edGenerateBlocks(){
  const from   = parseInt(document.getElementById('edGenFrom').value) || 1;
  const to     = parseInt(document.getElementById('edGenTo').value)   || 10;
  const prefix = document.getElementById('edGenPrefix').value.trim() || 'block';
  const injectId   = document.getElementById('edGenInjectId').checked;
  const injectKey  = document.getElementById('edGenInjectKey').checked;
  const injectUuid = document.getElementById('edGenInjectUuid').checked;
  const templateRaw = (document.getElementById('edGenTemplate').value || '').trim();
  const resultEl = document.getElementById('edGenResult');

  if(from > to){ resultEl.style.color='var(--red)'; resultEl.textContent='⚠ Start must be ≤ End'; return; }
  const count = to - from + 1;
  if(count > 5000){ resultEl.style.color='var(--red)'; resultEl.textContent='⚠ Max 5000 blocks at once'; return; }

  // Parse template
  let template = {};
  if(templateRaw){
    try { template = JSON.parse(templateRaw); }
    catch(e){ resultEl.style.color='var(--red)'; resultEl.textContent='⚠ Invalid template JSON'; return; }
    if(typeof template !== 'object' || Array.isArray(template)){
      resultEl.style.color='var(--red)'; resultEl.textContent='⚠ Template must be a JSON object {}'; return;
    }
  }

  const uuid = ()=>'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});

  // Generate
  const generated = _edGenType === 'object' ? {} : [];

  for(let i = from; i <= to; i++){
    const block = JSON.parse(JSON.stringify(template)); // deep clone
    // Auto-inject fields
    if(injectId)   block['id']   = i;
    if(injectKey)  block['key']  = `${prefix}${i}`;
    if(injectUuid) block['uuid'] = uuid();

    if(_edGenType === 'object'){
      generated[`${prefix}${i}`] = block;
    } else {
      generated.push(block);
    }
  }

  // Apply mode
  if(_edGenMode === 'replace' || !edData){
    edPushHistory(`Generate ${count} blocks (${_edGenType})`, '⚡');
    edData = generated;
  } else {
    // Merge
    edPushHistory(`Generate & merge ${count} blocks`, '⚡');
    if(Array.isArray(edData) && Array.isArray(generated)){
      edData.push(...generated);
    } else if(!Array.isArray(edData) && !Array.isArray(generated)){
      Object.assign(edData, generated);
    } else {
      resultEl.style.color='var(--red)';
      resultEl.textContent='⚠ Cannot merge: type mismatch (object vs array)';
      return;
    }
  }

  edCollapsed = {};
  edSelected = new Set();
  edBuildLevelSelect();
  edRenderTree();
  edUpdateStats();

  resultEl.style.color = 'var(--green)';
  resultEl.textContent = `✓ Generated ${count} block${count!==1?'s':''} (${_edGenType})`;
  edFlash(`✓ ${count} blocks generated`);

  // Auto-switch to tree so user sees result immediately
  edSwitchTab('bulk');
}


/* ── DEPTH VISUALS: A (lane) + E (dim) + level legend ── */

const ED_DEPTH_COLORS = [
  null,
  'rgba(99,102,241,1)',   // L1 — indigo
  'rgba(20,184,166,1)',   // L2 — teal
  'rgba(251,191,36,1)',   // L3 — amber
  'rgba(248,113,113,1)',  // L4 — red
  'rgba(167,139,250,1)',  // L5 — purple
  'rgba(74,222,128,1)',   // L6 — green
];

let edLevelSelected = false; // true only when user has explicitly picked a level

function edApplyLaneHighlight(){
  const tree = document.getElementById('edTree');
  if(!tree || !edData) return;

  // Remove previous highlight classes
  tree.querySelectorAll('.ed-lane-target,.ed-lane-ancestor').forEach(el=>{
    el.classList.remove('ed-lane-target','ed-lane-ancestor');
  });
  tree.classList.remove('ed-tree-leveled');

  // Only highlight if user has actively selected a level
  if(!edLevelSelected) return;

  // A+E: add leveled class to enable dim effect
  tree.classList.add('ed-tree-leveled');

  // Mark nodes at target level
  tree.querySelectorAll('.node,.node-leaf').forEach(el=>{
    const d = parseInt(el.dataset.depth);
    if(d === edLevel){
      el.classList.add('ed-lane-target');
      // Mark all ancestors so they stay visible (not dimmed)
      let parent = el.parentElement;
      while(parent && parent !== tree){
        if(parent.classList.contains('node')){
          parent.classList.add('ed-lane-ancestor');
        }
        parent = parent.parentElement;
      }
    }
  });
}

function edBuildLevelLegend(){
  const legend = document.getElementById('edLevelLegend');
  if(!legend || !edData) return;

  const maxD = edGetMaxDepth(edData);
  if(maxD <= 1){ legend.style.display='none'; return; }

  legend.style.display = 'flex';

  // Keep the DEPTH: label, rebuild pills
  const existing = legend.querySelectorAll('.ed-level-pill');
  existing.forEach(p=>p.remove());

  for(let d=1; d<=Math.min(maxD,6); d++){
    const pill = document.createElement('button');
    pill.className = `ed-level-pill ed-level-pill-${d}${d===edLevel?' active':''}`;
    pill.dataset.level = d;
    pill.title = `Highlight level ${d}`;

    const dot = document.createElement('span');
    dot.style.cssText = `width:7px;height:7px;border-radius:50%;background:${ED_DEPTH_COLORS[d]};display:inline-block`;
    pill.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = `L${d}`;
    pill.appendChild(label);

    pill.onclick = ()=>{
      // Click same level pill to deselect (toggle off)
      if(edLevel === d && edLevelSelected){
        edLevelSelected = false;
        legend.querySelectorAll('.ed-level-pill').forEach(p=>p.classList.remove('active'));
        const tree = document.getElementById('edTree');
        tree.classList.remove('ed-tree-leveled');
        tree.querySelectorAll('.ed-lane-target,.ed-lane-ancestor').forEach(el=>{
          el.classList.remove('ed-lane-target','ed-lane-ancestor');
        });
        edUpdateScopeInfo();
        return;
      }
      edLevel = d;
      edLevelSelected = true;
      const sel = document.getElementById('edLevelSelect');
      if(sel) sel.value = d;
      legend.querySelectorAll('.ed-level-pill').forEach(p=>p.classList.toggle('active', parseInt(p.dataset.level)===d));
      edExpandToLevel(d);
      edUpdateScopeInfo();
    };

    legend.appendChild(pill);
  }
}

/* Lane/legend wiring is called directly from edRenderTree and edBuildLevelSelect below */


/* Expand tree to a specific depth level — level by level, lazy-renders as needed */
function edExpandToLevel(targetDepth){
  const tree = document.getElementById('edTree');
  if(!tree) return;

  // Expand all nodes whose depth is LESS than targetDepth (so target level is visible)
  // Collapse all nodes whose depth is >= targetDepth
  function processNodes(container){
    container.querySelectorAll(':scope > .node').forEach(node=>{
      const depth = parseInt(node.dataset.depth || 1);
      const header = node.querySelector(':scope > .node-header');
      const children = node.querySelector(':scope > .node-children');
      const closing = node.querySelector(':scope > .tree-brace');
      const arrow = header && header.querySelector('.tree-arrow');
      if(!children) return;

      if(depth < targetDepth){
        // Expand: need to show this node's children
        if(!children.dataset.rendered){
          children.dataset.rendered = '1';
          const pathKey = node.dataset.pathKey;
          let path = []; try { path = pathKey ? JSON.parse(pathKey) : []; } catch(e) { path = []; }
          let obj = edData;
          for(const k of path) obj = obj?.[k];
          if(obj && typeof obj === 'object') edWalkShallow(obj, path, children, depth+1);
        }
        children.style.display = 'block';
        if(closing) closing.style.display = 'block';
        if(arrow) arrow.textContent = '▼';
        edCollapsed[node.dataset.pathKey] = false;
        // Recurse into now-visible children
        processNodes(children);
      } else {
        // Collapse: at or deeper than target — hide children
        children.style.display = 'none';
        if(closing) closing.style.display = 'none';
        if(arrow) arrow.textContent = '▶';
        edCollapsed[node.dataset.pathKey] = true;
      }
    });
  }

  processNodes(tree);
  setTimeout(edApplyLaneHighlight, 0);
}


function toggleEditorFullscreen(){
  const panel = document.getElementById('panel-editor');
  const btn   = document.getElementById('edFullscreenBtn');
  const isFS  = panel.classList.toggle('editor-fullscreen');
  btn.textContent = isFS ? '⛶ Exit FS' : '⛶ Fullscreen';
  document.body.style.overflow = isFS ? 'hidden' : '';
}

// Auto-load JSON when pasted into edPasteArea
document.addEventListener('DOMContentLoaded', ()=>{
  const pa = document.getElementById('edPasteArea');
  if(pa){
    pa.addEventListener('paste', ()=>{
      setTimeout(()=>{
        if(pa.value.trim()) edLoadJson();
      }, 0);
    });
  }
});




/* ════════════════════════════════════════════════════════
   PERSISTENT STORAGE — localStorage
   Saves: mock tabs, active tool, editor JSON, theme
   Restores silently on load
   ════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'jedimock_v2';
const STORAGE_VERSION = 1;
let _persistTimer = null;
let _lastSaved = null;

/* Save indicator — silent success, only shows on error */
function _showSaveDot(error){
  // No-op on success — save silently like Notion/Linear
  // Only surface errors via console
}

/* Debounced persist — saves 800ms after last change */
function persistSession(){
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(_doSave, 1000);
}

function _doSave(){
  try{
    // Flush current DOM state into tabs array before saving
    if(typeof saveState === 'function') saveState();
    const payload = buildSessionPayload({
      storageVersion: STORAGE_VERSION,
      tabs,
      currentTab,
      activeTool: document.querySelector('.sidebar-nav-btn.active')?.id?.replace('nav-','') || 'mock',
      theme: document.documentElement.getAttribute('data-theme') || 'dark',
      editorJson: edData ? JSON.stringify(edData) : null,
      validatorInput: document.getElementById('validInput')?.value || '',
      beautInput: document.getElementById('beautInput')?.value || ''
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    _lastSaved = Date.now();
  } catch(e){
    console.warn('JediMock: failed to save session', e);
    // localStorage full or blocked — fail silently
  }
}

function restoreSession(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const payload = sanitizeStoredPayload(JSON.parse(raw), {
      storageVersion: STORAGE_VERSION,
      tabLimit: TAB_LIMIT,
      sanitizeTabState
    });
    if(!payload) return false;

    // Restore theme first (no flash)
    if(payload.theme){
      document.documentElement.setAttribute('data-theme', payload.theme);
      // Update theme btn label
      const btn = document.getElementById('themeBtn');
      if(btn){
        const moonSvg=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
        const sunSvg=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
        btn.innerHTML=(payload.theme==='dark'?sunSvg:moonSvg)+`<span class="theme-label">Toggle theme</span>`;
      }
    }

    // Restore mock tabs
    if(payload.tabs && payload.tabs.length){
      tabs = payload.tabs;
      currentTab = Math.min(payload.currentTab||0, tabs.length-1);
      renderTabs();
      loadState();
    }

    // Restore active tool
    if(payload.activeTool && payload.activeTool !== 'mock'){
      switchTool(payload.activeTool);
    } else {
      // Mock is active — make sure buttons show
      const mb = document.getElementById('mockOnlyBtns');
      if(mb) mb.style.display = 'block';
    }

    // Restore editor JSON
    if(payload.editorJson){
      try{
        edData = JSON.parse(payload.editorJson);
        edBuildLevelSelect();
        edRenderTree();
        edUpdateStats();
      } catch(e){}
    }

    // Restore validator input
    if(payload.validatorInput){
      const vi = document.getElementById('validInput');
      if(vi){ vi.value = payload.validatorInput; onValidInput(); }
    }

    // Restore beautifier input
    if(payload.beautInput){
      const bi = document.getElementById('beautInput');
      if(bi){ bi.value = payload.beautInput; bi.dispatchEvent(new Event('input')); }
    }

    return true;
  } catch(e){
    console.warn('JediMock: failed to restore session', e);
    return false;
  }
}

function clearPersistedSession(){
  clearTimeout(_persistTimer); // cancel any pending auto-save
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('jedimock_onboarded');
  const dot = document.getElementById('_saveDot');
  if(dot) dot.style.opacity='0';
}

/* persistSession is called directly inside saveState, switchTool, toggleTheme */

/* end persistence */


/* ════════════════════════════════════════════════════════
   RESPONSE RULES — stateful per-call mocking
   Each rule: { type:'exact'|'after'|'always', call:N, status:N, delay:N, json:str }
   ════════════════════════════════════════════════════════ */

let rules = [];        // rules for current tab
let rulesEnabled = false;

function onFallbackChange(){
  markScriptOutdated();
  const cb = document.getElementById('fallbackEnabled');
  const inp = document.getElementById('fallbackTimeout');
  const staticLabel = document.getElementById('fallbackTimeoutStatic');
  const hint = document.getElementById('fallbackAsyncHint');
  const isAsync = (document.querySelector('input[name="asyncMode"]:checked')?.value||'off') !== 'off';
  const wrap = document.getElementById('fallbackTimeoutWrap');
  const sLabel = document.getElementById('fallbackSecondsLabel');
  if(wrap) wrap.style.display = cb && cb.checked ? 'flex' : 'none';
  if(sLabel) sLabel.style.display = cb && cb.checked ? 'inline' : 'none';
  if(staticLabel) staticLabel.style.display = cb && cb.checked ? 'none' : 'inline';
  if(hint) hint.style.display = (cb && cb.checked && isAsync) ? 'block' : 'none';
  saveState();
}

function updateFallbackRowVisibility(){
  const row = document.getElementById('fallbackRow');
  if(!row) return;
  const target = getInterceptTarget();
  const isRequestOnly = target === 'request';
  row.style.display = isRequestOnly ? 'none' : 'flex';
}

function onFallbackChangeAsync(){
  markScriptOutdated();
  const cb = document.getElementById('fallbackEnabledAsync');
  const wrap2 = document.getElementById('fallbackTimeoutWrapAsync');
  const sLabelA = document.getElementById('fallbackSecondsLabelAsync');
  const staticLabel = document.getElementById('fallbackTimeoutStaticAsync');
  const hint = document.getElementById('fallbackAsyncHint');
  if(wrap2) wrap2.style.display = cb && cb.checked ? 'flex' : 'none';
  if(sLabelA) sLabelA.style.display = cb && cb.checked ? 'inline' : 'none';
  if(staticLabel) staticLabel.style.display = cb && cb.checked ? 'none' : 'inline';
  if(hint) hint.style.display = cb && cb.checked ? 'block' : 'none';
  saveState();
}

function getFallbackEnabledAsync(){
  return document.getElementById('fallbackEnabledAsync')?.checked || false;
}

function getFallbackTimeoutAsync(){
  return parseInt(document.getElementById('fallbackTimeoutAsync')?.value || '30', 10);
}

function getFallbackEnabled(){
  return document.getElementById('fallbackEnabled')?.checked || false;
}

function getFallbackTimeout(){
  return parseInt(document.getElementById('fallbackTimeout')?.value || '30', 10);
}

function onRulesToggle(){
  markScriptOutdated();
  rulesEnabled = document.getElementById('rulesEnabled').checked;
  renderRules();
  // Update active badge
  const badge = document.getElementById('rulesActiveBadge');
  if(badge) badge.style.display = rulesEnabled && rules.length > 0 ? 'inline-block' : 'none';
  // Update card border
  const card = document.getElementById('responseRulesCard');
  if(card) card.style.borderColor = rulesEnabled && rules.length > 0 ? 'rgba(0,212,255,0.4)' : '';
  persistSession();
}

function addRule(){
  const type   = document.getElementById('ruleCallType').value;
  const call   = parseInt(document.getElementById('ruleCallNum').value) || 1;
  const status = parseInt(document.getElementById('ruleStatus').value) || 200;
  const delay  = parseInt(document.getElementById('ruleDelay').value) || 0;
  const json   = (document.getElementById('ruleJson').value||'').trim();

  // Validate custom JSON if provided
  if(json){
    try{ JSON.parse(json); }
    catch(e){ edFlash('⚠ Rule JSON is invalid — '+e.message, 'var(--red)'); return; }
  }

  rules.push({ type, call, status, delay, json });
  // Sort: exact first by call number, then after, then always
  rules.sort((a,b)=>{
    const order = {exact:0, after:1, always:2};
    if(order[a.type]!==order[b.type]) return order[a.type]-order[b.type];
    return a.call - b.call;
  });

  // Reset inputs
  document.getElementById('ruleCallNum').value = rules.length + 1;
  document.getElementById('ruleJson').value = '';
  document.getElementById('ruleDelay').value = 0;

  renderRules();
  persistSession();
}

function deleteRule(i){
  rules.splice(i, 1);
  renderRules();
  persistSession();
}

function renderRules(){
  const list  = document.getElementById('rulesList');
  const empty = document.getElementById('rulesEmpty');
  if(!list) return;

  // Clear existing rule rows (keep empty msg)
  [...list.querySelectorAll('.rule-row')].forEach(r=>r.remove());

  if(rules.length === 0){
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  // Sync active badge
  const badge2 = document.getElementById('rulesActiveBadge');
  if(badge2) badge2.style.display = rulesEnabled && rules.length > 0 ? 'inline-block' : 'none';
  const card2 = document.getElementById('responseRulesCard');
  if(card2) card2.style.borderColor = rulesEnabled && rules.length > 0 ? 'rgba(0,212,255,0.4)' : '';

  rules.forEach((rule, i)=>{
    const row = document.createElement('div');
    row.className = 'rule-row';

    // Call label
    const callLabel = document.createElement('div');
    callLabel.className = 'rule-calls-badge';
    if(rule.type==='exact') callLabel.textContent = 'Call '+rule.call;
    else if(rule.type==='after') callLabel.textContent = 'After '+rule.call;
    else callLabel.textContent = 'Always';

    // Description
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    desc.textContent = rule.json ? rule.json.substring(0,40)+(rule.json.length>40?'…':'') : '(main JSON)';
    desc.title = rule.json || 'Uses the main JSON response';

    // Status
    const status = document.createElement('div');
    status.style.cssText = `font-size:11px;font-weight:600;color:${rule.status>=400?'var(--red)':rule.status>=300?'var(--yellow)':'var(--green)'}`;
    status.textContent = rule.status;

    // Delay
    const delay = document.createElement('div');
    delay.style.cssText = 'font-size:11px;color:var(--text-dim)';
    delay.textContent = rule.delay ? rule.delay+'ms' : '—';

    // Delete
    const del = document.createElement('button');
    del.className = 'rule-delete-btn';
    del.textContent = '✕';
    del.title = 'Remove rule';
    del.onclick = ()=>deleteRule(i);

    row.append(callLabel, desc, status, delay, del);
    list.appendChild(row);
  });
}

/* Save/restore rules with tab state */
function saveRulesToTab(){
  if(tabs[currentTab]){
    tabs[currentTab].rules = rules;
    tabs[currentTab].rulesEnabled = rulesEnabled;
  }
}

function loadRulesFromTab(){
  const t = tabs[currentTab];
  rules = (t && t.rules) ? t.rules : [];
  rulesEnabled = (t && t.rulesEnabled) ? t.rulesEnabled : false;
  const cb = document.getElementById('rulesEnabled');
  if(cb) cb.checked = rulesEnabled;
  renderRules();
}

/* end response rules */




/* ════════════════════════════════════════════════════════
   RESPONSE / REQUEST MODE — merge | replace
   ════════════════════════════════════════════════════════ */

function getResponseMode(){
  const el = document.querySelector('input[name="responseMode"]:checked');
  return el ? el.value : 'merge';
}

function getRequestBodyMode(){
  const el = document.querySelector('input[name="requestMode"]:checked');
  return el ? el.value : 'merge';
}

function onResponseModeChange(){
  const mode = getResponseMode();
  const mergeHint   = document.getElementById('responseMergeHint');
  const replaceHint = document.getElementById('responseReplaceHint');
  const viewerCard  = document.getElementById('viewerCard');
  const label       = document.getElementById('jsonCardLabel');
  const hasData = data && Object.keys(data).length > 0;

  // Only show hints after JSON is loaded
  if(mergeHint)   mergeHint.style.display   = (hasData && mode==='merge')   ? 'block' : 'none';
  if(replaceHint) replaceHint.style.display = (hasData && mode==='replace') ? 'block' : 'none';

  // In replace mode — no need to edit tree, hide viewer
  if(viewerCard && data && Object.keys(data).length > 0){
    viewerCard.classList.toggle('hidden', mode==='replace');
  }
  if(label) label.textContent = mode==='replace' ? 'Response JSON (full replacement)' : 'Response JSON';

  persistSession();
}

function onRequestModeChange(){
  const mode = getRequestBodyMode();
  const mergeHint   = document.getElementById('requestMergeHint');
  const replaceHint = document.getElementById('requestReplaceHint');
  if(mergeHint)   mergeHint.style.display   = mode==='merge'   ? 'block' : 'none';
  if(replaceHint) replaceHint.style.display = mode==='replace' ? 'block' : 'none';
  persistSession();
}

/* Save/restore modes with tab state */
function saveModesToTab(){
  if(tabs[currentTab]){
    tabs[currentTab].responseMode = getResponseMode();
    tabs[currentTab].requestBodyMode = getRequestBodyMode();
  }
}

function loadModesFromTab(){
  const t = tabs[currentTab];

  // Response mode
  const resMode = (t && t.responseMode) || 'merge';
  const resEl = document.querySelector(`input[name="responseMode"][value="${resMode}"]`);
  if(resEl) resEl.checked = true;
  onResponseModeChange();

  // Request mode
  const reqMode = (t && t.requestBodyMode) || 'merge';
  const reqEl = document.querySelector(`input[name="requestMode"][value="${reqMode}"]`);
  if(reqEl) reqEl.checked = true;
  onRequestModeChange();
}

/* end response/request mode */

/* ════════════════════════════════════════════════════════
   INTERCEPT TARGET — response | request | both
   ════════════════════════════════════════════════════════ */

function getInterceptTarget(){
  const el = document.querySelector('input[name="interceptTarget"]:checked');
  return el ? el.value : 'response';
}

function onTargetChange(){
  const target = getInterceptTarget();
  const isAsync = document.querySelector('input[name="asyncMode"]:checked')?.value !== 'off';
  const hasData = data && Object.keys(data).length > 0;
  const isRequestOnly = target === 'request';
  const includesResponse = target === 'response' || target === 'both';
  const includesRequest = target === 'request' || target === 'both';

  // Request body card — show when target includes request
  const reqCard = document.getElementById('requestBodyCard');
  if(reqCard) reqCard.classList.toggle('hidden', isAsync || !includesRequest);

  // Response JSON card (paste JSON) — always visible so user can paste
  // but label and mode toggle reflect the target
  const jsonCardLabel = document.getElementById('jsonCardLabel');
  if(jsonCardLabel){
    if(isRequestOnly) jsonCardLabel.textContent = 'Response JSON';
    else jsonCardLabel.textContent = target === 'both' ? 'Response JSON' : 'Response JSON';
  }

  // Response mode toggle — only relevant when target includes response
  const responseModeToggle = document.getElementById('responseModeToggle');
  const _isAsyncNow = (document.querySelector('input[name="asyncMode"]:checked')?.value||'off') !== 'off';
  if(responseModeToggle) responseModeToggle.style.display = (!_isAsyncNow && includesResponse) ? 'flex' : 'none';

  // Viewer/options/rules — only show when target includes response AND data loaded
  const viewerCard = document.getElementById('viewerCard');
  const responseOptionsCard = document.getElementById('responseOptionsCard');
  const responseRulesCard = document.getElementById('responseRulesCard');

  if(hasData){
    if(viewerCard) viewerCard.classList.toggle('hidden', isRequestOnly || getResponseMode()==='replace');
    if(responseOptionsCard) responseOptionsCard.classList.toggle('hidden', isRequestOnly);
    if(responseRulesCard) responseRulesCard.classList.toggle('hidden', isRequestOnly);
  }

  // JSON card and generate visibility handled by updateVisibility
  if(jsonCardLabel) jsonCardLabel.textContent = 'Response JSON';

  // Show reqViewer when request data is loaded
  const reqViewerCard = document.getElementById('reqViewerCard');
  if(reqViewerCard){
    const hasReqData2 = reqData && Object.keys(reqData).length > 0;
    reqViewerCard.classList.toggle('hidden', !includesRequest || !hasReqData2);
  }

  updateVisibility();
  updateFallbackRowVisibility();
  persistSession();
}

function getRequestBodyMods(){
  if(reqData && Object.keys(reqData).length > 0){
    return buildTrackedObject(reqData, reqChanges, reqDeletions, reqAdditions);
  }
  const ta = document.getElementById('requestBodyInput');
  if(ta && ta.value.trim()){
    try{ return JSON.parse(ta.value); } catch(e){ return null; }
  }
  return null;
}

/* Save/restore target with tab state */
function saveTargetToTab(){
  if(tabs[currentTab]) tabs[currentTab].interceptTarget = getInterceptTarget();
}

function loadTargetFromTab(){
  const t = tabs[currentTab];
  const target = (t && t.interceptTarget) || 'response';
  const el = document.querySelector(`input[name="interceptTarget"][value="${target}"]`);
  if(el) el.checked = true;
  // Also save request body
  if(t && t.requestBody){
    const ta = document.getElementById('requestBodyInput');
    if(ta) ta.value = t.requestBody;
  }
  reqData = (t && t.reqData) || {};
  reqChanges = (t && t.reqChanges) || [];
  reqDeletions = (t && t.reqDeletions) || [];
  reqAdditions = (t && t.reqAdditions) || [];
  reqCollapsed = (t && t.reqCollapsed) || {};
  const _fbEl = document.getElementById('fallbackEnabled');
  const _ftEl = document.getElementById('fallbackTimeout');
  if(_fbEl) _fbEl.checked = (t && t.fallbackEnabled) || false;
  if(_ftEl) _ftEl.value = (t && t.fallbackTimeout) || 30;
  onFallbackChange();
  updateFallbackRowVisibility();
  const _fbaEl = document.getElementById('fallbackEnabledAsync');
  const _ftaEl = document.getElementById('fallbackTimeoutAsync');
  if(_fbaEl) _fbaEl.checked = (t && t.fallbackEnabledAsync) || false;
  if(_ftaEl) _ftaEl.value = (t && t.fallbackTimeoutAsync) || 30;
  onFallbackChangeAsync();
  if(reqData && Object.keys(reqData).length > 0){
    renderReqTree();
    const vc = document.getElementById('reqViewerCard');
    if(vc) vc.classList.remove('hidden');
    updateReqChangesBadge();
  }
  onTargetChange();
  // Restore scriptUpToDate AFTER onTargetChange to prevent it being overridden
  if(t && t.scriptUpToDate === true && t.script){
    _loadingState = false;
    markScriptCurrent();
  } else if(t && t.scriptUpToDate === false && t.script){
    _loadingState = false;
    markScriptOutdated();
  } else {
    _loadingState = false;
    markScriptCurrent();
  }
}

/* end intercept target */


/* ════════════════════════════════════════════════════════
   REQUEST BODY EDITOR — mirrors response editor
   ════════════════════════════════════════════════════════ */

let _scriptUpToDate = false; // tracks if generated script matches current config
let _loadingState = false;   // prevents markScriptOutdated during tab/state load
let reqData = {};        // parsed request body
let reqChanges = [];     // field edits
let reqDeletions = [];   // deleted fields
let reqAdditions = [];   // added fields
let reqCollapsed = {};   // collapsed state for req tree
function loadReqJson(){
  const ta = document.getElementById('requestBodyInput');
  const errEl = document.getElementById('requestBodyError');
  if(!ta || !ta.value.trim()){
    if(errEl){ errEl.textContent='⚠ Paste JSON first'; errEl.style.display='block'; }
    return;
  }
  try {
    reqData = JSON.parse(ta.value);
    reqChanges = []; reqDeletions = []; reqAdditions = [];
    if(errEl) errEl.style.display = 'none';
    renderReqTree();
    const vc = document.getElementById('reqViewerCard');
    if(vc) vc.classList.remove('hidden');
    updateReqChangesBadge();
    markScriptOutdated();
    // Show generate button
    onTargetChange();
  } catch(e) {
    if(errEl){ errEl.textContent='⚠ Invalid JSON: '+e.message; errEl.style.display='block'; }
  }
}

function pasteReqFromClipboard(){
  navigator.clipboard.readText().then(text => {
    const ta = document.getElementById('requestBodyInput');
    if(ta){ ta.value = text; loadReqJson(); }
  }).catch(()=>{
    const ta = document.getElementById('requestBodyInput');
    if(ta) ta.focus();
  });
}


/* ════════════════════════════════════════════════════════
   REQUEST TREE HELPERS — mirrors response tree helpers
   ════════════════════════════════════════════════════════ */

function deleteReqNode(path, obj, key){
  const pathKey = JSON.stringify(path);
  const isAdded = reqAdditions.some(a => JSON.stringify(a.path) === pathKey);
  if(isAdded){
    if(Array.isArray(obj)) obj.splice(Number(key), 1);
    else delete obj[key];
    reqAdditions = reqAdditions.filter(a => JSON.stringify(a.path) !== pathKey);
  } else {
    const alreadyDeleted = reqDeletions.some(d => JSON.stringify(d) === pathKey);
    if(alreadyDeleted){
      reqDeletions = reqDeletions.filter(d => JSON.stringify(d) !== pathKey);
    } else {
      reqDeletions.push(path);
    }
  }
  renderReqTree();
}

function resetReqField(path){
  const pathKey = JSON.stringify(path);
  reqChanges = reqChanges.filter(c => JSON.stringify(c.path) !== pathKey);
  renderReqTree();
}

function showAddReqForm(obj, path, parent){
  const form = document.createElement('div');
  form.className = 'add-form';
  form.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap';

  const isArr = Array.isArray(obj);
  let keyInput = null;

  if(!isArr){
    keyInput = document.createElement('input');
    keyInput.placeholder = 'key';
    keyInput.className = 'inline-edit';
    keyInput.style.width = '90px';
    form.appendChild(keyInput);
  }

  const valInput = document.createElement('input');
  valInput.placeholder = 'value';
  valInput.className = 'inline-edit';
  valInput.style.width = '120px';
  form.appendChild(valInput);

  const okBtn = document.createElement('button');
  okBtn.className = 'add-btn';
  okBtn.textContent = '✓';
  okBtn.title = 'Add field';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'delete-btn';
  cancelBtn.textContent = '✕';
  cancelBtn.title = 'Cancel';

  form.appendChild(okBtn);
  form.appendChild(cancelBtn);
  parent.appendChild(form);
  (keyInput || valInput).focus();

  const commit = () => {
    const rawVal = valInput.value.trim();
    let val = rawVal;
    if(val === 'true') val = true;
    else if(val === 'false') val = false;
    else if(val === 'null') val = null;
    else if(!isNaN(val) && val !== '') val = Number(val);

    if(isArr){
      const idx = obj.length;
      obj.push(val);
      const newPath = [...path, String(idx)];
      reqAdditions.push({path: newPath, value: val});
    } else {
      const k = keyInput ? keyInput.value.trim() : '';
      if(!k){ keyInput && keyInput.focus(); return; }
      obj[k] = val;
      const newPath = [...path, k];
      reqAdditions.push({path: newPath, value: val});
    }
    form.remove();
    renderReqTree();
  };

  okBtn.onclick = (e) => { e.stopPropagation(); commit(); };
  cancelBtn.onclick = (e) => { e.stopPropagation(); form.remove(); };
  valInput.onkeydown = (e) => { if(e.key === 'Enter') commit(); if(e.key === 'Escape') form.remove(); };
  if(keyInput) keyInput.onkeydown = (e) => { if(e.key === 'Enter') valInput.focus(); if(e.key === 'Escape') form.remove(); };
}

/* end request tree helpers */

function updateReqChangesBadge(){
  if(reqChanges.length > 0 || reqDeletions.length > 0 || reqAdditions.length > 0) markScriptOutdated();
  const badge = document.getElementById('reqChangesBadge');
  const panel = document.getElementById('reqDiffPanel');
  const list  = document.getElementById('reqDiffList');
  const total = reqChanges.length + reqDeletions.length + reqAdditions.length;

  if(badge){
    badge.textContent = total + ' change' + (total!==1?'s':'');
    badge.classList.toggle('hidden', total===0);
  }
  if(!panel || !list) return;
  if(total===0){ panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  list.replaceChildren();

  reqChanges.forEach(ch => {
    const row = document.createElement('div');
    row.className = 'diff-row';
    const pathStr = ch.path.map(p=>isNaN(p)?p:`[${p}]`).join('.');
    const newStr = typeof ch.value==='string' ? `"${ch.value}"` : String(ch.value);
    appendDiffRowSummary(row, pathStr, newStr, 'diff-val');
    const resetBtn = document.createElement('button');
    resetBtn.className = 'diff-reset-btn'; resetBtn.title = 'Restore'; resetBtn.textContent = '↺';
    resetBtn.onclick = () => {
      const idx = reqChanges.findIndex(c=>JSON.stringify(c.path)===JSON.stringify(ch.path));
      if(idx!==-1) reqChanges.splice(idx,1);
      renderReqTree();
    };
    row.appendChild(resetBtn);
    list.appendChild(row);
  });

  reqDeletions.forEach(path => {
    const row = document.createElement('div');
    row.className = 'diff-row';
    const pathStr = path.map(p=>isNaN(p)?p:`[${p}]`).join('.');
    appendDiffRowSummary(row, pathStr, 'deleted', 'diff-val-del');
    const undoBtn = document.createElement('button');
    undoBtn.className = 'diff-reset-btn'; undoBtn.title = 'Undo deletion'; undoBtn.textContent = '↺';
    undoBtn.onclick = () => {
      reqDeletions.splice(reqDeletions.findIndex(d=>JSON.stringify(d)===JSON.stringify(path)),1);
      renderReqTree();
    };
    row.appendChild(undoBtn);
    list.appendChild(row);
  });

  reqAdditions.forEach(a => {
    const row = document.createElement('div');
    row.className = 'diff-row';
    const pathStr = a.path.map(p=>isNaN(p)?p:`[${p}]`).join('.');
    const valStr = typeof a.value==='string' ? `"${a.value}"` : String(a.value);
    appendDiffRowSummary(row, pathStr, `${valStr} (added)`, 'diff-val-add');
    list.appendChild(row);
  });
}

function renderReqTree(){
  const container = document.getElementById('reqViewerSection');
  if(!container) return;
  container.replaceChildren();
  walkReq(reqData, [], container);
  updateReqChangesBadge();
}

function walkReq(obj, path, parent){
  if(typeof obj !== 'object' || obj === null) return;
  const isArray = Array.isArray(obj);
  Object.keys(obj).forEach(key => {
    const div = document.createElement('div');
    div.className = 'node';
    const newPath = [...path, key];
    const pathKey = JSON.stringify(newPath);
    const isDeleted = reqDeletions.some(d => JSON.stringify(d) === pathKey);
    const isAdded = reqAdditions.some(a => JSON.stringify(a.path) === pathKey);

    if(typeof obj[key] === 'object' && obj[key] !== null){
      const isCollapsed = reqCollapsed[pathKey] || false;
      const isArr = Array.isArray(obj[key]);
      const childCount = Object.keys(obj[key]).length;

      const header = document.createElement('div');
      header.className = 'node-header';
      if(isDeleted) header.style.cssText = 'opacity:0.4;text-decoration:line-through;pointer-events:none';

      const arrow = document.createElement('span');
      arrow.className = 'tree-arrow';
      arrow.textContent = isCollapsed ? '▶' : '▼';

      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key-obj';
      keySpan.textContent = isArray ? `[${key}]` : key;

      const brace = document.createElement('span');
      brace.className = 'tree-brace';
      brace.textContent = ' ' + (isArr ? '[' : '{');

      header.appendChild(arrow);
      header.appendChild(keySpan);
      header.appendChild(brace);

      if(isArr){
        const badge = document.createElement('span');
        badge.className = 'array-badge';
        badge.textContent = childCount;
        header.appendChild(badge);
      }

      const count = document.createElement('span');
      count.style.cssText = 'color:var(--text-dim);font-size:11px;margin-left:4px';
      count.textContent = isCollapsed ? (isArr ? `${childCount} items` : `${childCount} keys`) : '';
      header.appendChild(count);

      if(isAdded){
        const lbl = document.createElement('span');
        lbl.className = 'node-added-label';
        lbl.textContent = 'added';
        header.appendChild(lbl);
      } else if(isDeleted){
        const lbl = document.createElement('span');
        lbl.className = 'node-deleted-label';
        lbl.textContent = 'deleted';
        header.appendChild(lbl);
      }

      if(!isDeleted){
        const addBtn = document.createElement('button');
        addBtn.className = 'add-btn';
        addBtn.title = 'Add field';
        addBtn.textContent = '+';
        addBtn.onclick = (e) => { e.stopPropagation(); showAddReqForm(obj[key], newPath, children); };
        header.appendChild(addBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.title = 'Delete this node';
        delBtn.textContent = '✕';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteReqNode(newPath, obj, key); };
        header.appendChild(delBtn);
      } else {
        const undoBtn = document.createElement('button');
        undoBtn.className = 'delete-btn';
        undoBtn.style.display = 'inline';
        undoBtn.title = 'Undo delete';
        undoBtn.textContent = '↺';
        undoBtn.onclick = (e) => { e.stopPropagation(); deleteReqNode(newPath, obj, key); };
        header.appendChild(undoBtn);
      }

      div.appendChild(header);

      const children = document.createElement('div');
      children.className = 'node-children';
      children.style.display = isCollapsed ? 'none' : 'block';

      const closing = document.createElement('div');
      closing.className = 'tree-brace';
      closing.style.cssText = 'padding:1px 4px;color:var(--text-dim)';
      closing.textContent = isArr ? ']' : '}';

      header.onclick = (e) => {
        if(e.target.classList.contains('add-btn') || e.target.classList.contains('delete-btn')) return;
        e.stopPropagation();
        reqCollapsed[pathKey] = !reqCollapsed[pathKey];
        const col = reqCollapsed[pathKey];
        arrow.textContent = col ? '▶' : '▼';
        children.style.display = col ? 'none' : 'block';
        closing.style.display = col ? 'none' : 'block';
        count.textContent = col ? (isArr ? `${childCount} items` : `${childCount} keys`) : '';
      };

      parent.appendChild(div);
      div.appendChild(children);
      div.appendChild(closing);
      walkReq(obj[key], newPath, children);

    } else {
      // Leaf node
      const changed = reqChanges.find(ch => JSON.stringify(ch.path) === pathKey);
      const val = obj[key];

      const keySpan = document.createElement('span');
      keySpan.className = 'tree-key';
      keySpan.textContent = (isArray ? `[${key}]` : key) + ': ';

      const displayVal = changed ? changed.value : val;
      const valSpan = document.createElement('span');
      if(isAdded){
        valSpan.className = 'value-string';
      } else if(changed){
        valSpan.className = 'value-changed';
      } else if(typeof val === 'string'){
        valSpan.className = 'value-string';
      } else if(typeof val === 'number'){
        valSpan.className = 'value-number';
      } else if(typeof val === 'boolean'){
        valSpan.className = 'value-bool';
      } else {
        valSpan.className = 'value-null';
      }
      valSpan.textContent = typeof displayVal === 'string' ? `"${displayVal}"` : String(displayVal);

      div.className = 'node node-leaf' + (isAdded ? ' node-added' : '') + (isDeleted ? ' node-deleted' : '');
      div.style.display = 'flex';
      div.style.alignItems = 'center';
      div.appendChild(keySpan);
      div.appendChild(valSpan);

      if(isAdded){
        const lbl = document.createElement('span');
        lbl.className = 'node-added-label';
        lbl.textContent = 'added';
        div.appendChild(lbl);
      }

      if(isDeleted){
        const lbl = document.createElement('span');
        lbl.className = 'node-deleted-label';
        lbl.textContent = 'deleted';
        div.appendChild(lbl);
        const undoBtn = document.createElement('button');
        undoBtn.className = 'delete-btn';
        undoBtn.style.display = 'inline';
        undoBtn.title = 'Undo delete';
        undoBtn.textContent = '↺';
        undoBtn.onclick = (e) => { e.stopPropagation(); deleteReqNode(newPath, obj, key); };
        div.appendChild(undoBtn);
      } else {
        if(changed){
          const resetBtn = document.createElement('button');
          resetBtn.className = 'field-reset-btn';
          resetBtn.title = 'Restore original';
          resetBtn.textContent = '↺';
          resetBtn.onclick = (e) => { e.stopPropagation(); resetReqField(newPath); };
          div.appendChild(resetBtn);
        }
        if(!isAdded){
          const delBtn = document.createElement('button');
          delBtn.className = 'delete-btn';
          delBtn.title = 'Delete this field';
          delBtn.textContent = '✕';
          delBtn.onclick = (e) => { e.stopPropagation(); deleteReqNode(newPath, obj, key); };
          div.appendChild(delBtn);
        } else {
          const delBtn = document.createElement('button');
          delBtn.className = 'delete-btn';
          delBtn.style.display = 'inline';
          delBtn.title = 'Remove added field';
          delBtn.textContent = '✕';
          delBtn.onclick = (e) => { e.stopPropagation(); deleteReqNode(newPath, obj, key); };
          div.appendChild(delBtn);
        }

        div.onclick = (e) => {
          e.stopPropagation();
          if(div.querySelector('input')) return;
          const original = changed ? changed.value : val;
          const input = document.createElement('input');
          input.className = 'inline-edit';
          input.value = typeof original === 'string' ? original : String(original);

          div.style.display = 'flex';
          div.style.alignItems = 'center';
          div.replaceChildren(keySpan, input);
          input.focus();
          input.select();

          let committed = false;
          const commit = () => {
            if(committed) return;
            committed = true;
            let newVal = input.value;
            if(newVal === 'true') newVal = true;
            else if(newVal === 'false') newVal = false;
            else if(newVal === 'null') newVal = null;
            else if(!isNaN(newVal) && newVal !== '') newVal = Number(newVal);

            const chIdx = reqChanges.findIndex(c => JSON.stringify(c.path) === pathKey);
            if(String(newVal) !== String(val)){
              if(chIdx !== -1) reqChanges[chIdx].value = newVal;
              else reqChanges.push({path: newPath, value: newVal});
            } else {
              if(chIdx !== -1) reqChanges.splice(chIdx, 1);
            }
            renderReqTree();
          };

          const outsideClick = (e) => {
            if(!input.contains(e.target)){
              document.removeEventListener('mousedown', outsideClick);
              commit();
            }
          };
          document.addEventListener('mousedown', outsideClick);

          input.onblur = () => setTimeout(() => { document.removeEventListener('mousedown', outsideClick); commit(); }, 100);
          input.onkeydown = (e) => {
            if(e.key === 'Enter'){ e.preventDefault(); document.removeEventListener('mousedown', outsideClick); commit(); }
            if(e.key === 'Escape'){ committed = true; document.removeEventListener('mousedown', outsideClick); renderReqTree(); }
          };
        };
      }

      parent.appendChild(div);
    }
  });

  // Root-level add field button
  if(path.length === 0){
    const addRootBtn = document.createElement('button');
    addRootBtn.style.cssText = 'margin-top:8px;font-size:12px;padding:4px 10px;background:transparent;border:1px dashed rgba(74,222,128,0.3);color:var(--green);border-radius:4px;cursor:pointer;';
    addRootBtn.textContent = '+ Add field';
    addRootBtn.onclick = () => { showAddReqForm(obj, [], parent); addRootBtn.remove(); };
    parent.appendChild(addRootBtn);
  }
}


function toggleCurlImport(){
  const area = document.getElementById('curlImportArea');
  const btn  = document.getElementById('curlToggleBtn');
  if(!area) return;
  const open = area.classList.toggle('open');
  if(btn) btn.style.color = open ? 'var(--accent)' : '';
  if(open) document.getElementById('curlInput').focus();
}

function parseCurl(){
  const raw = (document.getElementById('curlInput').value || '').trim();
  const errEl = document.getElementById('curlError');
  if(errEl) errEl.style.display = 'none';

  if(!raw){ showCurlError('Paste a cURL command first'); return; }

  try {
    // Extract URL — first quoted or unquoted arg after 'curl'
    const urlMatch = raw.match(/curl\s+(?:-[^\s']+\s+)*['"]?(https?:\/\/[^\s'"]+)['"]?/) ||
                     raw.match(/curl\s+['"]([^'"]+)['"]/);
    if(!urlMatch) { showCurlError('Could not find a URL in this cURL command'); return; }
    const fullUrl = urlMatch[1];

    // Extract path from URL
    let path = fullUrl;
    try {
      const u = new URL(fullUrl);
      path = u.pathname + (u.search || '');
    } catch(e) {}

    // Extract JSON body from --data, -d, --data-raw, --data-binary
    let jsonBody = null;
    const dataMatch = raw.match(/(?:--data(?:-raw|-binary)?|-d)\s+['"]([^'"]+)['"]/s) ||
                      raw.match(/(?:--data(?:-raw|-binary)?|-d)\s+(\{[\s\S]*?\})/);
    if(dataMatch){
      try { jsonBody = JSON.parse(dataMatch[1].replace(/\\"/g, '"')); }
      catch(e) { /* not JSON body */ }
    }

    // Extract response body from -D or inline JSON in URL (less common)
    // If no body, check if there's a JSON-like string anywhere
    if(!jsonBody){
      const jsonMatch = raw.match(/(\{[\s\S]+\})/);
      if(jsonMatch){
        try { jsonBody = JSON.parse(jsonMatch[1]); } catch(e){}
      }
    }

    // Apply URL
    if(urlInput) urlInput.value = path;
    updateTabName();

    // Route JSON body based on target mode
    const target = typeof getInterceptTarget === 'function' ? getInterceptTarget() : 'response';
    const includesRequest = target === 'request' || target === 'both';

    if(jsonBody){
      if(includesRequest){
        // Request or Both — put body into request body field
        const ri = document.getElementById('requestBodyInput');
        if(ri){
          ri.value = JSON.stringify(jsonBody, null, 2);
          loadReqJson();
        }
        // In Both mode also switch to requestBodyCard visible
        const rbc = document.getElementById('requestBodyCard');
        if(rbc) rbc.classList.remove('hidden');
      } else {
        // Response mode — put into response JSON field
        const ji = document.getElementById('jsonInput');
        if(ji){
          ji.value = JSON.stringify(jsonBody, null, 2);
          loadJson();
        }
      }
    }

    // Close cURL panel
    toggleCurlImport();
    document.getElementById('curlInput').value = '';

    // Flash success
    const dest = includesRequest ? 'request body' : 'response JSON';
    edFlash ? edFlash('✓ cURL imported — URL'+(jsonBody?` and ${dest} `:' ')+'extracted') :
      console.log('cURL imported');

    persistSession();
  } catch(e) {
    showCurlError('Parse error: ' + e.message);
  }
}

function showCurlError(msg){
  const el = document.getElementById('curlError');
  if(el){ el.textContent = '⚠ ' + msg; el.style.display = 'block'; }
}

/* ════════════════════════════════════════════════════════
   CUSTOM TEMPLATES
   ════════════════════════════════════════════════════════ */

const TEMPLATES_KEY = 'jedimock_templates';

function loadCustomTemplates(){
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); }
  catch(e){ return []; }
}

function saveCustomTemplates(templates){
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)); }
  catch(e){ console.warn('Failed to save templates'); }
}

function saveAsTemplate(){
  const ji = document.getElementById('jsonInput');
  if(!ji || !ji.value.trim()){ edFlash('⚠ Paste JSON first', 'var(--red)'); return; }

  // Validate JSON
  try { JSON.parse(ji.value); }
  catch(e){ edFlash('⚠ Invalid JSON — fix it first', 'var(--red)'); return; }

  // Show inline name input instead of prompt()
  const btn = document.querySelector('[onclick="saveAsTemplate()"]');
  if(!btn) return;

  // If already showing input, save it
  const existingInput = document.getElementById('templateNameInput');
  if(existingInput){
    const name = existingInput.value.trim();
    if(!name){ existingInput.focus(); return; }
    _doSaveTemplate(name, ji.value);
    existingInput.parentNode.replaceChild(btn, existingInput);
    return;
  }

  // Replace button with inline input
  const input = document.createElement('input');
  input.id = 'templateNameInput';
  input.style.cssText = 'font-size:12px;padding:4px 8px;background:var(--surface2);border:1px solid var(--accent);border-radius:5px;color:var(--text);outline:none;width:160px';
  input.placeholder = 'Template name…';
  input.value = tabs[currentTab]?.name || '';
  btn.parentNode.replaceChild(input, btn);
  input.focus();
  input.select();

  input.onkeydown = (e) => {
    if(e.key === 'Enter'){
      const name = input.value.trim();
      if(!name){ input.focus(); return; }
      _doSaveTemplate(name, ji.value);
      input.parentNode.replaceChild(btn, input);
    }
    if(e.key === 'Escape'){
      input.parentNode.replaceChild(btn, input);
    }
  };
  input.onblur = () => {
    // Small delay so Enter key fires first
    setTimeout(()=>{
      const still = document.getElementById('templateNameInput');
      if(still) still.parentNode.replaceChild(btn, still);
    }, 200);
  };
}

function _doSaveTemplate(name, jsonStr){
  const templates = loadCustomTemplates();
  const existing = templates.findIndex(t => t.name === name);
  if(existing !== -1){
    templates[existing] = { name, json: jsonStr };
  } else {
    templates.push({ name, json: jsonStr });
  }
  saveCustomTemplates(templates);
  renderCustomTemplates();
  edFlash('★ Template "'+name+'" saved');
}

function applyCustomTemplate(name){
  const templates = loadCustomTemplates();
  const t = templates.find(t => t.name === name);
  if(!t) return;
  const ji = document.getElementById('jsonInput');
  if(ji){ ji.value = t.json; loadJson(); }
}

function deleteCustomTemplate(name, e){
  e.stopPropagation();
  e.preventDefault();
  const templates = loadCustomTemplates().filter(t => t.name !== name);
  saveCustomTemplates(templates);
  renderCustomTemplates();
  edFlash('Template "'+name+'" deleted');
}

function renderCustomTemplates(){
  const container = document.getElementById('customTemplatePills');
  if(!container) return;
  const templates = loadCustomTemplates();
  container.replaceChildren();
  if(templates.length === 0){ container.style.display = 'none'; return; }
  container.style.display = 'flex';
  templates.forEach(t => {
    const pill = document.createElement('span');
    pill.className = 'template-pill custom';
    pill.title = 'Apply template: ' + t.name;
    pill.onclick = () => applyCustomTemplate(t.name);

    const label = document.createElement('span');
    label.textContent = '★ ' + t.name;

    const del = document.createElement('span');
    del.className = 'template-pill-delete';
    del.textContent = '✕';
    del.title = 'Delete template';
    del.onclick = (e) => { e.stopPropagation(); e.preventDefault(); deleteCustomTemplate(t.name, e); };

    pill.appendChild(label);
    pill.appendChild(del);
    container.appendChild(pill);
  });
}

/* ════════════════════════════════════════════════════════
   ONBOARDING
   ════════════════════════════════════════════════════════ */

function showOnboarding(){
  const el = document.getElementById('onboardingOverlay');
  if(el) el.style.display = 'flex';
}

function dismissOnboarding(){
  const el = document.getElementById('onboardingOverlay');
  if(el) el.style.display = 'none';
  try { localStorage.setItem('jedimock_onboarded', '1'); } catch(e){}
}

function checkOnboarding(){
  try {
    const done = localStorage.getItem('jedimock_onboarded');
    if(!done) showOnboarding();
  } catch(e){}
}

/* ════════════════════════════════════════════════════════
   KEYBOARD SHORTCUTS PANEL
   ════════════════════════════════════════════════════════ */

function showShortcuts(){
  const el = document.getElementById('shortcutsOverlay');
  if(el) el.style.display = 'flex';
}

function closeShortcuts(){
  const el = document.getElementById('shortcutsOverlay');
  if(el) el.style.display = 'none';
}

/* end new features */


/* ════════════════════════════════════════════════════════
   SIDEBAR — auto collapse based on screen width
   ════════════════════════════════════════════════════════ */

// Sidebar collapse handled purely by CSS media query

/* end sidebar collapse */








/* ════════════════════════════════════════════════════════
   SIDEBAR OVERLAY — small screens only (≤900px)
   ════════════════════════════════════════════════════════ */

function toggleSidebarOverlay(){
  const sidebar = document.querySelector('.sidebar');
  const isOpen = sidebar.classList.contains('open');
  if(isOpen) closeSidebar(); else openSidebar();
}

function openSidebar(){
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const tab = document.getElementById('sidebarToggleTab');
  sidebar.classList.add('open');
  if(backdrop) backdrop.classList.add('open');
  if(tab) tab.classList.add('sidebar-open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar(){
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const tab = document.getElementById('sidebarToggleTab');
  sidebar.classList.remove('open');
  if(backdrop) backdrop.classList.remove('open');
  if(tab) tab.classList.remove('sidebar-open');
  document.body.style.overflow = '';
}

/* Close sidebar when switching tools on small screens */
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    btn.addEventListener('click', ()=>{
      if(window.innerWidth <= 900) closeSidebar();
    });
  });
});

/* end sidebar overlay */


/* ════════════════════════════════════════════════════════
   SCRIPT OBFUSCATION — light, deters casual reading
   ════════════════════════════════════════════════════════ */

function _jmObfuscate(code){
  // Encode string literals (except console.log prefixes we want readable)
  // Minify whitespace
  let out = code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/[\n\r]+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Wrap in self-executing function with encoded var names
  const varMap = {
    '_fetch': '_f0',
    '_xhrOpen': '_x0',
    '_xhrSend': '_x1',
    '_jmHandled': '_h0',
    '_jmPattern': '_p0',
    '_jmTab': '_t0',
    '_jmStart': '_s0',
    '_mockStatus': '_ms',
    '_mockDelay': '_md',
    '_reqMods': '_rm',
    '_reqMode': '_rx',
    '_rulesScript': '',
  };
  Object.entries(varMap).forEach(([k,v]) => {
    if(v) out = out.split(k).join(v);
  });

  return out;
}

function _jmBuildMeta(t, target, responseMode, rulesEnabled, rules){
  const meta = document.getElementById('scriptMeta');
  if(!meta) return;
  const isAsync = (t.asyncProtocol||'off') !== 'off';
  const rows = [];
  const addRow = (label, value, options={})=>{
    const row = document.createElement('div');
    const labelEl = document.createElement('span');
    labelEl.style.color = 'var(--text-dim)';
    labelEl.textContent = label;
    row.appendChild(labelEl);
    row.appendChild(document.createTextNode(' '));

    let valueEl;
    if(options.code){
      valueEl = document.createElement('code');
      valueEl.style.color = 'var(--accent)';
    } else if(options.emphasis){
      valueEl = document.createElement('span');
      valueEl.style.color = 'var(--accent)';
      valueEl.style.fontWeight = '600';
    } else {
      valueEl = document.createElement('span');
    }
    valueEl.textContent = value;
    row.appendChild(valueEl);
    rows.push(row);
  };

  if(isAsync){
    addRow('Mode', 'Async ID');
    addRow('Trigger', `${t.asyncTriggerMethod||'POST'} ${t.asyncTriggerUrl||'—'}`, { code: true });
    addRow('Response URL', t.asyncResponseUrl||'—', { code: true });
    if(t.fallbackEnabledAsync) addRow('Fallback', `${t.fallbackTimeoutAsync||30}s`, { emphasis: true });
  } else {
    addRow('URL pattern', t.url||'—', { code: true });
    addRow('Target', target.charAt(0).toUpperCase()+target.slice(1));
    if(target !== 'request') addRow('Response', responseMode === 'replace' ? 'Replace entirely' : 'Merge changes');
    if(target !== 'response') addRow('Request body', 'Modify');
    if(rulesEnabled && rules.length > 0) addRow('Rules', `${rules.length} active`, { emphasis: true });
    addRow('Status', `${t.statusCode||200}${t.responseDelay>0?' · '+t.responseDelay+'ms delay':''}`);
    if(t.fallbackEnabled) addRow('Fallback', `${t.fallbackTimeout||30}s`, { emphasis: true });
  }

  meta.replaceChildren(...rows);
}

/* end obfuscation */

// Restore session or load shared tab
if(!window.location.hash){
  // Auto-detect OS color scheme on first visit
  if(!localStorage.getItem('jedimock_v2')){
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if(!prefersDark){
      document.documentElement.setAttribute('data-theme','light');
    }
  }
  restoreSession();
}

// Init custom templates
renderCustomTemplates();


// Onboarding shown via button only — not auto

// Load shared tab on startup if hash present
loadSharedTab();

// Wire up persistence on editor data changes
document.addEventListener('DOMContentLoaded', ()=>{
  // Persist on validator input
  const vi = document.getElementById('validInput');
  if(vi) vi.addEventListener('input', persistSession);

  // Persist on beautifier input
  const bi = document.getElementById('beautInput');
  if(bi) bi.addEventListener('input', persistSession);

  // Persist on editor paste area
  const ea = document.getElementById('edPasteArea');
  if(ea) ea.addEventListener('input', persistSession);
});
