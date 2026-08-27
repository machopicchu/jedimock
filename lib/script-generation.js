(function(global){
  const HTTP_METHODS = new Set(["ANY","GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"]);

  function normalizeHttpMethod(value){
    const method = String(value || "ANY").toUpperCase();
    return HTTP_METHODS.has(method) ? method : "ANY";
  }

  function normalizeUrlMatchMode(value){
    return ["exact","contains","pattern"].includes(value) ? value : "contains";
  }

  function wildcardToRegex(pattern){
    const source = String(pattern);
    const escaped = source
      .replace(/[-+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\./g, "\\.");
    const regex = escaped.replace(/\*/g, "[^/?&#]+");
    if(!source.endsWith("*")) return regex;
    const queryIndex = source.indexOf("?");
    const starIsInQuery = queryIndex !== -1 && source.lastIndexOf("*") > queryIndex;
    return regex + (starIsInQuery ? "(?=[&#]|$)" : "(?=[?&#]|$)");
  }

  function urlMatches(value, pattern, mode = "contains", baseUrl = "http://localhost/"){
    const candidate = String(value || "");
    const targetPattern = String(pattern || "");
    const matchMode = normalizeUrlMatchMode(mode);
    if(!targetPattern) return false;
    if(matchMode === "contains") return candidate.includes(targetPattern);
    if(matchMode === "pattern") return new RegExp(wildcardToRegex(targetPattern)).test(candidate);

    try{
      const base = new URL(baseUrl, "http://localhost/");
      const root = base.origin + "/";
      const actual = new URL(candidate, base.href);
      const expected = new URL(targetPattern, root);
      const absolutePattern = /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(targetPattern);
      if(absolutePattern && actual.origin !== expected.origin) return false;
      if(actual.pathname !== expected.pathname) return false;
      return !targetPattern.includes("?") || actual.search === expected.search;
    }catch(e){
      const stripHash = text => text.split("#")[0];
      const [actualPath, actualQuery = ""] = stripHash(candidate).split("?");
      const [expectedPath, expectedQuery = ""] = stripHash(targetPattern).split("?");
      return actualPath === expectedPath && (!targetPattern.includes("?") || actualQuery === expectedQuery);
    }
  }

  function requestMatches(value, actualMethod, pattern, mode = "contains", configuredMethod = "ANY", baseUrl){
    const expectedMethod = normalizeHttpMethod(configuredMethod);
    const method = normalizeHttpMethod(actualMethod || "GET");
    return (expectedMethod === "ANY" || method === expectedMethod) && urlMatches(value, pattern, mode, baseUrl);
  }

  function generateRequestMatcherScript(pattern, mode = "contains", configuredMethod = "ANY"){
    const safePattern = String(pattern || "");
    const safeMode = normalizeUrlMatchMode(mode);
    const safeMethod = normalizeHttpMethod(configuredMethod);
    const regex = wildcardToRegex(safePattern);
    return `  const _jmPattern = ${JSON.stringify(safePattern)};
  const _jmMatchMode = ${JSON.stringify(safeMode)};
  const _jmMatchMethod = ${JSON.stringify(safeMethod)};
  function _jmMatchesUrl(value) {
    const candidate = String(value || '');
    if(!_jmPattern) return false;
    if(_jmMatchMode === 'contains') return candidate.includes(_jmPattern);
    if(_jmMatchMode === 'pattern') return new RegExp(${JSON.stringify(regex)}).test(candidate);
    try {
      const root = location.origin + '/';
      const actual = new URL(candidate, location.href);
      const expected = new URL(_jmPattern, root);
      const absolutePattern = /^[A-Za-z][A-Za-z\\d+.-]*:\\/\\//.test(_jmPattern);
      if(absolutePattern && actual.origin !== expected.origin) return false;
      if(actual.pathname !== expected.pathname) return false;
      return !_jmPattern.includes('?') || actual.search === expected.search;
    } catch(e) {
      const stripHash = text => text.split('#')[0];
      const actualParts = stripHash(candidate).split('?');
      const expectedParts = stripHash(_jmPattern).split('?');
      return actualParts[0] === expectedParts[0] && (!_jmPattern.includes('?') || (actualParts[1] || '') === (expectedParts[1] || ''));
    }
  }
  function _jmMatchesRequest(value, method) {
    const actualMethod = String(method || 'GET').toUpperCase();
    return (_jmMatchMethod === 'ANY' || actualMethod === _jmMatchMethod) && _jmMatchesUrl(value);
  }`;
  }

  function generateRulesScript(rules, defaultStatus = 200, defaultDelay = 0){
    if(!rules || rules.length === 0) return "";
    const safeDefaultStatus = Math.min(599, Math.max(100, Number(defaultStatus) || 200));
    const safeDefaultDelay = Math.min(300000, Math.max(0, Number(defaultDelay) || 0));
    return `
  // Response rules — stateful per-call mocking
  let _jmCallCount = 0;
  const _jmRules = ${JSON.stringify(rules)};

  function _jmGetResponse(_jmData){
    _jmCallCount++;
    // Specific calls win over thresholds; thresholds win over Always.
    let exact = null;
    let after = null;
    let always = null;
    for(const r of _jmRules){
      if(r.type==='exact' && _jmCallCount===r.call) exact = r;
      else if(r.type==='after' && _jmCallCount>r.call && (!after || r.call>=after.call)) after = r;
      else if(r.type==='always') always = r;
    }
    const matched = exact || after || always;
    if(!matched) return { data:_jmData, status:${safeDefaultStatus}, delay:${safeDefaultDelay} };
    const data = matched.json ? JSON.parse(matched.json) : _jmData;
    console.log('%c⚡ JediMock rule matched', 'color:#00D4FF;font-weight:bold;font-size:12px', {
      rule: matched.type==='exact'?'Call #'+matched.call : matched.type==='after'?'After #'+matched.call : 'Always',
      status: matched.status, call: _jmCallCount
    });
    return { data, status:matched.status, delay:matched.delay||0 };
  }
`;
  }

  const api = {
    normalizeHttpMethod,
    normalizeUrlMatchMode,
    wildcardToRegex,
    urlMatches,
    requestMatches,
    generateRequestMatcherScript,
    generateRulesScript
  };

  global.JediMockScriptGen = api;
  if(typeof module !== "undefined" && module.exports){
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
