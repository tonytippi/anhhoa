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
    ['', 'runs', 'Đợt thu / Nộp trước', root + 'invoice-generation.html'],
    ['', 'invoice-review', 'Rà soát hóa đơn', root + 'invoice-detail-review.html'],
    ['', 'settlement', 'Thu tiền / Công nợ', root + 'invoice-detail-review.html'],
    ['', 'report', 'Báo cáo', root + 'invoice-detail-review.html'],
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
  host.innerHTML = '<aside class="sidebar"><p class="brand"><b>P</b> PassionEdu</p><nav aria-label="Điều hướng quản trị và nhân sự">' + navigation + '</nav></aside><main id="main" class="workspace"><header class="topbar"><button class="context" type="button" data-school-context="clean">Ánh Hoa · Năm học 2026-2027 ▾</button><div class="avatar"><span class="muted">Hoa Nguyễn</span><i>HN</i></div></header>' + content + '</main>';

  function updateNavigation() {
    var activeRoute = window.location.hash.split('?')[0].slice(1) || route;
    if (isWorkspace && ['overview', 'leave', 'handover'].indexOf(activeRoute) === -1) {
      window.location.hash = '#overview';
      return;
    }
    document.querySelectorAll('.side-link').forEach(function (link) {
      var isCurrent = link.getAttribute('href').split('?')[0] === '#' + activeRoute;
      link.classList.toggle('active', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  window.addEventListener('hashchange', updateNavigation);
  updateNavigation();
}());
