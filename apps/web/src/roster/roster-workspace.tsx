import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type SchoolYear = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  closedAt?: string | null;
};
type Classroom = {
  id: string;
  schoolYearId: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
  activeStudentCount: number;
};
type Enrollment = {
  id: string;
  classId: string;
  lifecycle: string;
  effectiveFrom: string;
  endedOn: string | null;
  schoolYear: { name: string };
  classroom: { name: string };
  classAssignmentHistory?: {
    id: string;
    className: string | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    reason: string;
  }[];
  lifecycleHistory: {
    id: string;
    previousLifecycle: string | null;
    lifecycle: string;
    effectiveFrom: string;
    endedOn: string | null;
    changedAt: string;
  }[];
};
type Student = {
  id: string;
  studentCode: string;
  fullName: string;
  dateOfBirth: string;
  enrollments: Enrollment[];
};
type ParentLink = {
  id: string;
  studentId: string;
  status: "ACTIVE" | "REVOKED";
  parent: { fullName: string; email: string; phone: string; bound: boolean };
};
type Staff = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  employmentStatus: "ACTIVE" | "INACTIVE";
  primaryPositionId: string;
  primaryPosition: {
    id: string;
    code: string;
    name: string;
    status: "ACTIVE" | "INACTIVE";
  } | null;
  schoolMembershipId: string | null;
};
type Position = {
  id: string;
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  capabilities: string[];
};
type PositionAction = {
  position: Position;
  kind: "rename" | "inactivate" | "grant" | "revoke";
  name: string;
  capability: string;
  reason: string;
  confirmation: string;
};
type Assignment = {
  id: string;
  staffProfileId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string;
  endReason: string | null;
  staff: { fullName: string };
  schoolYear: { id: string; name: string };
  classroom: { id: string; name: string };
  access: { status: string };
};
type Pending = {
  id: string;
  schoolId: string;
  kind:
    | "school-year"
    | "class"
    | "rename"
    | "student"
    | "archive"
    | "lifecycle"
    | "parent"
    | "parent-revoke"
    | "staff"
    | "position"
    | "assignment"
    | "assignment-end"
    | "transition"
    | "close-year";
};
type TransitionPreview = {
  fingerprint: string;
  movable: { enrollmentId: string; student: { fullName: string } }[];
  excluded: {
    enrollmentId: string;
    student: { fullName: string };
    reason: string;
  }[];
  destination: { schoolYearName: string; className: string };
};
type ErrorBody = {
  error?: { message?: string; fieldErrors?: Record<string, string> };
};
type Status = { dirty: boolean; pending: boolean; reconcile?: () => void };

const apiUrl = typeof __API_URL__ === "undefined" ? "" : __API_URL__;
const csrfName =
  typeof __CSRF_COOKIE_NAME__ === "undefined"
    ? "app_csrf"
    : __CSRF_COOKIE_NAME__;
const pendingKey = "passionedu.app.pending-roster-operation";
const lifecycleLabel: Record<string, string> = {
  TRIAL: "Học thử",
  WAITING_FOR_CLASS: "Chờ xếp lớp",
  SCHEDULED_TO_START: "Đã hẹn nhập học",
  ENROLLED: "Đang nhập học",
  ON_LEAVE: "Tạm nghỉ",
  WITHDRAWN: "Đã thôi học",
  GRADUATED: "Đã tốt nghiệp",
};
const capabilityLabel: Record<string, string> = {
  SCHOOL_CONTEXT_READ: "Ngữ cảnh trường",
  ACCESS_MANAGE: "Quản lý truy cập",
  ROSTER_MANAGE: "Danh bộ",
  SETTINGS_MANAGE: "Cấu hình",
  CLASS_LEAVE_READ: "Xem đơn nghỉ lớp",
  ATTENDANCE_WRITE: "Điểm danh",
  DAILY_JOURNAL_WRITE: "Nhật ký ngày",
  HANDOVER_WRITE: "Bàn giao",
  WORKFORCE_MANAGE: "Quản lý nhân sự",
  TIMEKEEPING_IMPORT: "Nhập chấm công",
  TIMEKEEPING_REVIEW: "Duyệt chấm công",
  LATE_CARE_MANAGE: "Trông muộn",
  PAYROLL_PREPARE: "Chuẩn bị lương",
  PAYROLL_RECONCILE: "Đối soát lương",
  PAYROLL_APPROVE: "Duyệt lương",
  PAYROLL_REOPEN: "Mở lại lương",
  PAYROLL_PAYOUT_CONFIRM: "Xác nhận chi lương",
  PAYROLL_REPORT_READ: "Xem báo cáo lương",
};
const csrf = () =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${csrfName}=`))
    ?.slice(csrfName.length + 1);
const deniedStatus = (status: number) => [401, 403, 404].includes(status);
const uncertain = (status: number) => [408, 502, 503, 504].includes(status);
const businessToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}-${parts.find((part) => part.type === "day")!.value}`;
};

export function RosterWorkspace({
  schoolId,
  schoolName,
  denied,
  onStatusChange,
}: {
  schoolId: string;
  schoolName: string;
  denied: () => void;
  onStatusChange?: (status: Status) => void;
}) {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [yearId, setYearId] = useState("");
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parentLinks, setParentLinks] = useState<Record<string, ParentLink[]>>(
    {},
  );
  const [parent, setParent] = useState<
    Record<string, { fullName: string; email: string; phone: string }>
  >({});
  const [staff, setStaff] = useState<Staff[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staffInput, setStaffInput] = useState({
    fullName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    employmentStatus: "ACTIVE",
    primaryPositionId: "",
    schoolMembershipId: "",
  });
  const [positionInput, setPositionInput] = useState({
    code: "",
    name: "",
    capabilities: [] as string[],
    reason: "",
  });
  const [positionAction, setPositionAction] = useState<PositionAction>();
  const [editingStaffId, setEditingStaffId] = useState("");
  const [assignment, setAssignment] = useState({
    staffId: "",
    classId: "",
    effectiveFrom: "",
    effectiveTo: "",
    reason: "",
  });
  const [editingAssignmentId, setEditingAssignmentId] = useState("");
  const [endingAssignment, setEndingAssignment] = useState<Assignment>();
  const [endingInput, setEndingInput] = useState({
    effectiveTo: "",
    reason: "",
  });
  const [transition, setTransition] = useState({
    kind: "CLASS_TRANSFER",
    sourceClassId: "",
    destinationSchoolYearId: "",
    destinationClassId: "",
    effectiveFrom: "",
    reason: "",
    confirmation: "",
  });
  const [transitionPreview, setTransitionPreview] =
    useState<TransitionPreview>();
  const [destinationClasses, setDestinationClasses] = useState<Classroom[]>([]);
  const [closeYear, setCloseYear] = useState({
    effectiveTo: "",
    reason: "",
    confirmation: "",
  });
  const [closePreview, setClosePreview] = useState<{
    fingerprint: string;
    assignments: { assignmentId: string; student: { fullName: string } }[];
  }>();
  const [year, setYear] = useState({ name: "", startsOn: "", endsOn: "" });
  const [className, setClassName] = useState("");
  const [rename, setRename] = useState<Classroom>();
  const [renameName, setRenameName] = useState("");
  const [student, setStudent] = useState({
    fullName: "",
    dateOfBirth: "",
    classId: "",
    lifecycle: "ENROLLED",
    effectiveFrom: "",
    endedOn: "",
  });
  const [yearErrors, setYearErrors] = useState<Record<string, string>>({});
  const [classErrors, setClassErrors] = useState<Record<string, string>>({});
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({});
  const [studentErrors, setStudentErrors] = useState<Record<string, string>>(
    {},
  );
  const [staffErrors, setStaffErrors] = useState<Record<string, string>>({});
  const [positionErrors, setPositionErrors] = useState<Record<string, string>>({});
  const [assignmentErrors, setAssignmentErrors] = useState<
    Record<string, string>
  >({});
  const [endedOnByEnrollment, setEndedOnByEnrollment] = useState<
    Record<string, string>
  >({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending>();
  const summary = useRef<HTMLDivElement>(null);
  const endDialog = useRef<HTMLDivElement>(null);
  const endTrigger = useRef<HTMLButtonElement>(null);
  const restoreEndFocus = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const currentSchool = useRef(schoolId);
  const selectedYear = useRef("");
  const valid = (school: string, requestGeneration: number) =>
    currentSchool.current === school &&
    generation.current === requestGeneration;
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const dirty = Boolean(
    year.name ||
      year.startsOn ||
      year.endsOn ||
      className ||
      renameName ||
      student.fullName ||
      student.dateOfBirth ||
      student.classId ||
      student.effectiveFrom ||
      student.endedOn ||
      staffInput.fullName ||
      staffInput.email ||
      staffInput.phone ||
      staffInput.dateOfBirth ||
      staffInput.gender ||
      staffInput.address ||
      assignment.staffId ||
      assignment.classId ||
      assignment.effectiveFrom ||
      assignment.effectiveTo ||
      assignment.reason ||
      endingInput.effectiveTo ||
      endingInput.reason ||
      transition.destinationClassId ||
      transition.effectiveFrom ||
      transition.reason,
  );

  useEffect(() => {
    onStatusChange?.({
      dirty,
      pending: Boolean(pending),
      reconcile: pending ? () => void reconcile(pending) : undefined,
    });
  }, [dirty, pending, onStatusChange]);

  const read = async <T,>(
    path: string,
    requestGeneration = generation.current,
  ): Promise<T | undefined> => {
    const response = await fetch(`${apiUrl}${path}`, {
      credentials: "include",
    });
    if (!valid(schoolId, requestGeneration)) return;
    if (deniedStatus(response.status)) {
      denied();
      return;
    }
    if (!response.ok) throw new Error("Không thể tải danh bộ.");
    return ((await response.json()) as { data: T }).data;
  };
  const loadYear = async (
    selected: string,
    requestGeneration = generation.current,
  ) => {
    setClasses([]);
    setStudents([]);
    setParentLinks({});
    setAssignments([]);
    const [nextClasses, nextStudents, nextAssignments] = await Promise.all([
      read<Classroom[]>(
        `/api/app/schools/${schoolId}/roster/school-years/${selected}/classes`,
        requestGeneration,
      ),
      read<Student[]>(
        `/api/app/schools/${schoolId}/roster/school-years/${selected}/students`,
        requestGeneration,
      ),
      read<Assignment[]>(
        `/api/app/schools/${schoolId}/roster/school-years/${selected}/staff-assignments`,
        requestGeneration,
      ),
    ]);
    if (
      !valid(schoolId, requestGeneration) ||
      selectedYear.current !== selected
    )
      return;
    setClasses(nextClasses ?? []);
    setStudents(nextStudents ?? []);
    setAssignments(
      (nextAssignments ?? []).filter((item): item is Assignment =>
        Boolean(item?.staff && item?.schoolYear && item?.classroom),
      ),
    );
    const links = await Promise.all(
      (nextStudents ?? []).map(
        async (student) =>
          [
            student.id,
            await read<ParentLink[]>(
              `/api/app/schools/${schoolId}/roster/students/${student.id}/parents`,
              requestGeneration,
            ),
          ] as const,
      ),
    );
    if (
      !valid(schoolId, requestGeneration) ||
      selectedYear.current !== selected
    )
      return;
    setParentLinks(
      Object.fromEntries(
        links.map(([id, values]) => [
          id,
          (values ?? []).filter((value) => Boolean(value?.parent)),
        ]),
      ),
    );
    setStudent((current) =>
      current.classId
        ? current
        : {
            ...current,
            classId:
              (nextClasses ?? []).find((item) => item.status === "ACTIVE")
                ?.id ?? "",
          },
    );
  };
  const refresh = async (requestGeneration = generation.current) => {
    const [nextYears, nextStaff, nextPositions] = await Promise.all([
      read<SchoolYear[]>(
        `/api/app/schools/${schoolId}/roster/school-years`,
        requestGeneration,
      ),
      read<Staff[]>(
        `/api/app/schools/${schoolId}/roster/staff`,
        requestGeneration,
      ),
      read<Position[]>(
        `/api/app/schools/${schoolId}/roster/positions`,
        requestGeneration,
      ),
    ]);
    if (!nextYears || !valid(schoolId, requestGeneration)) return;
    setYears(nextYears);
    setStaff(
      (nextStaff ?? []).filter((item): item is Staff =>
        Boolean(item?.email && item?.phone && item?.fullName),
      ),
    );
    setPositions((nextPositions ?? []).filter((item): item is Position => Boolean(item && Array.isArray(item.capabilities) && typeof item.id === 'string')));
    const selected = nextYears.some((item) => item.id === selectedYear.current)
      ? selectedYear.current
      : (nextYears[0]?.id ?? "");
    if (selected !== selectedYear.current) {
      selectedYear.current = selected;
      setYearId(selected);
    }
    if (!selected) {
      setClasses([]);
      setStudents([]);
      return;
    }
    if (selected === yearId) await loadYear(selected, requestGeneration);
  };
  const reconcile = async (
    operation: Pending,
    requestGeneration = generation.current,
  ) => {
    if (!valid(operation.schoolId, requestGeneration)) return;
    setPending(operation);
    try {
      const response = await fetch(
        `${apiUrl}/api/app/schools/${operation.schoolId}/operations/${operation.id}`,
        { credentials: "include" },
      );
      if (!valid(operation.schoolId, requestGeneration)) return;
      if (deniedStatus(response.status)) {
        denied();
        return;
      }
      if (!response.ok) throw new Error();
      const result = ((await response.json()) as { data: { status: string } })
        .data;
      if (result.status === "PENDING") {
        timer.current = window.setTimeout(
          () => void reconcile(operation, requestGeneration),
          750,
        );
        return;
      }
      sessionStorage.removeItem(pendingKey);
      setPending(undefined);
      if (result.status === "COMPLETED") await refresh(requestGeneration);
      else setMessage("Thao tác không thành công.");
    } catch {
      if (valid(operation.schoolId, requestGeneration))
        timer.current = window.setTimeout(
          () => void reconcile(operation, requestGeneration),
          750,
        );
    }
  };
  useEffect(() => {
    const requestGeneration = ++generation.current;
    currentSchool.current = schoolId;
    selectedYear.current = "";
    stop();
    setYears([]);
    setYearId("");
    setClasses([]);
    setStudents([]);
    setParentLinks({});
    setParent({});
    setStaff([]);
    setPositions([]);
    setAssignments([]);
    setYear({ name: "", startsOn: "", endsOn: "" });
    setClassName("");
    setRename(undefined);
    setRenameName("");
    setStudent({
      fullName: "",
      dateOfBirth: "",
      classId: "",
      lifecycle: "ENROLLED",
      effectiveFrom: "",
      endedOn: "",
    });
    setStaffInput({
      fullName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      gender: "",
      address: "",
      employmentStatus: "ACTIVE",
      primaryPositionId: "",
      schoolMembershipId: "",
    });
    setPositionInput({ code: "", name: "", capabilities: [], reason: "" });
    setPositionAction(undefined);
    setEditingStaffId("");
    setAssignment({
      staffId: "",
      classId: "",
      effectiveFrom: "",
      effectiveTo: "",
      reason: "",
    });
    setEditingAssignmentId("");
    setEndingAssignment(undefined);
    setEndingInput({ effectiveTo: "", reason: "" });
    setTransition({
      kind: "CLASS_TRANSFER",
      sourceClassId: "",
      destinationSchoolYearId: "",
      destinationClassId: "",
      effectiveFrom: "",
      reason: "",
      confirmation: "",
    });
    setTransitionPreview(undefined);
    setDestinationClasses([]);
    setCloseYear({ effectiveTo: "", reason: "", confirmation: "" });
    setClosePreview(undefined);
    setYearErrors({});
    setClassErrors({});
    setRenameErrors({});
    setStudentErrors({});
    setStaffErrors({});
    setPositionErrors({});
    setAssignmentErrors({});
    setMessage("");
    setPending(undefined);
    void refresh(requestGeneration).catch(
      (error: Error) =>
        valid(schoolId, requestGeneration) && setMessage(error.message),
    );
    const raw = sessionStorage.getItem(pendingKey);
    if (raw) {
      const saved = JSON.parse(raw) as Pending;
      if (saved.schoolId === schoolId) void reconcile(saved, requestGeneration);
    }
    return stop;
  }, [schoolId]);
  useEffect(() => {
    if (!yearId) return;
    const requestGeneration = generation.current;
    void loadYear(yearId, requestGeneration).catch(
      (error: Error) =>
        valid(schoolId, requestGeneration) &&
        selectedYear.current === yearId &&
        setMessage(error.message),
    );
  }, [yearId, schoolId]);
  useEffect(() => {
    if (
      transition.kind === "YEAR_TRANSITION" &&
      transition.destinationSchoolYearId
    )
      void loadDestinationClasses(
        transition.destinationSchoolYearId,
        generation.current,
        yearId,
      );
    else setDestinationClasses([]);
  }, [transition.kind, transition.destinationSchoolYearId, schoolId, yearId]);
  useLayoutEffect(() => {
    if (
      Object.keys(yearErrors).length ||
      Object.keys(classErrors).length ||
      Object.keys(renameErrors).length ||
       Object.keys(studentErrors).length ||
       Object.keys(staffErrors).length ||
       Object.keys(positionErrors).length ||
       Object.keys(assignmentErrors).length
    )
      summary.current?.focus();
  }, [
    yearErrors,
    classErrors,
    renameErrors,
    studentErrors,
    staffErrors,
    positionErrors,
    assignmentErrors,
  ]);
  useEffect(() => {
    if (endingAssignment)
      endDialog.current?.querySelector<HTMLElement>("input, button")?.focus();
    else if (restoreEndFocus.current) {
      endTrigger.current?.focus();
      restoreEndFocus.current = false;
    }
  }, [endingAssignment]);

  const post = async (path: string, body: object, kind: Pending["kind"]) => {
    if (pending) return false;
    const requestGeneration = generation.current;
    const operation: Pending = { id: crypto.randomUUID(), schoolId, kind };
    setMessage("");
    if (kind === "school-year") setYearErrors({});
    else if (kind === "class" || kind === "archive") setClassErrors({});
    else if (kind === "rename") setRenameErrors({});
    else if (kind === "staff") setStaffErrors({});
    else if (kind === "position") setPositionErrors({});
    else if (kind === "assignment" || kind === "assignment-end")
      setAssignmentErrors({});
    else setStudentErrors({});
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
      if (!valid(schoolId, requestGeneration)) return false;
      if (deniedStatus(response.status)) {
        denied();
        return false;
      }
      if (uncertain(response.status))
        throw new TypeError("Mutation outcome is uncertain.");
      if (!response.ok) {
        const data = (await response.json()) as ErrorBody;
        const errors = data.error?.fieldErrors ?? {};
        if (kind === "school-year") setYearErrors(errors);
        else if (kind === "class" || kind === "archive") setClassErrors(errors);
        else if (kind === "rename") setRenameErrors(errors);
        else if (kind === "staff") setStaffErrors(errors);
        else if (kind === "position") setPositionErrors(errors);
        else if (kind === "assignment" || kind === "assignment-end")
          setAssignmentErrors(errors);
        else setStudentErrors(errors);
        setMessage(data.error?.message ?? "Thao tác không thành công.");
        return false;
      }
      await refresh(requestGeneration);
      return valid(schoolId, requestGeneration);
    } catch (error) {
      if (!valid(schoolId, requestGeneration)) return false;
      if (error instanceof TypeError) {
        sessionStorage.setItem(pendingKey, JSON.stringify(operation));
        setPending(operation);
        void reconcile(operation, requestGeneration);
      } else setMessage("Thao tác không thành công.");
      return false;
    }
  };
  const createYear = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await post(
        `/api/app/schools/${schoolId}/roster/school-years`,
        year,
        "school-year",
      )
    )
      setYear({ name: "", startsOn: "", endsOn: "" });
  };
  const createClass = async (event: FormEvent) => {
    event.preventDefault();
    if (
      yearId &&
      (await post(
        `/api/app/schools/${schoolId}/roster/school-years/${yearId}/classes`,
        { name: className },
        "class",
      ))
    )
      setClassName("");
  };
  const submitRename = async (event: FormEvent) => {
    event.preventDefault();
    if (
      rename &&
      (await post(
        `/api/app/schools/${schoolId}/roster/classes/${rename.id}/name`,
        { name: renameName },
        "rename",
      ))
    ) {
      setRename(undefined);
      setRenameName("");
    }
  };
  const createStudent = async (event: FormEvent) => {
    event.preventDefault();
    if (
      yearId &&
      (await post(
        `/api/app/schools/${schoolId}/roster/students`,
        { ...student, schoolYearId: yearId, endedOn: student.endedOn || null },
        "student",
      ))
    )
      setStudent({
        fullName: "",
        dateOfBirth: "",
        classId: classes.find((item) => item.status === "ACTIVE")?.id ?? "",
        lifecycle: "ENROLLED",
        effectiveFrom: "",
        endedOn: "",
      });
  };
  const changeLifecycle = async (enrollment: Enrollment, lifecycle: string) => {
    await post(
      `/api/app/schools/${schoolId}/roster/enrollments/${enrollment.id}/lifecycle`,
      {
        lifecycle,
        endedOn:
          lifecycle === "ON_LEAVE" ||
          lifecycle === "WITHDRAWN" ||
          lifecycle === "GRADUATED"
            ? endedOnByEnrollment[enrollment.id] ||
              enrollment.endedOn ||
              businessToday()
            : null,
      },
      "lifecycle",
    );
  };
  const createParent = async (event: FormEvent, studentId: string) => {
    event.preventDefault();
    const input = parent[studentId] ?? { fullName: "", email: "", phone: "" };
    if (
      await post(
        `/api/app/schools/${schoolId}/roster/students/${studentId}/parents`,
        input,
        "parent",
      )
    )
      setParent({
        ...parent,
        [studentId]: { fullName: "", email: "", phone: "" },
      });
  };
  const revokeParent = async (link: ParentLink) => {
    if (window.confirm(`Thu hồi liên kết của ${link.parent.fullName}?`))
      await post(
        `/api/app/schools/${schoolId}/roster/student-parents/${link.id}/revoke`,
        {},
        "parent-revoke",
      );
  };
  const saveStaff = async (event: FormEvent) => {
    event.preventDefault();
    const path = editingStaffId
      ? `/api/app/schools/${schoolId}/roster/staff/${editingStaffId}`
      : `/api/app/schools/${schoolId}/roster/staff`;
    if (
      await post(
        path,
        {
          ...staffInput,
          schoolMembershipId: staffInput.schoolMembershipId || null,
        },
        "staff",
      )
    ) {
      setStaffInput({
        fullName: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        gender: "",
        address: "",
        employmentStatus: "ACTIVE",
        primaryPositionId: "",
        schoolMembershipId: "",
      });
      setEditingStaffId("");
    }
  };
  const savePosition = async (event: FormEvent) => {
    event.preventDefault();
    if (
      await post(
        `/api/app/schools/${schoolId}/roster/positions`,
        positionInput,
        "position",
      )
    )
      setPositionInput({ code: "", name: "", capabilities: [], reason: "" });
  };
  const submitPositionAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!positionAction) return;
    const { position, kind, name, capability, reason, confirmation } = positionAction;
    if (kind === "inactivate" && confirmation !== "NGỪNG HIỆU LỰC") return;
    const path =
      kind === "rename"
        ? `/api/app/schools/${schoolId}/roster/positions/${position.id}/name`
        : kind === "inactivate"
          ? `/api/app/schools/${schoolId}/roster/positions/${position.id}/inactivate`
          : kind === "grant"
            ? `/api/app/schools/${schoolId}/roster/positions/${position.id}/grants`
            : `/api/app/schools/${schoolId}/roster/positions/${position.id}/grants/${capability}/revoke`;
    const body =
      kind === "rename" ? { name, reason } : kind === "grant" ? { capability, reason } : { reason };
    if (await post(path, body, "position")) setPositionAction(undefined);
  };
  const saveAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (!yearId) return;
    const path = editingAssignmentId
      ? `/api/app/schools/${schoolId}/roster/staff-assignments/${editingAssignmentId}/change`
      : `/api/app/schools/${schoolId}/roster/staff/${assignment.staffId}/assignments`;
    if (
      await post(
        path,
        {
          schoolYearId: yearId,
          classId: assignment.classId,
          effectiveFrom: assignment.effectiveFrom,
          effectiveTo: assignment.effectiveTo || null,
          reason: assignment.reason,
        },
        "assignment",
      )
    ) {
      setAssignment({
        staffId: "",
        classId: "",
        effectiveFrom: "",
        effectiveTo: "",
        reason: "",
      });
      setEditingAssignmentId("");
    }
  };
  const endAssignment = async (event: FormEvent) => {
    event.preventDefault();
    if (
      endingAssignment &&
      (await post(
        `/api/app/schools/${schoolId}/roster/staff-assignments/${endingAssignment.id}/end`,
        endingInput,
        "assignment-end",
      ))
    ) {
      setEndingAssignment(undefined);
      setEndingInput({ effectiveTo: "", reason: "" });
    }
  };
  const previewRosterTransition = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    const requestGeneration = generation.current;
    const input = {
      ...transition,
      sourceSchoolYearId: yearId,
      destinationSchoolYearId:
        transition.kind === "CLASS_TRANSFER"
          ? yearId
          : transition.destinationSchoolYearId,
    };
    const snapshot = JSON.stringify(input);
    setMessage("");
    setTransitionPreview(undefined);
    try {
      const response = await fetch(
        `${apiUrl}/api/app/schools/${schoolId}/roster/transitions/preview`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": decodeURIComponent(csrf() ?? ""),
          },
          body: snapshot,
        },
      );
      const current = {
        ...transition,
        sourceSchoolYearId: yearId,
        destinationSchoolYearId:
          transition.kind === "CLASS_TRANSFER"
            ? yearId
            : transition.destinationSchoolYearId,
      };
      if (
        !valid(schoolId, requestGeneration) ||
        selectedYear.current !== yearId ||
        snapshot !== JSON.stringify(current)
      )
        return;
      if (deniedStatus(response.status)) {
        denied();
        return;
      }
      if (!response.ok) {
        const data = (await response.json()) as ErrorBody;
        setMessage(data.error?.message ?? "Không thể tạo kết quả xem trước.");
        return;
      }
      setTransitionPreview(
        ((await response.json()) as { data: TransitionPreview }).data,
      );
    } catch {
      if (valid(schoolId, requestGeneration))
        setMessage("Không thể tạo kết quả xem trước.");
    }
  };
  const confirmRosterTransition = async () => {
    if (!transitionPreview || readOnly) return;
    if (
      await post(
        `/api/app/schools/${schoolId}/roster/transitions`,
        {
          ...transition,
          sourceSchoolYearId: yearId,
          destinationSchoolYearId:
            transition.kind === "CLASS_TRANSFER"
              ? yearId
              : transition.destinationSchoolYearId,
          selectedEnrollmentIds: transitionPreview.movable.map(
            (item) => item.enrollmentId,
          ),
          previewFingerprint: transitionPreview.fingerprint,
          confirmation: transition.confirmation,
        },
        "transition",
      )
    ) {
      setTransitionPreview(undefined);
      setTransition({
        kind: "CLASS_TRANSFER",
        sourceClassId: "",
        destinationSchoolYearId: yearId,
        destinationClassId: "",
        effectiveFrom: "",
        reason: "",
        confirmation: "",
      });
    }
  };
  const loadDestinationClasses = async (
    destinationYearId: string,
    requestGeneration: number,
    sourceYearId: string,
  ) => {
    setDestinationClasses([]);
    setTransitionPreview(undefined);
    if (!destinationYearId) return;
    try {
      const values = await read<Classroom[]>(
        `/api/app/schools/${schoolId}/roster/school-years/${destinationYearId}/classes`,
        requestGeneration,
      );
      if (
        values &&
        valid(schoolId, requestGeneration) &&
        selectedYear.current === sourceYearId &&
        transition.destinationSchoolYearId === destinationYearId
      )
        setDestinationClasses(values);
    } catch {
      if (valid(schoolId, requestGeneration))
        setMessage("Không thể tải lớp đích.");
    }
  };
  const previewYearClose = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly) return;
    const requestGeneration = generation.current;
    const snapshot = JSON.stringify({
      schoolYearId: yearId,
      effectiveTo: closeYear.effectiveTo,
      reason: closeYear.reason,
    });
    setClosePreview(undefined);
    try {
      const response = await fetch(
        `${apiUrl}/api/app/schools/${schoolId}/roster/close-year/preview`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-csrf-token": decodeURIComponent(csrf() ?? ""),
          },
          body: snapshot,
        },
      );
      if (
        !valid(schoolId, requestGeneration) ||
        selectedYear.current !== yearId ||
        snapshot !==
          JSON.stringify({
            schoolYearId: yearId,
            effectiveTo: closeYear.effectiveTo,
            reason: closeYear.reason,
          })
      )
        return;
      if (deniedStatus(response.status)) {
        denied();
        return;
      }
      if (!response.ok) {
        setMessage("Không thể tạo kết quả xem trước.");
        return;
      }
      setClosePreview(
        (
          (await response.json()) as {
            data: {
              fingerprint: string;
              assignments: {
                assignmentId: string;
                student: { fullName: string };
              }[];
            };
          }
        ).data,
      );
    } catch {
      if (valid(schoolId, requestGeneration))
        setMessage("Không thể tạo kết quả xem trước.");
    }
  };
  const confirmYearClose = async () => {
    if (
      !readOnly &&
      closePreview &&
      (await post(
        `/api/app/schools/${schoolId}/roster/close-year`,
        {
          schoolYearId: yearId,
          effectiveTo: closeYear.effectiveTo,
          reason: closeYear.reason,
          previewFingerprint: closePreview.fingerprint,
          confirmation: closeYear.confirmation,
        },
        "close-year",
      ))
    ) {
      setClosePreview(undefined);
      setCloseYear({ effectiveTo: "", reason: "", confirmation: "" });
    }
  };
  const selected = years.find((item) => item.id === yearId);
  const readOnly = Boolean(selected?.closedAt);
  const disabled = Boolean(pending);
  const field = (errors: Record<string, string>, name: string, prefix = "") =>
    errors[name]
      ? { "aria-invalid": true, "aria-describedby": `${prefix}${name}-error` }
      : {};
  const trapEndDialog = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = [
      ...(endDialog.current?.querySelectorAll<HTMLElement>(
        "input:not([disabled]), button:not([disabled])",
      ) ?? []),
    ];
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

  return (
    <section className="roster-workspace" aria-labelledby="roster-title">
      <h2 id="roster-title">Danh bộ</h2>
      <p>
        {schoolName}
        {selected ? ` / ${selected.name}` : " / Chưa có năm học"}
      </p>
      {message && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      <form className="roster-form" onSubmit={savePosition}>
        <h3>Danh mục chức danh</h3>
        <label>Mã chức danh<input value={positionInput.code} onChange={(event) => setPositionInput({ ...positionInput, code: event.target.value })} {...field(positionErrors, "code", "position-")} /></label>
        {positionErrors.code && <small id="position-code-error">{positionErrors.code}</small>}
        <label>Tên chức danh<input value={positionInput.name} onChange={(event) => setPositionInput({ ...positionInput, name: event.target.value })} {...field(positionErrors, "name", "position-")} /></label>
        {positionErrors.name && <small id="position-name-error">{positionErrors.name}</small>}
        <fieldset><legend>Capability hệ thống</legend>{Object.entries(capabilityLabel).map(([capability, label]) => <label key={capability}><input type="checkbox" checked={positionInput.capabilities.includes(capability)} onChange={() => setPositionInput({ ...positionInput, capabilities: positionInput.capabilities.includes(capability) ? positionInput.capabilities.filter((item) => item !== capability) : [...positionInput.capabilities, capability] })} />{label}</label>)}</fieldset>
        <label>Lý do tạo chức danh<input value={positionInput.reason} onChange={(event) => setPositionInput({ ...positionInput, reason: event.target.value })} {...field(positionErrors, "reason", "position-")} /></label>
        {positionErrors.reason && <small id="position-reason-error">{positionErrors.reason}</small>}
        <button disabled={disabled}>Tạo chức danh</button>
      </form>
      <div className="table-scroll"><table><caption>Chức danh của {schoolName}</caption><thead><tr><th>Chức danh</th><th>Capability</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{positions.length ? positions.map((item) => <tr key={item.id}><th scope="row">{item.name} ({item.code})</th><td>{item.capabilities.map((capability) => <span key={capability}>{capabilityLabel[capability] ?? capability} <button type="button" disabled={disabled} aria-label={`Thu hồi ${capabilityLabel[capability] ?? capability} của ${item.name}`} onClick={() => setPositionAction({ position: item, kind: "revoke", name: item.name, capability, reason: "", confirmation: "" })}>Thu hồi</button> </span>) || 'Chưa cấp capability'}</td><td>{item.status === 'ACTIVE' ? 'Đang hiệu lực' : 'Không hiệu lực'}</td><td><button type="button" disabled={disabled} onClick={() => setPositionAction({ position: item, kind: "rename", name: item.name, capability: "", reason: "", confirmation: "" })}>Đổi tên {item.name}</button>{item.status === 'ACTIVE' && <><button type="button" disabled={disabled} onClick={() => setPositionAction({ position: item, kind: "grant", name: item.name, capability: "", reason: "", confirmation: "" })}>Cấp capability cho {item.name}</button><button type="button" disabled={disabled} onClick={() => setPositionAction({ position: item, kind: "inactivate", name: item.name, capability: "", reason: "", confirmation: "" })}>Ngừng hiệu lực {item.name}</button></>}</td></tr>) : <tr><td colSpan={4}>Chưa có chức danh.</td></tr>}</tbody></table></div>
      {positionAction && <div role="dialog" aria-modal="true" aria-labelledby="position-action-title"><form className="roster-form" onSubmit={submitPositionAction}><h3 id="position-action-title">{positionAction.kind === "rename" ? `Đổi tên ${positionAction.position.name}` : positionAction.kind === "inactivate" ? `Ngừng hiệu lực ${positionAction.position.name}` : positionAction.kind === "grant" ? `Cấp capability cho ${positionAction.position.name}` : `Thu hồi capability của ${positionAction.position.name}`}</h3>{positionAction.kind === "rename" && <label>Tên chức danh mới<input value={positionAction.name} onChange={(event) => setPositionAction({ ...positionAction, name: event.target.value })} {...field(positionErrors, "name", "position-")} /></label>}{positionAction.kind === "grant" && <label>Capability cần cấp<select value={positionAction.capability} onChange={(event) => setPositionAction({ ...positionAction, capability: event.target.value })}><option value="">Chọn capability</option>{Object.entries(capabilityLabel).filter(([capability]) => !positionAction.position.capabilities.includes(capability)).map(([capability, label]) => <option key={capability} value={capability}>{label}</option>)}</select></label>}<label>{positionAction.kind === "rename" ? "Lý do đổi tên chức danh" : positionAction.kind === "inactivate" ? "Lý do ngừng hiệu lực chức danh" : positionAction.kind === "grant" ? "Lý do cấp capability" : "Lý do thu hồi capability"}<input value={positionAction.reason} onChange={(event) => setPositionAction({ ...positionAction, reason: event.target.value })} {...field(positionErrors, "reason", "position-")} /></label>{positionErrors.reason && <small id="position-reason-error">{positionErrors.reason}</small>}{positionAction.kind === "inactivate" && <label>Nhập NGỪNG HIỆU LỰC để xác nhận<input value={positionAction.confirmation} onChange={(event) => setPositionAction({ ...positionAction, confirmation: event.target.value })} /></label>}<button type="button" onClick={() => setPositionAction(undefined)}>Hủy</button><button disabled={disabled || (positionAction.kind === "inactivate" && positionAction.confirmation !== "NGỪNG HIỆU LỰC")}>{positionAction.kind === "rename" ? "Lưu tên chức danh" : positionAction.kind === "inactivate" ? "Xác nhận ngừng hiệu lực" : positionAction.kind === "grant" ? "Cấp capability" : "Xác nhận thu hồi capability"}</button></form></div>}
      <form className="roster-form" onSubmit={saveStaff}>
        <h3>{editingStaffId ? "Sửa hồ sơ nhân sự" : "Hồ sơ nhân sự"}</h3>
        <label>
          Họ và tên nhân sự
          <input
            value={staffInput.fullName}
            onChange={(event) =>
              setStaffInput({ ...staffInput, fullName: event.target.value })
            }
            {...field(staffErrors, "fullName", "staff-")}
          />
        </label>
        {staffErrors.fullName && (
          <small id="staff-fullName-error">{staffErrors.fullName}</small>
        )}
        <label>
          Email nhân sự
          <input
            type="email"
            value={staffInput.email}
            onChange={(event) =>
              setStaffInput({ ...staffInput, email: event.target.value })
            }
            {...field(staffErrors, "email", "staff-")}
          />
        </label>
        {staffErrors.email && (
          <small id="staff-email-error">{staffErrors.email}</small>
        )}
        <label>
          Số điện thoại nhân sự
          <input
            value={staffInput.phone}
            onChange={(event) =>
              setStaffInput({ ...staffInput, phone: event.target.value })
            }
            {...field(staffErrors, "phone", "staff-")}
          />
        </label>
        {staffErrors.phone && (
          <small id="staff-phone-error">{staffErrors.phone}</small>
        )}
        <label>
          Ngày sinh nhân sự
          <input
            type="date"
            value={staffInput.dateOfBirth}
            onChange={(event) =>
              setStaffInput({ ...staffInput, dateOfBirth: event.target.value })
            }
            {...field(staffErrors, "dateOfBirth", "staff-")}
          />
        </label>
        {staffErrors.dateOfBirth && (
          <small id="staff-dateOfBirth-error">{staffErrors.dateOfBirth}</small>
        )}
        <label>
          Giới tính
          <input
            value={staffInput.gender}
            onChange={(event) =>
              setStaffInput({ ...staffInput, gender: event.target.value })
            }
            {...field(staffErrors, "gender", "staff-")}
          />
        </label>
        {staffErrors.gender && (
          <small id="staff-gender-error">{staffErrors.gender}</small>
        )}
        <label>
          Địa chỉ
          <input
            value={staffInput.address}
            onChange={(event) =>
              setStaffInput({ ...staffInput, address: event.target.value })
            }
            {...field(staffErrors, "address", "staff-")}
          />
        </label>
        {staffErrors.address && (
          <small id="staff-address-error">{staffErrors.address}</small>
        )}
        <label>Chức danh chính<select value={staffInput.primaryPositionId} onChange={(event) => setStaffInput({ ...staffInput, primaryPositionId: event.target.value })}><option value="">Chọn chức danh</option>{positions.filter((item) => item.status === 'ACTIVE').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Trạng thái nhân sự<select value={staffInput.employmentStatus} onChange={(event) => setStaffInput({ ...staffInput, employmentStatus: event.target.value as 'ACTIVE' | 'INACTIVE' })}><option value="ACTIVE">Đang hiệu lực</option><option value="INACTIVE">Không hiệu lực</option></select></label>
        {editingStaffId && (
          <button
            type="button"
            onClick={() => {
              setEditingStaffId("");
              setStaffInput({
                fullName: "",
                email: "",
                phone: "",
                dateOfBirth: "",
                gender: "",
                address: "", employmentStatus: "ACTIVE", primaryPositionId: "", schoolMembershipId: "",
              });
            }}
          >
            Hủy sửa hồ sơ
          </button>
        )}
        <button disabled={disabled}>
          {editingStaffId ? "Lưu thay đổi hồ sơ" : "Lưu hồ sơ nhân sự"}
        </button>
      </form>
      <div className="table-scroll">
        <table>
          <caption>Hồ sơ nhân sự của {schoolName}</caption>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Chức danh chính</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {staff.length ? (
              staff.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{item.fullName}</th>
                  <td>
                    {item.primaryPosition?.name ?? 'Không có'}
                  </td>
                  <td>
                    {item.employmentStatus === 'ACTIVE' ? 'Đang hiệu lực' : 'Không hiệu lực'}
                  </td>
                  <td>
                    <button
                      disabled={disabled}
                      onClick={() => {
                        setEditingStaffId(item.id);
                        setStaffInput({
                          fullName: item.fullName,
                          email: item.email,
                          phone: item.phone,
                          dateOfBirth: item.dateOfBirth,
                          gender: item.gender,
                          address: item.address,
                          employmentStatus: item.employmentStatus,
                          primaryPositionId: item.primaryPositionId,
                          schoolMembershipId: item.schoolMembershipId ?? "",
                        });
                        setStaffErrors({});
                      }}
                    >
                      Sửa hồ sơ
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>Chưa có hồ sơ nhân sự.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form className="roster-form" onSubmit={createYear}>
        <h3>Tạo năm học</h3>
        <label>
          Tên năm học
          <input
            value={year.name}
            onChange={(event) => setYear({ ...year, name: event.target.value })}
            {...field(yearErrors, "name")}
          />
        </label>
        {yearErrors.name && <small id="name-error">{yearErrors.name}</small>}
        <label>
          Ngày bắt đầu
          <input
            type="date"
            value={year.startsOn}
            onChange={(event) =>
              setYear({ ...year, startsOn: event.target.value })
            }
            {...field(yearErrors, "startsOn")}
          />
        </label>
        {yearErrors.startsOn && (
          <small id="startsOn-error">{yearErrors.startsOn}</small>
        )}
        <label>
          Ngày kết thúc
          <input
            type="date"
            value={year.endsOn}
            onChange={(event) =>
              setYear({ ...year, endsOn: event.target.value })
            }
            {...field(yearErrors, "endsOn")}
          />
        </label>
        {yearErrors.endsOn && (
          <small id="endsOn-error">{yearErrors.endsOn}</small>
        )}
        <button disabled={disabled}>Tạo năm học</button>
      </form>
      <div className="table-scroll">
        <table>
          <caption>Năm học của {schoolName}</caption>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Khoảng thời gian</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {years.length ? (
              years.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    <button
                      onClick={() => {
                        selectedYear.current = item.id;
                        setClasses([]);
                        setStudents([]);
                        setTransitionPreview(undefined);
                        setClosePreview(undefined);
                        setDestinationClasses([]);
                        setTransition({
                          kind: "CLASS_TRANSFER",
                          sourceClassId: "",
                          destinationSchoolYearId: "",
                          destinationClassId: "",
                          effectiveFrom: "",
                          reason: "",
                          confirmation: "",
                        });
                        setYearId(item.id);
                      }}
                    >
                      {item.name}
                    </button>
                  </th>
                  <td>
                    {item.startsOn} - {item.endsOn}
                  </td>
                  <td>
                    {item.isActive ? "Đang hoạt động" : "Không hoạt động"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>
                  Chưa có năm học. Tạo năm học đầu tiên để quản lý lớp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {yearId && (
        <>
          {readOnly && (
            <p role="status">
              Năm học đã đóng. Danh bộ và lịch sử chỉ có thể xem.
            </p>
          )}
          <fieldset disabled={readOnly || disabled}>
            {!readOnly && (
              <form className="roster-form" onSubmit={createClass}>
                <h3>Thêm lớp cho {selected?.name}</h3>
                <label>
                  Tên lớp
                  <input
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    {...field(classErrors, "name")}
                  />
                </label>
                {classErrors.name && (
                  <small id="name-error">{classErrors.name}</small>
                )}
                <button disabled={disabled}>Tạo lớp</button>
              </form>
            )}
            <form className="roster-form" onSubmit={saveAssignment}>
              <h3>
                {editingAssignmentId
                  ? "Sửa phân công nhân sự"
                  : "Phân công nhân sự theo hiệu lực"}
              </h3>
              <label>
                Nhân sự
                <select
                  disabled={Boolean(editingAssignmentId)}
                  value={assignment.staffId}
                  onChange={(event) =>
                    setAssignment({
                      ...assignment,
                      staffId: event.target.value,
                    })
                  }
                  {...field(assignmentErrors, "staffId", "assignment-")}
                >
                  <option value="">Chọn nhân sự</option>
                  {staff.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
              </label>
              {assignmentErrors.staffId && (
                <small id="assignment-staffId-error">
                  {assignmentErrors.staffId}
                </small>
              )}
              <label>
                Lớp phân công
                <select
                  value={assignment.classId}
                  onChange={(event) =>
                    setAssignment({
                      ...assignment,
                      classId: event.target.value,
                    })
                  }
                  {...field(assignmentErrors, "classId", "assignment-")}
                >
                  <option value="">Chọn lớp</option>
                  {classes
                    .filter((item) => item.status === "ACTIVE")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              {assignmentErrors.classId && (
                <small id="assignment-classId-error">
                  {assignmentErrors.classId}
                </small>
              )}
              <label>
                Ngày hiệu lực phân công
                <input
                  type="date"
                  value={assignment.effectiveFrom}
                  onChange={(event) =>
                    setAssignment({
                      ...assignment,
                      effectiveFrom: event.target.value,
                    })
                  }
                  {...field(assignmentErrors, "effectiveFrom", "assignment-")}
                />
              </label>
              {assignmentErrors.effectiveFrom && (
                <small id="assignment-effectiveFrom-error">
                  {assignmentErrors.effectiveFrom}
                </small>
              )}
              {!editingAssignmentId && (
                <>
                  <label>
                    Ngày kết thúc phân công
                    <input
                      type="date"
                      value={assignment.effectiveTo}
                      onChange={(event) =>
                        setAssignment({
                          ...assignment,
                          effectiveTo: event.target.value,
                        })
                      }
                      {...field(
                        endingAssignment ? {} : assignmentErrors,
                        "effectiveTo",
                        "assignment-",
                      )}
                    />
                  </label>
                  {!endingAssignment && assignmentErrors.effectiveTo && (
                    <small id="assignment-effectiveTo-error">
                      {assignmentErrors.effectiveTo}
                    </small>
                  )}
                </>
              )}
              <label>
                Lý do phân công
                <input
                  value={assignment.reason}
                  onChange={(event) =>
                    setAssignment({ ...assignment, reason: event.target.value })
                  }
                  {...field(assignmentErrors, "reason", "assignment-")}
                />
              </label>
              {assignmentErrors.reason && (
                <small id="assignment-reason-error">
                  {assignmentErrors.reason}
                </small>
              )}
              {editingAssignmentId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAssignmentId("");
                    setAssignment({
                      staffId: "",
                      classId: "",
                      effectiveFrom: "",
                      effectiveTo: "",
                      reason: "",
                    });
                  }}
                >
                  Hủy sửa phân công
                </button>
              )}
              <button disabled={disabled || !selected?.isActive}>
                {editingAssignmentId
                  ? "Lưu thay đổi phân công"
                  : "Lưu phân công"}
              </button>
            </form>
            <div className="table-scroll">
              <table>
                <caption>Phân công lớp theo hiệu lực của {schoolName}</caption>
                <thead>
                  <tr>
                    <th>Nhân sự</th>
                    <th>Lớp / năm học</th>
                    <th>Khoảng hiệu lực</th>
                    <th>Quyền truy cập</th>
                    <th>Lý do</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.length ? (
                    assignments.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">{item.staff.fullName}</th>
                        <td>
                          {item.classroom.name} / {item.schoolYear.name}
                        </td>
                        <td>
                          {item.effectiveFrom} đến{" "}
                          {item.effectiveTo ?? "chưa xác định"}
                        </td>
                        <td>
                          {item.access.status === "NOT_PROVIDED"
                            ? "Chưa có quyền được trả về"
                            : item.access.status}
                        </td>
                        <td>
                          {item.reason}
                          {item.endReason
                            ? ` / Kết thúc: ${item.endReason}`
                            : ""}
                        </td>
                        <td>
                          {!item.effectiveTo && (
                            <>
                              <button
                                disabled={disabled}
                                aria-label={`Sửa phân công ${item.staff.fullName} tại ${item.classroom.name}`}
                                onClick={() => {
                                  setEditingAssignmentId(item.id);
                                  setAssignment({
                                    staffId: item.staffProfileId,
                                    classId: item.classroom.id,
                                    effectiveFrom: item.effectiveFrom,
                                    effectiveTo: "",
                                    reason: item.reason,
                                  });
                                  setAssignmentErrors({});
                                }}
                              >
                                Sửa phân công
                              </button>
                              <button
                                disabled={disabled}
                                aria-label={`Kết thúc phân công ${item.staff.fullName} tại ${item.classroom.name}`}
                                onClick={(event) => {
                                  endTrigger.current = event.currentTarget;
                                  restoreEndFocus.current = true;
                                  setEndingAssignment(item);
                                  setEndingInput({
                                    effectiveTo: "",
                                    reason: "",
                                  });
                                  setAssignmentErrors({});
                                }}
                              >
                                Kết thúc
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>Chưa có phân công trong năm học này.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-scroll">
              <table>
                <caption>Lớp thuộc {selected?.name}</caption>
                <thead>
                  <tr>
                    <th>Tên lớp</th>
                    <th>Trạng thái</th>
                    <th>Học sinh đang nhập học</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.length ? (
                    classes.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">{item.name}</th>
                        <td>
                          {item.status === "ACTIVE"
                            ? "Đang hoạt động"
                            : "Đã lưu trữ"}
                        </td>
                        <td>{item.activeStudentCount}</td>
                        <td>
                          {item.status === "ACTIVE" && (
                            <>
                              <button
                                disabled={disabled}
                                onClick={() => {
                                  setRename(item);
                                  setRenameName(item.name);
                                  setRenameErrors({});
                                }}
                              >
                                Đổi tên
                              </button>
                              <button
                                disabled={disabled}
                                onClick={() => {
                                  if (
                                    window.confirm(`Lưu trữ lớp ${item.name}?`)
                                  )
                                    void post(
                                      `/api/app/schools/${schoolId}/roster/classes/${item.id}/archive`,
                                      {},
                                      "archive",
                                    );
                                }}
                              >
                                Lưu trữ
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>Năm học này chưa có lớp.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <form className="roster-form" onSubmit={previewRosterTransition}>
              <h3>Chuyển danh bộ</h3>
              <p>
                Xem trước, xác nhận bằng tên thao tác và đối soát kết quả từ hệ
                thống.
              </p>
              <label>
                Loại chuyển
                <select
                  value={transition.kind}
                  onChange={(event) => {
                    setTransition((current) => ({
                      ...current,
                      kind: event.target.value,
                      destinationSchoolYearId:
                        event.target.value === "CLASS_TRANSFER" ? yearId : "",
                      destinationClassId: "",
                      confirmation: "",
                    }));
                    setTransitionPreview(undefined);
                  }}
                >
                  <option value="CLASS_TRANSFER">Chuyển lớp</option>
                  <option value="YEAR_TRANSITION">Chuyển năm</option>
                </select>
              </label>
              <label>
                Lớp nguồn
                <select
                  value={transition.sourceClassId}
                  onChange={(event) => {
                    setTransition((current) => ({
                      ...current,
                      sourceClassId: event.target.value,
                    }));
                    setTransitionPreview(undefined);
                  }}
                >
                  <option value="">Chọn lớp nguồn</option>
                  {classes
                    .filter((item) => item.status === "ACTIVE")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              {transition.kind === "YEAR_TRANSITION" && (
                <label>
                  Năm học đích
                  <select
                    value={transition.destinationSchoolYearId}
                    onChange={(event) => {
                      setTransition((current) => ({
                        ...current,
                        destinationSchoolYearId: event.target.value,
                        destinationClassId: "",
                      }));
                      setTransitionPreview(undefined);
                    }}
                  >
                    <option value="">Chọn năm học đích</option>
                    {years
                      .filter((item) => item.id !== yearId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {transition.kind === "CLASS_TRANSFER" && (
                <label>
                  Lớp đích
                  <select
                    value={transition.destinationClassId}
                    onChange={(event) => {
                      setTransition((current) => ({
                        ...current,
                        destinationClassId: event.target.value,
                      }));
                      setTransitionPreview(undefined);
                    }}
                  >
                    <option value="">Chọn lớp đích</option>
                    {classes
                      .filter((item) => item.status === "ACTIVE")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Ngày hiệu lực
                <input
                  type="date"
                  value={transition.effectiveFrom}
                  onChange={(event) => {
                    setTransition((current) => ({
                      ...current,
                      effectiveFrom: event.target.value,
                    }));
                    setTransitionPreview(undefined);
                  }}
                />
              </label>
              <label>
                Lý do
                <input
                  value={transition.reason}
                  onChange={(event) => {
                    setTransition((current) => ({
                      ...current,
                      reason: event.target.value,
                    }));
                    setTransitionPreview(undefined);
                  }}
                />
              </label>
              <button disabled={disabled}>Tạo kết quả xem trước</button>
            </form>
            {transition.kind === "YEAR_TRANSITION" && (
              <label>
                Lớp đích của năm được chọn
                <select
                  value={transition.destinationClassId}
                  onChange={(event) => {
                    setTransition({
                      ...transition,
                      destinationClassId: event.target.value,
                    });
                    setTransitionPreview(undefined);
                  }}
                >
                  <option value="">Chọn lớp đích</option>
                  {destinationClasses
                    .filter((item) => item.status === "ACTIVE")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {transitionPreview && (
              <section
                className="roster-form"
                aria-label="Kết quả xem trước chuyển danh bộ"
              >
                <h3>Kết quả xem trước</h3>
                <p>
                  Đích: {transitionPreview.destination.schoolYearName} /{" "}
                  {transitionPreview.destination.className}
                </p>
                <ul>
                  {transitionPreview.movable.map((item) => (
                    <li key={item.enrollmentId}>
                      {item.student.fullName}: Có thể chuyển
                    </li>
                  ))}
                  {transitionPreview.excluded.map((item) => (
                    <li key={item.enrollmentId}>
                      {item.student.fullName}: Không chuyển, {item.reason}
                    </li>
                  ))}
                </ul>
                <label>
                  Nhập CHUYỂN DANH BỘ để xác nhận
                  <input
                    value={transition.confirmation}
                    onChange={(event) =>
                      setTransition({
                        ...transition,
                        confirmation: event.target.value,
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    disabled ||
                    transition.confirmation !== "CHUYỂN DANH BỘ" ||
                    !transitionPreview.movable.length
                  }
                  onClick={() => void confirmRosterTransition()}
                >
                  Xác nhận chuyển danh bộ
                </button>
              </section>
            )}
            <form className="roster-form" onSubmit={previewYearClose}>
              <h3>Đóng năm học</h3>
              <p>
                Hệ thống kết thúc phân lớp, không thay đổi trạng thái
                enrollment.
              </p>
              <label>
                Ngày đóng năm học
                <input
                  type="date"
                  value={closeYear.effectiveTo}
                  onChange={(event) => {
                    setCloseYear({
                      ...closeYear,
                      effectiveTo: event.target.value,
                    });
                    setClosePreview(undefined);
                  }}
                />
              </label>
              <label>
                Lý do đóng năm học
                <input
                  value={closeYear.reason}
                  onChange={(event) => {
                    setCloseYear({ ...closeYear, reason: event.target.value });
                    setClosePreview(undefined);
                  }}
                />
              </label>
              <button disabled={disabled}>
                Tạo kết quả xem trước đóng năm
              </button>
            </form>
            {closePreview && (
              <section
                className="roster-form"
                aria-label="Kết quả xem trước đóng năm"
              >
                <h3>Kết quả xem trước đóng năm</h3>
                <p>
                  {closePreview.assignments.length} phân lớp sẽ được kết thúc.
                  Enrollment vẫn giữ trạng thái hiện tại.
                </p>
                <ul>
                  {closePreview.assignments.map((item) => (
                    <li key={item.assignmentId}>{item.student.fullName}</li>
                  ))}
                </ul>
                <label>
                  Nhập ĐÓNG NĂM HỌC để xác nhận
                  <input
                    value={closeYear.confirmation}
                    onChange={(event) =>
                      setCloseYear({
                        ...closeYear,
                        confirmation: event.target.value,
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    disabled || closeYear.confirmation !== "ĐÓNG NĂM HỌC"
                  }
                  onClick={() => void confirmYearClose()}
                >
                  Xác nhận đóng năm học
                </button>
              </section>
            )}
            {selected?.isActive ? (
              <form className="roster-form" onSubmit={createStudent}>
                <h3>Tạo học sinh và enrollment</h3>
                <label>
                  Họ và tên
                  <input
                    value={student.fullName}
                    onChange={(event) =>
                      setStudent({ ...student, fullName: event.target.value })
                    }
                    {...field(studentErrors, "fullName")}
                  />
                </label>
                {studentErrors.fullName && (
                  <small id="fullName-error">{studentErrors.fullName}</small>
                )}
                <label>
                  Ngày sinh
                  <input
                    type="date"
                    value={student.dateOfBirth}
                    onChange={(event) =>
                      setStudent({
                        ...student,
                        dateOfBirth: event.target.value,
                      })
                    }
                    {...field(studentErrors, "dateOfBirth")}
                  />
                </label>
                {studentErrors.dateOfBirth && (
                  <small id="dateOfBirth-error">
                    {studentErrors.dateOfBirth}
                  </small>
                )}
                <label>
                  Lớp
                  <select
                    value={student.classId}
                    onChange={(event) =>
                      setStudent({ ...student, classId: event.target.value })
                    }
                    {...field(studentErrors, "classId")}
                  >
                    <option value="">Chọn lớp</option>
                    {classes
                      .filter((item) => item.status === "ACTIVE")
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
                {studentErrors.classId && (
                  <small id="classId-error">{studentErrors.classId}</small>
                )}
                <label>
                  Trạng thái
                  <select
                    value={student.lifecycle}
                    onChange={(event) =>
                      setStudent({ ...student, lifecycle: event.target.value })
                    }
                  >
                    {Object.entries(lifecycleLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ngày hiệu lực
                  <input
                    type="date"
                    value={student.effectiveFrom}
                    onChange={(event) =>
                      setStudent({
                        ...student,
                        effectiveFrom: event.target.value,
                      })
                    }
                    {...field(studentErrors, "effectiveFrom")}
                  />
                </label>
                {studentErrors.effectiveFrom && (
                  <small id="effectiveFrom-error">
                    {studentErrors.effectiveFrom}
                  </small>
                )}
                <label>
                  Ngày kết thúc
                  <input
                    type="date"
                    value={student.endedOn}
                    onChange={(event) =>
                      setStudent({ ...student, endedOn: event.target.value })
                    }
                    {...field(studentErrors, "endedOn")}
                  />
                </label>
                {studentErrors.endedOn && (
                  <small id="endedOn-error">{studentErrors.endedOn}</small>
                )}
                <button disabled={disabled}>Tạo học sinh</button>
              </form>
            ) : (
              <p role="status">
                Chỉ có thể tạo enrollment trong năm học đang hoạt động.
              </p>
            )}
            <div className="table-scroll">
              <table>
                <caption>Học sinh của {selected?.name}</caption>
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Họ tên</th>
                    <th>Enrollment hiện tại</th>
                    <th>Lịch sử</th>
                    <th>Liên kết phụ huynh</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length ? (
                    students.map((item) => (
                      <tr key={item.id}>
                        <td>{item.studentCode}</td>
                        <th scope="row">{item.fullName}</th>
                        <td>
                          {item.enrollments.at(-1) &&
                            lifecycleLabel[item.enrollments.at(-1)!.lifecycle]}
                        </td>
                        <td>
                          {item.enrollments.map((enrollment) => (
                            <div key={enrollment.id}>
                              {enrollment.schoolYear.name} /{" "}
                              {enrollment.classroom.name} /{" "}
                              {lifecycleLabel[enrollment.lifecycle]} (
                              {enrollment.effectiveFrom}
                              {enrollment.endedOn
                                ? ` - ${enrollment.endedOn}`
                                : ""}
                              ){" "}
                              <label>
                                Ngày kết thúc
                                <input
                                  aria-label={`Ngày kết thúc ${item.fullName}`}
                                  type="date"
                                  value={
                                    endedOnByEnrollment[enrollment.id] ??
                                    enrollment.endedOn ??
                                    ""
                                  }
                                  onChange={(event) =>
                                    setEndedOnByEnrollment({
                                      ...endedOnByEnrollment,
                                      [enrollment.id]: event.target.value,
                                    })
                                  }
                                />
                              </label>{" "}
                              <label>
                                Đổi trạng thái
                                <select
                                  aria-label={`Trạng thái ${item.fullName}`}
                                  value={enrollment.lifecycle}
                                  disabled={disabled}
                                  onChange={(event) =>
                                    void changeLifecycle(
                                      enrollment,
                                      event.target.value,
                                    )
                                  }
                                  {...field(studentErrors, "lifecycle")}
                                >
                                  {Object.entries(lifecycleLabel).map(
                                    ([value, label]) => (
                                      <option key={value} value={value}>
                                        {label}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                              {(enrollment.lifecycleHistory ?? []).map(
                                (history) => (
                                  <div key={history.id}>
                                    Chuyển từ{" "}
                                    {history.previousLifecycle
                                      ? lifecycleLabel[
                                          history.previousLifecycle
                                        ]
                                      : "Khởi tạo"}{" "}
                                    sang {lifecycleLabel[history.lifecycle]} (
                                    {history.effectiveFrom}
                                    {history.endedOn
                                      ? ` - ${history.endedOn}`
                                      : ""}
                                    )
                                  </div>
                                ),
                              )}
                              {studentErrors.lifecycle && (
                                <small id="lifecycle-error">
                                  {studentErrors.lifecycle}
                                </small>
                              )}
                            </div>
                          ))}
                        </td>
                        <td>
                          <form
                            onSubmit={(event) =>
                              void createParent(event, item.id)
                            }
                          >
                            <h3>Liên kết phụ huynh</h3>
                            <label>
                              Họ và tên phụ huynh
                              <input
                                aria-label={`Họ và tên phụ huynh ${item.fullName}`}
                                value={parent[item.id]?.fullName ?? ""}
                                onChange={(event) =>
                                  setParent({
                                    ...parent,
                                    [item.id]: {
                                      ...(parent[item.id] ?? {
                                        email: "",
                                        phone: "",
                                      }),
                                      fullName: event.target.value,
                                    },
                                  })
                                }
                                {...field(studentErrors, "fullName")}
                              />
                            </label>
                            <label>
                              Email phụ huynh
                              <input
                                aria-label={`Email phụ huynh ${item.fullName}`}
                                value={parent[item.id]?.email ?? ""}
                                onChange={(event) =>
                                  setParent({
                                    ...parent,
                                    [item.id]: {
                                      ...(parent[item.id] ?? {
                                        fullName: "",
                                        phone: "",
                                      }),
                                      email: event.target.value,
                                    },
                                  })
                                }
                                {...field(studentErrors, "email")}
                              />
                            </label>
                            <label>
                              Số điện thoại phụ huynh
                              <input
                                aria-label={`Số điện thoại phụ huynh ${item.fullName}`}
                                value={parent[item.id]?.phone ?? ""}
                                onChange={(event) =>
                                  setParent({
                                    ...parent,
                                    [item.id]: {
                                      ...(parent[item.id] ?? {
                                        fullName: "",
                                        email: "",
                                      }),
                                      phone: event.target.value,
                                    },
                                  })
                                }
                                {...field(studentErrors, "phone")}
                              />
                            </label>
                            <button disabled={disabled}>Tạo liên kết</button>
                          </form>
                          <ul
                            aria-label={`Liên kết phụ huynh ${item.fullName}`}
                          >
                            {(parentLinks[item.id] ?? []).map((link) => (
                              <li key={link.id}>
                                {link.parent.fullName} ({link.parent.email}) -{" "}
                                {link.status === "ACTIVE"
                                  ? link.parent.bound
                                    ? "Đã xác nhận"
                                    : "Đang chờ"
                                  : "Đã thu hồi"}{" "}
                                {link.status === "ACTIVE" && (
                                  <button
                                    disabled={disabled}
                                    onClick={() => void revokeParent(link)}
                                  >
                                    Thu hồi
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>Năm học này chưa có học sinh.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <section aria-label="Lịch sử phân lớp xác nhận">
              <h3>Lịch sử phân lớp</h3>
              {students.flatMap((student) =>
                student.enrollments.map((enrollment) => (
                  <div key={`${student.id}-${enrollment.id}`}>
                    {student.fullName}:{" "}
                    {(enrollment.classAssignmentHistory ?? []).map(
                      (placement) => (
                        <div key={placement.id}>
                          {placement.className ?? "Không xác định"} (
                          {placement.effectiveFrom}
                          {placement.effectiveTo
                            ? ` - ${placement.effectiveTo}`
                            : ""}
                          ) - {placement.reason}
                        </div>
                      ),
                    )}
                  </div>
                )),
              )}
            </section>
          </fieldset>
        </>
      )}
      {endingAssignment && (
        <div
          ref={endDialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-assignment-title"
          onKeyDown={trapEndDialog}
        >
          <form onSubmit={endAssignment}>
            <h3 id="end-assignment-title">Kết thúc phân công</h3>
            <p>
              {endingAssignment.staff.fullName} tại{" "}
              {endingAssignment.classroom.name}. Lý do phân công gốc được giữ
              nguyên.
            </p>
            <label>
              Ngày kết thúc phân công
              <input
                type="date"
                value={endingInput.effectiveTo}
                onChange={(event) =>
                  setEndingInput({
                    ...endingInput,
                    effectiveTo: event.target.value,
                  })
                }
                {...field(assignmentErrors, "effectiveTo", "end-assignment-")}
              />
            </label>
            {assignmentErrors.effectiveTo && (
              <small id="end-assignment-effectiveTo-error">
                {assignmentErrors.effectiveTo}
              </small>
            )}
            <label>
              Lý do kết thúc
              <input
                value={endingInput.reason}
                onChange={(event) =>
                  setEndingInput({ ...endingInput, reason: event.target.value })
                }
                {...field(assignmentErrors, "reason", "end-assignment-")}
              />
            </label>
            {assignmentErrors.reason && (
              <small id="end-assignment-reason-error">
                {assignmentErrors.reason}
              </small>
            )}
            <button
              type="button"
              onClick={() => {
                setEndingAssignment(undefined);
                setEndingInput({ effectiveTo: "", reason: "" });
                setAssignmentErrors({});
              }}
            >
              Hủy
            </button>
            <button disabled={disabled}>Xác nhận kết thúc</button>
          </form>
        </div>
      )}
      {rename && (
        <div role="dialog" aria-modal="true" aria-labelledby="rename-title">
          <form onSubmit={submitRename}>
            <h3 id="rename-title">Đổi tên lớp</h3>
            <label>
              Tên lớp
              <input
                autoFocus
                value={renameName}
                onChange={(event) => setRenameName(event.target.value)}
                {...field(renameErrors, "name", "rename-")}
              />
            </label>
            {renameErrors.name && (
              <small id="rename-name-error">{renameErrors.name}</small>
            )}
            <button type="button" onClick={() => setRename(undefined)}>
              Hủy
            </button>
            <button disabled={disabled}>Lưu tên lớp</button>
          </form>
        </div>
      )}
    </section>
  );
}
