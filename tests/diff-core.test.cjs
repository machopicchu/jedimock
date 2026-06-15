const test = require('node:test');
const assert = require('node:assert/strict');

const diffCore = require('../lib/diff-core.js');

test('sanitizeJson escapes control characters inside strings', () => {
  const input = '{"message":"hello\nworld"}';
  const output = diffCore.sanitizeJson(input);
  assert.equal(output, '{"message":"hello\\nworld"}');
});

test('computeLineDiff groups changed lines into paired rows', () => {
  const result = diffCore.computeLineDiff(
    ['alpha', 'beta', 'delta'],
    ['alpha', 'gamma', 'delta']
  );

  assert.deepEqual(result, [
    { type: 'same', l: 'alpha', r: 'alpha' },
    { type: 'change', l: 'beta', r: 'gamma' },
    { type: 'same', l: 'delta', r: 'delta' }
  ]);
});

test('inlineDiff highlights changed fragments', () => {
  const html = diffCore.inlineDiff('status=200', 'status=202', value => {
    return value;
  });

  assert.match(html.left, /<mark class="diff-word-left">0<\/mark>/);
  assert.match(html.right, /<mark class="diff-word-right">2<\/mark>/);
});
