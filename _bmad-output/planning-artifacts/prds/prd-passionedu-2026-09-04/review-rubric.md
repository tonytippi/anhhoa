# PRD Quality Review — PassionEdu: Nen tang van hanh da truong

## Overall verdict

**Chua san sang phe duyet build end-to-end (Fair).** PRD co thesis ro rang ve clean-break, multi-school isolation va finance ledger; pham vi, non-goals, hanh trinh va phan lon he qua kiem thu deu cu the, tao nen mot contract nghiep vu manh cho Architecture va Epic planning. Tuy nhien, release gating hien chu yeu la test fixture noi bo, NFR chua co nguong do duoc, va mot so quyet dinh policy/Parent payment can thiet cho cac release sau chua co owner, tieu chi chot va hanh vi fallback duoc dinh nghia du. Khong nen cam ket Release 4 hay lap ke hoach van hanh production cho toan initiative truoc khi giai quyet cac finding high ben duoi.

## Decision-readiness — thin

PRD da dua ra nhieu quyet dinh quan trong mot cach ro rang: clean-break (§1, §5), server-authoritative finance (§4.3), khong auto-price tu attendance/handover (§4.5) va thu tu release foundation-first (§6.2). Cac lua chon nay co trade-off co the suy ra duoc, dac biet tu cac non-goals va rui ro §9, nhung tai lieu it khi noi truc tiep cai gia phai tra va dieu kien nao se thay doi quyet dinh. Vi du, clean-break chi hop le khi “du lieu van hanh chua ton tai” (§9), nhung khong co owner hay release gate de xac nhan dieu kien nay.

Cau hoi mo §10 co owner va moc E7/deferred, la mot nen tang tot. Tuy vay, Q1-Q2 de lai capability thanh toan cua Parent, danh sach ngan hang va device matrix chua chot trong khi FR-15 cho phep VietQR/copy fields “neu UX/architecture giu lai capability nay”. Day la quyet dinh pham vi va an toan thanh toan, khong chi la chi tiet UX; khong co phuong an mac dinh da cam ket neu chua chot dung han.

### Findings

- **high** Khong co quyet dinh release-ready cho Parent payment instruction (§4.6, FR-15; §10.1-2; §11) — FR-15 dua capability VietQR/copy fields vao dieu kien “neu UX/architecture giu lai”, trong khi Q1-Q2 chua dinh nghia owner mot nguoi, deadline quyet dinh, tieu chi chon, browser/device support, hay fallback. E7 khong the duoc scope hay test acceptance on dinh theo contract nay. *Fix:* Chot mot MVP contract (vi du chi copy fields, hoac VietQR + deep link cu the), nêu fallback khi device/bank khong ho tro, owner quyet dinh va release gate truoc khi E7 bat dau.
- **medium** Dieu kien clean-break chua co quyet dinh van hanh de kiem chung (§1, §5, §9) — PRD noi khong migration production va chi ap dung khi du lieu van hanh chua ton tai, nhung khong xac dinh ai xac nhan, khi nao xac nhan, va xu ly ra sao neu pilot/du lieu that xuat hien truoc rollout. *Fix:* Them decision record/gate voi owner Platform Operations/Product, bang chung can co va diem dung initiative neu tien de clean-break khong con dung.

## Substance over theater — adequate

Day khong phai PRD theo kieu “trang tri”: nam persona trong UJ-1 den UJ-5 deu gan truc tiep voi capability va quyen; Vision §1 phan biet ro Anh Hoa la tenant dau tien, khong phai ranh gioi san pham. Cac NFR hien co cung mang tinh mien nghiep vu cu the (CSRF, cookie host-only, tenant isolation, ledger, retention), khong phai boilerplate chung chung.

Diem yeu la §7 goi chung nhieu thu la “yeu cau chat luong, bao mat va governance” nhung chi liet ke invariant. Cac tuyen bo nay can nguong/measurement de khong tro thanh NFR theater khi chuyen thanh architecture, operations va QA.

### Findings

- **high** NFR khong co SLO/nguong kiem chung cho production (§7) — Khong co muc tieu hay gioi han co the do cho response time/capacity, availability, recovery/backup, audit retention, accessibility, rate limiting hay thoi gian propagation cua revoke/suspend. “Release-blocking verification” (§7) chi noi loai test, khong noi muc dat. He qua la system co the pass integration/E2E fixture nhung van khong dat muc dich van hanh truong hoc. *Fix:* Bo sung cac NFR co nguong, pham vi va cach kiem chung, uu tien isolation/revocation latency, performance cho preview/generate/report, RPO/RTO, availability, audit/backup retention va accessibility cho hai portal.

## Strategic coherence — adequate

Thesis foundation-first cua §1 nhat quan voi trinh tu §6.2: tenant control plane va roster di truoc finance, Parent portal di sau ledger. Non-goals §5 va counter-metrics §8 cung giu dung thesis bang cach tu choi auto-fee/auto-settlement va cac capability catalog chua co policy. Day la scope logic cua mot platform MVP, khong phai danh sach tinh nang ngau nhien.

Nhung Success Metrics dang do do tin cay cua test suite hon la xac nhan gia thuyet san pham: an toan khi van hanh da truong, lap hoa don dung va Parent tu phuc vu dung quyen. SM-4 dac biet khong co thoi gian hay ty le; do do khong the ket luan initiative dat gia tri sau rollout.

### Findings

- **high** Thanh cong chua do duoc gia tri initiative ngoai fixture test (§8) — SM-1 den SM-3 deu la 100% test/reconciliation fixture; chung la release quality gates can thiet, khong la outcome sau khi truong su dung. SM-4 “hoan tat ... trong mot luong” khong co thoi gian, ty le thanh cong hay mau quan sat; SM-5 cung chi la test behavior. *Fix:* Giu cac SM hien tai thanh release gates va bo sung metric co baseline/target/window cho setup danh bo, phat hanh-thu tien/reconciliation, Parent self-service va su co authorization/finance sau pilot.
- **medium** Counter-metrics la nguyen tac, khong phai chi so canh bao (§8) — SM-C1 va SM-C2 dung ve y dinh nhung “khong danh doi”/“khong toi uu” khong co signal quan sat hay nguong de phat hien team dang hy sinh an toan hay mo rong auto-fee som. *Fix:* Gan moi counter-metric voi mot chi so/canh bao va nguong can escalation, vi du cross-tenant denial/leak, manual adjustment ratio, hay auto-derived charge attempt.

## Done-ness clarity — adequate

15 FR lien tuc deu co “He qua kiem thu”, va nhieu dieu kien manh, co the test truc tiep: scoped authorization (§4.1), invoice uniqueness/idempotency (§4.3), immutable ledger (§4.4) va Parent revoke/cache (§4.6). Day la diem manh nhat cua PRD va du cho tach stories o cac core domain.

Mot so FR van uy quyen cac policy load-bearing ma khong dinh nghia shape toi thieu hay quy tac default. Điều nay hop ly khi policy can cau hinh, nhung engineer/QA khong the ket luan done neu khong biet policy nao bat buoc phai ton tai va lifecycle cua no.

### Findings

- **medium** FR-12 chua du contract cho service enrollment va leave policy (§4.5, FR-12) — FR gop leave, attendance va service enrollment, nhung khong neu lifecycle cua service enrollment, truong policy bat buoc, quy tac hieu luc, xu ly overlap/doi lop, va deadline/approval duoc tinh theo timezone/calendar nao. “Theo policy” khong tu no tao acceptance criteria. *Fix:* Tach hoac bo sung minimum policy contract: state/lifecycle, required fields, effective date/timezone, conflict/override rules, default khi policy chua cau hinh va audit expectations.
- **medium** Bao cao finance chua co dinh nghia as-of va dong bo so lieu (§4.4, FR-11) — Cac dimension report duoc liet ke tot, nhung chua quy dinh report doc ledger tai thoi diem nao, timezone/period boundary, freshness, xu ly reversal sau khi chot ky va co cho phep export/chot so hay khong. Nhung diem nay co the lam hai implementation deu “dung” nhung cho ket qua khac nhau. *Fix:* Dinh nghia report/as-of semantics, timezone, freshness, period close/reopen va behavior cua reversal/refund doi voi report da xem/chot.

## Scope honesty — adequate

§5 noi thang cac phan khong lam, §6 cong khai release dependency, va §10 gan owner/moc cho cac open question. Ba assumption o §11 cung khong bi an trong van ban; PRD thua nhan thang payment instruction va retention chua duoc chot. Mat do open item thap so voi stakes cua mot chain-top, multi-tenant finance initiative.

Van de la assumptions index khong round-trip voi cac doan ma no chi phoi, va assumption retention 12 thang co the anh huong privacy/Parent access truoc E7. Neu khong xac dinh no la temporary default hay decision bat buoc, downstream co nguy co “dong cung” mot proposal chua duoc phe duyet.

### Findings

- **medium** Assumption ve retention dang mang tinh quyet dinh release nhung chua duoc triage (§4.6 FR-14; §11) — Default “12 thang sau settlement” va kha nang School version policy sau nay anh huong quyen truy cap du lieu tai chinh cua Parent, storage va compliance, nhung khong co owner, deadline hoac dieu kien xac nhan nhu cac OQ §10. *Fix:* Chuyen thanh Open Question/decision co owner va gate truoc E7, hoac chot no la policy MVP va ghi ro co so phe duyet.

## Downstream usability — adequate

PRD duoc viet ro rang de feed Architecture, UX, Epics va QA (§0); glossary, UJ co ten nguoi, FR-1 den FR-15 va SM-1 den SM-5 lien tuc. Nhieu cross-reference FR/UJ/SM deu resolve, va addendum tach ro technical choices khoi yeu cau chuc nang.

Co mot vai domain noun quan trong chua co glossary, va assumption tags chi ton tai trong index thay vi ngay tai assertion. Cac tac vu downstream phai tu doan link giua `StudentParent`, Parent link va cac default retention/payment policy.

### Findings

- **medium** Glossary chua bao phu cac noun load-bearing (§3; FR-6; FR-14; addendum §17) — `StudentParent` duoc dung o §4.6/addendum trong khi glossary chi co `ParentProfile`; `Staff assignment`, `ReceivableGroup`, `Receivable`, `DiscountPolicy`, `ChargeRule`, `Payment instruction` va `operation` cung la cac term quyet dinh contract nhung khong duoc dinh nghia day du. *Fix:* Bo sung/lam ro cac term nay trong glossary, dac biet quan he Parent-Student va lifecycle/scope cua no.

## Shape fit — strong

Day la initiative brownfield/chain-top, multi-stakeholder va tai chinh nhay cam; hinh dang hien tai phu hop: UJ-1 den UJ-5 mang persona vao cac quyet dinh authorization/finance, FR co test consequences, non-goals giam scope creep, va addendum giu chi tiet ky thuat. PRD cung phan biet ro clean-break voi code/data cu (§1, §5, §9), nen khong gia vo day la mot greenfield khong rang buoc.

Khong co finding rieng cho dimension nay.

## Mechanical notes

- FR-1 den FR-15, UJ-1 den UJ-5 va SM-1 den SM-5 lien tuc, unique; cac cross-reference duoc kiem tra deu resolve. `SM-C1` va `SM-C2` la counter-metric nen khong pha chuoi SM primary/secondary.
- Moi UJ deu co protagonist co ten va ngu canh du de trich xuat.
- Assumptions Index co ba muc nhung khong co tag `[ASSUMPTION]` tuong ung tai cac assertion trong §4.6 hay §8. Round-trip voi checklist vi vay khong hoan chinh; dat tag inline hoac doi index thanh “Assumptions/decisions” co cross-reference cu the.
- Dung nhat quan `Parent link`/`StudentParent link`: chon mot term chinh thuc va tham chieu glossary. `Payment instruction` dang dung dung casing trong glossary va FR, nhung nen bo sung ID/term contract neu day la aggregate snapshot.
- Co hai non-goal/assumption gan nhau ve payment: §5 cam Parent self-confirmation, con §11 giu VietQR/copy fields. Khong mau thuan, nhung nen noi ro VietQR/deep link chi la presentation instruction, khong la payment confirmation hay bank integration.
