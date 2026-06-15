const test = require('node:test');
const assert = require('node:assert/strict');

const scriptGen = require('../lib/script-generation.js');

test('wildcardToRegex keeps path segments scoped', () => {
  assert.equal(scriptGen.wildcardToRegex('/api/users/*'), '/api/users/[^/?]+');
  assert.equal(scriptGen.wildcardToRegex('/api/jobs/status?id=*'), '/api/jobs/status\\?id=[^/?]+');
});

test('generateRulesScript embeds rule state and matcher logic', () => {
  const script = scriptGen.generateRulesScript([
    { type: 'exact', call: 2, status: 202, delay: 120, json: '{"ok":true}' }
  ]);

  assert.match(script, /let _jmCallCount = 0;/);
  assert.match(script, /const _jmRules = \[\{"type":"exact","call":2,"status":202,"delay":120,"json":"\{\\"ok\\":true\}"\}\];/);
  assert.match(script, /matched\.type==='exact'/);
  assert.match(script, /delay:matched\.delay\|\|0/);
});
