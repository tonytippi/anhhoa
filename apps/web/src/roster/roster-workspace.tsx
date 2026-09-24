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
type RosterRow = {
  id: string;
  studentCode: string;
  fullName: string;
  hasPhoto: boolean;
  enrollment: {
    id: string;
    lifecycle: string;
    effectiveFrom: string;
    classroom: { id: string; name: string } | null;
  };
  relatives: {
    mother: string | null;
    father: string | null;
    otherRelativeCount: number;
  };
};
type RosterPageMeta = { page: number; pageSize: number; totalItems: number; totalPages: number };
type ParentRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  children: Array<{ linkId: string; studentName: string; className: string | null; relationshipLabel: string }>;
};
type StudentDetail = RosterRow & {
  enrollments: Array<{ id: string; lifecycle: string; effectiveFrom: string; endedOn: string | null; classroom: { name: string } | null }>;
};
type ParentLink = { id: string; relationshipLabel: string; status: "ACTIVE" | "REVOKED"; parent: { fullName: string; email: string; phone: string; bound: boolean } };
type Staff = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  staffCode: string | null;
  personalIdentifier: string | null;
  hasPhoto: boolean;
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
  studentId?: string;
  staffId?: string;
  kind:
    | "school-year"
    | "class"
    | "rename"
    | "student"
    | "student-photo"
    | "placement"
    | "archive"
    | "lifecycle"
    | "parent"
    | "parent-revoke"
    | "staff"
    | "staff-photo"
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
type Status = {
  dirty: boolean;
  pending: boolean;
  dialogOpen?: boolean;
  reconcile?: () => void;
};

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

export function RosterWorkspace({
  schoolId,
  schoolName,
  denied,
  onStatusChange,
  section = "all",
}: {
  schoolId: string;
  schoolName: string;
  denied: () => void;
  onStatusChange?: (status: Status) => void;
  section?: "all" | "students" | "parents" | "staff" | "classes" | "years" | "positions";
}) {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [yearId, setYearId] = useState("");
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<RosterRow[]>([]);
  const [rosterMeta, setRosterMeta] = useState({ page: 1, pageSize: 25, totalItems: 0, totalPages: 0 });
  const [rosterQuery, setRosterQuery] = useState({ q: "", classId: "", lifecycle: "", sort: "name" as "name" | "class" });
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [parentMeta, setParentMeta] = useState<RosterPageMeta>({ page: 1, pageSize: 25, totalItems: 0, totalPages: 0 });
  const [parentQuery, setParentQuery] = useState({ q: "" });
  const [parentDetail, setParentDetail] = useState<ParentRow>();
  const [studentDetail, setStudentDetail] = useState<StudentDetail>();
  const [parentLinks, setParentLinks] = useState<ParentLink[]>([]);
  const [parentInput, setParentInput] = useState({ fullName: "", email: "", phone: "", relationshipLabel: "" });
  const [rowMenu, setRowMenu] = useState<string>();
  const [detailPlacement, setDetailPlacement] = useState({ classId: "", effectiveFrom: "" });
  const [detailEndedOn, setDetailEndedOn] = useState<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
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
    staffCode: "",
    personalIdentifier: "",
    photo: null as File | null,
  });
  const [positionInput, setPositionInput] = useState({
    code: "",
    name: "",
    capabilities: [] as string[],
    reason: "",
  });
  const [positionAction, setPositionAction] = useState<PositionAction>();
  const [editingStaffId, setEditingStaffId] = useState("");
  const [staffIntakeOpen, setStaffIntakeOpen] = useState(false);
  const confirmedStaff = useRef<string | undefined>(undefined);
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
    preferredName: "",
    gender: "",
    address: "",
    personalIdentifier: "",
    classId: "",
    intakeStatus: "PLACED",
    effectiveFrom: "",
    photo: null as File | null,
    parentFullName: "",
    parentEmail: "",
    parentPhone: "",
    parentRelationshipLabel: "",
  });
  const [yearErrors, setYearErrors] = useState<Record<string, string>>({});
  const [classErrors, setClassErrors] = useState<Record<string, string>>({});
  const [renameErrors, setRenameErrors] = useState<Record<string, string>>({});
  const [studentErrors, setStudentErrors] = useState<Record<string, string>>(
    {},
  );
  const [studentIntakeOpen, setStudentIntakeOpen] = useState(false);
  const [confirmedStudentId, setConfirmedStudentId] = useState<string>();
  const confirmedStudent = useRef<string | undefined>(undefined);
  const [staffErrors, setStaffErrors] = useState<Record<string, string>>({});
  const [positionErrors, setPositionErrors] = useState<Record<string, string>>({});
  const [assignmentErrors, setAssignmentErrors] = useState<
    Record<string, string>
  >({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending>();
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterLoadFailed, setRosterLoadFailed] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const endDialog = useRef<HTMLDivElement>(null);
  const studentIntakeDialog = useRef<HTMLDivElement>(null);
  const studentDetailDialog = useRef<HTMLElement>(null);
  const studentDetailTrigger = useRef<HTMLButtonElement>(null);
  const parentDetailDialog = useRef<HTMLElement>(null);
  const parentDetailTrigger = useRef<HTMLButtonElement>(null);
  const staffIntakeDialog = useRef<HTMLDivElement>(null);
  const endTrigger = useRef<HTMLButtonElement>(null);
  const restoreEndFocus = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const generation = useRef(0);
  const currentSchool = useRef(schoolId);
  const selectedYear = useRef("");
  const loadedYear = useRef("");
  const rosterRequest = useRef(0);
  const detailRequest = useRef(0);
  const selectedDetailStudent = useRef<string | undefined>(undefined);
  const rowMenuTrigger = useRef<HTMLButtonElement>(null);
  const rowMenuElement = useRef<HTMLDivElement>(null);
  const rowMenuKeyboardOpen = useRef(false);
  const sectionRef = useRef(section);
  const parentQueryRef = useRef(parentQuery);
  const parentPageRef = useRef(parentMeta.page);
  const parentYearRef = useRef(yearId);
  const valid = (school: string, requestGeneration: number) =>
    currentSchool.current === school &&
    generation.current === requestGeneration;
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
  };
  const closeStudentDetail = () => {
    if (pending) return;
    const trigger = studentDetailTrigger.current;
    detailRequest.current += 1;
    selectedDetailStudent.current = undefined;
    setDetailLoading(false);
    setStudentDetail(undefined);
    setParentLinks([]);
    setParentInput({ fullName: "", email: "", phone: "", relationshipLabel: "" });
    setStudentErrors({});
    trigger?.focus();
  };
  const closeParentDetail = () => {
    if (pending) return;
    setParentDetail(undefined);
    parentDetailTrigger.current?.focus();
  };
  const dirty = Boolean(
    year.name ||
      year.startsOn ||
      year.endsOn ||
      className ||
      renameName ||
      student.fullName ||
      student.dateOfBirth ||
      student.preferredName ||
      student.gender ||
      student.address ||
      student.personalIdentifier ||
      student.classId ||
      student.effectiveFrom ||
      student.photo ||
       student.parentFullName ||
       student.parentEmail ||
       student.parentPhone ||
       student.parentRelationshipLabel ||
      staffInput.fullName ||
      staffInput.email ||
      staffInput.phone ||
      staffInput.dateOfBirth ||
      staffInput.gender ||
       staffInput.address ||
       staffInput.staffCode ||
       staffInput.personalIdentifier ||
       staffInput.photo ||
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
       dialogOpen: studentIntakeOpen || staffIntakeOpen,
      reconcile: pending ? () => void reconcile(pending) : undefined,
    });
  }, [dirty, pending, studentIntakeOpen, staffIntakeOpen, onStatusChange]);
  useEffect(() => { sectionRef.current = section; }, [section]);
  useEffect(() => { parentQueryRef.current = parentQuery; }, [parentQuery]);
  useEffect(() => { parentPageRef.current = parentMeta.page; }, [parentMeta.page]);
  useEffect(() => { parentYearRef.current = yearId; }, [yearId]);

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
  const readRosterPage = async (
    path: string,
    requestGeneration = generation.current,
  ): Promise<{ data: RosterRow[]; meta: RosterPageMeta } | undefined> => {
    const response = await fetch(`${apiUrl}${path}`, { credentials: "include" });
    if (!valid(schoolId, requestGeneration)) return;
    if (deniedStatus(response.status)) {
      denied();
      return;
    }
    if (!response.ok) throw new Error("Không thể tải danh bộ.");
    return (await response.json()) as { data: RosterRow[]; meta: RosterPageMeta };
  };
  const readParentPage = readRosterPage as (
    path: string,
    requestGeneration?: number,
  ) => Promise<{ data: ParentRow[]; meta: RosterPageMeta } | undefined>;
  const loadYear = async (
    selected: string,
    requestGeneration = generation.current,
    query = rosterQuery,
    page = rosterMeta.page,
  ) => {
    const request = ++rosterRequest.current;
    setRowMenu(undefined);
    if (section === "parents") setParents([]);
    else {
      setClasses([]);
      setStudents([]);
      setAssignments([]);
    }
    setRosterLoading(true);
    setRosterLoadFailed(false);
    try {
      const [nextClasses, nextStudents, nextParents, nextAssignments] = await Promise.all([
        section === "parents" ? Promise.resolve(undefined) : read<Classroom[]>(
          `/api/app/schools/${schoolId}/roster/school-years/${selected}/classes`,
          requestGeneration,
        ),
        section === "parents"
          ? Promise.resolve(undefined)
          : readRosterPage(
          `/api/app/schools/${schoolId}/roster/school-years/${selected}/students?${new URLSearchParams({ page: String(page), pageSize: "25", ...(query.q ? { q: query.q } : {}), ...(query.classId ? { classId: query.classId } : {}), ...(query.lifecycle ? { lifecycle: query.lifecycle } : {}), sort: query.sort })}`,
          requestGeneration,
            ),
        section === "parents"
          ? readParentPage(
              `/api/app/schools/${schoolId}/roster/school-years/${selected}/parents?${new URLSearchParams({ page: String(page), pageSize: "25", ...(parentQueryRef.current.q ? { q: parentQueryRef.current.q } : {}) })}`,
              requestGeneration,
            )
          : Promise.resolve(undefined),
        section === "parents" ? Promise.resolve(undefined) : read<Assignment[]>(
          `/api/app/schools/${schoolId}/roster/school-years/${selected}/staff-assignments`,
          requestGeneration,
        ),
      ]);
      if (!valid(schoolId, requestGeneration) || selectedYear.current !== selected || rosterRequest.current !== request)
        return;
       if (section === "parents") {
         setParents(nextParents?.data ?? []);
         setParentMeta(nextParents?.meta ?? { page, pageSize: 25, totalItems: 0, totalPages: 0 });
       } else {
         setClasses(nextClasses ?? []);
         setStudents(nextStudents?.data ?? []);
         setRosterMeta(nextStudents?.meta ?? { page, pageSize: 25, totalItems: 0, totalPages: 0 });
         setAssignments((nextAssignments ?? []).filter((item): item is Assignment => Boolean(item?.staff && item?.schoolYear && item?.classroom)));
       }
      setRosterLoading(false);
      if (section !== "parents") setStudent((current) =>
        current.classId || current.intakeStatus === "WAITING_FOR_CLASS"
          ? current
          : {
              ...current,
              classId:
                (nextClasses ?? []).find((item) => item.status === "ACTIVE")
                  ?.id ?? "",
            },
      );
    } catch (error) {
      if (valid(schoolId, requestGeneration) && selectedYear.current === selected && rosterRequest.current === request) {
        setRosterLoadFailed(true);
        setMessage(error instanceof Error ? error.message : "Không thể tải danh bộ.");
      }
    } finally {
      if (valid(schoolId, requestGeneration) && selectedYear.current === selected && rosterRequest.current === request)
        setRosterLoading(false);
    }
  };
  const refresh = async (requestGeneration = generation.current) => {
    const [nextYears, nextStaff, nextPositions] = await Promise.all([
      read<SchoolYear[]>(
        `/api/app/schools/${schoolId}/roster/school-years`,
        requestGeneration,
      ),
      section === "parents" ? Promise.resolve(undefined) : read<Staff[]>(
        `/api/app/schools/${schoolId}/roster/staff`,
        requestGeneration,
      ),
      section === "parents" ? Promise.resolve(undefined) : read<Position[]>(
        `/api/app/schools/${schoolId}/roster/positions`,
        requestGeneration,
      ),
    ]);
    if (!nextYears || !valid(schoolId, requestGeneration)) return;
    setYears(nextYears);
    if (section !== "parents") setStaff(
      (nextStaff ?? []).filter((item): item is Staff =>
        Boolean(item?.email && item?.phone && item?.fullName),
      ),
    );
    if (section !== "parents") setPositions((nextPositions ?? []).filter((item): item is Position => Boolean(item && Array.isArray(item.capabilities) && typeof item.id === 'string')));
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
      setParents([]);
      setRosterLoading(false);
      return;
    }
    loadedYear.current = selected;
    await loadYear(selected, requestGeneration, rosterQuery, section === "parents" ? parentMeta.page : rosterMeta.page);
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
      const result = ((await response.json()) as { data: { status: string; outcome?: unknown } })
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
      if (result.status === "COMPLETED") {
        if (operation.kind === "parent-revoke" && sectionRef.current === "parents" && parentYearRef.current) {
          await loadYear(parentYearRef.current, requestGeneration, rosterQuery, parentPageRef.current);
        } else await refresh(requestGeneration);
        const createdStudentId = operation.kind === "student"
          ? (result.outcome as { id?: string } | undefined)?.id
          : undefined;
        if (createdStudentId) {
          confirmedStudent.current = createdStudentId;
          setConfirmedStudentId(createdStudentId);
          await completeStudentIntake(createdStudentId);
        } else if (operation.kind === "student-photo" && operation.studentId && operation.studentId === confirmedStudent.current) {
          setStudent((current) => ({ ...current, photo: null }));
          void completeStudentIntake(operation.studentId, true);
        } else if (operation.kind === "staff") {
          const createdStaffId = (result.outcome as { id?: string } | undefined)?.id;
          if (createdStaffId) {
            confirmedStaff.current = createdStaffId;
            await completeStaffIntake(createdStaffId);
          }
        } else if (operation.kind === "staff-photo" && operation.staffId) {
          setStaffInput((current) => ({ ...current, photo: null }));
          void completeStaffIntake(operation.staffId, true);
        } else if (operation.kind === "parent" && operation.studentId === confirmedStudent.current)
          clearStudentIntake();
      }
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
    detailRequest.current += 1;
    selectedDetailStudent.current = undefined;
    selectedYear.current = "";
    loadedYear.current = "";
    rosterRequest.current += 1;
    stop();
    setYears([]);
    setYearId("");
    setClasses([]);
    setStudents([]);
    setParents([]);
    setParentDetail(undefined);
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
      preferredName: "",
      gender: "",
      address: "",
      personalIdentifier: "",
      classId: "",
      intakeStatus: "PLACED",
      effectiveFrom: "",
      photo: null,
      parentFullName: "",
      parentEmail: "",
      parentPhone: "",
      parentRelationshipLabel: "",
    });
    setParentInput({ fullName: "", email: "", phone: "", relationshipLabel: "" });
    setRowMenu(undefined);
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
      staffCode: "",
      personalIdentifier: "",
      photo: null,
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
    setConfirmedStudentId(undefined);
    confirmedStudent.current = undefined;
    setStaffErrors({});
    setPositionErrors({});
    setAssignmentErrors({});
    setMessage("");
    setPending(undefined);
    setRosterLoading(true);
    setRosterLoadFailed(false);
    void refresh(requestGeneration).catch(
      (error: Error) => {
        if (!valid(schoolId, requestGeneration)) return;
        setRosterLoading(false);
        setRosterLoadFailed(true);
        setMessage(error.message);
      },
    );
    const raw = sessionStorage.getItem(pendingKey);
    if (raw) {
      const saved = JSON.parse(raw) as Pending;
      if (saved.schoolId === schoolId) void reconcile(saved, requestGeneration);
    }
    return stop;
  }, [schoolId]);
  useEffect(() => () => { detailRequest.current += 1; selectedDetailStudent.current = undefined; }, []);
  useEffect(() => {
    if (!yearId || loadedYear.current === yearId) return;
    detailRequest.current += 1;
    selectedDetailStudent.current = undefined;
    setDetailLoading(false);
    setStudentDetail(undefined);
    setParentDetail(undefined);
    setParentLinks([]);
    setParentInput({ fullName: "", email: "", phone: "", relationshipLabel: "" });
    setStudentErrors({});
    setRowMenu(undefined);
    loadedYear.current = yearId;
    const requestGeneration = generation.current;
    void loadYear(yearId, requestGeneration, rosterQuery, section === "parents" ? parentMeta.page : rosterMeta.page);
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

  const post = async (path: string, body: object, kind: Pending["kind"], studentId?: string) => {
    if (pending) return false;
    const requestGeneration = generation.current;
    const operation: Pending = { id: crypto.randomUUID(), schoolId, kind, studentId };
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
      const result = (await response.json()) as { data?: { outcome?: unknown } };
      if (kind === "parent-revoke" && sectionRef.current === "parents" && parentYearRef.current)
        await loadYear(parentYearRef.current, requestGeneration, rosterQuery, parentPageRef.current);
      else await refresh(requestGeneration);
      return valid(schoolId, requestGeneration) ? { outcome: result.data?.outcome } : false;
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
    if (yearId && (await post(
        `/api/app/schools/${schoolId}/roster/school-years/${yearId}/classes`,
        { name: className },
        "class",
      )))
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
    if (!yearId) return;
    if (confirmedStudentId) {
      await completeStudentIntake(confirmedStudentId);
      return;
    }
    const result = await post(
        `/api/app/schools/${schoolId}/roster/students`,
        {
          fullName: student.fullName,
          dateOfBirth: student.dateOfBirth,
          preferredName: student.preferredName || null,
          gender: student.gender || null,
          address: student.address || null,
          personalIdentifier: student.personalIdentifier || null,
          classId: student.intakeStatus === "PLACED" ? student.classId : null,
          intakeStatus: student.intakeStatus,
          effectiveFrom: student.effectiveFrom,
          schoolYearId: yearId,
        },
        "student",
      );
    const created = result
      ? (result as { outcome?: { id?: string } }).outcome
      : undefined;
    if (created?.id) {
      confirmedStudent.current = created.id;
      setConfirmedStudentId(created.id);
      await completeStudentIntake(created.id);
    }
  };
  const clearStudentIntake = () => {
    setStudent({ fullName: "", dateOfBirth: "", preferredName: "", gender: "", address: "", personalIdentifier: "", classId: classes.find((item) => item.status === "ACTIVE")?.id ?? "", intakeStatus: "PLACED", effectiveFrom: "", photo: null, parentFullName: "", parentEmail: "", parentPhone: "", parentRelationshipLabel: "" });
    confirmedStudent.current = undefined;
    setConfirmedStudentId(undefined);
    setStudentIntakeOpen(false);
  };
  const completeStudentIntake = async (studentId: string, photoComplete = false) => {
    const photo = student.photo;
    if (!photoComplete && photo && !(await uploadPhoto(studentId, photo))) return;
    if (!photoComplete && photo) setStudent((current) => ({ ...current, photo: null }));
    const hasParentInput = Boolean(student.parentFullName || student.parentEmail || student.parentPhone || student.parentRelationshipLabel);
    if (hasParentInput && (!student.parentFullName || !student.parentEmail || !student.parentPhone)) {
      setStudentErrors({
        ...(student.parentFullName ? {} : { fullName: "Cần họ và tên người thân." }),
        ...(student.parentEmail ? {} : { email: "Cần email người thân." }),
        ...(student.parentPhone ? {} : { phone: "Cần số điện thoại người thân." }),
      });
      return;
    }
    if (hasParentInput && !(await post(`/api/app/schools/${schoolId}/roster/students/${studentId}/parents`, { fullName: student.parentFullName, email: student.parentEmail, phone: student.parentPhone, relationshipLabel: student.parentRelationshipLabel }, "parent", studentId))) return;
    clearStudentIntake();
  };
  const openStudentDetail = async (studentId: string) => {
    const requestGeneration = generation.current;
    const request = ++detailRequest.current;
    const selectedSchoolYear = yearId;
    selectedDetailStudent.current = studentId;
    setDetailLoading(true);
    setStudentDetail(undefined);
    setParentLinks([]);
    setParentInput({ fullName: "", email: "", phone: "", relationshipLabel: "" });
    setStudentErrors({});
    try {
      const detail = await read<StudentDetail>(`/api/app/schools/${schoolId}/roster/students/${studentId}`, requestGeneration);
      const links = await read<ParentLink[]>(`/api/app/schools/${schoolId}/roster/students/${studentId}/parents`, requestGeneration);
      if (detail && valid(schoolId, requestGeneration) && detailRequest.current === request && selectedDetailStudent.current === studentId && yearId === selectedSchoolYear) {
        setStudentDetail(detail);
        setParentLinks(links ?? []);
      }
    } catch (error) {
      if (valid(schoolId, requestGeneration) && detailRequest.current === request && selectedDetailStudent.current === studentId) setMessage(error instanceof Error ? error.message : "Không thể tải hồ sơ học sinh.");
    } finally {
      if (valid(schoolId, requestGeneration) && detailRequest.current === request && selectedDetailStudent.current === studentId) setDetailLoading(false);
    }
  };
  const saveParentLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!studentDetail) return;
    if (await post(`/api/app/schools/${schoolId}/roster/students/${studentDetail.id}/parents`, parentInput, "parent", studentDetail.id)) {
      setParentInput({ fullName: "", email: "", phone: "", relationshipLabel: "" });
      await openStudentDetail(studentDetail.id);
    }
  };
  const revokeParentLink = async (link: ParentLink) => {
    if (!studentDetail || !window.confirm(`Thu hồi liên kết của ${link.parent.fullName}?`)) return;
    if (await post(`/api/app/schools/${schoolId}/roster/student-parents/${link.id}/revoke`, {}, "parent-revoke", studentDetail.id))
      await openStudentDetail(studentDetail.id);
  };
  const revokeParentListLink = async (linkId: string, studentName: string) => {
    if (!parentDetail || !window.confirm(`Thu hồi liên kết với ${studentName}?`)) return;
    if (await post(`/api/app/schools/${schoolId}/roster/student-parents/${linkId}/revoke`, {}, "parent-revoke")) {
      closeParentDetail();
    }
  };
  const changeDetailLifecycle = async (enrollment: StudentDetail["enrollments"][number], lifecycle: string) => {
    if (!studentDetail) return;
    if (await post(`/api/app/schools/${schoolId}/roster/enrollments/${enrollment.id}/lifecycle`, { lifecycle, endedOn: ["ON_LEAVE", "WITHDRAWN", "GRADUATED"].includes(lifecycle) ? detailEndedOn[enrollment.id] || enrollment.endedOn : null }, "lifecycle", studentDetail.id))
      await openStudentDetail(studentDetail.id);
  };
  const placeDetailEnrollment = async (enrollmentId: string) => {
    if (!studentDetail) return;
    if (await post(`/api/app/schools/${schoolId}/roster/enrollments/${enrollmentId}/placement`, detailPlacement, "placement", studentDetail.id))
      await openStudentDetail(studentDetail.id);
  };
  const uploadPhoto = async (studentId: string, photo: File) => {
    if (pending) return false;
    const operation: Pending = { id: crypto.randomUUID(), schoolId, studentId, kind: "student-photo" };
    const requestGeneration = generation.current;
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/roster/students/${studentId}/photo`, { method: "POST", credentials: "include", headers: { "content-type": photo.type, "x-csrf-token": decodeURIComponent(csrf() ?? ""), "idempotency-key": crypto.randomUUID(), "x-operation-id": operation.id }, body: photo });
      if (!valid(schoolId, requestGeneration)) return false;
      if (deniedStatus(response.status)) { denied(); return false; }
      if (uncertain(response.status)) throw new TypeError("Mutation outcome is uncertain.");
      if (!response.ok) { const data = (await response.json()) as ErrorBody; setStudentErrors(data.error?.fieldErrors ?? {}); setMessage(data.error?.message ?? "Không thể tải ảnh hồ sơ."); return false; }
      await refresh(requestGeneration);
      return valid(schoolId, requestGeneration);
    } catch (error) {
      if (valid(schoolId, requestGeneration) && error instanceof TypeError) { sessionStorage.setItem(pendingKey, JSON.stringify(operation)); setPending(operation); void reconcile(operation, requestGeneration); }
      else if (valid(schoolId, requestGeneration)) setMessage("Không thể tải ảnh hồ sơ.");
      return false;
    }
  };
  const saveStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmedStaff.current) return void completeStaffIntake(confirmedStaff.current);
    const path = editingStaffId
      ? `/api/app/schools/${schoolId}/roster/staff/${editingStaffId}`
      : `/api/app/schools/${schoolId}/roster/staff`;
    const { photo: _photo, ...staffProfile } = staffInput;
    const result = await post(
        path,
        {
          ...staffProfile,
          schoolMembershipId: staffInput.schoolMembershipId || null,
          staffCode: staffInput.staffCode || null,
          personalIdentifier: staffInput.personalIdentifier || null,
        },
        "staff",
      );
    const saved = result ? (result as { outcome?: { id?: string } }).outcome : undefined;
    if (saved?.id) { confirmedStaff.current = saved.id; await completeStaffIntake(saved.id); }
  };
  const clearStaffIntake = () => {
    setStaffInput({ fullName: "", email: "", phone: "", dateOfBirth: "", gender: "", address: "", employmentStatus: "ACTIVE", primaryPositionId: "", schoolMembershipId: "", staffCode: "", personalIdentifier: "", photo: null });
    setEditingStaffId(""); setStaffErrors({}); setStaffIntakeOpen(false); confirmedStaff.current = undefined;
  };
  const completeStaffIntake = async (staffId: string, photoComplete = false) => {
    if (staffInput.photo) {
      if (!photoComplete && !(await uploadStaffPhoto(staffId, staffInput.photo))) return;
      if (!photoComplete) setStaffInput((current) => ({ ...current, photo: null }));
    }
    clearStaffIntake();
  };
  const uploadStaffPhoto = async (staffId: string, photo: File) => {
    if (pending) return false;
    const operation: Pending = { id: crypto.randomUUID(), schoolId, staffId, kind: "staff-photo" };
    const requestGeneration = generation.current;
    try {
      const response = await fetch(`${apiUrl}/api/app/schools/${schoolId}/roster/staff/${staffId}/photo`, { method: "POST", credentials: "include", headers: { "content-type": photo.type, "x-csrf-token": decodeURIComponent(csrf() ?? ""), "idempotency-key": crypto.randomUUID(), "x-operation-id": operation.id }, body: photo });
      if (!valid(schoolId, requestGeneration)) return false;
      if (deniedStatus(response.status)) { denied(); return false; }
      if (uncertain(response.status)) throw new TypeError("Mutation outcome is uncertain.");
      if (!response.ok) { const data = (await response.json()) as ErrorBody; setStaffErrors(data.error?.fieldErrors ?? {}); setMessage(data.error?.message ?? "Không thể tải ảnh hồ sơ."); return false; }
      await refresh(requestGeneration);
      return valid(schoolId, requestGeneration);
    } catch (error) {
      if (valid(schoolId, requestGeneration) && error instanceof TypeError) { sessionStorage.setItem(pendingKey, JSON.stringify(operation)); setPending(operation); void reconcile(operation, requestGeneration); }
      else if (valid(schoolId, requestGeneration)) setMessage("Không thể tải ảnh hồ sơ.");
      return false;
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
  const showStudentIntake = section === "all" || studentIntakeOpen;
  const reloadRoster = (page = rosterMeta.page) => {
    if (yearId) void loadYear(yearId, generation.current, rosterQuery, page);
  };
  const reloadParents = (page = parentMeta.page) => {
    if (yearId) void loadYear(yearId, generation.current, rosterQuery, page);
  };
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
  const trapStudentDetailDialog = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      if (!pending) closeStudentDetail();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(studentDetailDialog.current?.querySelectorAll<HTMLElement>("input:not([disabled]), select:not([disabled]), button:not([disabled])") ?? [])];
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const trapParentDetailDialog = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      closeParentDetail();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(parentDetailDialog.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  useEffect(() => {
    if (!studentIntakeOpen) return;
    studentIntakeDialog.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [studentIntakeOpen]);
  useEffect(() => { if (staffIntakeOpen) staffIntakeDialog.current?.querySelector<HTMLInputElement>("input")?.focus(); }, [staffIntakeOpen]);
  useEffect(() => {
    if (!studentDetail || detailLoading) return;
    studentDetailDialog.current?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled])")?.focus();
  }, [studentDetail, detailLoading]);
  useEffect(() => {
    if (!parentDetail) return;
    parentDetailDialog.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  }, [parentDetail]);
  useEffect(() => {
    if (rowMenu && rowMenuKeyboardOpen.current)
      rowMenuElement.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    rowMenuKeyboardOpen.current = false;
  }, [rowMenu]);
  useEffect(() => {
    setRowMenu(undefined);
    setParentDetail(undefined);
    if (yearId)
      void loadYear(yearId, generation.current, rosterQuery, section === "parents" ? parentMeta.page : rosterMeta.page);
  }, [section]);
  const studentIntakeForm = (radioName: string, inDialog = false) => (
    <form className="roster-form student-intake-form" onSubmit={createStudent}>
      <h3 id={inDialog ? "student-intake-title" : undefined}>
        Tạo học sinh và ghi danh
      </h3>
      <fieldset>
        <legend>Thông tin cơ bản</legend>
        <label>Họ và tên<input value={student.fullName} onChange={(event) => setStudent({ ...student, fullName: event.target.value })} {...field(studentErrors, "fullName")} /></label>
        {studentErrors.fullName && <small id="fullName-error">{studentErrors.fullName}</small>}
        <label>Ngày sinh<input type="date" value={student.dateOfBirth} onChange={(event) => setStudent({ ...student, dateOfBirth: event.target.value })} {...field(studentErrors, "dateOfBirth")} /></label>
        {studentErrors.dateOfBirth && <small id="dateOfBirth-error">{studentErrors.dateOfBirth}</small>}
      </fieldset>
      <fieldset>
        <legend>Thông tin hồ sơ</legend>
        <label>Tên thường gọi<input value={student.preferredName} onChange={(event) => setStudent({ ...student, preferredName: event.target.value })} {...field(studentErrors, "preferredName")} /></label>
        {studentErrors.preferredName && <small id="preferredName-error">{studentErrors.preferredName}</small>}
        <label>Giới tính học sinh<select value={student.gender} onChange={(event) => setStudent({ ...student, gender: event.target.value })} {...field(studentErrors, "gender")}><option value="">Không khai báo</option><option value="NAM">Nam</option><option value="NU">Nữ</option><option value="KHAC">Khác</option></select></label>
        {studentErrors.gender && <small id="gender-error">{studentErrors.gender}</small>}
        <label className="student-intake-full-width">Địa chỉ học sinh<textarea value={student.address} onChange={(event) => setStudent({ ...student, address: event.target.value })} {...field(studentErrors, "address")} /></label>
        {studentErrors.address && <small id="address-error">{studentErrors.address}</small>}
        <label>Mã định danh cá nhân<input value={student.personalIdentifier} onChange={(event) => setStudent({ ...student, personalIdentifier: event.target.value })} {...field(studentErrors, "personalIdentifier")} /></label>
        {studentErrors.personalIdentifier && <small id="personalIdentifier-error">{studentErrors.personalIdentifier}</small>}
        <label className="student-intake-full-width">Ảnh hồ sơ<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setStudent({ ...student, photo: event.target.files?.[0] ?? null })} {...field(studentErrors, "photo")} /></label>
        {studentErrors.photo && <small id="photo-error">{studentErrors.photo}</small>}
      </fieldset>
      <fieldset>
        <legend>Ghi danh</legend>
        <div className="student-intake-radios">
          <label><input type="radio" name={radioName} checked={student.intakeStatus === "PLACED"} onChange={() => setStudent({ ...student, intakeStatus: "PLACED" })} />Xếp lớp</label>
          <label><input type="radio" name={radioName} checked={student.intakeStatus === "WAITING_FOR_CLASS"} onChange={() => setStudent({ ...student, intakeStatus: "WAITING_FOR_CLASS", classId: "" })} />Chờ xếp lớp</label>
        </div>
        {student.intakeStatus === "PLACED" && <label>Lớp<select value={student.classId} onChange={(event) => setStudent({ ...student, classId: event.target.value })} {...field(studentErrors, "classId")}><option value="">Chọn lớp</option>{classes.filter((item) => item.status === "ACTIVE").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {studentErrors.classId && <small id="classId-error">{studentErrors.classId}</small>}
        <label>Ngày hiệu lực<input type="date" value={student.effectiveFrom} onChange={(event) => setStudent({ ...student, effectiveFrom: event.target.value })} {...field(studentErrors, "effectiveFrom")} /></label>
        {studentErrors.effectiveFrom && <small id="effectiveFrom-error">{studentErrors.effectiveFrom}</small>}
      </fieldset>
      <fieldset>
        <legend>Phụ huynh (tùy chọn)</legend>
        <label>Họ và tên phụ huynh<input value={student.parentFullName} onChange={(event) => setStudent({ ...student, parentFullName: event.target.value })} {...(confirmedStudentId ? field(studentErrors, "fullName", "parent-") : {})} /></label>
        {confirmedStudentId && studentErrors.fullName && <small id="parent-fullName-error">{studentErrors.fullName}</small>}
        <label>Email phụ huynh<input type="email" value={student.parentEmail} onChange={(event) => setStudent({ ...student, parentEmail: event.target.value })} {...(confirmedStudentId ? field(studentErrors, "email", "parent-") : {})} /></label>
        {confirmedStudentId && studentErrors.email && <small id="parent-email-error">{studentErrors.email}</small>}
        <label>Số điện thoại phụ huynh<input value={student.parentPhone} onChange={(event) => setStudent({ ...student, parentPhone: event.target.value })} {...(confirmedStudentId ? field(studentErrors, "phone", "parent-") : {})} /></label>
        {confirmedStudentId && studentErrors.phone && <small id="parent-phone-error">{studentErrors.phone}</small>}
        <label>Quan hệ<input value={student.parentRelationshipLabel} onChange={(event) => setStudent({ ...student, parentRelationshipLabel: event.target.value })} placeholder="Ví dụ: Mẹ, Bố, Bà ngoại" {...(confirmedStudentId ? field(studentErrors, "relationshipLabel", "parent-") : {})} /></label>
        {confirmedStudentId && studentErrors.relationshipLabel && <small id="parent-relationshipLabel-error">{studentErrors.relationshipLabel}</small>}
      </fieldset>
      {inDialog ? <div className="student-intake-actions"><button type="button" disabled={disabled} onClick={() => setStudentIntakeOpen(false)}>Đóng</button><button disabled={disabled}>Tạo học sinh</button></div> : <button disabled={disabled}>Tạo học sinh</button>}
    </form>
  );

  return (
    <section className={`roster-workspace roster-workspace-${section}`} aria-labelledby="roster-title">
      <h2 id="roster-title">{({ all: "Danh bộ", students: "Học sinh", parents: "Phụ huynh", staff: "Nhân viên", classes: "Lớp học", years: "Năm học", positions: "Chức danh & capability" } as const)[section]}</h2>
      <p>
        {schoolName}
        {selected ? ` / ${selected.name}` : " / Chưa có năm học"}
      </p>
      {message && (
        <div ref={summary} tabIndex={-1} role="alert">
          {message}
        </div>
      )}
      {(section === "all" || section === "positions") && <>
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
      </>}
      {(section === "all" || section === "staff") && <>
      <button type="button" className="primary-action" disabled={disabled} onClick={() => { clearStaffIntake(); setStaffIntakeOpen(true); }}>Thêm nhân viên</button>
      {staffIntakeOpen && <div className="student-intake-backdrop"><div ref={staffIntakeDialog} className="student-intake-dialog staff-intake-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-intake-title"><form className="roster-form student-intake-form" onSubmit={saveStaff}>
        <h3 id="staff-intake-title">{editingStaffId ? "Sửa hồ sơ nhân viên" : "Tạo hồ sơ nhân viên"}</h3>
        <fieldset><legend>Thông tin cơ bản</legend>
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
          Email liên hệ
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
          <select
            value={staffInput.gender}
            onChange={(event) =>
              setStaffInput({ ...staffInput, gender: event.target.value })
            }
            {...field(staffErrors, "gender", "staff-")}
          ><option value="">Chọn giới tính</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option></select>
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
        <label>Mã nhân viên<input value={staffInput.staffCode} onChange={(event) => setStaffInput({ ...staffInput, staffCode: event.target.value })} {...field(staffErrors, "staffCode", "staff-")} /></label>
        {staffErrors.staffCode && <small id="staff-staffCode-error">{staffErrors.staffCode}</small>}
        <label>Mã định danh cá nhân<input value={staffInput.personalIdentifier} onChange={(event) => setStaffInput({ ...staffInput, personalIdentifier: event.target.value })} {...field(staffErrors, "personalIdentifier", "staff-")} /></label>
        {staffErrors.personalIdentifier && <small id="staff-personalIdentifier-error">{staffErrors.personalIdentifier}</small>}
        <label className="student-intake-full-width">Ảnh hồ sơ<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setStaffInput({ ...staffInput, photo: event.target.files?.[0] ?? staffInput.photo })} {...field(staffErrors, "photo", "staff-")} /></label>
        {staffErrors.photo && <small id="staff-photo-error">{staffErrors.photo}</small>}
        </fieldset><fieldset><legend>Công việc</legend>
        <label>Chức danh chính<select value={staffInput.primaryPositionId} onChange={(event) => setStaffInput({ ...staffInput, primaryPositionId: event.target.value })}><option value="">Chọn chức danh</option>{positions.filter((item) => item.status === 'ACTIVE').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Trạng thái nhân sự<select value={staffInput.employmentStatus} onChange={(event) => setStaffInput({ ...staffInput, employmentStatus: event.target.value as 'ACTIVE' | 'INACTIVE' })}><option value="ACTIVE">Đang hiệu lực</option><option value="INACTIVE">Không hiệu lực</option></select></label>
        </fieldset>
        <div className="student-intake-actions"><button type="button" disabled={disabled} onClick={clearStaffIntake}>Đóng</button><button disabled={disabled}>
          {editingStaffId ? "Lưu thay đổi hồ sơ" : "Lưu hồ sơ nhân sự"}
        </button></div>
      </form></div></div>}
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
                          staffCode: item.staffCode ?? "",
                          personalIdentifier: item.personalIdentifier ?? "",
                          photo: null,
                        });
                        setStaffErrors({});
                        setStaffIntakeOpen(true);
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
      </>}
      {(section === "all" || section === "years") && <>
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
                         detailRequest.current += 1;
                         selectedDetailStudent.current = undefined;
                         setDetailLoading(false);
                         setStudentDetail(undefined);
                         setParentLinks([]);
                         selectedYear.current = item.id;
                         loadedYear.current = "";
                         rosterRequest.current += 1;
                         setClasses([]);
                         setStudents([]);
                         setRosterLoading(true);
                         setRosterLoadFailed(false);
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
      </>}
      {yearId && (
        <>
          {readOnly && (
            <p role="status">
              Năm học đã đóng. Danh bộ và lịch sử chỉ có thể xem.
            </p>
          )}
          <fieldset className={section === "students" || section === "parents" ? "student-roster-surface" : undefined} disabled={readOnly || disabled}>
            {(section === "all" || section === "classes") && !readOnly && (
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
            {(section === "all" || section === "staff") && <>
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
            </>}
            {(section === "all" || section === "classes") && <div className="table-scroll">
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
            </div>}
            {(section === "all" || section === "years") && <>
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
                ghi danh.
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
                  Ghi danh vẫn giữ trạng thái hiện tại.
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
            </>}
            {(section === "all" || section === "students") && <>
            {section === "students" && selected?.isActive && (
              <div className="student-list-toolbar">
                <h3>Học sinh của {selected.name}</h3>
                <button type="button" className="primary-action" disabled={disabled} onClick={() => setStudentIntakeOpen(true)}>Thêm học sinh</button>
              </div>
            )}
            {section === "students" && selected?.isActive && studentIntakeOpen && (
              <div className="student-intake-backdrop" role="presentation">
              <div ref={studentIntakeDialog} className="student-intake-dialog" role="dialog" aria-modal="true" aria-labelledby="student-intake-title">
              {studentIntakeForm("intake-status", true)}
              </div>
              </div>
            )}
            {selected?.isActive && showStudentIntake && section === "all" && (
              studentIntakeForm("intake-status-all")
            )}
            {!selected?.isActive && (
              <p role="status">
                Chỉ có thể tạo ghi danh trong năm học đang hoạt động.
              </p>
            )}
            <div className="table-scroll student-list-table">
              <table>
                <caption>Danh bộ {schoolName} · {selected?.name ?? "Chưa chọn năm học"} · Trang {rosterMeta.page}</caption>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Mã</th>
                    <th>Học sinh</th>
                    <th>Lớp</th>
                    <th>Mẹ</th>
                    <th>Bố</th>
                    <th>Trạng thái</th>
                    <th>Tùy chọn</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterLoading ? (
                    <tr>
                        <td colSpan={8} role="status" className="student-empty-state">
                        Đang tải danh sách học sinh...
                      </td>
                    </tr>
                    ) : students.length ? (
                      students.map((item, index) => (
                        <tr key={item.id}>
                          <td>{(rosterMeta.page - 1) * rosterMeta.pageSize + index + 1}</td>
                          <td>{item.studentCode}</td>
                          <th scope="row">{item.hasPhoto && <img src={`${apiUrl}/api/app/schools/${schoolId}/roster/students/${item.id}/photo`} alt={`Ảnh hồ sơ ${item.fullName}`} />} {item.fullName}</th>
                          <td>{item.enrollment.classroom?.name ?? "Chưa xếp lớp"}</td>
                          <td>{item.relatives.mother ?? "-"}</td>
                          <td>{item.relatives.father ?? "-"}{item.relatives.otherRelativeCount ? <small className="relative-count">+{item.relatives.otherRelativeCount} người thân khác</small> : null}</td>
                          <td>{lifecycleLabel[item.enrollment.lifecycle]}</td>
                          <td className="roster-row-actions">
                            <button
                              ref={rowMenu === item.id ? rowMenuTrigger : undefined}
                              type="button"
                              aria-label={`Tùy chọn cho ${item.fullName}`}
                              aria-haspopup="menu"
                              aria-expanded={rowMenu === item.id}
                              onKeyDown={(event) => {
                                if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key))
                                  rowMenuKeyboardOpen.current = true;
                                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                  event.preventDefault();
                                  setRowMenu(item.id);
                                }
                              }}
                              onClick={() => setRowMenu(rowMenu === item.id ? undefined : item.id)}
                            >...</button>
                            {rowMenu === item.id && <div
                              ref={rowMenuElement}
                              className="roster-action-menu"
                              role="menu"
                              onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget as Node))
                                  setRowMenu(undefined);
                              }}
                              onKeyDown={(event) => {
                                const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
                                const current = items.indexOf(document.activeElement as HTMLButtonElement);
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setRowMenu(undefined);
                                  rowMenuTrigger.current?.focus();
                                } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                  event.preventDefault();
                                  items[(current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
                                } else if (event.key === "Home" || event.key === "End") {
                                  event.preventDefault();
                                  items[event.key === "Home" ? 0 : items.length - 1]?.focus();
                                } else if (event.key === "Tab") setRowMenu(undefined);
                              }}
                            >
                              <button ref={selectedDetailStudent.current === item.id ? studentDetailTrigger : undefined} type="button" role="menuitem" onClick={(event) => { studentDetailTrigger.current = event.currentTarget; setRowMenu(undefined); void openStudentDetail(item.id); }}>Xem hồ sơ</button>
                              <button type="button" role="menuitem" onClick={(event) => { studentDetailTrigger.current = event.currentTarget; setRowMenu(undefined); void openStudentDetail(item.id); }}>Quản lý liên kết người thân</button>
                            </div>}
                          </td>
                        </tr>
                      ))
                  ) : !rosterLoadFailed && (
                    <tr>
                      <td colSpan={8} className="student-empty-state">
                        <strong>Chưa có học sinh trong năm học này</strong>
                        <span>Thêm hồ sơ đầu tiên để bắt đầu quản lý danh sách và phân lớp.</span>
                        {selected?.isActive && <button type="button" onClick={() => setStudentIntakeOpen(true)}>Thêm học sinh đầu tiên</button>}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <form className="roster-list-filters" aria-label="Lọc danh bộ" onSubmit={(event) => { event.preventDefault(); reloadRoster(1); }}>
              <label>Tìm kiếm<input type="search" value={rosterQuery.q} onChange={(event) => setRosterQuery({ ...rosterQuery, q: event.target.value })} placeholder="Tên hoặc mã học sinh" /></label>
              <label>Lớp<select value={rosterQuery.classId} onChange={(event) => setRosterQuery({ ...rosterQuery, classId: event.target.value })}><option value="">Tất cả lớp</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label>Trạng thái<select value={rosterQuery.lifecycle} onChange={(event) => setRosterQuery({ ...rosterQuery, lifecycle: event.target.value })}><option value="">Tất cả trạng thái</option>{Object.entries(lifecycleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Sắp xếp<select value={rosterQuery.sort} onChange={(event) => setRosterQuery({ ...rosterQuery, sort: event.target.value as "name" | "class" })}><option value="name">Tên học sinh</option><option value="class">Lớp</option></select></label>
              <button>Áp dụng</button><button type="button" disabled={rosterLoading} onClick={() => reloadRoster()}>Làm mới danh sách</button>
            </form>
            {rosterMeta.totalPages > 1 && <nav className="pagination" aria-label="Phân trang danh bộ"><button type="button" disabled={rosterLoading || rosterMeta.page === 1} onClick={() => reloadRoster(rosterMeta.page - 1)}>Trước</button>{Array.from({ length: Math.min(5, rosterMeta.totalPages) }, (_, index) => rosterMeta.totalPages <= 5 ? index + 1 : Math.min(rosterMeta.totalPages - 4, Math.max(1, rosterMeta.page - 2)) + index).map((page) => <button key={page} type="button" disabled={rosterLoading || page === rosterMeta.page} aria-current={page === rosterMeta.page ? "page" : undefined} onClick={() => reloadRoster(page)}>{page}</button>)}<button type="button" disabled={rosterLoading || rosterMeta.page === rosterMeta.totalPages} onClick={() => reloadRoster(rosterMeta.page + 1)}>Sau</button></nav>}
            </>}
            {section === "parents" && <>
              <div className="table-scroll student-list-table parent-list-table">
                <table>
                  <caption>Phụ huynh {schoolName} · {selected?.name ?? "Chưa chọn năm học"} · Trang {parentMeta.page}</caption>
                  <thead><tr><th>STT</th><th>Phụ huynh</th><th>Số điện thoại</th><th>Email</th><th>Con / lớp</th><th>Tùy chọn</th></tr></thead>
                  <tbody>
                    {rosterLoading ? <tr><td colSpan={6} role="status" className="student-empty-state">Đang tải danh sách phụ huynh...</td></tr>
                      : parents.length ? parents.map((item, index) => <tr key={item.id}>
                        <td>{(parentMeta.page - 1) * parentMeta.pageSize + index + 1}</td>
                        <th scope="row">{item.fullName}</th><td>{item.phone}</td><td>{item.email ?? "-"}</td>
                        <td><ul className="parent-children">{item.children.map((child) => <li key={child.linkId}>{child.studentName} · {child.className ?? "Chưa xếp lớp"} <span>({child.relationshipLabel})</span></li>)}</ul></td>
                        <td className="roster-row-actions"><button ref={rowMenu === item.id ? rowMenuTrigger : undefined} type="button" aria-label={`Tùy chọn cho ${item.fullName}`} aria-haspopup="menu" aria-expanded={rowMenu === item.id} onKeyDown={(event) => { if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) rowMenuKeyboardOpen.current = true; if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); setRowMenu(item.id); } }} onClick={() => setRowMenu(rowMenu === item.id ? undefined : item.id)}>...</button>
                          {rowMenu === item.id && <div ref={rowMenuElement} className="roster-action-menu" role="menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setRowMenu(undefined); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setRowMenu(undefined); rowMenuTrigger.current?.focus(); } else if (event.key === "Tab") setRowMenu(undefined); }}><button type="button" role="menuitem" onClick={() => { parentDetailTrigger.current = rowMenuTrigger.current; setRowMenu(undefined); setParentDetail(item); }}>Xem chi tiết phụ huynh</button></div>}
                        </td>
                      </tr>) : !rosterLoadFailed && <tr><td colSpan={6} className="student-empty-state"><strong>Chưa có phụ huynh liên kết trong năm học này</strong><span>Danh sách chỉ hiển thị liên kết đang hiệu lực.</span></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="parent-list-controls">
                <form className="parent-list-search" aria-label="Lọc phụ huynh" onSubmit={(event) => { event.preventDefault(); reloadParents(1); }}>
                  <label>
                    <span>Tìm kiếm</span>
                    <input type="search" value={parentQuery.q} onChange={(event) => { const next = { q: event.target.value }; parentQueryRef.current = next; setParentQuery(next); }} placeholder="Tên, con, số điện thoại hoặc email" />
                  </label>
                  <button>Áp dụng</button>
                  <button type="button" disabled={rosterLoading} onClick={() => reloadParents()}>Làm mới</button>
                </form>
                {parentMeta.totalPages > 1 && <nav className="pagination parent-list-pagination" aria-label="Phân trang phụ huynh"><button type="button" disabled={rosterLoading || parentMeta.page === 1} onClick={() => reloadParents(parentMeta.page - 1)}>Trước</button>{Array.from({ length: Math.min(5, parentMeta.totalPages) }, (_, index) => parentMeta.totalPages <= 5 ? index + 1 : Math.min(parentMeta.totalPages - 4, Math.max(1, parentMeta.page - 2)) + index).map((page) => <button key={page} type="button" disabled={rosterLoading || page === parentMeta.page} aria-current={page === parentMeta.page ? "page" : undefined} onClick={() => reloadParents(page)}>{page}</button>)}<button type="button" disabled={rosterLoading || parentMeta.page === parentMeta.totalPages} onClick={() => reloadParents(parentMeta.page + 1)}>Sau</button></nav>}
              </div>
            </>}
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
      {parentDetail && (
        <div className="student-intake-backdrop" role="presentation">
          <section ref={parentDetailDialog} className="student-intake-dialog student-detail-panel" role="dialog" aria-modal="true" aria-labelledby="parent-detail-title" onKeyDown={trapParentDetailDialog}>
            <div className="student-list-toolbar"><h3 id="parent-detail-title">Hồ sơ {parentDetail.fullName}</h3><button type="button" disabled={disabled} onClick={closeParentDetail}>Đóng</button></div>
            <p>{parentDetail.phone} · {parentDetail.email ?? "Không có email"}</p>
            <section><h4>Liên kết với học sinh</h4><ul>{parentDetail.children.map((child) => <li key={child.linkId}>{child.studentName} · {child.className ?? "Chưa xếp lớp"} · {child.relationshipLabel}<button type="button" disabled={disabled} onClick={() => void revokeParentListLink(child.linkId, child.studentName)}>Thu hồi</button></li>)}</ul></section>
          </section>
        </div>
      )}
      {(detailLoading || studentDetail) && (
        <div className="student-intake-backdrop" role="presentation">
          <section ref={studentDetailDialog} className="student-intake-dialog student-detail-panel" role="dialog" aria-modal="true" aria-labelledby="student-detail-title" onKeyDown={trapStudentDetailDialog}>
            {detailLoading ? <p role="status">Đang tải hồ sơ học sinh...</p> : studentDetail && <>
              <div className="student-list-toolbar"><h3 id="student-detail-title">Hồ sơ {studentDetail.fullName}</h3><button type="button" disabled={disabled} onClick={closeStudentDetail}>Đóng</button></div>
              <p>Mã học sinh: {studentDetail.studentCode}</p>
              <section><h4>Ghi danh</h4>{studentDetail.enrollments.map((enrollment) => <div key={enrollment.id}><p>{enrollment.classroom?.name ?? "Chưa xếp lớp"} · {lifecycleLabel[enrollment.lifecycle]} · {enrollment.effectiveFrom}{enrollment.endedOn ? ` - ${enrollment.endedOn}` : ""}</p>{enrollment.lifecycle === "WAITING_FOR_CLASS" && <fieldset><label>Lớp<select value={detailPlacement.classId} onChange={(event) => setDetailPlacement({ ...detailPlacement, classId: event.target.value })}><option value="">Chọn lớp</option>{classes.filter((item) => item.status === "ACTIVE").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Ngày hiệu lực xếp lớp<input type="date" value={detailPlacement.effectiveFrom} onChange={(event) => setDetailPlacement({ ...detailPlacement, effectiveFrom: event.target.value })} /></label><button type="button" disabled={disabled} onClick={() => void placeDetailEnrollment(enrollment.id)}>Xếp lớp</button></fieldset>}<label>Ngày kết thúc<input type="date" value={detailEndedOn[enrollment.id] ?? enrollment.endedOn ?? ""} onChange={(event) => setDetailEndedOn({ ...detailEndedOn, [enrollment.id]: event.target.value })} /></label><label>Đổi trạng thái<select value={enrollment.lifecycle} disabled={disabled} onChange={(event) => void changeDetailLifecycle(enrollment, event.target.value)}>{Object.entries(lifecycleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>)}</section>
              <section><h4>Liên kết người thân</h4><ul>{parentLinks.map((link) => <li key={link.id}>{link.parent.fullName} · {link.relationshipLabel} · {link.parent.email} · {link.status === "ACTIVE" ? (link.parent.bound ? "Đã xác nhận" : "Đang chờ") : "Đã thu hồi"}{link.status === "ACTIVE" && <button type="button" disabled={disabled} onClick={() => void revokeParentLink(link)}>Thu hồi</button>}</li>)}</ul>
                <form onSubmit={saveParentLink}><label>Họ và tên người thân<input value={parentInput.fullName} onChange={(event) => setParentInput({ ...parentInput, fullName: event.target.value })} /></label><label>Email người thân<input type="email" value={parentInput.email} onChange={(event) => setParentInput({ ...parentInput, email: event.target.value })} /></label><label>Số điện thoại người thân<input value={parentInput.phone} onChange={(event) => setParentInput({ ...parentInput, phone: event.target.value })} /></label><label>Quan hệ<input value={parentInput.relationshipLabel} onChange={(event) => setParentInput({ ...parentInput, relationshipLabel: event.target.value })} placeholder="Ví dụ: Mẹ, Bố, Ông, Bà" {...field(studentErrors, "relationshipLabel", "parent-")} /></label>{studentErrors.relationshipLabel && <small id="parent-relationshipLabel-error">{studentErrors.relationshipLabel}</small>}<button disabled={disabled}>Tạo liên kết</button></form>
              </section>
            </>}
          </section>
        </div>
      )}
    </section>
  );
}
