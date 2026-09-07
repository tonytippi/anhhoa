(function () {
  'use strict';

  var host = document.querySelector('[data-admin-shell]');
  if (!host) return;

  var route = host.getAttribute('data-admin-route');
  var links = [
    ['VẬN HÀNH', 'overview', 'Tổng quan', 'admin-staff.html#overview'],
    ['', 'attendance', 'Điểm danh', 'admin-staff.html#attendance'],
    ['', 'leave', 'Xin nghỉ', 'admin-staff.html#leave'],
    ['', 'handover', 'Bàn giao', 'admin-staff.html#handover'],
    ['DANH BỘ', 'roster', 'Danh bộ', 'admin-staff.html#roster'],
    ['', 'settings', 'Cấu hình trường', 'admin-staff.html#settings'],
    ['TÀI CHÍNH', 'receivables', 'Khoản thu', 'receivable-configuration.html'],
    ['', 'runs', 'Đợt thu', 'invoice-generation.html'],
    ['', 'invoice-review', 'Rà soát hóa đơn', 'invoice-detail-review.html'],
    ['', 'settlement', 'Thu tiền / Công nợ', 'admin-staff.html#settlement'],
    ['', 'report', 'Báo cáo', 'admin-staff.html#report']
  ];
  var navigation = '';
  var isWorkspace = route === 'overview';

  links.forEach(function (link) {
    var current = link[1] === route;
    if (link[0]) navigation += '<p class="nav-group">' + link[0] + '</p>';
    var href = isWorkspace && ['overview', 'attendance', 'leave', 'handover', 'roster', 'settings', 'settlement', 'report'].indexOf(link[1]) !== -1 ? '#' + link[1] : link[3];
    navigation += '<a class="side-link' + (current ? ' active' : '') + '" href="' + href + '"' + (current ? ' aria-current="page"' : '') + '>' + link[2] + '</a>';
  });

  var content = host.innerHTML;
  host.insertAdjacentHTML('beforebegin', '<a class="skip" href="#main">Bỏ qua điều hướng</a>');
  host.className = 'shell';
  host.innerHTML = '<aside class="sidebar"><p class="brand"><b>P</b> PassionEdu</p><nav aria-label="Điều hướng quản trị và nhân sự">' + navigation + '</nav></aside><main id="main" class="workspace"><header class="topbar"><button class="context" data-confirm="Đổi trường|Bạn đang xem Ánh Hoa. Biểu mẫu đang soạn sẽ không được tự lưu.">Ánh Hoa · Năm học 2026-2027 ▾</button><div class="avatar"><span class="muted">Hoa Nguyễn</span><i>HN</i></div></header>' + content + '</main>';
}());
