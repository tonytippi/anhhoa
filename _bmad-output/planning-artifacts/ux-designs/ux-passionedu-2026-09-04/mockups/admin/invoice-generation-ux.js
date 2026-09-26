window.addEventListener("DOMContentLoaded", function () {
  var reviewLinks = [].slice.call(
    document.querySelectorAll('#run-detail a[href*="invoice-detail-review"]'),
  );
  var selectAll = document.getElementById("select-eligible");
  var studentSelects = [].slice.call(document.querySelectorAll(".student-select"));

  function syncSelectAll() {
    var eligible = studentSelects.filter(function (input) { return !input.disabled; });
    var selected = eligible.filter(function (input) { return input.checked; });
    selectAll.checked = selected.length === eligible.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < eligible.length;
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-open-run]");
    if (!button) return;
    var month = button.dataset.openRun;
    if (!month) return;
    reviewLinks.forEach(function (link) {
      link.href = link.href.replace(/run=2026-\d\d/, "run=2026-" + month.slice(0, 2));
    });
  });

  document.addEventListener("change", function (event) {
    if (event.target.matches(".student-select")) {
      syncSelectAll();
      document.getElementById("run-feedback").textContent =
        "Lựa chọn đã thay đổi. Hãy yêu cầu preview mới từ hệ thống.";
    }
  });
});
