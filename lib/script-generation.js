(function(global){
  function wildcardToRegex(pattern){
    const escaped = String(pattern)
      .replace(/[-+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\./g, "\\.");
    return escaped.replace(/\*/g, "[^/?]+");
  }

  function generateRulesScript(rules){
    if(!rules || rules.length === 0) return "";
    return `
  // Response rules — stateful per-call mocking
  let _jmCallCount = 0;
  const _jmRules = ${JSON.stringify(rules)};

  function _jmGetResponse(_jmData){
    _jmCallCount++;
    // Find matching rule (last match wins)
    let matched = null;
    for(const r of _jmRules){
      if(r.type==='always') matched = r;
      else if(r.type==='exact' && _jmCallCount===r.call) matched = r;
      else if(r.type==='after' && _jmCallCount>r.call) matched = r;
    }
    if(!matched) return { data:_jmData, status:${200}, delay:0 };
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
    wildcardToRegex,
    generateRulesScript
  };

  global.JediMockScriptGen = api;
  if(typeof module !== "undefined" && module.exports){
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
