(function(global){
  function buildSessionPayload(options){
    const {
      storageVersion,
      tabs,
      currentTab,
      activeTool,
      theme,
      editorJson,
      validatorInput,
      beautInput
    } = options;

    return {
      v: storageVersion,
      ts: Date.now(),
      tabs,
      currentTab,
      activeTool: activeTool || "mock",
      theme: theme || "dark",
      editorJson: editorJson || null,
      validatorInput: validatorInput || "",
      beautInput: beautInput || ""
    };
  }

  function sanitizeStoredPayload(payload, options){
    const {
      storageVersion,
      tabLimit,
      sanitizeTabState
    } = options;

    if(!payload || payload.v !== storageVersion) return null;

    const rawTabs = Array.isArray(payload.tabs) ? payload.tabs.slice(0, tabLimit) : [];
    const tabs = rawTabs.map((tab, index) => sanitizeTabState(tab, "Tab " + (index + 1)));

    return {
      tabs,
      currentTab: tabs.length ? Math.min(Number(payload.currentTab) || 0, tabs.length - 1) : 0,
      activeTool: typeof payload.activeTool === "string" ? payload.activeTool : "mock",
      theme: typeof payload.theme === "string" ? payload.theme : "dark",
      editorJson: typeof payload.editorJson === "string" ? payload.editorJson : null,
      validatorInput: typeof payload.validatorInput === "string" ? payload.validatorInput : "",
      beautInput: typeof payload.beautInput === "string" ? payload.beautInput : ""
    };
  }

  const api = {
    buildSessionPayload,
    sanitizeStoredPayload
  };

  global.JediMockSessionStore = api;
  if(typeof module !== "undefined" && module.exports){
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
