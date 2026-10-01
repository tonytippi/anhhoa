import {
  StrictMode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createRoot } from "react-dom/client";
import {
  bootstrapSession,
  googleLoginUrl,
  logout,
  parentGet,
  parentMedia,
  parentLeaveMutation,
  parentMutation,
  parentPost,
  type ParentContext,
  type Session,
} from "./auth-session";
import "@fontsource-variable/inter";
import "./styles.css";
import "./journal.css";

export type ParentSchool = {
  schoolId: string;
  schoolName: string;
  children: ParentContext["student"][];
};
type Attendance = {
  studentId: string;
  studentDisplayName: string;
  date: string;
  status?: "PRESENT" | "ABSENT" | "ON_LEAVE" | "NOT_RECORDED";
  updatedAt: string | null;
  calendarLabel?: string;
};
type Journal = {
  studentId: string;
  studentDisplayName: string;
  journalDate: string;
  text: string;
  updatedAt: string;
  media: Array<{ id: string; contentType: string }>;
};
type InboxEvent = {
  id: string;
  studentId: string;
  studentDisplayName: string;
  eventType: "ATTENDANCE" | "HANDOVER";
  text: string;
  date: string;
  time: string;
  unread: boolean;
};
type LeaveRequest = {
  id: string;
  studentId: string;
  status: "PENDING" | "AUTO_APPROVED" | "APPROVED" | "REJECTED" | "CANCELLED";
  startsOn: string | null;
  operatingDates: string[];
  createdAt: string;
};
type PhoneOperation = { id: string; status: string; outcome: { phone: string } };
type Obligation = { id: string; studentId: string; channel?: "SCHOOL" | "PERSONAL"; obligationCode: string; period: string; issuedTotal: string; vatTotal?: string; deductionTotal?: string; actualReceipt: string; outcome: string | null; outstanding: string; state: "ISSUED" | "CLOSED"; effectiveAt: string; paymentInstruction: { receivingBank: string; accountNumber: string; accountHolderName: string; transferContent: string } };
const vnd = (value: string) => new Intl.NumberFormat("vi-VN").format(BigInt(value)) + " đ";
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const thirtyDays = () => {
  const value = new Date(`${today()}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 29);
  return value.toISOString().slice(0, 10);
};
const statusLabel = (status?: Attendance["status"]) =>
  status === "PRESENT"
    ? "Đã ghi nhận có mặt"
    : status === "ABSENT"
      ? "Vắng mặt"
      : status === "ON_LEAVE"
        ? "Đang nghỉ"
        : "Trường chưa ghi nhận";
const route = () => {
  const match = /^\/children\/([^/]+)\/days\/(\d{4}-\d{2}-\d{2})$/.exec(
    window.location.pathname,
  );
  return match ? { studentId: match[1]!, date: match[2]! } : null;
};
export function groupSchools(contexts: ParentContext[]): ParentSchool[] {
  const schools = new Map<string, ParentSchool>();
  for (const context of contexts) {
    const school = schools.get(context.schoolId) ?? {
      schoolId: context.schoolId,
      schoolName: context.schoolName,
      children: [],
    };
    schools.set(context.schoolId, school);
    if (!school.children.some((child) => child.id === context.student.id))
      school.children.push(context.student);
  }
  return [...schools.values()];
}
function SignedOut({
  headingRef,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <main className="auth-state">
      <p className="sr-only" aria-live="polite">
        Phiên đăng nhập đã kết thúc.
      </p>
      <h1 ref={headingRef} tabIndex={-1}>
        PassionEdu
      </h1>
      <p>Vui lòng đăng nhập để tiếp tục.</p>
      <a className="primary-button" href={googleLoginUrl}>
        Đăng nhập với Google
      </a>
    </main>
  );
}
function SchoolChooser({
  schools,
  onSelect,
  onLogout,
  headingRef,
}: {
  schools: ParentSchool[];
  onSelect: (schoolId: string) => void;
  onLogout: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <main className="auth-state chooser-state">
      <p className="sr-only" aria-live="polite">
        Chọn trường được phép để tiếp tục.
      </p>
      <p className="eyebrow">CỔNG PHỤ HUYNH</p>
      <h1 ref={headingRef} tabIndex={-1}>
        Chọn trường để xem
      </h1>
      <p>Chỉ các trường có liên kết phụ huynh đang hiệu lực được hiển thị.</p>
      <section className="school-choices">
        <ul>
          {schools.map((school) => (
            <li key={school.schoolId}>
              <button
                className="school-choice"
                onClick={() => onSelect(school.schoolId)}
              >
                <strong>{school.schoolName}</strong>
                <span>Chọn ngữ cảnh trường</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <button className="text-button" onClick={onLogout}>
        Đăng xuất
      </button>
    </main>
  );
}

function ParentWorkspace({
  school,
  canSwitch,
  onSwitch,
  onLogout,
  headingRef,
  onDenied,
}: {
  school: ParentSchool;
  canSwitch: boolean;
  onSwitch: () => void;
  onLogout: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onDenied: () => void;
}) {
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>(
    {},
  );
  const [selected, setSelected] = useState<string>();
  const [selectedDate, setSelectedDate] = useState<string>();
  const [journal, setJournal] = useState<Journal | null | undefined>();
  const [inbox, setInbox] = useState<InboxEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [view, setView] = useState<"today" | "inbox" | "obligations">("today");
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [obligation, setObligation] = useState<Obligation>();
  const [obligationLoading, setObligationLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveForm, setLeaveForm] = useState<{
    id?: string;
    startsOn: string;
    endsOn: string;
  }>();
  const [leaveErrors, setLeaveErrors] = useState<Record<string, string>>({});
  const [leaveOperation, setLeaveOperation] = useState<string>();
  const [confirmCancel, setConfirmCancel] = useState<string>();
  const [phone, setPhone] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({});
  const [phoneOperation, setPhoneOperation] = useState<string>();
  const [contactOpen, setContactOpen] = useState(false);
  const [mobileNavigation, setMobileNavigation] = useState(
    () => window.matchMedia?.("(max-width: 920px)").matches ?? false,
  );
  const leaveErrorSummary = useRef<HTMLParagraphElement>(null);
  const phoneErrorSummary = useRef<HTMLParagraphElement>(null);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const cancelDialog = useRef<HTMLDivElement>(null);
  const workspaceLoad = useRef<AbortController | undefined>(undefined);
  const attendanceRequest = useRef<AbortController | undefined>(undefined);
  const journalRequest = useRef<AbortController | undefined>(undefined);
  const resolver = useRef<AbortController | undefined>(undefined);
  const media = useRef<AbortController | undefined>(undefined);
  const obligationRequest = useRef<AbortController | undefined>(undefined);
  const obligationGeneration = useRef(0);
  const workspaceGeneration = useRef(0);
  const generation = useRef(0);
  const resolverGeneration = useRef(0);
  const image = useRef<string | undefined>(undefined);
  const inboxReady = useRef(false);
  const pendingSelector = useRef<{ studentId: string; date: string } | null>(
    null,
  );
  const clearImage = () => {
    media.current?.abort();
    if (image.current) URL.revokeObjectURL(image.current);
    image.current = undefined;
    setImageUrl(undefined);
  };
  const clearDetail = () => {
    resolver.current?.abort();
    attendanceRequest.current?.abort();
    journalRequest.current?.abort();
    media.current?.abort();
    generation.current += 1;
    resolverGeneration.current += 1;
    clearImage();
    setDetailLoading(false);
    setSelected(undefined);
    setSelectedDate(undefined);
    setJournal(undefined);
    setLeaves([]);
    setLeaveForm(undefined);
    setLeaveErrors({});
    setLeaveOperation(undefined);
    setConfirmCancel(undefined);
  };
  const fallback = (safePath = "/") => {
    obligationRequest.current?.abort();
    obligationGeneration.current += 1;
    clearDetail();
    setLoading(false);
    if (window.location.pathname !== safePath)
      window.history.replaceState(null, "", safePath);
    setAttendance({});
    setInbox([]);
    setObligations([]);
    setObligation(undefined);
    setObligationLoading(false);
    setUnread(0);
    onDenied();
  };
  const resolve = async (event: InboxEvent, push: boolean) => {
    clearDetail();
    const id = ++resolverGeneration.current;
    const controller = new AbortController();
    resolver.current = controller;
    const result = await parentPost<{ studentId: string; date: string }>(
      `/api/parent/schools/${school.schoolId}/inbox/${event.id}/open`,
      controller.signal,
    );
    if (
      controller.signal.aborted ||
      id !== resolverGeneration.current ||
      result.kind === "aborted"
    )
      return;
    if (result.kind === "auth" || result.kind === "denied")
      return fallback(push ? "/inbox" : "/");
    if (result.kind !== "ok") {
      setLoading(false);
      return setError(true);
    }
    setLoading(false);
    setInbox((current) =>
      current.map((item) =>
        item.id === event.id ? { ...item, unread: false } : item,
      ),
    );
    setUnread((current) => Math.max(0, current - (event.unread ? 1 : 0)));
    setView("today");
    setSelected(result.data.studentId);
    setSelectedDate(result.data.date);
    const path = `/children/${result.data.studentId}/days/${result.data.date}`;
    if (push) window.history.pushState(null, "", path);
    if (!attendance[result.data.studentId]) {
      const controller = new AbortController();
      attendanceRequest.current = controller;
      void parentGet<Attendance[]>(
        `/api/parent/schools/${school.schoolId}/students/${result.data.studentId}/attendance?from=${thirtyDays()}&to=${today()}`,
        controller.signal,
      ).then((attendanceResult) => {
        if (
          controller.signal.aborted ||
          id !== resolverGeneration.current ||
          attendanceResult.kind === "aborted"
        )
          return;
        if (
          attendanceResult.kind === "auth" ||
          attendanceResult.kind === "denied"
        )
          return fallback("/");
        if (
          attendanceResult.kind === "ok" &&
          Array.isArray(attendanceResult.data)
        )
          setAttendance((current) => ({
            ...current,
            [result.data.studentId]: attendanceResult.data,
          }));
        else if (attendanceResult.kind === "error") setError(true);
      });
    }
  };
  const resolveUrl = () => {
    const requested = route();
    if (!requested) {
      pendingSelector.current = null;
      clearDetail();
       setView(window.location.pathname === "/inbox" ? "inbox" : window.location.pathname === "/obligations" ? "obligations" : "today");
      return;
    }
    pendingSelector.current = requested;
    if (!inboxReady.current) return;
    const event = inbox.find(
      (item) =>
        item.studentId === requested.studentId && item.date === requested.date,
    );
    if (!event) return fallback("/");
    pendingSelector.current = null;
    void resolve(event, false);
  };
  const selectTodayChild = (studentId: string) => {
    clearDetail();
    const id = ++resolverGeneration.current;
    const controller = new AbortController();
    attendanceRequest.current = controller;
    const date = today();
    setSelected(studentId);
    setSelectedDate(date);
    if (attendance[studentId]) {
      setLoading(false);
      return;
    }
    void parentGet<Attendance[]>(
      `/api/parent/schools/${school.schoolId}/students/${studentId}/attendance?from=${thirtyDays()}&to=${today()}`,
      controller.signal,
    ).then((result) => {
      if (
        controller.signal.aborted ||
        id !== resolverGeneration.current ||
        result.kind === "aborted"
      )
        return;
      if (result.kind === "auth" || result.kind === "denied")
        return fallback("/");
      if (result.kind === "ok" && Array.isArray(result.data))
        setAttendance((current) => ({ ...current, [studentId]: result.data }));
      else if (result.kind === "error") setError(true);
      setLoading(false);
    });
  };
  useEffect(() => {
    clearDetail();
    workspaceLoad.current?.abort();
    inboxReady.current = false;
    pendingSelector.current = route();
    const controller = new AbortController();
    workspaceLoad.current = controller;
    const id = ++workspaceGeneration.current;
    const requested = pendingSelector.current;
    setView(window.location.pathname === "/inbox" ? "inbox" : window.location.pathname === "/obligations" ? "obligations" : "today");
    let pending = requested ? 1 : school.children.length + 1;
    setLoading(true);
    setError(false);
    const finish = () => {
      pending -= 1;
      if (
        pending === 0 &&
        !controller.signal.aborted &&
        id === workspaceGeneration.current
      )
        setLoading(false);
    };
    if (!requested)
      for (const child of school.children)
        void parentGet<Attendance[]>(
          `/api/parent/schools/${school.schoolId}/students/${child.id}/attendance?from=${thirtyDays()}&to=${today()}`,
          controller.signal,
        ).then((result) => {
          if (
            controller.signal.aborted ||
            id !== workspaceGeneration.current ||
            result.kind === "aborted"
          )
            return;
          if (result.kind === "auth" || result.kind === "denied") {
            controller.abort();
            return fallback();
          }
          if (result.kind === "ok" && Array.isArray(result.data))
            setAttendance((current) => ({
              ...current,
              [child.id]: result.data,
            }));
          else if (result.kind === "error") setError(true);
          finish();
        });
    void parentGet<InboxEvent[]>(
      `/api/parent/schools/${school.schoolId}/inbox`,
      controller.signal,
    ).then((result) => {
      if (
        controller.signal.aborted ||
        id !== workspaceGeneration.current ||
        result.kind === "aborted"
      )
        return;
      if (result.kind === "auth" || result.kind === "denied") {
        controller.abort();
        return fallback();
      }
      if (result.kind === "ok" && Array.isArray(result.data)) {
        const items = result.data as InboxEvent[];
        inboxReady.current = true;
        setInbox(items);
        setUnread(items.filter((item) => item.unread).length);
        const selector = pendingSelector.current;
        const event =
          selector &&
          items.find(
            (item) =>
              item.studentId === selector.studentId &&
              item.date === selector.date,
          );
        if (selector) {
          if (!event) return fallback();
          pendingSelector.current = null;
          void resolve(event, false);
        } else if (window.location.pathname === "/inbox") setView("inbox");
      } else if (result.kind === "error") setError(true);
      finish();
    });
    void parentGet<{ phone: string }>(`/api/parent/schools/${school.schoolId}/profile`, controller.signal).then((result) => {
      if (controller.signal.aborted || id !== workspaceGeneration.current || result.kind === "aborted") return;
      if (result.kind === "auth" || result.kind === "denied") { controller.abort(); return fallback(); }
      if (result.kind === "ok") { setPhone(result.data.phone); setPhoneInput(result.data.phone); }
      else if (result.kind === "error") setError(true);
    });
    void parentGet<Obligation[]>(`/api/parent/schools/${school.schoolId}/obligations`, controller.signal).then((result) => {
      if (controller.signal.aborted || id !== workspaceGeneration.current || result.kind === "aborted") return;
      if (result.kind === "auth" || result.kind === "denied") { controller.abort(); return fallback(); }
      if (result.kind === "ok" && Array.isArray(result.data)) setObligations(result.data);
      else if (result.kind === "error") setError(true);
    });
    return () => {
      controller.abort();
      clearDetail();
    };
  }, [school.schoolId, school.children.map((child) => child.id).join(",")]);
  useEffect(() => {
    const popstate = () => resolveUrl();
    window.addEventListener("popstate", popstate);
    return () => window.removeEventListener("popstate", popstate);
  }, [inbox, school.schoolId]);
  useEffect(() => {
    if (!selected || !selectedDate) return;
    const controller = new AbortController();
    journalRequest.current = controller;
    const id = ++generation.current;
    clearImage();
    setJournal(undefined);
    setDetailLoading(true);
    void parentGet<Journal | null>(
      `/api/parent/schools/${school.schoolId}/students/${selected}/daily-journal?journalDate=${selectedDate}`,
      controller.signal,
    ).then((result) => {
      if (
        controller.signal.aborted ||
        id !== generation.current ||
        result.kind === "aborted"
      )
        return;
      if (result.kind === "auth" || result.kind === "denied")
        return fallback("/");
      if (result.kind === "ok") setJournal(result.data);
      else if (result.kind === "error") setError(true);
      setDetailLoading(false);
    });
    return () => controller.abort();
  }, [selected, selectedDate, school.schoolId]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void parentGet<LeaveRequest[]>(
      `/api/parent/schools/${school.schoolId}/leave-requests?studentId=${selected}`,
      controller.signal,
    ).then((result) => {
      if (controller.signal.aborted || result.kind === "aborted") return;
      if (result.kind === "auth" || result.kind === "denied")
        return fallback("/");
      if (result.kind === "ok")
        setLeaves(Array.isArray(result.data) ? result.data : []);
      else setError(true);
    });
    return () => controller.abort();
  }, [selected, school.schoolId]);
  useEffect(() => {
    if (Object.keys(leaveErrors).length) leaveErrorSummary.current?.focus();
  }, [leaveErrors]);
  useEffect(() => {
    if (Object.keys(phoneErrors).length) phoneErrorSummary.current?.focus();
  }, [phoneErrors]);
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 920px)");
    if (!query) return;
    const update = () => setMobileNavigation(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const closeCancel = () => {
    setConfirmCancel(undefined);
    queueMicrotask(() => cancelTrigger.current?.focus());
  };
  useEffect(() => {
    if (!confirmCancel) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !leaveOperation) {
        event.preventDefault();
        closeCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(cancelDialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ) ?? [])];
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [confirmCancel, leaveOperation]);
  const submitLeave = async () => {
    if (!selected || !leaveForm || leaveOperation) return;
    const operationId = crypto.randomUUID();
    const idempotencyKey = crypto.randomUUID();
    setLeaveOperation(operationId);
    setLeaveErrors({});
    const path = leaveForm.id
      ? `/api/parent/schools/${school.schoolId}/leave-requests/${leaveForm.id}`
      : `/api/parent/schools/${school.schoolId}/leave-requests`;
    const result = await parentLeaveMutation<LeaveRequest>(
      path,
      leaveForm.id ? "PATCH" : "POST",
      {
        studentId: selected,
        startsOn: leaveForm.startsOn,
        endsOn: leaveForm.endsOn,
      },
      idempotencyKey,
      operationId,
    );
    if (result.kind === "auth" || result.kind === "denied")
      return fallback("/");
    if (result.kind === "validation") {
      setLeaveErrors(result.fieldErrors);
      return setLeaveOperation(undefined);
    }
    if (result.kind === "ok") {
      setLeaves((current) => [
        result.data,
        ...current.filter((item) => item.id !== result.data.id),
      ]);
      setLeaveForm(undefined);
      return setLeaveOperation(undefined);
    }
    if (result.kind === "unknown") return;
    setLeaveOperation(undefined);
    setError(true);
  };
  const cancelLeave = async () => {
    if (!confirmCancel || leaveOperation) return;
    const operationId = crypto.randomUUID();
    const idempotencyKey = crypto.randomUUID();
    setLeaveOperation(operationId);
    const result = await parentLeaveMutation<LeaveRequest>(
      `/api/parent/schools/${school.schoolId}/leave-requests/${confirmCancel}/cancel`,
      "POST",
      {},
      idempotencyKey,
      operationId,
    );
    if (result.kind === "auth" || result.kind === "denied")
      return fallback("/");
    if (result.kind === "ok") {
      setLeaves((current) =>
        current.map((item) =>
          item.id === result.data.id ? result.data : item,
        ),
      );
      closeCancel();
      return setLeaveOperation(undefined);
    }
    if (result.kind === "unknown") return;
    setLeaveOperation(undefined);
    setError(true);
  };
  const submitPhone = async () => {
    if (phoneOperation) return;
    if (!/^[0-9+() .-]{6,30}$/.test(phoneInput.trim())) {
      setPhoneErrors({ phone: "Số điện thoại không hợp lệ." });
      return;
    }
    const operationId = crypto.randomUUID();
    setPhoneOperation(operationId);
    setPhoneErrors({});
    const result = await parentMutation<PhoneOperation>(
      `/api/parent/schools/${school.schoolId}/profile/phone`, "PATCH", { phone: phoneInput }, crypto.randomUUID(), operationId,
    );
    if (result.kind === "auth" || result.kind === "denied") return fallback("/");
    if (result.kind === "validation") { setPhoneErrors(result.fieldErrors); return setPhoneOperation(undefined); }
    if (result.kind === "ok") { setPhone(result.data.outcome.phone); setPhoneInput(result.data.outcome.phone); setPhoneOperation(undefined); return; }
    if (result.kind === "unknown") return;
    setPhoneOperation(undefined); setError(true);
  };
  useEffect(() => {
    if (!leaveOperation) return;
    const timer = window.setInterval(() => {
      void parentGet<{ id: string; status: string; outcome: LeaveRequest }>(
        `/api/parent/schools/${school.schoolId}/operations/${leaveOperation}`,
      ).then((result) => {
        if (result.kind === "auth" || result.kind === "denied")
          return fallback("/");
        if (result.kind === "ok" && result.data.status === "COMPLETED") {
          setLeaves((current) => [
            result.data.outcome,
            ...current.filter((item) => item.id !== result.data.outcome.id),
          ]);
          setLeaveForm(undefined);
          closeCancel();
          setLeaveOperation(undefined);
        }
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [leaveOperation, school.schoolId]);
  useEffect(() => {
    if (!phoneOperation) return;
    const timer = window.setInterval(() => {
      void parentGet<PhoneOperation>(`/api/parent/schools/${school.schoolId}/operations/${phoneOperation}`).then((result) => {
        if (result.kind === "auth" || result.kind === "denied") return fallback("/");
        if (result.kind === "ok" && result.data.status === "COMPLETED") {
          setPhone(result.data.outcome.phone);
          setPhoneInput(result.data.outcome.phone);
          setPhoneOperation(undefined);
        }
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phoneOperation, school.schoolId]);
  const openMedia = async (mediaId: string) => {
    clearImage();
    const controller = new AbortController();
    media.current = controller;
    const id = generation.current;
    const result = await parentMedia(
      `/api/parent/schools/${school.schoolId}/daily-journal-media/${mediaId}`,
      controller.signal,
    );
    if (
      controller.signal.aborted ||
      id !== generation.current ||
      result.kind === "aborted"
    )
      return;
    if (result.kind === "auth" || result.kind === "denied") return fallback();
    if (result.kind !== "ok") return setError(true);
    image.current = URL.createObjectURL(result.data);
    setImageUrl(image.current);
  };
  const current = selected ? attendance[selected] : undefined;
  useEffect(() => {
    if (selected || view === "inbox") headingRef.current?.focus();
  }, [selected, view, headingRef]);
  const openObligation = async (id: string) => {
    obligationRequest.current?.abort();
    const generation = ++obligationGeneration.current;
    const controller = new AbortController();
    obligationRequest.current = controller;
    setObligation(undefined);
    setObligationLoading(true);
    const result = await parentGet<Obligation>(`/api/parent/schools/${school.schoolId}/obligations/${id}`, controller.signal);
    if (controller.signal.aborted || generation !== obligationGeneration.current || result.kind === "aborted") return;
    if (result.kind === "auth" || result.kind === "denied") return fallback("/obligations");
    if (result.kind === "ok" && result.data.id === id) { setObligation(result.data); setObligationLoading(false); return; }
    setObligationLoading(false);
    setError(true);
  };
  const navigate = (next: "today" | "inbox" | "obligations") => {
    obligationRequest.current?.abort();
    obligationGeneration.current += 1;
    pendingSelector.current = null;
    clearDetail();
    window.history.pushState(null, "", next === "inbox" ? "/inbox" : next === "obligations" ? "/obligations" : "/");
    setView(next);
  };
  const closeObligation = () => {
    obligationRequest.current?.abort();
    obligationGeneration.current += 1;
    setObligation(undefined);
    setObligationLoading(false);
  };
  return (
    <div className="parent-app">
      <aside className="desktop-sidebar" aria-label="Điều hướng phụ huynh">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>
            PassionEdu<small>CỔNG PHỤ HUYNH</small>
          </span>
        </div>
        <p className="nav-heading">THEO DÕI CON</p>
        <button
          className={`side-link ${view === "today" ? "active" : ""}`}
          onClick={() => navigate("today")}
        >
          Hôm nay
        </button>
        <button
          className={`side-link ${view === "inbox" ? "active" : ""}`}
          onClick={() => navigate("inbox")}
        >
          Thông báo {unread > 0 && <span className="unread">{unread}</span>}
        </button>
        <button className={`side-link ${view === "obligations" ? "active" : ""}`} onClick={() => navigate("obligations")}>Khoản cần thanh toán</button>
        <div className="sidebar-account">
          <button className="text-button" onClick={() => setContactOpen(true)}>Thông tin liên hệ</button>
          <button className="text-button" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <span className="selected-school">
            Trường đang xem <strong>{school.schoolName}</strong>
          </span>
          <div className="workspace-actions">
            <button className="text-button" onClick={() => setContactOpen(true)}>Liên hệ</button>
            {canSwitch && <button className="text-button" disabled={Boolean(phoneOperation)} onClick={onSwitch}>Đổi trường</button>}
          </div>
        </header>
        <section className="screen">
          <div className="screen-heading">
            <p className="eyebrow">CỔNG PHỤ HUYNH</p>
            <h1 ref={headingRef} tabIndex={-1}>
              {view === "inbox"
                ? "Thông báo"
                : view === "obligations"
                  ? obligation ? "Khoản cần thanh toán" : "Khoản cần thanh toán"
                : selected
                  ? school.children.find((child) => child.id === selected)
                      ?.fullName
                  : "Hôm nay của các con"}
            </h1>
            <p>
              {view === "inbox"
                ? "Sự kiện điểm danh trong 30 ngày gần đây"
                : view === "obligations"
                  ? "Thông tin bản chụp của nghĩa vụ đã phát hành."
                : selected
                  ? `Ngày ${selectedDate}`
                  : `Những cập nhật phụ huynh cần biết từ ${school.schoolName}.`}
            </p>
          </div>
          {error && (
            <p role="alert">Không thể tải cập nhật. Vui lòng thử lại sau.</p>
          )}
          {contactOpen && (
            <section className="panel contact-sheet" aria-label="Cập nhật số điện thoại">
              <div className="section-heading"><h2>Thông tin liên hệ</h2><button className="text-button" disabled={Boolean(phoneOperation)} onClick={() => { setContactOpen(false); setPhoneInput(phone); setPhoneErrors({}); }}>Đóng</button></div>
              <form onSubmit={(event) => { event.preventDefault(); void submitPhone(); }}>
                {Object.keys(phoneErrors).length > 0 && <p ref={phoneErrorSummary} role="alert" tabIndex={-1}>{phoneErrors.phone}</p>}
                <label>Số điện thoại<input type="tel" value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} aria-invalid={Boolean(phoneErrors.phone)} aria-describedby={phoneErrors.phone ? "phone-error" : undefined} /></label>
                {phoneErrors.phone && <p id="phone-error">{phoneErrors.phone}</p>}
                <p className="form-hint">Số hiện tại: {phone || "Chưa có"}</p>
                <div><button className="primary-button" disabled={Boolean(phoneOperation)}>{phoneOperation ? "Đang đối soát thao tác..." : "Lưu số điện thoại"}</button><button type="button" className="text-button" disabled={Boolean(phoneOperation)} onClick={() => { setPhoneInput(phone); setPhoneErrors({}); }}>Hủy</button></div>
              </form>
            </section>
          )}
           {view === "obligations" ? (
              obligation || obligationLoading ? <>
                <button className="text-button" onClick={closeObligation}>Quay lại danh sách</button>
                {obligation ? <><section className="panel"><h2>{obligation.state === "ISSUED" ? (BigInt(obligation.issuedTotal) < 0n ? "Trường hoàn lại cho phụ huynh" : "Đang chờ thanh toán") : "Đã hoàn tất"}</h2><dl className="payment-facts"><div><dt>Mã nghĩa vụ</dt><dd>{obligation.obligationCode}</dd></div><div><dt>Kỳ thu</dt><dd>{obligation.period}</dd></div><div><dt>{BigInt(obligation.issuedTotal) < 0n ? "Trường hoàn lại" : "Tổng tiền khi phát hành"}</dt><dd>{vnd((BigInt(obligation.issuedTotal) < 0n ? -BigInt(obligation.issuedTotal) : BigInt(obligation.issuedTotal)).toString())}{obligation.deductionTotal && obligation.deductionTotal !== "0" && <><br /><small>Đã bớt {vnd(obligation.deductionTotal)} cho ngày nghỉ có phép</small></>}{obligation.vatTotal && obligation.vatTotal !== "0" && <><br /><small>Đã gồm thuế GTGT {vnd(obligation.vatTotal)}</small></>}</dd></div><div><dt>Đã nhận thực tế</dt><dd>{vnd(obligation.actualReceipt)}</dd></div>{BigInt(obligation.issuedTotal) >= 0n && <div><dt>Còn phải thanh toán</dt><dd>{vnd(obligation.outstanding)}</dd></div>}<div><dt>Cập nhật</dt><dd>{new Date(obligation.effectiveAt).toLocaleString("vi-VN")}</dd></div></dl></section>{BigInt(obligation.issuedTotal) < 0n ? <section className="panel"><h2>Hoàn tiền</h2><p className="muted">{obligation.state === "ISSUED" ? "Nhà trường sẽ chuyển khoản hoặc trả tiền mặt cho phụ huynh và xác nhận sau khi chi. Phụ huynh không cần chuyển khoản." : "Nhà trường đã chi hoàn khoản này."}</p></section> : <section className="panel"><h2>Thông tin chuyển khoản</h2><dl className="payment-facts"><div><dt>Ngân hàng nhận</dt><dd>{obligation.paymentInstruction.receivingBank}</dd></div><div><dt>Số tài khoản</dt><dd>{obligation.paymentInstruction.accountNumber}</dd></div><div><dt>Chủ tài khoản</dt><dd>{obligation.paymentInstruction.accountHolderName}</dd></div><div><dt>Nội dung</dt><dd>{obligation.paymentInstruction.transferContent}</dd></div></dl>{BigInt(obligation.outstanding) > 0n ? <p className="muted">Vui lòng chuyển đúng số tiền còn phải thanh toán.</p> : <p className="muted">Nghĩa vụ này đã hoàn tất. Không có thao tác thanh toán.</p>}</section>}</> : <p aria-live="polite">Đang tải khoản cần thanh toán...</p>}
             </> : <>{!loading && obligations.length === 0 ? <p className="empty-state">Không có khoản cần thanh toán hoặc lịch sử còn hiệu lực.</p> : obligations.map((item) => <button className="child-card" key={item.id} onClick={() => void openObligation(item.id)}><strong>{item.obligationCode}</strong><span>{item.period}{item.channel ? ` · ${item.channel === "SCHOOL" ? "Chuyển vào tài khoản trường" : "Chuyển vào tài khoản cá nhân"}` : ""} · {BigInt(item.outstanding) < 0n ? `Trường hoàn lại ${vnd((-BigInt(item.outstanding)).toString())}` : `Còn phải thanh toán ${vnd(item.outstanding)}`}</span></button>)}</>
           ) : view === "inbox" ? (
            <>
              {!loading && inbox.length === 0 ? (
                <p className="empty-state">
                  Chưa có thông báo trong 30 ngày gần đây.
                </p>
              ) : (
                inbox.map((event) => (
                  <button
                    className={`inbox-item ${event.unread ? "new" : ""}`}
                    key={event.id}
                    onClick={() => void resolve(event, true)}
                    aria-label={`${event.unread ? "Mới, " : ""}${event.studentDisplayName}, ${event.text}`}
                  >
                    <p>
                      {event.unread && <span className="dot">Mới</span>}
                      {event.unread && " · "}
                      {event.studentDisplayName}
                    </p>
                    <strong>{event.text}</strong>
                    <p className="muted">
                      {event.date} ·{" "}
                      {new Date(event.time).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <small>Xem ngày {event.date}</small>
                  </button>
                ))
              )}
            </>
          ) : selected ? (
            <>
              <button className="text-button" onClick={() => navigate("today")}>
                Quay lại Hôm nay
              </button>
              <section className="panel">
                <h2>Lịch sử điểm danh</h2>
                {current?.map((day) => (
                  <button
                    className="history-row"
                    key={day.date}
                    onClick={() => {
                      clearImage();
                      setSelectedDate(day.date);
                    }}
                  >
                    <span>
                      <strong>{day.date}</strong>
                    </span>
                    {day.status && (
                      <span className="attendance-status">
                        {statusLabel(day.status)}
                      </span>
                    )}
                  </button>
                ))}
              </section>
              <section className="panel leave-panel">
                <div className="section-heading">
                  <h2>Đơn xin nghỉ</h2>
                  {!leaveForm && (
                    <button
                      className="primary-button"
                      onClick={() => setLeaveForm({ startsOn: "", endsOn: "" })}
                    >
                      Tạo đơn
                    </button>
                  )}
                </div>
                {leaveForm && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitLeave();
                    }}
                  >
                    {Object.keys(leaveErrors).length > 0 && (
                      <p ref={leaveErrorSummary} role="alert" tabIndex={-1}>
                        {leaveErrors.startsOn ?? leaveErrors.endsOn}
                      </p>
                    )}
                    <label>
                      Ngày bắt đầu
                      <input
                        type="date"
                        value={leaveForm.startsOn}
                        onChange={(event) =>
                          setLeaveForm({
                            ...leaveForm,
                            startsOn: event.target.value,
                          })
                        }
                        aria-invalid={Boolean(leaveErrors.startsOn)}
                      />
                    </label>
                    {leaveErrors.startsOn && (
                      <p role="alert">{leaveErrors.startsOn}</p>
                    )}
                    <label>
                      Ngày kết thúc
                      <input
                        type="date"
                        value={leaveForm.endsOn}
                        onChange={(event) =>
                          setLeaveForm({
                            ...leaveForm,
                            endsOn: event.target.value,
                          })
                        }
                        aria-invalid={Boolean(leaveErrors.endsOn)}
                      />
                    </label>
                    {leaveErrors.endsOn && (
                      <p role="alert">{leaveErrors.endsOn}</p>
                    )}
                    <button
                      className="primary-button"
                      disabled={Boolean(leaveOperation)}
                    >
                      {leaveOperation
                        ? "Đang đối soát thao tác..."
                        : leaveForm.id
                          ? "Lưu thay đổi"
                          : "Gửi đơn"}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={Boolean(leaveOperation)}
                      onClick={() => {
                        setLeaveForm(undefined);
                        setLeaveErrors({});
                      }}
                    >
                      Hủy
                    </button>
                  </form>
                )}
                {leaves.map((leave) => (
                  <article className="leave-card" key={leave.id}>
                    <strong>{leave.operatingDates.join(", ")}</strong>
                    <p className="muted">
                      {leave.status === "PENDING"
                        ? "Đang chờ duyệt"
                        : leave.status === "CANCELLED"
                          ? "Đã hủy"
                          : leave.status}
                    </p>
                    {leave.status === "PENDING" && (
                      <p>
                        <button
                          className="text-button"
                          disabled={Boolean(leaveOperation)}
                          onClick={() =>
                            setLeaveForm({
                              id: leave.id,
                              startsOn: leave.operatingDates[0] ?? "",
                              endsOn: leave.operatingDates.at(-1) ?? "",
                            })
                          }
                        >
                          Sửa đơn
                        </button>
                        <button
                          className="text-button"
                          disabled={Boolean(leaveOperation)}
                          onClick={(event) => {
                            cancelTrigger.current = event.currentTarget;
                            setConfirmCancel(leave.id);
                          }}
                        >
                          Hủy đơn
                        </button>
                      </p>
                    )}
                  </article>
                ))}
                {confirmCancel && (
                  <div
                    ref={cancelDialog}
                    className="leave-confirm"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Xác nhận hủy đơn"
                  >
                    <p>Bạn có muốn hủy đơn xin nghỉ đang chờ duyệt?</p>
                    <button
                      className="primary-button"
                      autoFocus
                      disabled={Boolean(leaveOperation)}
                      onClick={() => void cancelLeave()}
                    >
                      {leaveOperation
                        ? "Đang đối soát thao tác..."
                        : "Xác nhận hủy đơn"}
                    </button>
                    <button
                      className="text-button"
                      disabled={Boolean(leaveOperation)}
                      onClick={closeCancel}
                    >
                      Quay lại
                    </button>
                  </div>
                )}
              </section>
              {detailLoading && (
                <p aria-live="polite">Đang tải nhận xét trong ngày...</p>
              )}
              {journal === null && (
                <p className="empty-state">Chưa có nhận xét trong ngày này.</p>
              )}
              {journal && (
                <section className="panel journal-card">
                  <h2>Nhận xét ngày {journal.journalDate}</h2>
                  <p>{journal.text}</p>
                  <div className="journal-media">
                    {journal.media.map((item) => (
                      <button
                        className="text-button"
                        key={item.id}
                        onClick={() => void openMedia(item.id)}
                      >
                        Xem ảnh nhận xét
                      </button>
                    ))}
                  </div>
                  {imageUrl && (
                    <img
                      className="journal-image"
                      src={imageUrl}
                      alt="Ảnh nhận xét trong ngày"
                    />
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              {loading && <p aria-live="polite">Đang tải cập nhật...</p>}
              {school.children.map((child) => {
                const first = attendance[child.id]?.[0];
                return (
                  <button
                    className="child-card"
                    key={child.id}
                    onClick={() => selectTodayChild(child.id)}
                  >
                    <strong>{child.fullName}</strong>
                    <span>
                      {first
                        ? statusLabel(first.status)
                        : "Trường chưa ghi nhận"}
                    </span>
                  </button>
                );
              })}
            </>
          )}
        </section>
      </main>
      {mobileNavigation && <nav className="mobile-nav" aria-label="Điều hướng phụ huynh">
        <button className={view === "today" ? "active" : ""} onClick={() => navigate("today")}>Hôm nay</button>
        <button className={view === "inbox" ? "active" : ""} onClick={() => navigate("inbox")}>Thông báo{unread > 0 ? ` (${unread})` : ""}</button>
        <button className={view === "obligations" ? "active" : ""} onClick={() => navigate("obligations")}>Khoản cần thanh toán</button>
        <button className={contactOpen ? "active" : ""} onClick={() => setContactOpen(true)}>Liên hệ</button>
      </nav>}
    </div>
  );
}

export function ParentShell() {
  const [session, setSession] = useState<Session>();
  const [schoolId, setSchoolId] = useState<string>();
  const [state, setState] = useState<
    "loading" | "chooser" | "workspace" | "signed-out"
  >("loading");
  const request = useRef<AbortController | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const currentSchool = useRef<string | undefined>(undefined);
  const foregroundQueued = useRef(false);
  const signedOut = useRef(false);
  const refresh = (requested?: string, foreground = false) => {
    if (!mounted.current || (foreground && signedOut.current)) return;
    const previous = requested ?? currentSchool.current;
    request.current?.abort();
    setSession(undefined);
    setSchoolId(undefined);
    setState("loading");
    const controller = new AbortController();
    request.current = controller;
    void bootstrapSession(() => undefined, controller.signal).then((next) => {
      if (!mounted.current || controller.signal.aborted || signedOut.current)
        return;
      const schools = groupSchools(next?.schools ?? []);
      if (!next || !schools.length) {
        signedOut.current = true;
        return setState("signed-out");
      }
      setSession(next);
      const direct = route();
      const directObligations = window.location.pathname === "/obligations";
      const target = direct
        ? schools.find((school) =>
            school.children.some((child) => child.id === direct.studentId),
          )?.schoolId
        : directObligations
          ? schools[0]?.schoolId
        : previous;
      if (target && schools.some((school) => school.schoolId === target)) {
        currentSchool.current = target;
        setSchoolId(target);
        return setState("workspace");
      }
      const only = schools[0];
      if (!foreground && schools.length === 1 && only) {
        currentSchool.current = only.schoolId;
        setSchoolId(only.schoolId);
        return setState("workspace");
      }
      setState("chooser");
    });
  };
  useEffect(() => {
    mounted.current = true;
    refresh();
    const foreground = () => {
      if (document.visibilityState === "hidden" || foregroundQueued.current)
        return;
      foregroundQueued.current = true;
      queueMicrotask(() => {
        foregroundQueued.current = false;
        refresh(undefined, true);
      });
    };
    window.addEventListener("focus", foreground);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      mounted.current = false;
      request.current?.abort();
      window.removeEventListener("focus", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, []);
  useLayoutEffect(() => {
    if (state !== "loading") heading.current?.focus();
  }, [state, schoolId]);
  const signOut = () => {
    signedOut.current = true;
    request.current?.abort();
    setSession(undefined);
    setSchoolId(undefined);
    setState("signed-out");
    void logout(() => undefined);
  };
  if (state === "loading")
    return (
      <main className="auth-state">
        <p className="sr-only" aria-live="polite">
          Đang xác thực phiên.
        </p>
        <h1>PassionEdu</h1>
        <p>Đang xác thực phiên...</p>
      </main>
    );
  if (state === "signed-out") return <SignedOut headingRef={heading} />;
  const schools = groupSchools(session?.schools ?? []);
  if (state === "chooser")
    return (
      <SchoolChooser
        schools={schools}
        onSelect={(id) => refresh(id)}
        onLogout={signOut}
        headingRef={heading}
      />
    );
  const selected = schools.find((school) => school.schoolId === schoolId);
  return selected ? (
    <ParentWorkspace
      school={selected}
      canSwitch={schools.length > 1}
      onSwitch={() => {
        currentSchool.current = undefined;
        refresh();
      }}
      onLogout={signOut}
      headingRef={heading}
      onDenied={() => {
        currentSchool.current = undefined;
        setSchoolId(undefined);
        setState("chooser");
      }}
    />
  ) : (
    <SignedOut headingRef={heading} />
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <ParentShell />
    </StrictMode>,
  );
