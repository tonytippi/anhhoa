import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";

type Holiday = { id?: string; name: string; startsOn: string; endsOn: string };
type Settings = {
  asOf: string;
  timezone: string;
  profile: {
    effectiveFrom: string;
    schoolName: string;
    address: string | null;
    phone: string | null;
  } | null;
  calendar: { effectiveFrom: string; holidays: Holiday[] } | null;
};
type Pending = { id: string; schoolId: string };
export type SettingsStatus = {
  dirty: boolean;
  pending: boolean;
  reconcile?: () => void;
};
const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName =
  typeof __CSRF_COOKIE_NAME__ === "undefined"
    ? "app_csrf"
    : __CSRF_COOKIE_NAME__;
const pendingKey = "passionedu.app.pending-settings-operation";
const maxReconcileAttempts = 5;
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${csrfName}=`))
    ?.slice(csrfName.length + 1);
const networkUncertain = (error: unknown) =>
  error instanceof TypeError && /network|fetch|timeout/i.test(error.message);

export function SettingsWorkspace({
  schoolId,
  schoolName,
  denied,
  onStatusChange,
}: {
  schoolId: string;
  schoolName: string;
  denied: () => void;
  onStatusChange?: (status: SettingsStatus) => void;
}) {
  const [data, setData] = useState<Settings>();
  const [profile, setProfile] = useState({
    effectiveFrom: "",
    schoolName: "",
    address: "",
    phone: "",
  });
  const [calendar, setCalendar] = useState({
    effectiveFrom: "",
    holidays: [] as Holiday[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorScope, setErrorScope] = useState<"profile" | "calendar">(
    "profile",
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending>();
  const summary = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const activeSchool = useRef(schoolId);
  const statusChange = useRef(onStatusChange);
  const attempts = useRef(0);
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const current = (operation: Pending) =>
    activeSchool.current === operation.schoolId;
  const load = async () => {
    const response = await fetch(
      `${apiUrl}/api/app/schools/${schoolId}/settings`,
      { credentials: "include" },
    );
    if ([401, 403, 404].includes(response.status)) return denied();
    if (!response.ok) throw new Error("Không thể tải cấu hình trường.");
    if (activeSchool.current === schoolId)
      setData(((await response.json()) as { data: Settings }).data);
  };
  const reconcile = async (operation: Pending) => {
    if (!current(operation)) return;
    setPending(operation);
    if (attempts.current >= maxReconcileAttempts) {
      setMessage(
        "Chưa thể xác nhận Operation. Mã thao tác được giữ lại để đối soát sau.",
      );
      return;
    }
    try {
      const response = await fetch(
        `${apiUrl}/api/app/schools/${operation.schoolId}/operations/${operation.id}`,
        { credentials: "include" },
      );
      if (!current(operation)) return;
      if ([401, 403, 404].includes(response.status)) return denied();
      if (!response.ok) throw new Error();
      const result = ((await response.json()) as { data: { status: string } })
        .data;
      if (result.status === "PENDING") {
        attempts.current += 1;
        timer.current = window.setTimeout(
          () => void reconcile(operation),
          attempts.current * 750,
        );
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      attempts.current = 0;
      if (result.status === "COMPLETED") {
        await load();
        setProfile({
          effectiveFrom: "",
          schoolName: "",
          address: "",
          phone: "",
        });
        setCalendar({ effectiveFrom: "", holidays: [] });
      } else setMessage("Thao tác không thành công.");
    } catch {
      if (current(operation)) {
        attempts.current += 1;
        if (attempts.current >= maxReconcileAttempts)
          setMessage(
            "Chưa thể xác nhận Operation. Mã thao tác được giữ lại để đối soát sau.",
          );
        else
          timer.current = window.setTimeout(
            () => void reconcile(operation),
            attempts.current * 750,
          );
      }
    }
  };
  useEffect(() => {
    activeSchool.current = schoolId;
    stop();
    attempts.current = 0;
    setData(undefined);
    setProfile({ effectiveFrom: "", schoolName: "", address: "", phone: "" });
    setCalendar({ effectiveFrom: "", holidays: [] });
    setErrors({});
    setErrorScope("profile");
    setMessage("");
    setPending(undefined);
    void load().catch((error: Error) => setMessage(error.message));
    const raw = sessionStorage.getItem(pendingKey);
    if (raw) {
      try {
        const operation = JSON.parse(raw) as Pending;
        if (
          typeof operation?.id !== "string" ||
          typeof operation.schoolId !== "string"
        )
          sessionStorage.removeItem(pendingKey);
        else if (operation.schoolId === schoolId) void reconcile(operation);
      } catch {
        sessionStorage.removeItem(pendingKey);
      }
    }
    return stop;
  }, [schoolId]);
  const dirty = Boolean(
    profile.effectiveFrom ||
      profile.schoolName ||
      calendar.effectiveFrom ||
      calendar.holidays.length,
  );
  useEffect(() => {
    statusChange.current = onStatusChange;
  }, [onStatusChange]);
  useEffect(() => {
    statusChange.current?.({
      dirty,
      pending: Boolean(pending),
      reconcile: pending ? () => void reconcile(pending) : undefined,
    });
  }, [dirty, pending]);
  useLayoutEffect(() => {
    if (Object.keys(errors).length) summary.current?.focus();
  }, [errors]);
  const post = async (
    path: string,
    body: object,
    scope: "profile" | "calendar",
  ) => {
    if (pending) return false;
    const operation = { id: crypto.randomUUID(), schoolId };
    setErrors({});
    setErrorScope(scope);
    setMessage("");
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": decodeURIComponent(csrf() ?? ""),
          "idempotency-key": crypto.randomUUID(),
          "x-operation-id": operation.id,
        },
        body: JSON.stringify(body),
      });
      if ([401, 403, 404].includes(response.status)) {
        denied();
        return false;
      }
      if ([408, 502, 503, 504].includes(response.status))
        throw new TypeError("timeout");
      if (!response.ok) {
        const error = (
          (await response.json()) as {
            error?: { message?: string; fieldErrors?: Record<string, string> };
          }
        ).error;
        setErrors(error?.fieldErrors ?? {});
        setMessage(error?.message ?? "Thao tác không thành công.");
        return false;
      }
      await load();
      return true;
    } catch (error) {
      if (networkUncertain(error)) {
        attempts.current = 0;
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        setPending(operation);
        setMessage(
          "Kết quả chưa chắc chắn. Đang đối soát Operation trước khi thử lại.",
        );
        void reconcile(operation);
      } else
        setMessage(
          error instanceof Error ? error.message : "Thao tác không thành công.",
        );
      return false;
    }
  };
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await post(
        `/api/app/schools/${schoolId}/settings/profile-versions`,
        profile,
        "profile",
      )
    )
      setProfile({ effectiveFrom: "", schoolName: "", address: "", phone: "" });
  };
  const saveCalendar = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await post(
        `/api/app/schools/${schoolId}/settings/calendar-versions`,
        calendar,
        "calendar",
      )
    )
      setCalendar({ effectiveFrom: "", holidays: [] });
  };
  const field = (scope: "profile" | "calendar", name: string) =>
    errorScope === scope && errors[name]
      ? { "aria-invalid": true, "aria-describedby": `${scope}-${name}-error` }
      : {};
  return (
    <section aria-labelledby="settings-title">
      <h2 id="settings-title">Cấu hình trường</h2>
      <p>
        {schoolName} / Dữ liệu được xác nhận từ máy chủ (
        {data?.timezone ?? "Asia/Ho_Chi_Minh"}).
      </p>
      {message && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      <section>
        <h3>Thông tin trường</h3>
        <p>
          Đang áp dụng:{" "}
          {data?.profile
            ? `${data.profile.schoolName} từ ${data.profile.effectiveFrom}`
            : "Chưa có phiên bản"}
        </p>
        <form onSubmit={saveProfile}>
          <label>
            Ngày hiệu lực
            <input
              type="date"
              value={profile.effectiveFrom}
              onChange={(event) =>
                setProfile({ ...profile, effectiveFrom: event.target.value })
              }
              {...field("profile", "effectiveFrom")}
            />
          </label>
          {errorScope === "profile" && errors.effectiveFrom && (
            <small id="profile-effectiveFrom-error">
              {errors.effectiveFrom}
            </small>
          )}
          <label>
            Tên trường
            <input
              value={profile.schoolName}
              onChange={(event) =>
                setProfile({ ...profile, schoolName: event.target.value })
              }
              {...field("profile", "schoolName")}
            />
          </label>
          {errorScope === "profile" && errors.schoolName && (
            <small id="profile-schoolName-error">{errors.schoolName}</small>
          )}
          <label>
            Địa chỉ
            <input
              value={profile.address}
              onChange={(event) =>
                setProfile({ ...profile, address: event.target.value })
              }
            />
          </label>
          <label>
            Số điện thoại
            <input
              value={profile.phone}
              onChange={(event) =>
                setProfile({ ...profile, phone: event.target.value })
              }
            />
          </label>
          <button disabled={Boolean(pending)}>Tạo phiên bản hồ sơ</button>
        </form>
      </section>
      <section>
        <h3>Lịch hoạt động</h3>
        <p>
          Thứ Hai đến Thứ Bảy hoạt động; Chủ Nhật không hoạt động. Đang áp dụng
          từ {data?.calendar?.effectiveFrom ?? "chưa có phiên bản"}.
        </p>
        <form onSubmit={saveCalendar}>
          <label>
            Ngày hiệu lực
            <input
              type="date"
              value={calendar.effectiveFrom}
              onChange={(event) =>
                setCalendar({ ...calendar, effectiveFrom: event.target.value })
              }
              {...field("calendar", "effectiveFrom")}
            />
          </label>
          {errorScope === "calendar" && errors.effectiveFrom && (
            <small id="calendar-effectiveFrom-error">
              {errors.effectiveFrom}
            </small>
          )}
          <fieldset>
            <legend>Ngày nghỉ có tên</legend>
            {calendar.holidays.map((holiday, index) => (
              <div key={index}>
                <label>
                  Tên
                  <input
                    value={holiday.name}
                    onChange={(event) =>
                      setCalendar({
                        ...calendar,
                        holidays: calendar.holidays.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Bắt đầu
                  <input
                    type="date"
                    value={holiday.startsOn}
                    onChange={(event) =>
                      setCalendar({
                        ...calendar,
                        holidays: calendar.holidays.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, startsOn: event.target.value }
                            : item,
                        ),
                      })
                    }
                    {...field("calendar", "startsOn")}
                  />
                </label>
                <label>
                  Kết thúc
                  <input
                    type="date"
                    value={holiday.endsOn}
                    onChange={(event) =>
                      setCalendar({
                        ...calendar,
                        holidays: calendar.holidays.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, endsOn: event.target.value }
                            : item,
                        ),
                      })
                    }
                    {...field("calendar", "endsOn")}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setCalendar({
                      ...calendar,
                      holidays: calendar.holidays.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                >
                  Bỏ ngày nghỉ
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setCalendar({
                  ...calendar,
                  holidays: [
                    ...calendar.holidays,
                    { name: "", startsOn: "", endsOn: "" },
                  ],
                })
              }
            >
              Thêm ngày nghỉ
            </button>
          </fieldset>
          {errorScope === "calendar" && errors.startsOn && (
            <small id="calendar-startsOn-error">{errors.startsOn}</small>
          )}
          {errorScope === "calendar" && errors.endsOn && (
            <small id="calendar-endsOn-error">{errors.endsOn}</small>
          )}
          <button disabled={Boolean(pending)}>Tạo phiên bản lịch</button>
        </form>
      </section>
    </section>
  );
}
