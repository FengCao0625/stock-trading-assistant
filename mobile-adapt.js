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

  document.body.appendChild(nav);

  // Prevent bounce scroll on iOS
  document.addEventListener('touchmove', function(e) {
    if (e.target.closest('.mobile-bottom-nav')) {
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