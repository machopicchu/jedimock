const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../lib/app-core.js');
const store = require('../lib/session-store.js');

test('buildSessionPayload creates a serializable payload shell', () => {
  const payload = store.buildSessionPayload({
    storageVersion: 1,
    tabs: [{ name: 'Tab 1' }],
    currentTab: 0,
    activeTool: 'mock',
    theme: 'dark',
    editorJson: '{"ok":true}',
    validatorInput: '{"a":1}',
    beautInput: '{"b":2}'
  });

  assert.equal(payload.v, 1);
  assert.equal(payload.activeTool, 'mock');
  assert.equal(payload.theme, 'dark');
  assert.equal(payload.editorJson, '{"ok":true}');
  assert.equal(Array.isArray(payload.tabs), true);
  assert.equal(typeof payload.ts, 'number');
});

test('sanitizeStoredPayload normalizes tabs and clamps currentTab', () => {
  const payload = {
    v: 1,
    tabs: [
      { name: 'A', statusCode: 700, responseDelay: -10 },
      { name: 'B', asyncProtocol: 'weird' }
    ],
    currentTab: 99,
    activeTool: 'diff',
    theme: 'light',
    editorJson: '{"x":1}',
    validatorInput: 'bad',
    beautInput: 'pretty'
  };

  const next = store.sanitizeStoredPayload(payload, {
    storageVersion: 1,
    tabLimit: core.TAB_LIMIT,
    sanitizeTabState: core.sanitizeTabState
  });

  assert.equal(next.tabs.length, 2);
  assert.equal(next.tabs[0].statusCode, '599');
  assert.equal(next.tabs[0].responseDelay, 0);
  assert.equal(next.tabs[1].asyncProtocol, 'fetch');
  assert.equal(next.currentTab, 1);
  assert.equal(next.activeTool, 'diff');
  assert.equal(next.theme, 'light');
  assert.equal(next.editorJson, '{"x":1}');
});

test('sanitizeStoredPayload rejects wrong versions', () => {
  const next = store.sanitizeStoredPayload({ v: 2 }, {
    storageVersion: 1,
    tabLimit: core.TAB_LIMIT,
    sanitizeTabState: core.sanitizeTabState
  });
  assert.equal(next, null);
});
