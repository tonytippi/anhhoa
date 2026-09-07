---
title: "Sprint Change Proposal - Portal Giao vien va nhat ky ngay hoc"
status: approved
created: 2026-09-07
sources:
  - prds/prd-passionedu-2026-09-04/prd.md
  - architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
  - epics-passionedu.md
  - ux-designs/ux-passionedu-2026-09-04/DESIGN.md
  - ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md
---

# Sprint Change Proposal: Portal Giao vien va nhat ky ngay hoc

## 1. Tom tat van de

Stakeholder can tach cong viec giao vien thanh mot portal rieng va bo sung nhat ky nhan xet hang ngay de Parent xem. Giao vien phai diem danh khi nhan tre, ghi ban giao khi tra tre va viet nhan xet cho tung Student trong Class duoc phan cong. Nhieu anh co the duoc dinh kem nhan xet; Parent xem day la muc dich chinh cua tinh nang.

Day la yeu cau moi, khong phai loi implementation: hien tai `apps/web` la portal chung Admin/Staff va PRD coi daily journal/album la non-goal. Tat ca Epic dang backlog nen khong co code hay story hoan thanh can rollback.

## 2. Quyet dinh da chot

- Bo sung `apps/teacher-web`, mot React/Vite PWA doc lap tai `teacher.passionedu.org`; khong dung chung shell, cookie, callback OAuth, session audience hay service-worker cache voi Admin, Parent, Ops.
- Audience `teacher` la audience danh nhap rieng. Actor chi duoc vao School/Class khi server xac minh UserIdentity, SchoolMembership, StaffProfile binding, capability va Class assignment deu active/effective tai ngay thao tac.
- Admin khong co UI diem danh, ban giao hay nhat ky trong `apps/web`. School Admin muon lam cong viec nay phai dang nhap `teacher.passionedu.org`, va van phai co binding, capability va Class assignment hop le nhu giao vien.
- Teacher ghi diem danh nhan tre va ban giao tra tre; giu nguyen boundary: attendance/handover la du lieu van hanh, khong la pickup authorization va khong tu dong tinh phi.
- Teacher tao mot nhan xet hang ngay cho moi Student/Class/date. Teacher duoc sua trong ngay theo `Asia/Ho_Chi_Minh`; API luu immutable version/audit actor, timestamp va noi dung truoc/sau. Parent chi thay phien ban hien hanh moi nhat duoc cap quyen.
- Nhan xet ho tro khong gioi han so luong anh moi nhan xet. Moi anh chi la JPEG, PNG hoac WebP, toi da 10 MB; API xac minh MIME, kich thuoc va ownership thay vi tin metadata/client filename.
- Parent co the xem nhan xet va anh cua dung Student co `StudentParent` active. Sau `StudentEnrollment.endedOn`, Parent duoc xem toi da 30 ngay lich; sau do Parent DTO/media access bi tu choi. Audit va record noi bo khong bi hard-delete theo Parent retention.

## 3. Impact analysis

### Epic va backlog

- **Epic 1:** Mo rong Story 1.1, 1.2, 1.4 va 1.6 cho app/audience/session/isolation `teacher`; day la dependency truoc moi workflow giao vien.
- **Epic 2:** Story 2.4 khong doi ownership StaffProfile/assignment nhung can bo sung capability contract cho teacher portal.
- **Epic 3:** Them typed `DailyJournalPolicy` de quy dinh retention media va validation upload; policy phai versioned/effective-dated, server-enforced.
- **Epic 4:** Story 4.2 va 4.4 doi surface tu Admin/Staff sang Teacher. Them story nhan xet/ngay hoc va story evidence/media lifecycle/Parent projection; khong sua attendance evidence rule hien co.
- **Epic 7:** Mo rong Parent home/child detail va inbox/read model de hien nhan xet va anh theo Student-level re-authorization, 30-ngay retention va protected cache rules.
- **Epic 8 moi:** Khong can. Portal giao vien la presentation boundary cua operational domain, phu thuoc truc tiep E1-E4 va Parent read model E7; tach Epic moi se tao dependency vong va lam cham operational release. Them story vao E1, E3, E4, E7 la phuong an direct adjustment.
- Thu tu release doi thanh: E1 -> E2 -> E3 -> E4 (teacher operational core) -> E7 Parent attendance/journal read model; E5/E6 finance van co the tiep tuc sau E4 nhu hien tai. Parent journal khong can phu thuoc E6, chi Parent finance view van phu thuoc E6.

### PRD va SPEC

- PRD FR-1/FR-2 va quality topology conflict vi hien chi co `app`, `parent`, `ops`, `api`; can them `teacher` audience/host.
- PRD FR-12 can tach ro attendance/handover tai Teacher portal va them daily journal cua Student; FR-14 can mo rong Parent DTO/retention de bao gom journal va media da cap quyen.
- PRD non-goal "album, meal/daily journal" phai duoc thay bang non-goal hep: khong co album tu do, chat, SMS/email/Zalo hoac medical journal; daily journal co cau truc per Student/date thuoc scope.
- SPEC CAP-6/CAP-7, Constraints va Non-goals phai phan anh Teacher audience, nhat ky/anh, Parent minimum DTO va retention moi.

### Architecture

- AD-1 va structural seed can them `apps/teacher-web`; teacher portal chi dung REST va pure shared packages.
- AD-4 can them `teacher.passionedu.org`, cookie host-only/session audience `teacher`, callback/origin allowlist rieng va protected-state clearing. Session `app` hay `teacher` khong duoc dung cheo.
- AD-6 can them aggregate `DailyJournal`, `DailyJournalVersion` va `DailyJournalMedia`, School/Class/Student/date scoped; unique `(schoolId, studentId, journalDate)` cho phien ban hien hanh. Moi relation Student/Class/actor/media phai tenant graph-safe.
- AD-8 can ap dung CSRF cho upload/mutation; create/update/finalize journal dung idempotency va SchoolMembership-scoped Operation. Upload phai duoc re-authorize tai init, complete va media-read; retry khong tao journal version/media duplicate.
- AD-14/15 khong duoc tai su dung attendance evidence URL hay event payload cho journal. Journal media co authorization, retention va Parent projection rieng; Parent khong nhan Staff identity, internal audit, Class list, source storage key hay direct blob URL.
- Deploy AD-10 can them static teacher container va TLS route `teacher.passionedu.org`.

### UX va verification

- DESIGN/EXPERIENCE phai tu "ba portal" thanh bon portal. Teacher la mobile-first cho luong lop hoc, nhung phai responsive desktop/tablet; Parent van chi doc nhat ky cua con.
- Teacher home uu tien ngay hien tai, School/Class context, tien do diem danh nhan tre, tra tre va nhan xet. Cac row Student chi hien thi du lieu thuoc Class duoc server cap quyen.
- Parent Today/child detail co section "Nhan xet hom nay" voi noi dung va gallery anh. Anh khong preload, khong cache service worker, khong xuat hien trong notification payload; deep-link re-authorize School/Student/journal date truoc render.
- E2E/integration gate mo rong: teacher audience/session isolation; Class assignment revoked/effective-date denial; cross-School/Class/Student journal denial; Parent sibling/cross-School denial; parent retention 30 ngay; media MIME/size/authorization; version audit; no Parent media cache/URL leak.

## 4. Phuong an danh gia va khuyen nghi

| Phuong an | Danh gia | Effort | Rui ro |
| --- | --- | --- | --- |
| Dieu chinh truc tiep cac Epic hien co | **Chon.** Giu domain attendance/roster/parent ownership, them audience va story theo dependency. | Cao | Trung binh |
| Rollback | Khong kha dung: khong co implementation PassionEdu can rollback. | N/A | N/A |
| Giu non-goal, chi tao nhan xet text trong `apps/web` | Khong dap ung portal giao vien rieng, Parent image va authorization boundary da chot. | Trung binh | Cao |

Khuyen nghi la direct adjustment voi pham vi lon, can PM + Architect cap nhat canonical contract truoc Developer implementation. Khong tach Epic rieng; tuyen E1/E2/E3/E4/E7 giu dependency ro rang va khong lam finance phu thuoc Parent journal.

Rui ro con lai la dung luong do khong gioi han so anh. Quyet dinh san pham duoc giu nguyen; truoc pilot, Architecture/Operations phai bo sung monitoring/quota storage theo School va alert, khong duoc am tham cat bot anh hoac tu dong lam giam chat luong. Day la release/operations gate, khong thay doi capability MVP.

## 5. De xuat thay doi chi tiet

### PRD

**Muc 2.1 va UJ-5**

OLD: Class Teacher, Attendance Recorder va Handover Recorder ghi van hanh lop hoc trong capability duoc cap.

NEW: Teacher dung portal giao vien rieng de ghi nhan tre, ban giao tra tre va nhan xet hang ngay kem anh cho tung Student trong Class duoc phan cong; Parent xem nhan xet/anh cua dung con duoc uy quyen.

Ly do: phan tach surface giao vien va bo sung ket qua Parent-facing.

**FR-12 va FR-14**

OLD: Parent attendance DTO chi co status toi thieu va khong evidence/media.

NEW: Giữ attendance DTO toi thieu. Them DailyJournal Parent DTO rieng gom Student display-name snapshot, journalDate, noi dung phien ban hien hanh, updatedAt va danh sach media metadata/toi thieu; moi media read tai API phai re-authorize active StudentParent va operational retention. DTO khong chua Staff identity, audit/version history, Class list, storage key hay evidence attendance.

Ly do: tach ro attendance evidence nhay cam khoi nhat ky duoc Parent cho phep xem.

**Muc 5 Non-goals**

OLD: Khong co album, meal/daily journal.

NEW: Khong co album tu do, chat, SMS/Zalo/email hay nhat ky y te/bua an. Daily journal per Student/date voi text va anh la pham vi chinh thuc theo FR-12/FR-14.

Ly do: loai bo mau thuan voi capability moi ma van giu scope hep.

### Architecture Spine

**AD-1 / AD-4 / AD-10**

OLD: Ba portal `apps/web`, `apps/parent-web`, `apps/ops-web`; ba audience hosts.

NEW: Bon portal, them `apps/teacher-web` va host `teacher.passionedu.org`. Teacher co callback allowlist, origin allowlist, host-only Secure/httpOnly/SameSite=Lax cookie va session audience `teacher` rieng. Proxy route static teacher container rieng. Khong portal nao chap nhan session audience cua portal khac.

Ly do: teacher la security boundary, khong phai mot vai route an trong Admin/Staff shell.

**AD-6 / AD-8 / AD-14-15**

OLD: Attendance evidence Parent-inaccessible va attendance event co DTO toi thieu.

NEW: `attendance` so huu DailyJournal, DailyJournalVersion va DailyJournalMedia School-scoped. Teacher actor phai qua Staff binding/capability/Class assignment effective theo journalDate. Journal co mot current version theo Student/date; update trong ngay tao audit version bat bien. Media upload/read validate server-side MIME JPEG/PNG/WebP, toi da 10 MB moi file, tenant graph va re-authorization; khong gioi han so anh per journal. Parent journal projection/read model recheck StudentParent theo Student tren moi list/detail/media request, chi cho 30 ngay sau endedOn, va khong chia evidence attendance hay notification event payload. Journal media khong cache service worker va khong dung direct permanent URL.

Ly do: bao ve du lieu tre em va tranh tai su dung nham evidence attendance cho Parent.

### Epics va sprint tracker

Them/cap nhat stories sau khi proposal duoc phe duyet:

- 1.1: scaffold `apps/teacher-web` va deploy route.
- 1.2: Google OAuth/session isolation cho teacher audience.
- 1.4: capability navigation va School/Class guard cua teacher portal.
- 1.6: E1 test audience teacher isolation.
- 2.4: capability/binding contract cho Teacher operational actor.
- 3.3: `DailyJournalPolicy` typed/versioned, retention/media governance.
- 4.2: route attendance chi trong Teacher portal.
- 4.4: route handover chi trong Teacher portal.
- 4.8 moi: Teacher tao/sua nhan xet ngay hoc co audit va media validation.
- 4.9 moi: Journal media lifecycle va tenant/capability verification.
- 4.10 moi: Teacher portal operational queue va E2E release gate.
- 7.2: Parent xem nhat ky/anh cua con trong retention, re-authorization va protected cache clearing.
- 7.3: Parent inbox khong payload media; deep-link journal co re-authorization neu co notification journal.
- 7.7: Parent cross-School/media retention/revoke release gate.

### UX

- Information architecture them Teacher home, Class/day attendance, handover va journal editor; loai bo operational mutation destinations khoi Admin shell.
- Teacher flow: chon School -> chi thay Class duoc phan cong -> ghi nhan tre -> them/sua nhan xet trong ngay -> them anh -> server confirmation/Operation reconciliation.
- Parent flow: Today/Child detail -> nhan xet theo ngay -> mo anh qua protected request; revoke/expired retention xoa text, thumbnail va dialog truoc safe fallback.
- Accessibility: upload control keyboard accessible, announce validation/progress, alt text khong chua thong tin tre em cua Student khac; gallery co dialog focus trap/return va touch target 44px.

## 6. Handoff va tieu chi thanh cong

**Phan loai:** Major. Yeu cau thay doi product scope va frozen architecture, can PM + Architect cap nhat canonical artifact truoc implementation.

- Product Manager: cap nhat PRD/addendum, formalize FR daily journal, Parent retention va non-goal boundary.
- Solution Architect: cap nhat Spine/SPEC cho portal/audience, schema, media authorization/retention/upload, deployment va verification gate.
- UX Designer: cap nhat DESIGN/EXPERIENCE cho four-surface IA va luong Teacher/Parent journal.
- Product Owner/Developer: cap nhat `epics-passionedu.md` va `sprint-status.yaml`, sau do tao implementation specs va code theo thu tu dependency.

Tieu chi thanh cong:

1. Teacher audience khong dung cheo session/cookie voi Admin, Parent hoac Ops.
2. Khong actor nao ghi/read attendance, handover, journal hay media ngoai School/Class assignment effective cua minh.
3. Parent chi xem journal/media cua Student co active link, va mat quyen ngay request tiep theo khi revoke/qua 30 ngay retention.
4. Parent khong xem attendance evidence, Staff identity, audit/version history, Class list hay permanent media URL.
5. Moi update journal trong ngay co version/audit; upload retry/idempotency khong tao duplicate media/version.
6. JPEG/PNG/WebP qua 10 MB hay metadata/MIME khong hop le bi server tu choi; khong gioi han so anh moi nhan xet theo quyet dinh san pham.
7. Portal E2E va PostgreSQL integration chung minh tenant/Class/media/retention/session isolation truoc release.

## 7. Checklist trang thai

- [x] 1.1 Trigger: yeu cau stakeholder, khong gan voi story da trien khai.
- [x] 1.2 Problem: thieu Teacher surface doc lap va Parent-facing daily journal.
- [x] 1.3 Evidence: yeu cau/decisions cua stakeholder ngay 2026-09-07.
- [x] 2.1-2.5 Epic impact: E1, E2, E3, E4, E7 bi anh huong; khong epic nao obsolete; can them story va dieu chinh sequencing Parent journal.
- [x] 3.1-3.4 Artifact impact: PRD, SPEC, Architecture, UX, Epics, sprint tracker, deployment va verification deu can cap nhat.
- [x] 4.1 Direct adjustment kha dung, effort cao/rui ro trung binh.
- [x] 4.2 Rollback khong ap dung.
- [x] 4.3 MVP review: MVP mo rong co kiem soat, giu non-goal album/chat/medical.
- [x] 4.4 Chon direct adjustment voi PM/Architect handoff.
- [x] 5.1-5.5 Proposal, action plan va handoff da duoc lap.
- [x] 6.3 User phe duyet proposal ngay 2026-09-07.
- [x] 6.4 `sprint-status.yaml` da them stories 4.8-4.10 va cap nhat 7.2 sau phe duyet.
