import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

type Group = { id: string; name: string; status: "ACTIVE" | "INACTIVE" | null };
type Receivable = {
  id: string;
  groupId: string;
  code: string | null;
  displayName: string;
  unitLabel: string;
  defaultUnitPrice: string;
  status: "ACTIVE" | "INACTIVE" | null;
  available: boolean;
};
type Catalog = { groups: Group[]; receivables: Receivable[] };
type Year = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  closedAt: string | null;
};
type Candidate = { id: string; studentCode: string; fullName: string };
type Candidates = { schoolYears: Year[]; students: Candidate[] };
type Run = {
  id: string;
  schoolYearId: string;
  billingMonth: string;
  type: "MONTHLY";
  status: "DRAFT" | "READY" | "GENERATED" | "CLOSED";
  version: number;
  selectedStudentIds: string[];
};
type Preview = {
  run: Run;
  eligible: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    className: string;
  }>;
  skips: Array<{
    studentId: string;
    studentCode?: string;
    fullName?: string;
    reason: string;
  }>;
  fingerprint: string;
};
type GenerateOutcome = {
  run: Run;
  created: Array<{
    studentId: string;
    studentCode: string;
    fullName: string;
    className: string;
  }>;
  skipped: Array<{
    studentId: string;
    studentCode?: string;
    fullName?: string;
    reason: string;
  }>;
};
type Pending = { id: string; schoolId: string };
type Lifecycle = {
  kind: "receivable-groups" | "receivables";
  id: string;
  name: string;
  next: "ACTIVE" | "INACTIVE";
  reason: string;
};
export type FinanceStatus = {
  dirty: boolean;
  pending: boolean;
  reconcile?: () => void;
};

const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName =
  typeof __CSRF_COOKIE_NAME__ === "undefined"
    ? "app_csrf"
    : __CSRF_COOKIE_NAME__;
const pendingKey = "passionedu.app.pending-finance-operation";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${csrfName}=`))
    ?.slice(csrfName.length + 1);
const uncertain = (status: number) => [408, 502, 503, 504].includes(status);
const skipReason = (reason: string) =>
  ({
    NO_ENROLLMENT: "Không còn hồ sơ nhập học.",
    ENROLLMENT_NOT_EFFECTIVE: "Nhập học không hiệu lực vào đầu tháng thu.",
    NOT_ENROLLED: "Học sinh không ở trạng thái đang theo học.",
    NO_CLASS_ASSIGNMENT: "Chưa có lớp được phân công hiệu lực vào đầu tháng thu.",
    CLASS_INACTIVE: "Lớp được phân công đã ngừng hoạt động.",
    INVOICE_EXISTS: "Học sinh đã có hóa đơn trong đợt thu này.",
  })[reason] ?? "Không đủ điều kiện theo roster hiện tại.";

export function FinanceWorkspace({
  schoolId,
  schoolName,
  denied,
  onStatusChange,
}: {
  schoolId: string;
  schoolName: string;
  denied: () => void;
  onStatusChange?: (status: FinanceStatus) => void;
}) {
  const [catalog, setCatalog] = useState<Catalog>();
  const [candidates, setCandidates] = useState<Candidates>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [run, setRun] = useState<Run>();
  const [preview, setPreview] = useState<Preview>();
  const [generateConfirmation, setGenerateConfirmation] = useState(false);
  const [generateConfirmationMonth, setGenerateConfirmationMonth] = useState("");
  const [additionConfirmation, setAdditionConfirmation] = useState<Candidate>();
  const [additionConfirmationName, setAdditionConfirmationName] = useState("");
  const [generatedOutcome, setGeneratedOutcome] = useState<GenerateOutcome>();
  const [open, setOpen] = useState({ schoolYearId: "", billingMonth: "" });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [group, setGroup] = useState({ name: "" });
  const [receivable, setReceivable] = useState({
    groupId: "",
    code: "",
    displayName: "",
    unitLabel: "",
    defaultUnitPrice: "",
  });
  const [lifecycle, setLifecycle] = useState<Lifecycle>();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"group" | "receivable" | "lifecycle">(
    "group",
  );
  const [pending, setPending] = useState<Pending>();
  const activeSchool = useRef(schoolId);
  const summary = useRef<HTMLDivElement>(null);
  const status = useRef(onStatusChange);
  const submitting = useRef(false);
  const request = useRef(0);
  const reconciliationTimer = useRef<number | undefined>(undefined);

  const get = async <T,>(path: string, mutation = false) => {
    const response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
      headers: mutation
        ? { "x-csrf-token": decodeURIComponent(csrf() ?? "") }
        : undefined,
    });
    if ([401, 403].includes(response.status)) {
      denied();
      throw new Error();
    }
    if (!response.ok) throw new Error("Không thể tải dữ liệu Finance.");
    return ((await response.json()) as { data: T }).data;
  };
  const load = async () => {
    const token = ++request.current;
    const [nextCatalog, nextRuns, nextCandidates] = await Promise.all([
      get<Catalog>(`/api/app/schools/${schoolId}/finance/receivables`),
      get<{ runs: Run[] }>(
        `/api/app/schools/${schoolId}/finance/collection-runs`,
      ),
      get<Candidates>(
        `/api/app/schools/${schoolId}/finance/collection-run-candidates${(run?.schoolYearId ?? open.schoolYearId) ? `?schoolYearId=${run?.schoolYearId ?? open.schoolYearId}` : ""}`,
      ),
    ]);
    if (activeSchool.current !== schoolId || token !== request.current) return;
    setCatalog(nextCatalog);
    setRuns(nextRuns.runs);
    setCandidates(nextCandidates);
    if (run) setRun(nextRuns.runs.find((item) => item.id === run.id));
  };
  const loadCandidates = async (yearId: string) => {
    const token = ++request.current;
    const next = await get<Candidates>(
      `/api/app/schools/${schoolId}/finance/collection-run-candidates${yearId ? `?schoolYearId=${yearId}` : ""}`,
    );
    if (activeSchool.current === schoolId && token === request.current)
      setCandidates(next);
  };
  const reconcile = async (operation: Pending) => {
    if (operation.schoolId !== activeSchool.current) return;
    const token = ++request.current;
    setPending(operation);
    try {
      const result = await get<{ status: string; outcome?: unknown }>(
        `/api/app/schools/${operation.schoolId}/finance/operations/${operation.id}`,
      );
      if (
        activeSchool.current !== operation.schoolId ||
        token !== request.current
      )
        return;
      if (result.status === "PENDING") {
        reconciliationTimer.current = window.setTimeout(
          () => void reconcile(operation),
          750,
        );
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      submitting.current = false;
      if (result.status === "COMPLETED") {
        if ((result.outcome as GenerateOutcome | undefined)?.created)
          setGeneratedOutcome(result.outcome as GenerateOutcome);
        await load();
      } else setMessage("Thao tác không thành công.");
    } catch {
      if (
        activeSchool.current === operation.schoolId &&
        token === request.current
      )
        setMessage(
          "Chưa thể xác nhận Operation. Mã thao tác được giữ lại để đối soát sau.",
        );
    }
  };
  useEffect(() => {
    activeSchool.current = schoolId;
    submitting.current = false;
    ++request.current;
    if (reconciliationTimer.current)
      window.clearTimeout(reconciliationTimer.current);
    setCatalog(undefined);
    setCandidates(undefined);
    setRuns([]);
    setRun(undefined);
    setPreview(undefined);
    setGenerateConfirmation(false);
    setGenerateConfirmationMonth("");
    setAdditionConfirmation(undefined);
    setAdditionConfirmationName("");
    setGeneratedOutcome(undefined);
    setOpen({ schoolYearId: "", billingMonth: "" });
    setSelectedStudentIds([]);
    setGroup({ name: "" });
    setReceivable({
      groupId: "",
      code: "",
      displayName: "",
      unitLabel: "",
      defaultUnitPrice: "",
    });
    setLifecycle(undefined);
    setErrors({});
    setMessage("");
    void load().catch(
      (error: Error) =>
        activeSchool.current === schoolId && setMessage(error.message),
    );
    const saved = sessionStorage.getItem(pendingKey);
    if (saved)
      try {
        const operation = JSON.parse(saved) as Pending;
        if (uuid.test(operation.id) && operation.schoolId === schoolId)
          void reconcile(operation);
        else sessionStorage.removeItem(pendingKey);
      } catch {
        sessionStorage.removeItem(pendingKey);
      }
    return () => {
      ++request.current;
      if (reconciliationTimer.current)
        window.clearTimeout(reconciliationTimer.current);
    };
  }, [schoolId]);
  const dirty = Boolean(
    open.schoolYearId ||
    open.billingMonth ||
    selectedStudentIds.length ||
    group.name ||
    receivable.groupId ||
    receivable.code ||
    receivable.displayName ||
    receivable.unitLabel ||
    receivable.defaultUnitPrice ||
    lifecycle?.reason,
  );
  useEffect(() => {
    status.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    status.current?.({
      dirty,
      pending: Boolean(pending),
      reconcile: pending ? () => void reconcile(pending) : undefined,
    });
  }, [dirty, pending]);
  useLayoutEffect(() => {
    if (message || Object.keys(errors).length) summary.current?.focus();
  }, [message, errors]);
  const command = async (
    path: string,
    method: "POST" | "PUT",
    body: object,
    nextScope?: typeof scope,
  ) => {
    if (submitting.current || pending) return undefined;
    const token = ++request.current;
    submitting.current = true;
    const operation = { id: crypto.randomUUID(), schoolId };
    setMessage("");
    setErrors({});
    if (nextScope) setScope(nextScope);
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method,
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": decodeURIComponent(csrf() ?? ""),
          "idempotency-key": crypto.randomUUID(),
          "x-operation-id": operation.id,
        },
        body: JSON.stringify(body),
      });
      if ([401, 403].includes(response.status)) {
        denied();
        return undefined;
      }
      if (uncertain(response.status)) {
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        if (activeSchool.current === schoolId && token === request.current) {
          setPending(operation);
          setMessage(
            "Kết quả chưa chắc chắn. Đang đối soát Operation trước khi thử lại.",
          );
          void reconcile(operation);
        }
        return undefined;
      }
      if (!response.ok) {
        const error = (
          (await response.json()) as {
            error?: { message?: string; fieldErrors?: Record<string, string> };
          }
        ).error;
        if (activeSchool.current === schoolId && token === request.current) {
          setErrors(error?.fieldErrors ?? {});
          setMessage(error?.message ?? "Thao tác không thành công.");
        }
        return undefined;
      }
      const outcome = ((await response.json()) as { data: { outcome: any } })
        .data.outcome;
      if (activeSchool.current !== schoolId || token !== request.current)
        return undefined;
      return outcome;
    } catch {
      sessionStorage.setItem(pendingKey, JSON.stringify(operation));
      if (activeSchool.current === schoolId && token === request.current) {
        setPending(operation);
        setMessage(
          "Kết nối bị gián đoạn. Đang đối soát Operation trước khi thử lại.",
        );
        void reconcile(operation);
      }
      return undefined;
    } finally {
      if (!pending) submitting.current = false;
    }
  };
  const chooseRun = (next: Run) => {
    setRun(next);
    setSelectedStudentIds(next.selectedStudentIds);
    setPreview(undefined);
    void loadCandidates(next.schoolYearId).catch(() =>
      setMessage("Không thể tải danh sách học sinh."),
    );
  };
  const openRun = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs`,
      "POST",
      open,
    );
    if (outcome) {
      setOpen({ schoolYearId: "", billingMonth: "" });
      chooseRun(outcome as Run);
      await load();
    }
  };
  const saveSelection = async (event: FormEvent) => {
    event.preventDefault();
    if (!run) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/selection`,
      "PUT",
      { studentIds: selectedStudentIds },
    );
    if (outcome) {
      chooseRun(outcome as Run);
      await load();
    }
  };
  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
    setPreview(undefined);
  };
  const loadPreview = async () => {
    if (!run) return;
    const runId = run.id;
    const token = ++request.current;
    setMessage("");
    try {
      const next = await get<Preview>(
        `/api/app/schools/${schoolId}/finance/collection-runs/${runId}/preview`,
        true,
      );
      if (
        activeSchool.current === schoolId &&
        token === request.current &&
        runId === run.id
      )
        setPreview(next);
    } catch {
      if (activeSchool.current === schoolId && token === request.current)
        setMessage("Không thể tạo bản xem trước.");
    }
  };
  const ready = async () => {
    if (!run || !preview) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/ready`,
      "POST",
      { previewFingerprint: preview.fingerprint },
    );
    if (outcome) {
      chooseRun(outcome as Run);
      await load();
    }
  };
  const generate = async () => {
    if (!run) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/generate`,
      "POST",
      {},
    );
    if (outcome) {
      setGenerateConfirmation(false);
      setGenerateConfirmationMonth("");
      setGeneratedOutcome(outcome as GenerateOutcome);
      chooseRun((outcome as GenerateOutcome).run);
      await load();
    }
  };
  const addGeneratedStudent = async () => {
    if (!run || !additionConfirmation) return;
    const outcome = await command(
      `/api/app/schools/${schoolId}/finance/collection-runs/${run.id}/generated-students`,
      "POST",
      { studentId: additionConfirmation.id },
    );
    if (outcome) {
      setAdditionConfirmation(undefined);
      setAdditionConfirmationName("");
      setGeneratedOutcome(outcome as GenerateOutcome);
      await load();
    }
  };
  const saveGroup = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await command(
        `/api/app/schools/${schoolId}/finance/receivable-groups`,
        "POST",
        group,
        "group",
      )
    ) {
      setGroup({ name: "" });
      await load();
    }
  };
  const saveReceivable = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await command(
        `/api/app/schools/${schoolId}/finance/receivables`,
        "POST",
        receivable,
        "receivable",
      )
    ) {
      setReceivable({
        groupId: "",
        code: "",
        displayName: "",
        unitLabel: "",
        defaultUnitPrice: "",
      });
      await load();
    }
  };
  const saveLifecycle = async (event: FormEvent) => {
    event.preventDefault();
    if (!lifecycle) return;
    if (
      await command(
        `/api/app/schools/${schoolId}/finance/${lifecycle.kind}/${lifecycle.id}/lifecycle`,
        "POST",
        { status: lifecycle.next, reason: lifecycle.reason },
        "lifecycle",
      )
    ) {
      setLifecycle(undefined);
      await load();
    }
  };
  const field = (nextScope: typeof scope, name: string) =>
    scope === nextScope && errors[name]
      ? {
          "aria-invalid": true,
          "aria-describedby": `${nextScope}-${name}-error`,
        }
      : {};

  return (
    <section aria-labelledby="finance-title">
      <h2 id="finance-title">Finance</h2>
      <p>
        {schoolName} / Eligibility, lifecycle và đơn giá được máy chủ xác nhận.
      </p>
      {message && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      <section>
        <h3>Nhóm khoản thu</h3>
        <form onSubmit={saveGroup}>
          <label>
            Tên nhóm
            <input
              value={group.name}
              onChange={(event) => setGroup({ name: event.target.value })}
              {...field("group", "name")}
            />
          </label>
          {scope === "group" && errors.name && (
            <small id="group-name-error">{errors.name}</small>
          )}
          <button disabled={Boolean(pending)}>Thêm nhóm</button>
        </form>
        <table>
          <caption>Nhóm khoản thu theo trường</caption>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {catalog?.groups.length ? (
              catalog.groups.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    {item.status === "ACTIVE"
                      ? "Đang áp dụng"
                      : "Ngừng áp dụng"}
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() =>
                        setLifecycle({
                          kind: "receivable-groups",
                          id: item.id,
                          name: item.name,
                          next:
                            item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          reason: "",
                        })
                      }
                    >
                      {item.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>
                  {catalog
                    ? "Chưa có nhóm khoản thu."
                    : "Đang tải nhóm khoản thu."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Khoản thu</h3>
        <form onSubmit={saveReceivable}>
          <label>
            Nhóm
            <select
              value={receivable.groupId}
              onChange={(event) =>
                setReceivable({ ...receivable, groupId: event.target.value })
              }
              {...field("receivable", "groupId")}
            >
              <option value="">Chọn nhóm</option>
              {(catalog?.groups ?? [])
                .filter((item) => item.status === "ACTIVE")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Mã khoản thu
            <input
              value={receivable.code}
              onChange={(event) =>
                setReceivable({ ...receivable, code: event.target.value })
              }
            />
          </label>
          <label>
            Tên khoản thu
            <input
              value={receivable.displayName}
              onChange={(event) =>
                setReceivable({
                  ...receivable,
                  displayName: event.target.value,
                })
              }
              {...field("receivable", "displayName")}
            />
          </label>
          <label>
            Đơn vị
            <input
              value={receivable.unitLabel}
              onChange={(event) =>
                setReceivable({ ...receivable, unitLabel: event.target.value })
              }
              {...field("receivable", "unitLabel")}
            />
          </label>
          <label>
            Đơn giá mặc định (VND)
            <input
              inputMode="numeric"
              value={receivable.defaultUnitPrice}
              onChange={(event) =>
                setReceivable({
                  ...receivable,
                  defaultUnitPrice: event.target.value,
                })
              }
              {...field("receivable", "defaultUnitPrice")}
            />
          </label>
          {scope === "receivable" &&
            Object.entries(errors).map(([name, error]) => (
              <small key={name} id={`receivable-${name}-error`}>
                {error}
              </small>
            ))}
          <button disabled={Boolean(pending)}>Thêm khoản thu</button>
        </form>
        <table>
          <caption>Khoản thu theo trường</caption>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên</th>
              <th>Đơn vị</th>
              <th>Đơn giá VND</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {catalog?.receivables.length ? (
              catalog.receivables.map((item) => (
                <tr key={item.id}>
                  <td>{item.code ?? ""}</td>
                  <td>{item.displayName}</td>
                  <td>{item.unitLabel}</td>
                  <td>{item.defaultUnitPrice}</td>
                  <td>{item.available ? "Đang áp dụng" : "Ngừng áp dụng"}</td>
                  <td>
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() =>
                        setLifecycle({
                          kind: "receivables",
                          id: item.id,
                          name: item.displayName,
                          next:
                            item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          reason: "",
                        })
                      }
                    >
                      {item.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  {catalog ? "Chưa có khoản thu." : "Đang tải khoản thu."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Mở đợt thu tháng</h3>
        <form onSubmit={openRun}>
          <label>
            Năm học
            <select
              value={open.schoolYearId}
              onChange={(event) => {
                const schoolYearId = event.target.value;
                setOpen({ ...open, schoolYearId });
                setPreview(undefined);
                void loadCandidates(schoolYearId).catch(() =>
                  setMessage("Không thể tải danh sách học sinh."),
                );
              }}
              aria-invalid={Boolean(errors.schoolYearId)}
            >
              <option value="">Chọn năm học</option>
              {candidates?.schoolYears?.map((year) => (
                <option
                  key={year.id}
                  value={year.id}
                  disabled={Boolean(year.closedAt)}
                >
                  {year.name}
                  {year.closedAt ? " (đã đóng)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tháng thu
            <input
              type="month"
              value={open.billingMonth}
              onChange={(event) =>
                setOpen({ ...open, billingMonth: event.target.value })
              }
              aria-invalid={Boolean(errors.billingMonth)}
            />
          </label>
          <button disabled={Boolean(pending)}>Mở hoặc vào đợt thu</button>
        </form>
        <table>
          <caption>Đợt thu theo trường</caption>
          <thead>
            <tr>
              <th>Tháng</th>
              <th>Năm học</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {runs.length ? (
              runs.map((item) => (
                <tr key={item.id}>
                  <td>{item.billingMonth}</td>
                  <td>
                    {candidates?.schoolYears?.find(
                      (year) => year.id === item.schoolYearId,
                    )?.name ?? item.schoolYearId}
                  </td>
                  <td>{item.status}</td>
                  <td>
                    <button type="button" onClick={() => chooseRun(item)}>
                      Mở chi tiết
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  {catalog ? "Chưa có đợt thu." : "Đang tải đợt thu."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      {run && (
        <section aria-labelledby="run-detail-title">
          <h3 id="run-detail-title">
            Đợt thu {run.billingMonth} / {run.status}
          </h3>
          <p>
            Năm học:{" "}
            {candidates?.schoolYears?.find(
              (year) => year.id === run.schoolYearId,
            )?.name ?? run.schoolYearId}
            . Đã chọn {selectedStudentIds.length} học sinh.
          </p>
          {run.status === "DRAFT" && (
            <>
              <form onSubmit={saveSelection}>
                <table>
                  <caption>
                    Chọn học sinh thuộc năm học từ dữ liệu máy chủ
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Chọn</th>
                      <th scope="col">Mã học sinh</th>
                      <th scope="col">Họ tên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates?.students?.length ? (
                      candidates.students.map((student) => (
                        <tr key={student.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Chọn ${student.studentCode} ${student.fullName}`}
                              checked={selectedStudentIds.includes(student.id)}
                              onChange={() => toggleStudent(student.id)}
                            />
                          </td>
                          <td>{student.studentCode}</td>
                          <td>{student.fullName}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          Không có học sinh trong năm học này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <button disabled={Boolean(pending)}>
                  Lưu danh sách đã chọn
                </button>
              </form>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void loadPreview()}
              >
                Xem trước từ máy chủ
              </button>
            </>
          )}
          {preview && (
            <section aria-labelledby="preview-title">
              <h4 id="preview-title">Xem trước authoritative</h4>
              <table>
                <caption>Học sinh đủ điều kiện</caption>
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Lớp</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.eligible.length ? (
                    preview.eligible.map((item) => (
                      <tr key={item.studentId}>
                        <td>
                          {item.studentCode} / {item.fullName}
                        </td>
                        <td>{item.className}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2}>Không có học sinh đủ điều kiện.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <table>
                <caption>Học sinh bị bỏ qua</caption>
                <thead>
                  <tr>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.skips.length ? (
                    preview.skips.map((item, index) => (
                      <tr key={item.studentId}>
                        <td>
                          {index + 1}. {item.studentCode && item.fullName
                            ? `${item.studentCode} / ${item.fullName}: `
                            : ""}
                          {skipReason(item.reason)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td>Không có học sinh bị bỏ qua.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void ready()}
              >
                Xác nhận preview và chuyển READY
              </button>
            </section>
          )}
        </section>
      )}
      {run?.status === "READY" && (
        <button
          type="button"
          disabled={Boolean(pending)}
                  onClick={() => {
                    setGenerateConfirmationMonth("");
                    setGenerateConfirmation(true);
                  }}
        >
          Tạo hóa đơn nháp
        </button>
      )}
      {run?.status === "GENERATED" && (
        <section aria-labelledby="generated-student-addition-title">
          <h3 id="generated-student-addition-title">Thêm học sinh vào đợt đã tạo</h3>
          <p>Máy chủ sẽ tự xác nhận điều kiện tại thời điểm roster và hóa đơn hiện có.</p>
          <table>
            <caption>Học sinh có thể yêu cầu thêm</caption>
            <tbody>
              {(candidates?.students ?? []).map((student) => (
                <tr key={student.id}>
                  <td>{student.studentCode} / {student.fullName}</td>
                  <td><button type="button" disabled={Boolean(pending)} onClick={() => { setAdditionConfirmation(student); setAdditionConfirmationName(""); }}>Yêu cầu thêm</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {generatedOutcome && (
        <section aria-labelledby="generated-outcome-title">
          <h3 id="generated-outcome-title">Kết quả tạo hóa đơn từ máy chủ</h3>
          <p>
            Đã tạo {generatedOutcome.created.length} hóa đơn nháp; bỏ qua{" "}
            {generatedOutcome.skipped.length} học sinh.
          </p>
          <table>
            <caption>Hóa đơn nháp đã tạo</caption>
            <tbody>
              {generatedOutcome.created.map((item) => (
                <tr key={item.studentId}>
                  <td>
                    {item.studentCode} / {item.fullName}
                  </td>
                  <td>{item.className}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <caption>Học sinh bị bỏ qua khi tạo</caption>
            <tbody>
              {generatedOutcome.skipped.map((item) => (
                <tr key={item.studentId}>
                    <td>
                      {item.studentCode && item.fullName
                        ? `${item.studentCode} / ${item.fullName}: `
                        : ""}
                      {skipReason(item.reason)}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {generateConfirmation && run && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-generate-title"
        >
          <h3 id="finance-generate-title">
            Xác nhận tạo hóa đơn nháp cho đợt {run.billingMonth}
          </h3>
              <p>Máy chủ sẽ đánh giá lại roster trước khi tạo hóa đơn.</p>
              <label>
                Nhập chính xác tháng thu {run.billingMonth} để xác nhận
                <input
                  autoFocus
                  value={generateConfirmationMonth}
                  onChange={(event) =>
                    setGenerateConfirmationMonth(event.target.value)
                  }
                />
              </label>
              <button
                disabled={Boolean(pending) || generateConfirmationMonth !== run.billingMonth}
                onClick={() => void generate()}
              >
            Xác nhận tạo hóa đơn nháp
          </button>
          <button
            type="button"
            disabled={Boolean(pending)}
                onClick={() => {
                  setGenerateConfirmation(false);
                  setGenerateConfirmationMonth("");
                }}
          >
            Hủy
          </button>
        </div>
      )}
      {additionConfirmation && run && (
        <div role="dialog" aria-modal="true" aria-labelledby="finance-add-student-title">
          <h3 id="finance-add-student-title">Xác nhận thêm {additionConfirmation.fullName}</h3>
          <p>Máy chủ có thể từ chối nếu học sinh không đủ điều kiện hoặc đã có hóa đơn.</p>
          <label>
            Nhập chính xác tên học sinh {additionConfirmation.fullName} để xác nhận
            <input autoFocus value={additionConfirmationName} onChange={(event) => setAdditionConfirmationName(event.target.value)} />
          </label>
          <button disabled={Boolean(pending) || additionConfirmationName !== additionConfirmation.fullName} onClick={() => void addGeneratedStudent()}>Xác nhận thêm học sinh</button>
          <button type="button" disabled={Boolean(pending)} onClick={() => { setAdditionConfirmation(undefined); setAdditionConfirmationName(""); }}>Hủy</button>
        </div>
      )}
      {lifecycle && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="finance-lifecycle-title"
        >
          <form onSubmit={saveLifecycle}>
            <h3 id="finance-lifecycle-title">
              {lifecycle.next === "ACTIVE" ? "Kích hoạt" : "Ngừng áp dụng"}{" "}
              {lifecycle.name}
            </h3>
            <label>
              Lý do
              <input
                autoFocus
                value={lifecycle.reason}
                onChange={(event) =>
                  setLifecycle({ ...lifecycle, reason: event.target.value })
                }
                {...field("lifecycle", "reason")}
              />
            </label>
            {scope === "lifecycle" && errors.reason && (
              <small id="lifecycle-reason-error">{errors.reason}</small>
            )}
            <button disabled={Boolean(pending)}>Xác nhận</button>
            <button type="button" onClick={() => setLifecycle(undefined)}>
              Hủy
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
