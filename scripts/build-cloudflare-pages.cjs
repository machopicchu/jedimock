const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const client = path.join(dist, 'client');
const files = [
  'index.html', 'app.html', 'extension-privacy.html', 'test-lab.html', 'styles.css', 'app.js',
  'jedimock-demo.gif', 'jedimock-icon.png', '_headers', 'README.md', 'CHANGELOG.md', 'LICENSE'
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(client, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(root, file), path.join(client, file));
fs.cpSync(path.join(root, 'lib'), path.join(client, 'lib'), { recursive: true });
console.log('Built the website for Cloudflare Pages in dist/client/');
