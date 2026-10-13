// Decision 2026-10-02: every School has the same three fixed groups; the API owns the kind and its lock.
export type ReceivableKind = "FIXED" | "FLEXIBLE" | "EXTRACURRICULAR";
export const receivableKinds: Array<{ kind: ReceivableKind; label: string; hint: string }> = [
  {
    kind: "FIXED",
    label: "Khoản thu cố định",
    hint: "Tự thêm vào mỗi đợt thu cho toàn trường hoặc các lớp được chọn; sửa số lượng trong đợt khi cần.",
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
// Sprint change 2026-10-12: a language center calls the extracurricular group "Dịch vụ". One wording per School kind;
// the kind itself and every rule stay the same.
const extracurricularWording = {
  class: {
    label: "Ngoại khóa",
    usedBy: (count: number) => `Đang dùng cho ${count} lớp ngoại khóa`,
    attached: (count: number) => `gắn ${count} lớp ngoại khóa`,
    open: "Xem lớp ngoại khóa",
    locked: "Không đổi được nhóm: khoản thu đã dùng trên hóa đơn hoặc gắn lớp ngoại khóa.",
    guide: "thu theo thành viên của lớp ngoại khóa.",
    lockedGuide: "Khoản thu đã dùng trên hóa đơn hoặc gắn lớp ngoại khóa không đổi được nhóm.",
  },
  service: {
    label: "Dịch vụ",
    hint: "Thu theo dịch vụ; gắn khoản thu vào dịch vụ ở trang Dịch vụ.",
    usedBy: (count: number) => `Đang dùng cho ${count} dịch vụ`,
    attached: (count: number) => `gắn ${count} dịch vụ`,
    open: "Xem dịch vụ",
    locked: "Không đổi được nhóm: khoản thu đã dùng trên hóa đơn hoặc gắn dịch vụ.",
    guide: "thu theo thành viên của dịch vụ.",
    lockedGuide: "Khoản thu đã dùng trên hóa đơn hoặc gắn dịch vụ không đổi được nhóm.",
  },
};
const serviceKinds = receivableKinds.map((item) =>
  item.kind === "EXTRACURRICULAR" ? { ...item, label: extracurricularWording.service.label, hint: extracurricularWording.service.hint } : item,
);
export const receivableWording = (service = false) => ({
  ...extracurricularWording[service ? "service" : "class"],
  kinds: service ? serviceKinds : receivableKinds,
});
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
// Sprint change 2026-10-13: a FIXED receivable applies to the whole School or to chosen classes. The API stores the class list;
// "Các lớp được chọn" with nothing ticked is refused here and never sent as whole School.
export type ReceivableClassOption = { id: string; name: string; schoolYearId: string; schoolYearName: string };
export type ReceivableAppliesTo = "SCHOOL" | "CLASSES";
type ReceivableClassScope = { kind: ReceivableKind | ""; appliesTo: ReceivableAppliesTo; classIds: string[] };
export const receivableClassesError = "Chọn ít nhất một lớp áp dụng.";
export const receivableClassesMissing = (values: ReceivableClassScope) =>
  values.kind === "FIXED" && values.appliesTo === "CLASSES" && !values.classIds.length;
export const receivableClassIds = (values: ReceivableClassScope) =>
  values.kind === "FIXED" && values.appliesTo === "CLASSES" ? values.classIds : [];
export function ReceivableAppliesToField({
  id,
  appliesTo,
  classIds,
  classOptions,
  usesSchoolYears = true,
  onChange,
}: {
  id: string;
  appliesTo: ReceivableAppliesTo;
  classIds: string[];
  classOptions: ReceivableClassOption[];
  usesSchoolYears?: boolean;
  onChange: (values: { appliesTo?: ReceivableAppliesTo; classIds?: string[] }) => void;
}) {
  // A class belongs to one school year; the year is only worth reading when the list mixes years.
  const showYear = usesSchoolYears && new Set(classOptions.map((item) => item.schoolYearId).filter(Boolean)).size > 1;
  return (
    <>
      <fieldset className="chip-group full" aria-describedby={`${id}-hint`}>
        <legend>Áp dụng cho</legend>
        {(
          [
            ["SCHOOL", "Toàn trường"],
            ["CLASSES", "Các lớp được chọn"],
          ] as const
        ).map(([value, label]) => (
          <label key={value}>
            <input type="radio" name={id} value={value} checked={appliesTo === value} onChange={() => onChange({ appliesTo: value })} />
            {label}
          </label>
        ))}
      </fieldset>
      {appliesTo === "CLASSES" && (
        <fieldset className="chip-group full">
          <legend>Lớp áp dụng</legend>
          {classOptions.length ? (
            classOptions.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={classIds.includes(item.id)}
                  onChange={(event) =>
                    onChange({ classIds: event.target.checked ? [...classIds, item.id] : classIds.filter((classId) => classId !== item.id) })
                  }
                />
                {showYear && item.schoolYearName ? `${item.name} · ${item.schoolYearName}` : item.name}
              </label>
            ))
          ) : (
            <small className="muted">Chưa có lớp đang hoạt động.</small>
          )}
        </fieldset>
      )}
      <small className="muted full" id={`${id}-hint`}>
        {appliesTo === "SCHOOL"
          ? usesSchoolYears
            ? "Tự thêm vào mỗi đợt thu cho mọi học sinh."
            : "Tự thêm vào đợt thu của mọi lớp."
          : usesSchoolYears
            ? "Chọn ít nhất một lớp. Đợt thu mở sau chỉ tự thêm khoản này cho các lớp đã chọn; sang năm học mới cần chọn lại lớp."
            : "Chọn ít nhất một lớp. Chỉ đợt thu mở sau của các lớp đã chọn tự thêm khoản này."}
      </small>
    </>
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
  appliesTo: ReceivableAppliesTo;
  classIds: string[];
};
// Only changed fields go to the edit command; a locked kind is never sent. `classIds` is the whole new list and only goes with a
// FIXED kind: the API drops the classes itself when the kind changes away.
export function receivableEditChanges(edit: { values: ReceivableEditValues; original: ReceivableEditValues; locked: boolean }) {
  const changed = Object.fromEntries(
    (Object.keys(edit.values) as Array<keyof ReceivableEditValues>)
      .filter((key) => key !== "appliesTo" && key !== "classIds")
      .filter((key) => edit.values[key] !== edit.original[key] && !(key === "kind" && edit.locked))
      .map((key) => [key, edit.values[key]]),
  ) as Partial<Omit<ReceivableEditValues, "appliesTo">>;
  const next = receivableClassIds(edit.values);
  const before = receivableClassIds(edit.original);
  if (
    edit.values.kind === "FIXED" &&
    !receivableClassesMissing(edit.values) &&
    (next.length !== before.length || next.some((id) => !before.includes(id)))
  )
    changed.classIds = next;
  return changed;
}
export const receivableEditValues = (item: {
  displayName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  refundUnitPrice?: string;
  autoLeaveDeduction?: boolean;
  taxCategory?: TaxCategory;
  kind?: ReceivableKind | null;
  appliesToClassIds?: string[];
}): ReceivableEditValues => ({
  displayName: item.displayName,
  unitLabel: item.unitLabel,
  defaultUnitPrice: item.defaultUnitPrice,
  refundUnitPrice: item.refundUnitPrice ?? "0",
  autoLeaveDeduction: item.autoLeaveDeduction ?? false,
  taxCategory: item.taxCategory ?? "NOT_DECLARED",
  kind: item.kind ?? "FLEXIBLE",
  appliesTo: item.appliesToClassIds?.length ? "CLASSES" : "SCHOOL",
  classIds: item.appliesToClassIds ?? [],
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
  service = false,
  classOptions = [],
  usesSchoolYears = true,
}: {
  values: ReceivableEditValues;
  locked: boolean;
  reason: string;
  classNames: string[];
  service?: boolean;
  classOptions?: ReceivableClassOption[];
  usesSchoolYears?: boolean;
  onChange: (values: Partial<ReceivableEditValues>) => void;
  onReason: (reason: string) => void;
  field: (name: string) => object;
}) {
  const t = receivableWording(service);
  return (
    <div className="dialog-grid">
      {classNames.length > 0 && (
        <p className="full">
          {t.usedBy(classNames.length)}: {classNames.join(", ")}.
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
        {t.kinds.map((item) => (
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
          ? t.locked
          : t.kinds.find((item) => item.kind === values.kind)?.hint}
      </small>
      {values.kind === "FIXED" && (
        <ReceivableAppliesToField
          id="receivable-edit-applies-to"
          appliesTo={values.appliesTo}
          classIds={values.classIds}
          classOptions={classOptions}
          usesSchoolYears={usesSchoolYears}
          onChange={onChange}
        />
      )}
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
