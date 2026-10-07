// Decision 2026-10-02: every School has the same three fixed groups; the API owns the kind and its lock.
export type ReceivableKind = "FIXED" | "FLEXIBLE" | "EXTRACURRICULAR";
export const receivableKinds: Array<{ kind: ReceivableKind; label: string; hint: string }> = [
  {
    kind: "FIXED",
    label: "Khoản thu cố định",
    hint: "Tự thêm vào mỗi đợt thu cho toàn bộ học sinh; sửa số lượng trong đợt khi cần.",
  },
  {
    kind: "FLEXIBLE",
    label: "Khoản thu linh hoạt",
    hint: "Thêm vào đợt thu khi cần, chọn phạm vi: toàn bộ, lớp chính thức hoặc học sinh cụ thể.",
  },
  {
    kind: "EXTRACURRICULAR",
    label: "Ngoại khóa",
    hint: "Thu theo lớp ngoại khóa; gắn khoản thu vào lớp ở trang Lớp ngoại khóa.",
  },
];
export type TaxCategory = "NOT_DECLARED" | "EXEMPT" | "VAT_0" | "VAT_5" | "VAT_8" | "VAT_10";
// Labels follow the reviewed receivable mockup; the API alone derives rate, VAT and channel.
export const taxCategoryOptions: Array<[TaxCategory, string]> = [
  ["NOT_DECLARED", "Không kê khai nộp thuế"],
  ["EXEMPT", "Không chịu thuế"],
  ["VAT_0", "Thuế suất 0%"],
  ["VAT_5", "Thuế suất 5%"],
  ["VAT_8", "Thuế suất 8%"],
  ["VAT_10", "Thuế suất 10%"],
];
export const taxChannelHint = (category: TaxCategory) =>
  category === "NOT_DECLARED" ? "Thu vào tài khoản cá nhân" : "Thu vào tài khoản trường";
// Decision 2026-10-07: the unit stays free text; these are suggestions so Finance types the same words.
export const unitSuggestions = ["tháng", "năm", "ngày", "buổi", "unit", "lần", "bộ", "cái"];
export function UnitSuggestions({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {unitSuggestions.map((unit) => (
        <option key={unit} value={unit} />
      ))}
    </datalist>
  );
}
// Bớt is proposed from last month's approved leave days only when this is on; otherwise Finance types Bớt on the invoice line.
export function AutoLeaveDeductionField({
  id,
  checked,
  refundUnitPrice,
  onChange,
  field,
}: {
  id: string;
  checked: boolean;
  refundUnitPrice: string;
  onChange: (checked: boolean) => void;
  field: (name: string) => object;
}) {
  const noRefund = !/^\d+$/.test(refundUnitPrice) || BigInt(refundUnitPrice) === 0n;
  return (
    <div className="full">
      <label className="finance-checkbox">
        <input
          type="checkbox"
          checked={checked}
          disabled={noRefund && !checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={`${id}-hint`}
          {...field("autoLeaveDeduction")}
        />
        Tự động trừ theo ngày nghỉ có phép
      </label>
      <small className="muted" id={`${id}-hint`}>
        {noRefund
          ? "Nhập giá hoàn trả để bật. Không bật thì kế toán nhập Bớt trên dòng hóa đơn khi cần."
          : "Mỗi đợt thu đề xuất Bớt = số ngày nghỉ có phép tháng trước × giá hoàn trả. Không bật thì kế toán nhập Bớt trên dòng hóa đơn khi cần."}
      </small>
    </div>
  );
}
export type ReceivableEditValues = {
  displayName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  refundUnitPrice: string;
  autoLeaveDeduction: boolean;
  taxCategory: TaxCategory;
  kind: ReceivableKind;
};
// Only changed fields go to the edit command; a locked kind is never sent.
export function receivableEditChanges(edit: { values: ReceivableEditValues; original: ReceivableEditValues; locked: boolean }) {
  return Object.fromEntries(
    (Object.keys(edit.values) as Array<keyof ReceivableEditValues>)
      .filter((key) => edit.values[key] !== edit.original[key] && !(key === "kind" && edit.locked))
      .map((key) => [key, edit.values[key]]),
  ) as Partial<ReceivableEditValues>;
}
export const receivableEditValues = (item: {
  displayName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  refundUnitPrice?: string;
  autoLeaveDeduction?: boolean;
  taxCategory?: TaxCategory;
  kind?: ReceivableKind | null;
}): ReceivableEditValues => ({
  displayName: item.displayName,
  unitLabel: item.unitLabel,
  defaultUnitPrice: item.defaultUnitPrice,
  refundUnitPrice: item.refundUnitPrice ?? "0",
  autoLeaveDeduction: item.autoLeaveDeduction ?? false,
  taxCategory: item.taxCategory ?? "NOT_DECLARED",
  kind: item.kind ?? "FLEXIBLE",
});

// The fields of the one `Chỉnh sửa khoản thu` dialog (decision 2026-10-06), shared by the Khoản thu page and the extracurricular class
// page so both send the same command. The host owns the dialog shell, the submit and error display.
export function ReceivableEditFields({
  values,
  locked,
  reason,
  classNames,
  onChange,
  onReason,
  field,
}: {
  values: ReceivableEditValues;
  locked: boolean;
  reason: string;
  classNames: string[];
  onChange: (values: Partial<ReceivableEditValues>) => void;
  onReason: (reason: string) => void;
  field: (name: string) => object;
}) {
  return (
    <div className="dialog-grid">
      {classNames.length > 0 && (
        <p className="full">
          Đang dùng cho {classNames.length} lớp ngoại khóa: {classNames.join(", ")}.
        </p>
      )}
      <label>
        Tên khoản thu
        <input value={values.displayName} onChange={(event) => onChange({ displayName: event.target.value })} {...field("displayName")} />
      </label>
      <label>
        Đơn vị tính
        <input
          list="receivable-edit-units"
          value={values.unitLabel}
          onChange={(event) => onChange({ unitLabel: event.target.value })}
          {...field("unitLabel")}
        />
        <UnitSuggestions id="receivable-edit-units" />
      </label>
      <fieldset className="chip-group full" disabled={locked} aria-describedby="receivable-edit-kind-hint">
        <legend>Nhóm khoản thu</legend>
        {receivableKinds.map((item) => (
          <label key={item.kind}>
            <input
              type="radio"
              name="receivable-edit-kind"
              value={item.kind}
              checked={values.kind === item.kind}
              onChange={() => onChange({ kind: item.kind })}
            />
            {item.label}
          </label>
        ))}
      </fieldset>
      <small className="muted full" id="receivable-edit-kind-hint">
        {locked
          ? "Không đổi được nhóm: khoản thu đã dùng trên hóa đơn hoặc gắn lớp ngoại khóa."
          : receivableKinds.find((item) => item.kind === values.kind)?.hint}
      </small>
      <label>
        Giá / đơn vị (chưa VAT)
        <input
          inputMode="numeric"
          value={values.defaultUnitPrice}
          onChange={(event) => onChange({ defaultUnitPrice: event.target.value })}
          {...field("defaultUnitPrice")}
        />
      </label>
      <div>
        <label>
          Giá hoàn trả / đơn vị (chưa VAT)
          <input
            inputMode="numeric"
            value={values.refundUnitPrice}
            onChange={(event) => {
              const refundUnitPrice = event.target.value;
              onChange({ refundUnitPrice, ...(/^0*$/.test(refundUnitPrice) ? { autoLeaveDeduction: false } : {}) });
            }}
            aria-describedby="receivable-edit-refund-hint"
            {...field("refundUnitPrice")}
          />
        </label>
        <small className="muted" id="receivable-edit-refund-hint">
          Số tiền trả lại cho mỗi đơn vị bớt, không vượt giá thu. Để 0 nếu không hoàn trả.
        </small>
      </div>
      <div>
        <label>
          Mức thuế suất
          <select
            value={values.taxCategory}
            onChange={(event) => onChange({ taxCategory: event.target.value as TaxCategory })}
            aria-describedby="receivable-edit-tax-hint"
            {...field("taxCategory")}
          >
            {taxCategoryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <small className="muted" id="receivable-edit-tax-hint">
          {taxChannelHint(values.taxCategory)}
        </small>
      </div>
      <AutoLeaveDeductionField
        id="receivable-edit-auto"
        checked={values.autoLeaveDeduction}
        refundUnitPrice={values.refundUnitPrice}
        onChange={(autoLeaveDeduction) => onChange({ autoLeaveDeduction })}
        field={field}
      />
      <label>
        Lý do
        <input placeholder="Bắt buộc" value={reason} onChange={(event) => onReason(event.target.value)} {...field("reason")} />
      </label>
      <p className="muted full">
        Đổi giá, giá hoàn trả hoặc mức thuế chỉ áp dụng cho dòng hóa đơn thêm mới hoặc làm mới sau đó; đợt thu còn nháp cần xem
        trước lại.
      </p>
    </div>
  );
}
