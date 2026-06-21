/**
 * Context-aware size / colour / shade selectors with linked variant matrix stock.
 */
(function initProductOptions(global) {
  const SIZE_TYPES = {
    FOOTWEAR: 'footwear',
    CLOTHING: 'clothing',
    GADGETS: 'gadgets',
    JEWELRY: 'jewelry',
    BEAUTY: 'beauty',
    OTHER: 'other'
  };

  const TYPE_CONFIG = {
    loafers: { sizeType: SIZE_TYPES.FOOTWEAR, showColor: true, colorLabel: 'Colour' },
    slides: { sizeType: SIZE_TYPES.FOOTWEAR, showColor: true, colorLabel: 'Colour' },
    sneakers: { sizeType: SIZE_TYPES.FOOTWEAR, showColor: true, colorLabel: 'Colour' },
    cshirts: { sizeType: SIZE_TYPES.CLOTHING, showColor: true, showMeasurements: true, colorLabel: 'Colour' },
    shirts: { sizeType: SIZE_TYPES.CLOTHING, showColor: true, showMeasurements: true, colorLabel: 'Colour' },
    trousers: { sizeType: SIZE_TYPES.CLOTHING, showColor: true, showMeasurements: true, colorLabel: 'Colour' },
    skirts: { sizeType: SIZE_TYPES.CLOTHING, showColor: true, showMeasurements: true, colorLabel: 'Colour' },
    gowns: { sizeType: SIZE_TYPES.CLOTHING, showColor: true, showMeasurements: true, colorLabel: 'Colour' },
    bubu: { sizeType: SIZE_TYPES.CLOTHING, showColor: true, showMeasurements: true, colorLabel: 'Colour' },
    thrift: { sizeType: SIZE_TYPES.CLOTHING, showColor: true, showMeasurements: true, colorLabel: 'Colour' },
    accessoriesgadgets: { sizeType: SIZE_TYPES.GADGETS, showColor: true, colorLabel: 'Colour' },
    laptops: { sizeType: SIZE_TYPES.GADGETS, showColor: true, colorLabel: 'Colour' },
    phones: { sizeType: SIZE_TYPES.GADGETS, showColor: true, colorLabel: 'Colour' },
    hairproducts: { sizeType: SIZE_TYPES.BEAUTY, showColor: true, colorLabel: 'Shade', sizeLabel: 'Size / Volume' },
    skincare: { sizeType: SIZE_TYPES.BEAUTY, showColor: true, colorLabel: 'Shade', sizeLabel: 'Size / Volume' },
    accessoriesjewelry: { sizeType: SIZE_TYPES.JEWELRY, showColor: true, colorLabel: 'Colour', sizeLabel: 'Size' },
    bracelets: { sizeType: SIZE_TYPES.JEWELRY, showColor: true, colorLabel: 'Colour', sizeLabel: 'Wrist size' },
    chains: { sizeType: SIZE_TYPES.JEWELRY, showColor: true, colorLabel: 'Colour', sizeLabel: 'Chain length' },
    rings: { sizeType: SIZE_TYPES.JEWELRY, showColor: true, colorLabel: 'Colour', sizeLabel: 'Ring size' },
    watches: { sizeType: SIZE_TYPES.JEWELRY, showColor: true, colorLabel: 'Colour', sizeLabel: 'Strap size' },
    matchingsets: { sizeType: SIZE_TYPES.JEWELRY, showColor: true, colorLabel: 'Colour', sizeLabel: 'Size' }
  };

  const DEFAULTS = {
    [SIZE_TYPES.FOOTWEAR]: {
      sizes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
      colors: ['Black', 'White', 'Brown', 'Navy', 'Grey', 'Red', 'Blue']
    },
    [SIZE_TYPES.CLOTHING]: {
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      colors: ['Black', 'White', 'Navy', 'Grey', 'Red', 'Blue', 'Green', 'Brown', 'Beige', 'Pink']
    },
    [SIZE_TYPES.GADGETS]: { sizes: [], colors: ['Black', 'White', 'Silver', 'Gold', 'Blue', 'Grey'] },
    [SIZE_TYPES.OTHER]: { sizes: [], colors: [] }
  };

  const JEWELRY_DEFAULTS = {
    rings: {
      sizes: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
      colors: ['Gold', 'Silver', 'Rose Gold', 'White Gold', 'Platinum', 'Two-Tone']
    },
    bracelets: {
      sizes: ['6"', '6.5"', '7"', '7.5"', '8"', 'Adjustable'],
      colors: ['Gold', 'Silver', 'Rose Gold', 'Black', 'Multi', 'Two-Tone']
    },
    chains: {
      sizes: ['16"', '18"', '20"', '22"', '24"'],
      colors: ['Gold', 'Silver', 'Rose Gold', 'Black', 'Two-Tone']
    },
    watches: {
      sizes: ['Small', 'Medium', 'Large'],
      colors: ['Black', 'Silver', 'Gold', 'Rose Gold', 'Two-Tone', 'Brown']
    },
    matchingsets: {
      sizes: ['One Size'],
      colors: ['Gold', 'Silver', 'Rose Gold', 'Multi']
    },
    accessoriesjewelry: {
      sizes: ['One Size'],
      colors: ['Gold', 'Silver', 'Rose Gold', 'Black', 'Multi']
    }
  };

  const BEAUTY_DEFAULTS = {
    skincare: {
      sizes: ['30ml', '50ml', '100ml'],
      colors: ['Fair', 'Light', 'Light Medium', 'Medium', 'Tan', 'Deep', 'Rich']
    },
    hairproducts: {
      sizes: ['100ml', '250ml', '500ml'],
      colors: ['Black', 'Dark Brown', 'Brown', 'Light Brown', 'Blonde', 'Auburn', 'Red', 'Grey']
    }
  };

  let activeProduct = null;
  let activeConfig = null;
  let activeMatrix = [];
  let matrixIsVirtual = false;

  function normalizeType(type) {
    return String(type || '').toLowerCase().replace(/[\s_-]/g, '');
  }

  function normalizeVariants(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(v => ({
        label: String(v?.label || '').trim(),
        qty: v?.qty == null || v?.qty === '' ? null : Math.max(0, Number(v.qty) || 0)
      }))
      .filter(v => v.label);
  }

  function normalizeMatrix(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(row => ({
        size: String(row?.size ?? row?.sizeLabel ?? '').trim(),
        color: String(row?.color ?? row?.colorLabel ?? row?.shade ?? '').trim(),
        classification: String(row?.classification || '').trim(),
        qty: Math.max(0, Number(row?.qty) || 0)
      }))
      .filter(row => row.size || row.color || row.classification);
  }

  function getTypeConfig(product) {
    const key = normalizeType(product?.type || product?.supplierCategory);
    return TYPE_CONFIG[key] || { sizeType: SIZE_TYPES.OTHER, showColor: false, colorLabel: 'Colour', sizeLabel: 'Size' };
  }

  function getCategoryDefaults(product) {
    const key = normalizeType(product?.type || product?.supplierCategory);
    const cfg = getTypeConfig(product);
    if (cfg.sizeType === SIZE_TYPES.JEWELRY && JEWELRY_DEFAULTS[key]) return JEWELRY_DEFAULTS[key];
    if (cfg.sizeType === SIZE_TYPES.BEAUTY && BEAUTY_DEFAULTS[key]) return BEAUTY_DEFAULTS[key];
    return DEFAULTS[cfg.sizeType] || DEFAULTS[SIZE_TYPES.OTHER];
  }

  function matrixFromLegacy(product) {
    const sizes = normalizeVariants(product.sizeVariants);
    const colors = normalizeVariants(product.colorVariants);
    const stockQty = Number(product.stockQty || 0);
    const matrix = [];

    if (sizes.length && colors.length) {
      sizes.forEach(s => {
        colors.forEach(c => {
          matrix.push({
            size: s.label,
            color: c.label,
            classification: '',
            qty: s.qty != null && c.qty != null ? Math.min(s.qty, c.qty) : (s.qty ?? c.qty ?? stockQty)
          });
        });
      });
      return matrix;
    }

    sizes.forEach(s => matrix.push({ size: s.label, color: '', classification: '', qty: s.qty ?? stockQty }));
    colors.forEach(c => matrix.push({ size: '', color: c.label, classification: '', qty: c.qty ?? stockQty }));
    return matrix;
  }

  function buildDefaultMatrix(product) {
    const defaults = getCategoryDefaults(product);
    const cfg = getTypeConfig(product);
    const stockQty = Number(product.stockQty || 0);
    const sizes = defaults.sizes || [];
    const colors = defaults.colors || [];

    if (cfg.sizeType === SIZE_TYPES.GADGETS) {
      return colors.map(color => ({ size: '', color, classification: '', qty: stockQty }));
    }
    if (!sizes.length && !colors.length) return [];
    if (!sizes.length) return colors.map(color => ({ size: '', color, classification: '', qty: stockQty }));
    if (!colors.length) return sizes.map(size => ({ size, color: '', classification: '', qty: stockQty }));
    return sizes.flatMap(size => colors.map(color => ({ size, color, classification: '', qty: stockQty })));
  }

  function resolveVariantMatrix(product) {
    const vendorMatrix = normalizeMatrix(product.variantMatrix);
    if (vendorMatrix.length) {
      matrixIsVirtual = false;
      return vendorMatrix;
    }
    const legacy = matrixFromLegacy(product);
    if (legacy.length) {
      matrixIsVirtual = false;
      return legacy;
    }
    matrixIsVirtual = true;
    return buildDefaultMatrix(product);
  }

  function getComboQty(matrix, size, color, stockQty) {
    const row = matrix.find(r => (r.size || '') === (size || '') && (r.color || '') === (color || ''));
    if (row) return row.qty;
    if (matrixIsVirtual) return Number(stockQty || 0);
    return 0;
  }

  function uniqueValues(matrix, field, filterFn) {
    const seen = new Set();
    const out = [];
    matrix.forEach(row => {
      if (filterFn && !filterFn(row)) return;
      const val = row[field] || '';
      if (!val || seen.has(val)) return;
      seen.add(val);
      out.push(val);
    });
    return out;
  }

  function sizesForColor(matrix, color, stockQty) {
    return uniqueValues(matrix, 'size', row => {
      if (!row.size) return false;
      if (!color) return getComboQty(matrix, row.size, row.color, stockQty) > 0;
      return row.color === color && getComboQty(matrix, row.size, row.color, stockQty) > 0;
    });
  }

  function colorsForSize(matrix, size, stockQty) {
    return uniqueValues(matrix, 'color', row => {
      if (!row.color) return false;
      if (!size) return getComboQty(matrix, row.size, row.color, stockQty) > 0;
      return row.size === size && getComboQty(matrix, row.size, row.color, stockQty) > 0;
    });
  }

  function allAvailableSizes(matrix, stockQty) {
    return uniqueValues(matrix, 'size', row => row.size && getComboQty(matrix, row.size, row.color, stockQty) > 0);
  }

  function allAvailableColors(matrix, stockQty) {
    return uniqueValues(matrix, 'color', row => row.color && getComboQty(matrix, row.size, row.color, stockQty) > 0);
  }

  function computeInStockFromVariants(product) {
    const saved = normalizeMatrix(product.variantMatrix);
    if (saved.length) return saved.some(r => r.qty > 0);
    const legacy = matrixFromLegacy(product);
    if (legacy.length) return legacy.some(r => r.qty > 0);
    return Number(product.stockQty || 0) > 0;
  }

  function getContainer() {
    return document.getElementById('productOptionsContainer');
  }

  function optionQtyHint(matrix, stockQty, id, val) {
    const sizeEl = document.getElementById('buyerSize');
    const colorEl = document.getElementById('buyerColor');
    const size = id === 'buyerSize' ? val : (sizeEl?.value || '');
    const color = id === 'buyerColor' ? val : (colorEl?.value || '');
    if (id === 'buyerSize' && !color) {
      const rows = matrix.filter(r => r.size === val);
      return rows.length ? Math.max(...rows.map(r => getComboQty(matrix, r.size, r.color, stockQty))) : getComboQty(matrix, val, '', stockQty);
    }
    if (id === 'buyerColor' && !size) {
      const rows = matrix.filter(r => r.color === val);
      return rows.length ? Math.max(...rows.map(r => getComboQty(matrix, r.size, r.color, stockQty))) : getComboQty(matrix, '', val, stockQty);
    }
    return getComboQty(matrix, size, color, stockQty);
  }

  function buildSelect(id, label, values, matrix, stockQty, placeholder, selectedValue) {
    let html = `<div class="form-row product-options__field" data-field="${id}">`;
    html += `<label for="${id}">${label}</label>`;
    html += `<select id="${id}" ${values.length ? 'required' : ''}>`;
    html += `<option value="" disabled ${selectedValue ? '' : 'selected'}>${placeholder}</option>`;
    values.forEach(val => {
      const qty = optionQtyHint(matrix, stockQty, id, val);
      const available = qty > 0;
      const suffix = available && qty < 9000 ? ` (${qty} left)` : (available ? '' : ' (unavailable)');
      html += `<option value="${val}" ${val === selectedValue ? 'selected' : ''} ${available ? '' : 'disabled'}>${val}${suffix}</option>`;
    });
    html += '</select></div>';
    return html;
  }

  function rebuildSelect(id, label, values, matrix, stockQty, placeholder) {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    const parent = el.closest('.product-options__field');
    if (!parent) return;
    parent.outerHTML = buildSelect(id, label, values, matrix, stockQty, placeholder, values.includes(prev) ? prev : '');
    document.getElementById(id)?.addEventListener('change', onVariantSelectChange);
  }

  function onVariantSelectChange(ev) {
    if (!activeMatrix.length || !activeConfig) return;
    const targetId = ev?.target?.id || '';
    const stockQty = activeConfig.stockQty;

    if (targetId === 'buyerSize' && activeConfig.showColor) {
      const size = document.getElementById('buyerSize')?.value || '';
      rebuildSelect(
        'buyerColor',
        activeConfig.colorLabel,
        colorsForSize(activeMatrix, size, stockQty),
        activeMatrix,
        stockQty,
        'Select ' + activeConfig.colorLabel.toLowerCase()
      );
    }

    if (targetId === 'buyerColor' && activeConfig.showSize) {
      const color = document.getElementById('buyerColor')?.value || '';
      rebuildSelect(
        'buyerSize',
        activeConfig.sizeLabel,
        sizesForColor(activeMatrix, color, stockQty),
        activeMatrix,
        stockQty,
        'Select ' + activeConfig.sizeLabel.toLowerCase()
      );
    }
  }

  function bindLinkedSelectors() {
    document.getElementById('buyerSize')?.addEventListener('change', onVariantSelectChange);
    document.getElementById('buyerColor')?.addEventListener('change', onVariantSelectChange);
  }

  function buildMeasurements() {
    return `
      <div class="product-options__measurements" data-field="measurements">
        <div class="product-options__measurements-title">Specific measurements (optional)</div>
        <div class="product-options__measurements-grid">
          <div class="form-row"><label for="buyerWaist">Waist</label><input id="buyerWaist" placeholder="e.g. 32 in / 81 cm"></div>
          <div class="form-row"><label for="buyerLength">Length</label><input id="buyerLength" placeholder="e.g. 40 in / 102 cm"></div>
          <div class="form-row"><label for="buyerChest">Chest</label><input id="buyerChest" placeholder="e.g. 38 in"></div>
          <div class="form-row"><label for="buyerSleeve">Sleeve</label><input id="buyerSleeve" placeholder="e.g. 24 in"></div>
        </div>
      </div>`;
  }

  function prepareForProduct(product) {
    activeProduct = product || null;
    activeMatrix = product ? resolveVariantMatrix(product) : [];
    const cfg = product ? getTypeConfig(product) : null;
    const defaults = product ? getCategoryDefaults(product) : null;
    const stockQty = Number(product?.stockQty || 0);

    const showSize = activeMatrix.some(r => r.size) || (defaults?.sizes?.length && cfg?.sizeType !== SIZE_TYPES.GADGETS);
    const showColor = activeMatrix.some(r => r.color) || (defaults?.colors?.length && cfg?.showColor);

    activeConfig = product ? {
      showSize: !!showSize,
      showColor: !!showColor,
      sizeLabel: cfg.sizeLabel || (cfg.sizeType === SIZE_TYPES.FOOTWEAR ? 'Shoe size' : 'Size'),
      colorLabel: cfg.colorLabel || 'Colour',
      type: cfg,
      stockQty,
      linked: !!showSize && !!showColor
    } : null;

    const container = getContainer();
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
    if (!activeConfig) return;

    const parts = [];
    if (activeConfig.linked) {
      parts.push('<p class="product-options__hint">Available colours depend on the size you pick, and available sizes depend on the colour.</p>');
    }
    if (activeConfig.showSize) {
      parts.push(buildSelect('buyerSize', activeConfig.sizeLabel, allAvailableSizes(activeMatrix, stockQty), activeMatrix, stockQty, 'Select ' + activeConfig.sizeLabel.toLowerCase()));
    }
    if (activeConfig.showColor) {
      parts.push(buildSelect('buyerColor', activeConfig.colorLabel, allAvailableColors(activeMatrix, stockQty), activeMatrix, stockQty, 'Select ' + activeConfig.colorLabel.toLowerCase()));
    }
    if (activeConfig.type?.showMeasurements) parts.push(buildMeasurements());
    if (!parts.length) return;

    container.innerHTML = parts.join('');
    container.style.display = 'block';
    bindLinkedSelectors();
  }

  function readMeasurements() {
    const waist = document.getElementById('buyerWaist')?.value?.trim() || '';
    const length = document.getElementById('buyerLength')?.value?.trim() || '';
    const chest = document.getElementById('buyerChest')?.value?.trim() || '';
    const sleeve = document.getElementById('buyerSleeve')?.value?.trim() || '';
    if (!waist && !length && !chest && !sleeve) return null;
    return { waist, length, chest, sleeve };
  }

  function validateAndGetSelection() {
    if (!activeProduct || !activeConfig) return {};

    const result = { size: '', color: '', measurements: null };
    const size = document.getElementById('buyerSize')?.value?.trim() || '';
    const color = document.getElementById('buyerColor')?.value?.trim() || '';

    if (activeConfig.showSize && !size) {
      alert(`Please select a ${activeConfig.sizeLabel.toLowerCase()}.`);
      return false;
    }
    if (activeConfig.showColor && !color) {
      alert(`Please select a ${activeConfig.colorLabel.toLowerCase()}.`);
      return false;
    }

    result.size = size;
    result.color = color;

    const qty = getComboQty(activeMatrix, result.size, result.color, activeConfig.stockQty);
    if (activeMatrix.length && qty <= 0) {
      alert('That combination is not available. Please choose another size or colour.');
      return false;
    }

    result.measurements = readMeasurements();
    return result;
  }

  async function decrementStockAfterOrder(db, product, selection) {
    if (!db || !product?.id || !selection) return;

    const hadStoredMatrix = normalizeMatrix(product.variantMatrix).length > 0;
    let matrix = hadStoredMatrix ? normalizeMatrix(product.variantMatrix) : resolveVariantMatrix(product);
    let stockQty = Number(product.stockQty || 0);

    const idx = matrix.findIndex(r =>
      (r.size || '') === (selection.size || '') &&
      (r.color || '') === (selection.color || '')
    );

    if (idx >= 0) {
      matrix[idx].qty = Math.max(0, matrix[idx].qty - 1);
    } else if (matrixIsVirtual || !hadStoredMatrix) {
      stockQty = Math.max(0, stockQty - 1);
    }

    const nextProduct = { ...product, variantMatrix: matrix, stockQty };
    const instock = computeInStockFromVariants(nextProduct);

    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js');
    const payload = { instock, inStock: instock, stockQty };
    if (idx >= 0) payload.variantMatrix = matrix;
    await updateDoc(doc(db, 'products', product.id), payload);
  }

  global.ProductOptions = {
    SIZE_TYPES,
    TYPE_CONFIG,
    DEFAULTS,
    JEWELRY_DEFAULTS,
    BEAUTY_DEFAULTS,
    getTypeConfig,
    getCategoryDefaults,
    normalizeVariants,
    normalizeMatrix,
    resolveVariantMatrix,
    computeInStockFromVariants,
    prepareForProduct,
    validateAndGetSelection,
    decrementStockAfterOrder
  };
})(window);
