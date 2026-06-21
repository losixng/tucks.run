const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.isFile() && p.endsWith('.js')) files.push(p);
  }
}
walk(root);
const searchHandler = /function openLightbox\(item\)\{/;
const existingStock = /if\(lbStock\) lbStock\.textContent/;
const addBlock = `currentItem = item;
  if(lbName) lbName.textContent = item.name || '';
  if(lbDesc) lbDesc.textContent = item.desc || '';
  if(lbPrice) lbPrice.textContent = moneyFmt(item.price);
  if(lbStock) lbStock.textContent = item.instock ? '✅ In stock' : '❌ Out of stock';
  if(lbBuy) {
    lbBuy.disabled = !item.instock;
    lbBuy.textContent = item.instock ? 'Buy Now' : 'Out of Stock';
  }
  if(lbAdd) {
    lbAdd.disabled = !item.instock;
    lbAdd.textContent = item.instock ? 'Add to Cart' : 'Out of Stock';
  }
`;
const modified = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (searchHandler.test(text) && !existingStock.test(text)) {
    const replaced = text.replace(/currentItem = item;\s*\n/, addBlock);
    if (replaced !== text) {
      fs.writeFileSync(file, replaced, 'utf8');
      modified.push(path.relative(root, file));
    }
  }
}
console.log('MODIFIED', modified.length);
modified.forEach(f => console.log(f));
