(function(global){
  const TAB_LIMIT = 100;
  const MAX_TAB_NAME_LEN = 80;
  const MAX_TEXT_FIELD_LEN = 2000;
  const MAX_PATH_SEGMENTS = 64;
  const MAX_CHANGE_ITEMS = 1000;
  const MAX_SHARE_HASH_CHARS = 120000;
  const MAX_SHARE_BYTES = 1024 * 1024;
  const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
  const MAX_JSON_DEPTH = 40;
  const MAX_JSON_KEYS = 1000;

  function isPlainObject(value){
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clampString(value, maxLen = MAX_TEXT_FIELD_LEN){
    if(value === null || value === undefined) return "";
    return String(value).slice(0, maxLen);
  }

  function clampNumber(value, fallback, min, max){
    const num = Number(value);
    if(!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function sanitizePathArray(path){
    if(!Array.isArray(path)) return [];
    return path
      .slice(0, MAX_PATH_SEGMENTS)
      .map(seg => {
        if(typeof seg === "number" && Number.isInteger(seg)) return seg;
        if(typeof seg === "string" && /^\d+$/.test(seg)) return seg;
        return clampString(seg, 200);
      });
  }

  function cloneJsonValue(value, depth = 0){
    if(depth > MAX_JSON_DEPTH) return null;
    if(value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    if(Array.isArray(value)) return value.slice(0, MAX_JSON_KEYS).map(v => cloneJsonValue(v, depth + 1));
    if(isPlainObject(value)){
      const out = {};
      Object.keys(value).slice(0, MAX_JSON_KEYS).forEach(key => {
        out[clampString(key, 200)] = cloneJsonValue(value[key], depth + 1);
      });
      return out;
    }
    return null;
  }

  function sanitizeChangeList(list){
    if(!Array.isArray(list)) return [];
    return list.slice(0, MAX_CHANGE_ITEMS).filter(isPlainObject).map(item => ({
      path: sanitizePathArray(item.path),
      value: cloneJsonValue(item.value)
    }));
  }

  function sanitizeDeletionList(list){
    if(!Array.isArray(list)) return [];
    return list.slice(0, MAX_CHANGE_ITEMS).map(sanitizePathArray);
  }

  function sanitizeCollapsedMap(map){
    if(!isPlainObject(map)) return {};
    const out = {};
    Object.keys(map).slice(0, MAX_JSON_KEYS).forEach(key => {
      out[clampString(key, 200)] = !!map[key];
    });
    return out;
  }

  function sanitizeRulesList(list){
    if(!Array.isArray(list)) return [];
    return list.slice(0, 200).filter(isPlainObject).map(rule => ({
      type: ["exact","after","always"].includes(rule.type) ? rule.type : "exact",
      call: clampNumber(rule.call, 1, 1, 100000),
      status: clampNumber(rule.status, 200, 100, 599),
      delay: clampNumber(rule.delay, 0, 0, 300000),
      json: clampString(rule.json, MAX_SHARE_BYTES)
    }));
  }

  function sanitizeTabState(tab, fallbackName = "Tab 1"){
    const t = isPlainObject(tab) ? tab : {};
    return {
      name: clampString(t.name || fallbackName, MAX_TAB_NAME_LEN) || fallbackName,
      data: cloneJsonValue(t.data ?? {}),
      changes: sanitizeChangeList(t.changes),
      deletions: sanitizeDeletionList(t.deletions),
      additions: sanitizeChangeList(t.additions),
      url: clampString(t.url, MAX_TEXT_FIELD_LEN),
      mode: "fetch",
      asyncProtocol: t.asyncProtocol === "off" ? "off" : "fetch",
      rawJson: clampString(t.rawJson, MAX_SHARE_BYTES),
      script: clampString(t.script, MAX_SHARE_BYTES),
      asyncTriggerMethod: clampString(t.asyncTriggerMethod || "POST", 16).toUpperCase() || "POST",
      asyncTriggerUrl: clampString(t.asyncTriggerUrl, MAX_TEXT_FIELD_LEN),
      asyncResponseMethod: clampString(t.asyncResponseMethod || "GET", 16).toUpperCase() || "GET",
      asyncResponseUrl: clampString(t.asyncResponseUrl, MAX_TEXT_FIELD_LEN),
      asyncIdField: clampString(t.asyncIdField, 200),
      asyncIdPath: sanitizePathArray(t.asyncIdPath),
      asyncCaptureField: clampString(t.asyncCaptureField, 200),
      firestoreField: clampString(t.firestoreField, 200),
      firestoreValue: clampString(t.firestoreValue, 500),
      statusCode: String(clampNumber(t.statusCode, 200, 100, 599)),
      responseDelay: clampNumber(t.responseDelay, 0, 0, 300000),
      interceptTarget: ["response","request","both"].includes(t.interceptTarget) ? t.interceptTarget : "response",
      responseMode: ["merge","replace"].includes(t.responseMode) ? t.responseMode : "merge",
      requestBodyMode: ["merge","replace"].includes(t.requestBodyMode) ? t.requestBodyMode : "merge",
      requestBody: clampString(t.requestBody, MAX_SHARE_BYTES),
      reqData: cloneJsonValue(t.reqData ?? {}),
      reqChanges: sanitizeChangeList(t.reqChanges),
      reqDeletions: sanitizeDeletionList(t.reqDeletions),
      reqAdditions: sanitizeChangeList(t.reqAdditions),
      reqCollapsed: sanitizeCollapsedMap(t.reqCollapsed),
      fallbackEnabled: !!t.fallbackEnabled,
      fallbackTimeout: clampNumber(t.fallbackTimeout, 30, 1, 300),
      fallbackEnabledAsync: !!t.fallbackEnabledAsync,
      fallbackTimeoutAsync: clampNumber(t.fallbackTimeoutAsync, 30, 1, 300),
      rules: sanitizeRulesList(t.rules),
      rulesEnabled: !!t.rulesEnabled,
      scriptUpToDate: !!t.scriptUpToDate
    };
  }

  function bytesToBase64Url(bytes){
    if(typeof btoa === "function"){
      let bin = "";
      const chunkSize = 0x8000;
      for(let i = 0; i < bytes.length; i += chunkSize){
        bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
    }
    return Buffer.from(bytes).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
  }

  function base64UrlToBytes(b64){
    const normalized = String(b64).replace(/-/g,"+").replace(/_/g,"/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    if(typeof atob === "function"){
      const bin = atob(padded);
      return Uint8Array.from(bin, c => c.charCodeAt(0));
    }
    return Uint8Array.from(Buffer.from(padded, "base64"));
  }

  function isArrayIndexSegment(segment){
    return typeof segment === "number" || (typeof segment === "string" && /^(0|[1-9]\d*)$/.test(segment));
  }

  function isSafeJsIdentifier(segment){
    return typeof segment === "string" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment);
  }

  function formatPath(path){
    return path.map(segment => {
      if(isArrayIndexSegment(segment)) return `[${segment}]`;
      if(isSafeJsIdentifier(segment)) return `.${segment}`;
      return `[${JSON.stringify(String(segment))}]`;
    }).join("");
  }

  function formatReadablePath(path){
    const raw = formatPath(path);
    return raw.startsWith(".") ? raw.slice(1) : raw;
  }

  function setValueAtPath(obj, path, value){
    let ref = obj;
    for(let i = 0; i < path.length - 1; i++){
      ref = ref[path[i]];
      if(ref === undefined || ref === null) return;
    }
    ref[path[path.length - 1]] = value;
  }

  function deleteValueAtPath(obj, path){
    let ref = obj;
    for(let i = 0; i < path.length - 1; i++){
      ref = ref[path[i]];
      if(ref === undefined || ref === null) return;
    }
    if(Array.isArray(ref)) ref.splice(Number(path[path.length - 1]), 1);
    else delete ref[path[path.length - 1]];
  }

  function buildTrackedObject(baseObj, changesList, deletionsList, additionsList){
    const next = JSON.parse(JSON.stringify(baseObj));
    changesList.forEach(ch => setValueAtPath(next, ch.path, ch.value));
    deletionsList.forEach(path => deleteValueAtPath(next, path));
    additionsList.forEach(a => setValueAtPath(next, a.path, a.value));
    return next;
  }

  function buildTrackedModsScript(varName, changesList, deletionsList, additionsList, indent){
    let out = "";
    changesList.forEach(ch => {
      out += `${indent}${varName}${formatPath(ch.path)} = ${JSON.stringify(ch.value)};\n`;
    });
    deletionsList.forEach(path => {
      out += `${indent}delete ${varName}${formatPath(path)};\n`;
    });
    additionsList.forEach(a => {
      out += `${indent}${varName}${formatPath(a.path)} = ${JSON.stringify(a.value)};\n`;
    });
    return out;
  }

  const api = {
    TAB_LIMIT,
    MAX_TAB_NAME_LEN,
    MAX_TEXT_FIELD_LEN,
    MAX_PATH_SEGMENTS,
    MAX_CHANGE_ITEMS,
    MAX_SHARE_HASH_CHARS,
    MAX_SHARE_BYTES,
    MAX_IMPORT_FILE_BYTES,
    MAX_JSON_DEPTH,
    MAX_JSON_KEYS,
    isPlainObject,
    clampString,
    clampNumber,
    sanitizePathArray,
    cloneJsonValue,
    sanitizeChangeList,
    sanitizeDeletionList,
    sanitizeCollapsedMap,
    sanitizeRulesList,
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
  };

  global.JediMockCore = api;
  if(typeof module !== "undefined" && module.exports){
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
