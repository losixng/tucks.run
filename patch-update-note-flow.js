const fs = require('fs');
const path = require('path');
const root = process.cwd();
let changed = 0;
function save(file, content){ fs.writeFileSync(file, content, 'utf8'); changed++; }
function walk(dir, extensions){
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for(const entry of entries){
    const fullPath = path.join(dir, entry.name);
    if(entry.isDirectory()){
      if(entry.name === 'node_modules') continue;
      results.push(...walk(fullPath, extensions));
    } else if(entry.isFile()){
      if(extensions.some(ext => fullPath.toLowerCase().endsWith(ext))) results.push(path.relative(root, fullPath));
    }
  }
  return results;
}
const htmlFiles = walk(root, ['.html']);
const jsFiles = walk(root, ['.js']);

// Patch CSS
const cssFile = path.join(root,'clothes','clothes-theme.css');
if(fs.existsSync(cssFile)){
  let css = fs.readFileSync(cssFile,'utf8');
  const newCss = css.replace(/\.modal\s*\{([\s\S]*?)z-index:\s*1300;/, (m)=> m.replace(/z-index:\s*1300;/, 'z-index: 1400;'));
  if(newCss !== css){ save(cssFile, newCss); }
}

// Patch vendor.html note display
const vendor = path.join(root,'vendor.html');
if(fs.existsSync(vendor)){
  let vendorContent = fs.readFileSync(vendor,'utf8');
  const marker = '<div><strong>Total:</strong> ${moneyFmt(order.total)}</div>';
  const noteTemplate = '<div><strong>Note:</strong> ${order.supplierNote || order.note || \'None\'}</div>';
  if(vendorContent.includes(marker) && !vendorContent.includes('Note:</strong> ${order.supplierNote')){
    vendorContent = vendorContent.replace(marker, `${marker}\n            ${noteTemplate}`);
    save(vendor, vendorContent);
  }
}

// Patch order.html summary note display
const orderHtml = path.join(root,'order.html');
if(fs.existsSync(orderHtml)){
  let orderContent = fs.readFileSync(orderHtml,'utf8');
  const template = '<h3>Order ${doc.id}</h3><p>Total: ₦${o.total||0}</p>';
  if(orderContent.includes(template) && !orderContent.includes('Note: ${o.note}')){
    orderContent = orderContent.replace(template, `${template}${'${o.note ? `<p>Note: ${o.note}</p>` : ``}'}`);
    save(orderHtml, orderContent);
  }
}

const buyerNoteHtml = `        <div class="form-row"><label for="buyerNote">Note to supplier</label><textarea id="buyerNote" rows="3" placeholder="Add any special instructions for the supplier…"></textarea></div>\n`;
for(const file of htmlFiles){
  const filePath = path.join(root,file);
  let text = fs.readFileSync(filePath,'utf8');
  let orig = text;
  if(text.includes('id="lbCustomize"')){
    text = text.replace(/\s*<button[^>]*id="lbCustomize"[^>]*>Customize<\/button>\s*/g, '');
  }
  if(text.includes('id="buyModal"') && !text.includes('id="buyerNote"')){
    text = text.replace(/(<div class="form-row"><label for="buyerShipping">[\s\S]*?<\/select>\s*<\/div>\s*)/m, `$1${buyerNoteHtml}`);
  }
  if(text !== orig){ save(filePath, text); }
}

for(const file of jsFiles){
  const filePath = path.join(root,file);
  let text = fs.readFileSync(filePath,'utf8');
  let orig = text;
  if(text.includes("const bmAddress = document.getElementById('buyerAddress');") && !text.includes('const bmNote')){
    text = text.replace(/const bmAddress = document.getElementById\('buyerAddress'\);\s*const bmShipping = document.getElementById\('buyerShipping'\);/, `const bmAddress = document.getElementById('buyerAddress');\nconst bmNote = document.getElementById('buyerNote');\nconst bmShipping = document.getElementById('buyerShipping');`);
  }
  if(text.includes('const address = bmAddress?.value?.trim();') && !text.includes('const note = bmNote')){
    text = text.replace(/const address = bmAddress\?\.value\?\.trim\(\);/, `const address = bmAddress?.value?.trim();\n  const note = bmNote?.value?.trim() || '';`);
  }
  if(text.includes('customer: { name, phone, email, address },') && !text.includes('note,')){
    text = text.replace(/customer: \{ name, phone, email, address \},\s*product:/, `customer: { name, phone, email, address },\n    note,\n    product:`);
  }
  const receiptNoteTemplate = '<p><strong>Note:</strong> ${order.note}</p>';
  if(text.includes('saveOrderAsHTML(order)') && !text.includes('order.note ?')){
    text = text.replace(/<p><strong>Transaction fee:<\/strong>.*?<\/p>\s*<p><strong>Total:<\/strong>.*?<\/p>/s,
      `<p><strong>Transaction fee:</strong> ₦\${order.transactionFee}</p>\n    \${order.note ? \`${receiptNoteTemplate}\` : ''}\n    <p><strong>Total:</strong> ₦\${order.total}</p>`);
  }
  if(text !== orig){ save(filePath, text); }
}

console.log('changed', changed);
