(function () {
  'use strict';

  var host = document.querySelector('[data-admin-shell]');
  if (!host) return;

  var route = host.getAttribute('data-admin-route');
  // URLs resolve from the current document, so roster pages need a different root.
  var root = route === 'roster' ? '../' : '';
  var links = [
    ['VẬN HÀNH', 'overview', 'Tổng quan', root + 'admin-staff.html#overview'],
    ['', 'leave', 'Xin nghỉ', root + 'admin-staff.html#leave'],
    ['', 'handover', 'Bàn giao', root + 'admin-staff.html#handover'],
    ['DANH BỘ', 'roster', 'Danh bộ', route === 'roster' ? 'roster.html' : 'roster/roster.html'],
    ['CẤU HÌNH', 'settings', 'Cấu hình trường', root + 'school-settings.html'],
    ['TÀI CHÍNH', 'receivables', 'Khoản thu', root + 'receivable-configuration.html'],
    ['', 'runs', 'Đợt thu', root + 'invoice-generation.html'],
    ['LƯƠNG & NHÂN SỰ', 'timekeeping', 'Chấm công', root + 'payroll-timekeeping-import.html'],
    ['', 'payroll', 'Bảng lương', root + 'payroll-run-review.html'],
    ['', 'workforce', 'Hợp đồng & chính sách', root + 'payroll-overview.html']
  ];
  var navigation = '';
  var isWorkspace = route === 'overview';

  links.forEach(function (link) {
    var current = link[1] === route;
    if (link[0]) navigation += '<p class="nav-group">' + link[0] + '</p>';
    var href = isWorkspace && ['overview', 'leave', 'handover'].indexOf(link[1]) !== -1 ? '#' + link[1] : link[3];
    navigation += '<a class="side-link' + (current ? ' active' : '') + '" href="' + href + '"' + (current ? ' aria-current="page"' : '') + '>' + link[2] + '</a>';
  });

  var content = host.innerHTML;
  host.insertAdjacentHTML('beforebegin', '<a class="skip" href="#main">Bỏ qua điều hướng</a>');
  host.className = 'shell';
  host.innerHTML = '<aside class="sidebar" id="admin-navigation" aria-label="Điều hướng"><div class="sidebar-head"><p class="brand"><b>P</b> PassionEdu</p><button class="nav-close" type="button" aria-label="Đóng điều hướng">×</button></div><nav aria-label="Điều hướng quản trị và nhân sự">' + navigation + '</nav></aside><button class="nav-backdrop" type="button" aria-label="Đóng điều hướng"></button><main id="main" class="workspace"><header class="topbar"><div><button class="nav-toggle" type="button" aria-controls="admin-navigation" aria-expanded="false">☰ Menu</button> <button class="context" type="button" data-school-context="clean">Ánh Hoa · Năm học 2026-2027 ▾</button></div><div class="avatar"><span class="muted">Hoa Nguyễn</span><i>HN</i></div></header>' + content + '</main>';

  var sidebar = document.querySelector('.sidebar');
  var toggle = document.querySelector('.nav-toggle');
  var closeButton = document.querySelector('.nav-close');
  var backdrop = document.querySelector('.nav-backdrop');
  var lastOpener = null;
  var workspace = document.querySelector('.workspace');
  function closeNavigation(returnFocus) { sidebar.dataset.open = 'false'; backdrop.dataset.open = 'false'; toggle.setAttribute('aria-expanded', 'false'); workspace.inert = false; if (returnFocus && lastOpener) lastOpener.focus(); }
  function openNavigation() { lastOpener = document.activeElement; sidebar.dataset.open = 'true'; backdrop.dataset.open = 'true'; toggle.setAttribute('aria-expanded', 'true'); workspace.inert = true; closeButton.focus(); }
  if (toggle) toggle.addEventListener('click', openNavigation);
  if (closeButton) closeButton.addEventListener('click', function () { closeNavigation(true); });
  if (backdrop) backdrop.addEventListener('click', function () { closeNavigation(true); });
  if (sidebar) sidebar.querySelectorAll('a').forEach(function (link) { link.addEventListener('click', function () { closeNavigation(false); }); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && sidebar.dataset.open === 'true') closeNavigation(true); });

  function updateNavigation() {
    var activeRoute = window.location.hash.split('?')[0].slice(1) || route;
    if (isWorkspace && ['overview', 'leave', 'handover'].indexOf(activeRoute) === -1) {
      window.location.hash = '#overview';
      return;
    }
    document.querySelectorAll('.side-link').forEach(function (link) {
      var rawHref = link.getAttribute('href');
      var targetHash = (rawHref.split('#')[1] || '').split('?')[0];
      var targetPage = rawHref.split('#')[0].split('/').pop();
      var currentPage = (window.location.pathname || '').split('/').pop();
      var isCurrent = rawHref.charAt(0) === '#' ? targetHash === activeRoute : (targetPage === currentPage && (!targetHash || targetHash === activeRoute));
      if (!currentPage && activeRoute === route && link.getAttribute('aria-current') === 'page') isCurrent = true;
      link.classList.toggle('active', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  window.addEventListener('hashchange', updateNavigation);
  updateNavigation();
}());
