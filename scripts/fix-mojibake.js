const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const exts = ['.html', '.htm', '.js', '.css'];

const replacements = [
  { from: /—/g, to: '—' }, // em dash
  { from: /₦/g, to: '₦' }, // naira sign
  { from: /•/g, to: '•' }, // bullet variant
  { from: /•/g, to: '•' },
  { from: /–/g, to: '–' }, // en dash
  { from: /’/g, to: '’' }, // apostrophe
  { from: /₦/g, to: '₦' },
  { from: /₦/g, to: '₦' }
];

function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (it.name === 'node_modules' || it.name === '.git') continue;
      walk(full);
    } else {
      if (!exts.includes(path.extname(it.name).toLowerCase())) continue;
      try {
        let content = fs.readFileSync(full, 'utf8');
        let out = content;
        for (const r of replacements) out = out.replace(r.from, r.to);
        if (out !== content) {
          fs.writeFileSync(full + '.bak', content, 'utf8');
          fs.writeFileSync(full, out, 'utf8');
          console.log('Fixed:', full);
        }
      } catch (e) {
        console.error('Error processing', full, e.message);
      }
    }
  }
}

walk(root);
console.log('Done');
