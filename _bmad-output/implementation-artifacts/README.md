# Implementation Artifacts - PassionEdu

Thu muc nay chi chua specification va tracker dang hoat dong cho PassionEdu multi-school platform.

## Build Input

Truoc khi tao hoac thuc thi story, doc cac artifact canonical sau:

- `../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md`
- `../planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md`
- `../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md`
- `../specs/spec-passionedu/SPEC.md`
- `../planning-artifacts/epics-passionedu.md`
- `../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md`
- `../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md`
- `../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md`

`sprint-status.yaml` la tracker duy nhat cho backlog PassionEdu. Epic context va implementation spec phai duoc tao moi tu cac artifact tren; khong tai su dung context/spec cua Anh Hoa.

## UX Delivery Contract

Truoc khi implement story co portal surface, resolve row tu `UX and Mockup Traceability` trong `epics-passionedu.md`. Them cac link UX spine/mockup cua row do vao implementation spec, cung route/state dang lam va verification visual/E2E cho responsive, validation, permission/revoke va Operation reconciliation. `DESIGN.md` va `EXPERIENCE.md` thang khi mockup HTML static mau thuan; mockup chi la mốc fidelity, khong la authority cho API, authorization, finance calculation hay state transition.

## Traceability

Implementation artifacts cua Anh Hoa da bi loai khoi active path khi PassionEdu thay the pham vi san pham. Git history truoc commit nay la archive truy vet day du; khong phai build input cho clean-break implementation.
