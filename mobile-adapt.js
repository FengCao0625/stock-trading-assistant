/**
 * Mobile Adaptation JS — injects bottom navigation bar
 * Loaded on all pages; only renders on mobile (< 768px via CSS)
 */
(function() {
  'use strict';

  var NAV_ITEMS = [
    { key: 'dashboard', label: '总览', href: 'dashboard.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>' },
    { key: 'screener', label: '选股', href: 'stock-screener.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>' },
    { key: 'analysis', label: '分析', href: 'stock-analysis.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="M7 16l4-8 4 4 4-10"></path></svg>' },
    { key: 'tracking', label: '追踪', href: 'realtime-tracking.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>' },
    { key: 'forecast', label: '仓位', href: 'position-forecast.html',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>' }
  ];

  // Detect current page
  var path = window.location.pathname;
  var currentPage = 'dashboard';
  NAV_ITEMS.forEach(function(item) {
    if (path.indexOf(item.href) !== -1) currentPage = item.key;
  });

  // Build bottom nav
  var nav = document.createElement('nav');
  nav.className = 'mobile-bottom-nav';
  nav.setAttribute('aria-label', '主导航');

  NAV_ITEMS.forEach(function(item) {
    var a = document.createElement('a');
    a.className = 'mob-nav-item' + (item.key === currentPage ? ' mob-active' : '');
    a.href = item.href;
    a.innerHTML = item.icon + '<span class="mob-nav-label">' + item.label + '</span>';
    nav.appendChild(a);
  });

  // "More" button with popup menu
  var moreBtn = document.createElement('div');
  moreBtn.className = 'mob-nav-item';
  moreBtn.id = 'mob-more-btn';
  moreBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>' +
    '</svg>' +
    '<span class="mob-nav-label">更多</span>';
  moreBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMoreMenu();
  });
  nav.appendChild(moreBtn);

  document.body.appendChild(nav);

  // More menu popup
  var moreMenu = null;

  function toggleMoreMenu() {
    if (moreMenu) {
      moreMenu.remove();
      moreMenu = null;
      return;
    }
    moreMenu = document.createElement('div');
    moreMenu.id = 'mob-more-menu';
    moreMenu.style.cssText = 'position:fixed;bottom:68px;right:12px;background:#1A2035;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:6px 0;z-index:200;min-width:140px;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
    moreMenu.innerHTML =
      '<div class="mob-menu-item" onclick="DataMigration.showSyncModal();document.getElementById(\'mob-more-menu\')?.remove();">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>' +
        '<span>云端同步</span></div>' +
      '<div class="mob-menu-item" onclick="DataMigration.showExportModal();document.getElementById(\'mob-more-menu\')?.remove();">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
        '<span>导出数据</span></div>' +
      '<div class="mob-menu-item" onclick="DataMigration.showImportModal();document.getElementById(\'mob-more-menu\')?.remove();">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>' +
        '<span>导入数据</span></div>';
    document.body.appendChild(moreMenu);
  }

  // Close more menu on tap outside
  document.addEventListener('click', function(e) {
    if (moreMenu && !moreMenu.contains(e.target) && e.target !== moreBtn) {
      moreMenu.remove();
      moreMenu = null;
    }
  });

  // Prevent bounce scroll on iOS
  document.addEventListener('touchmove', function(e) {
    if (e.target.closest('.mobile-bottom-nav') || e.target.closest('#mob-more-menu')) {
      e.preventDefault();
    }
  }, { passive: false });

  // Handle viewport resize (e.g. orientation change) — trigger chart redraws
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      window.dispatchEvent(new Event('resize-chart'));
    }, 300);
  });
})();