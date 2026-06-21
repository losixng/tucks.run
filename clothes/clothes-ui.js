/* Stock / sale window evaluation for buyer product pages */
window.evaluateProductStock = function evaluateProductStock(data) {
  if (!data) return true;
  const now = Date.now();
  if (data.saleEnd) {
    const end = new Date(data.saleEnd).getTime();
    if (!isNaN(end) && now > end) return false;
  }
  if (data.saleStart) {
    const start = new Date(data.saleStart).getTime();
    if (!isNaN(start) && now < start) return false;
  }
  if (typeof data.stockQty === 'number' && data.stockQty <= 0) return false;
  if (window.ProductOptions && (Array.isArray(data.sizeVariants) || Array.isArray(data.colorVariants) || Array.isArray(data.variantMatrix))) {
    if (!window.ProductOptions.computeInStockFromVariants(data)) return false;
  }
  if (typeof data.instock === 'boolean') return data.instock;
  if (typeof data.inStock === 'boolean') return data.inStock;
  return true;
};

/* Product grid stagger reveal — watches dynamic cards from category JS */
(function initProductReveal() {
  function revealCards(grid) {
    grid.querySelectorAll('.card:not(.visible), .dept-card:not(.visible)').forEach((card, i) => {
      setTimeout(() => card.classList.add('visible'), i * 85);
    });
  }

  function watchGrid(grid) {
    revealCards(grid);
    new MutationObserver(() => revealCards(grid)).observe(grid, { childList: true });
  }

  function boot() {
    document.querySelectorAll('.product-grid, .dept-grid').forEach(watchGrid);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* Deep-link: scroll to and highlight a product card from ?product=id or #product-id */
(function initProductDeepLink() {
  function getDeepLinkId() {
    const fromQuery = new URLSearchParams(window.location.search).get('product');
    if (fromQuery) return decodeURIComponent(fromQuery);
    if (window.location.hash.startsWith('#product-')) {
      return decodeURIComponent(window.location.hash.slice(9));
    }
    return null;
  }

  function highlightProduct(id) {
    const target = document.getElementById('product-' + id);
    if (!target || target.dataset.deepLinkDone === '1') return false;
    target.dataset.deepLinkDone = '1';
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('highlighted-product');
      setTimeout(() => target.classList.remove('highlighted-product'), 4200);
    });
    return true;
  }

  const productId = getDeepLinkId();
  if (!productId) return;

  function tryHighlight() {
    return highlightProduct(productId);
  }

  function watchForCard() {
    const observer = new MutationObserver(() => {
      if (tryHighlight()) observer.disconnect();
    });
    document.querySelectorAll('.product-grid').forEach(grid => {
      observer.observe(grid, { childList: true, subtree: true });
    });
    setTimeout(() => observer.disconnect(), 20000);
  }

  function bootDeepLink() {
    if (!tryHighlight()) watchForCard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDeepLink);
  } else {
    bootDeepLink();
  }
})();
