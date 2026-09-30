import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnchoredActionMenu, AnchoredActionMenuItem } from "../components/anchored-action-menu";

export type PositionRow = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  staffCount?: number;
  capabilities: string[];
};
export type CapabilityCatalog = {
  groups: { id: string; label: string; capabilities: { code: string; label: string }[] }[];
  system: { code: string; label: string }[];
};
export type PositionDraft = {
  mode: "create" | "edit" | "inactivate";
  position?: PositionRow;
  code: string;
  name: string;
  capabilities: string[];
  reason: string;
  confirmation: string;
};

export const emptyPositionDraft = (): PositionDraft => ({
  mode: "create",
  code: "",
  name: "",
  capabilities: [],
  reason: "",
  confirmation: "",
});

export function PositionsPanel({
  schoolName,
  positions,
  catalog,
  disabled,
  pending,
  draft,
  errors,
  message,
  onDraftChange,
  onSubmit,
}: {
  schoolName: string;
  positions: PositionRow[];
  catalog?: CapabilityCatalog;
  disabled: boolean;
  pending: boolean;
  draft?: PositionDraft;
  errors: Record<string, string>;
  message: string;
  onDraftChange: (draft: PositionDraft | undefined) => void;
  onSubmit: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "INACTIVE">("");
  const trigger = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const labels = new Map(
    [...(catalog?.groups.flatMap((group) => group.capabilities) ?? []), ...(catalog?.system ?? [])].map(
      (item) => [item.code, item.label],
    ),
  );
  const order = [...labels.keys()];
  const managed = new Set(catalog?.groups.flatMap((group) => group.capabilities.map((item) => item.code)) ?? []);
  const sorted = (capabilities: string[]) =>
    [...capabilities].sort((a, b) => (order.indexOf(a) + 1 || order.length + 1) - (order.indexOf(b) + 1 || order.length + 1));
  const systemGrants = (position?: PositionRow) =>
    (position?.capabilities ?? []).filter((capability) => !managed.has(capability));
  const needle = query.trim().toLocaleLowerCase("vi");
  const visible = positions.filter(
    (item) =>
      (!status || item.status === status) &&
      (!needle || item.name.toLocaleLowerCase("vi").includes(needle) || item.code.toLocaleLowerCase("vi").includes(needle)),
  );
  const open = (next: PositionDraft, from: HTMLElement | null) => {
    trigger.current = from;
    onDraftChange(next);
  };
  const close = () => {
    if (pending) return;
    onDraftChange(undefined);
  };

  useEffect(() => {
    if (draft && !wasOpen.current)
      dialog.current?.querySelector<HTMLElement>("input:not([disabled]), select, button")?.focus();
    if (!draft && wasOpen.current) trigger.current?.focus();
    wasOpen.current = Boolean(draft);
  }, [draft]);
  useLayoutEffect(() => {
    if (draft && Object.keys(errors).length) errorSummary.current?.focus();
  }, [errors]);

  const trap = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...(dialog.current?.querySelectorAll<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex='0']",
      ) ?? []),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  const field = (name: string) =>
    errors[name] ? { "aria-invalid": true, "aria-describedby": `position-${name}-error` } : {};
  const toggle = (capability: string) =>
    draft &&
    onDraftChange({
      ...draft,
      capabilities: draft.capabilities.includes(capability)
        ? draft.capabilities.filter((item) => item !== capability)
        : [...draft.capabilities, capability],
    });

  return (
    <>
      <form
        className="roster-list-filters"
        aria-label="Lọc chức danh"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="roster-filter-search">
          Tìm kiếm
          <input
            type="search"
            value={query}
            placeholder="Tên hoặc mã chức danh"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Trạng thái
          <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang áp dụng</option>
            <option value="INACTIVE">Ngừng áp dụng</option>
          </select>
        </label>
        <div className="roster-list-filter-actions">
          <button
            type="button"
            className="primary-action"
            disabled={disabled || !catalog}
            onClick={(event) => open(emptyPositionDraft(), event.currentTarget)}
          >
            Thêm chức danh
          </button>
        </div>
      </form>
      <div className="table-scroll position-list-table">
        <table>
          <caption>Chức danh của {schoolName}</caption>
          <thead>
            <tr>
              <th>Tên chức danh</th>
              <th>Mã</th>
              <th>Khả năng thao tác</th>
              <th>Số nhân sự</th>
              <th>Trạng thái</th>
              <th>Tùy chọn</th>
            </tr>
          </thead>
          <tbody>
            {visible.length ? (
              visible.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.name}</th>
                  <td className="position-code">{item.code}</td>
                  <td>
                    {item.capabilities.length ? (
                      <ul className="position-capabilities" aria-label={`Khả năng thao tác của ${item.name}`}>
                        {sorted(item.capabilities).map((capability) => (
                          <li
                            key={capability}
                            className={managed.has(capability) ? undefined : "position-capability-system"}
                            title={managed.has(capability) ? undefined : "Quyền hệ thống, không chỉnh tại trang này"}
                          >
                            {labels.get(capability) ?? "Khả năng khác"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="position-muted">Chưa có khả năng thao tác</span>
                    )}
                  </td>
                  <td>{item.staffCount ?? "–"}</td>
                  <td>
                    <span className={`finance-badge ${item.status === "ACTIVE" ? "finance-badge-success" : "finance-badge-neutral"}`}>
                      {item.status === "ACTIVE" ? "Đang áp dụng" : "Ngừng áp dụng"}
                    </span>
                  </td>
                  <td>
                    {item.status === "ACTIVE" ? (
                      <AnchoredActionMenu
                        label={`Tùy chọn cho ${item.name}`}
                        disabled={disabled || !catalog}
                        onTriggerOpen={(element) => {
                          trigger.current = element;
                        }}
                      >
                        <AnchoredActionMenuItem
                          onClick={() =>
                            open(
                              {
                                mode: "edit",
                                position: item,
                                code: item.code,
                                name: item.name,
                                capabilities: item.capabilities.filter((capability) => managed.has(capability)),
                                reason: "",
                                confirmation: "",
                              },
                              trigger.current,
                            )
                          }
                        >
                          Sửa chức danh
                        </AnchoredActionMenuItem>
                        <AnchoredActionMenuItem
                          onClick={() =>
                            open(
                              { ...emptyPositionDraft(), mode: "inactivate", position: item, code: item.code, name: item.name },
                              trigger.current,
                            )
                          }
                        >
                          Ngừng áp dụng
                        </AnchoredActionMenuItem>
                      </AnchoredActionMenu>
                    ) : (
                      <span className="position-muted">Không có thao tác</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  {positions.length ? "Không có chức danh phù hợp bộ lọc." : "Chưa có chức danh. Thêm chức danh đầu tiên để gán cho nhân sự."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {draft && (
        <div className="student-intake-backdrop" role="presentation">
          <div
            ref={dialog}
            className="student-intake-dialog position-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="position-dialog-title"
            onKeyDown={trap}
          >
            <form className="roster-form student-intake-form" onSubmit={submit} noValidate>
              <h3 id="position-dialog-title">
                {draft.mode === "create"
                  ? "Thêm chức danh"
                  : draft.mode === "edit"
                    ? `Sửa chức danh ${draft.position?.name}`
                    : `Ngừng áp dụng ${draft.position?.name}`}
              </h3>
              <p className="position-muted">Trường: {schoolName}</p>
              {message && Object.keys(errors).length > 0 && (
                <div ref={errorSummary} tabIndex={-1} role="alert">
                  {message}
                </div>
              )}
              {message && !Object.keys(errors).length && <div role="alert">{message}</div>}
              {draft.mode === "inactivate" ? (
                <>
                  <p>
                    {draft.position?.staffCount
                      ? `${draft.position.staffCount} nhân sự đang giữ chức danh này sẽ mất các khả năng thao tác ở yêu cầu kế tiếp.`
                      : "Chưa có nhân sự đang giữ chức danh này."}{" "}
                    Chức danh và lịch sử vẫn được giữ, không bị xóa.
                  </p>
                  <label>
                    Lý do ngừng áp dụng
                    <input
                      value={draft.reason}
                      onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })}
                      {...field("reason")}
                    />
                  </label>
                  {errors.reason && <small id="position-reason-error">{errors.reason}</small>}
                  <label>
                    Nhập tên chức danh "{draft.position?.name}" để xác nhận
                    <input
                      value={draft.confirmation}
                      onChange={(event) => onDraftChange({ ...draft, confirmation: event.target.value })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <fieldset>
                    <legend>Thông tin chức danh</legend>
                    <label>
                      Tên chức danh
                      <input
                        value={draft.name}
                        onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                        {...field("name")}
                      />
                    </label>
                    {draft.mode === "create" ? (
                      <label>
                        Mã chức danh
                        <input
                          value={draft.code}
                          placeholder="Ví dụ: GIAO_VIEN"
                          onChange={(event) => onDraftChange({ ...draft, code: event.target.value.toUpperCase() })}
                          {...field("code")}
                        />
                      </label>
                    ) : (
                      <p className="position-readonly">
                        <span>Mã chức danh</span>
                        <b>{draft.code}</b>
                        <span className="position-muted">Mã không đổi sau khi tạo.</span>
                      </p>
                    )}
                    {errors.name && <small id="position-name-error">{errors.name}</small>}
                    {errors.code && <small id="position-code-error">{errors.code}</small>}
                  </fieldset>
                  <div className="position-capability-picker" role="group" aria-labelledby="position-capability-title">
                    <h4 id="position-capability-title">Khả năng thao tác</h4>
                    <p className="position-muted">
                      Tên chức danh chỉ để nhận biết; nhân sự chỉ làm được những việc được chọn dưới đây.
                    </p>
                    {catalog?.groups.map((group) => (
                      <fieldset key={group.id}>
                        <legend>{group.label}</legend>
                        {group.capabilities.map((capability) => (
                          <label key={capability.code}>
                            <input
                              type="checkbox"
                              checked={draft.capabilities.includes(capability.code)}
                              onChange={() => toggle(capability.code)}
                            />
                            {capability.label}
                          </label>
                        ))}
                      </fieldset>
                    ))}
                    {errors.capabilities && <small id="position-capabilities-error">{errors.capabilities}</small>}
                    {systemGrants(draft.position).length > 0 && (
                      <p className="position-muted">
                        Quyền hệ thống được giữ nguyên:{" "}
                        {systemGrants(draft.position)
                          .map((capability) => labels.get(capability) ?? "Khả năng khác")
                          .join(", ")}
                        .
                      </p>
                    )}
                  </div>
                  <label className="student-intake-full-width">
                    Lý do {draft.mode === "create" ? "tạo chức danh" : "thay đổi"}
                    <input
                      value={draft.reason}
                      onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })}
                      {...field("reason")}
                    />
                  </label>
                  {errors.reason && <small id="position-reason-error">{errors.reason}</small>}
                </>
              )}
              {pending && <p role="status">Đang kiểm tra kết quả với hệ thống…</p>}
              <div className="student-intake-actions">
                <button type="button" disabled={pending} onClick={close}>
                  Hủy
                </button>
                <button
                  className={draft.mode === "inactivate" ? "position-danger" : undefined}
                  disabled={
                    disabled ||
                    (draft.mode === "inactivate" && draft.confirmation.trim() !== draft.position?.name)
                  }
                >
                  {draft.mode === "create"
                    ? "Tạo chức danh"
                    : draft.mode === "edit"
                      ? "Lưu thay đổi"
                      : "Ngừng áp dụng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
