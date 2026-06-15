const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../lib/app-core.js');

test('sanitizeTabState clamps and normalizes tab state', () => {
  const dirty = {
    name: 'x'.repeat(200),
    url: '/api/users',
    asyncProtocol: 'weird',
    statusCode: 9999,
    responseDelay: -50,
    interceptTarget: 'nope',
    responseMode: 'replace',
    requestBodyMode: 'replace',
    changes: [{ path: ['name'], value: 'Leia' }],
    deletions: [['old']],
    additions: [{ path: ['extra'], value: true }],
    rules: [{ type: 'always', call: 2, status: 201, delay: 50, json: '{"ok":true}' }]
  };

  const next = core.sanitizeTabState(dirty, 'Tab 1');
  assert.equal(next.name.length, core.MAX_TAB_NAME_LEN);
  assert.equal(next.asyncProtocol, 'fetch');
  assert.equal(next.statusCode, '599');
  assert.equal(next.responseDelay, 0);
  assert.equal(next.interceptTarget, 'response');
  assert.equal(next.responseMode, 'replace');
  assert.equal(next.requestBodyMode, 'replace');
  assert.deepEqual(next.changes[0], { path: ['name'], value: 'Leia' });
  assert.deepEqual(next.deletions[0], ['old']);
  assert.deepEqual(next.additions[0], { path: ['extra'], value: true });
  assert.equal(next.rules[0].status, 201);
});

test('formatPath handles identifiers, arrays, and quoted keys', () => {
  assert.equal(core.formatPath(['user', 0, 'display-name']), '.user[0]["display-name"]');
  assert.equal(core.formatReadablePath(['job', 'ids', 'public-id']), 'job.ids["public-id"]');
});

test('buildTrackedObject applies changes, deletions, and additions', () => {
  const base = {
    profile: { name: 'Luke', role: 'pilot' },
    tags: ['jedi', 'rebel']
  };

  const result = core.buildTrackedObject(
    base,
    [{ path: ['profile', 'name'], value: 'Leia' }],
    [['tags', 0]],
    [{ path: ['profile', 'active'], value: true }]
  );

  assert.deepEqual(result, {
    profile: { name: 'Leia', role: 'pilot', active: true },
    tags: ['rebel']
  });
  assert.deepEqual(base, {
    profile: { name: 'Luke', role: 'pilot' },
    tags: ['jedi', 'rebel']
  });
});

test('base64 url helpers round-trip bytes', () => {
  const input = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
  const encoded = core.bytesToBase64Url(input);
  const output = core.base64UrlToBytes(encoded);
  assert.deepEqual(Array.from(output), Array.from(input));
});

test('buildTrackedModsScript emits quoted paths for unsafe keys', () => {
  const script = core.buildTrackedModsScript(
    'data',
    [{ path: ['user name'], value: 'Leia' }],
    [['items', 0]],
    [{ path: ['job', 'public-id'], value: 'job-123' }],
    '  '
  );

  assert.match(script, /data\["user name"\] = "Leia";/);
  assert.match(script, /delete data\.items\[0\];/);
  assert.match(script, /data\.job\["public-id"\] = "job-123";/);
});

test('sanitizeRulesList drops invalid rules and clamps values', () => {
  const rules = core.sanitizeRulesList([
    { type: 'always', call: 2, status: 202, delay: 50, json: '{"ok":true}' },
    null,
    { type: 'weird', call: -1, status: 999, delay: -5, json: 'x' }
  ]);

  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0], { type: 'always', call: 2, status: 202, delay: 50, json: '{"ok":true}' });
  assert.deepEqual(rules[1], { type: 'exact', call: 1, status: 599, delay: 0, json: 'x' });
});
