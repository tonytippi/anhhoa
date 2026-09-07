# Review cần chạy độc lập

Đặc tả đang ở trạng thái `in-review`. Hãy chạy ba prompt sau trong các phiên riêng, rồi trả lại findings để tiếp tục triage.

## Blind Hunter

Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Find at least ten issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

CONTENT:

Diff từ baseline `77ba9af5b10056f3fbf1cd80a6d131d7c365d901` tới worktree hiện tại, bao gồm thay đổi UX-spine đã được người dùng phê duyệt và mockup Tài chính. Hãy lấy bằng:

```bash
git diff --no-index /dev/null _bmad-output/implementation-artifacts/spec-chuan-hoa-ux-mockup-tai-chinh.md
git diff 77ba9af5b10056f3fbf1cd80a6d131d7c365d901 -- _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04
```

Do not invoke any skill. Return only the review result.

## Edge Case Hunter

Read `/home/sonnh/projects/anhhoa/_bmad/render/bmad-build/anhhoa-27612f38c250/040428f09c3cba08487d/review-prompts/edge-case-hunter.md` completely and follow it as your review instructions.

Review content:

Diff từ baseline `77ba9af5b10056f3fbf1cd80a6d131d7c365d901` tới worktree hiện tại, bao gồm thay đổi UX-spine đã được người dùng phê duyệt và mockup Tài chính. Hãy lấy bằng:

```bash
git diff --no-index /dev/null _bmad-output/implementation-artifacts/spec-chuan-hoa-ux-mockup-tai-chinh.md
git diff 77ba9af5b10056f3fbf1cd80a6d131d7c365d901 -- _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04
```

Do not invoke any skill. If the instruction file is unreadable, report that exact failure and stop. Return only the review result.

## Verification Gap Reviewer

Read `/home/sonnh/projects/anhhoa/_bmad/render/bmad-build/anhhoa-27612f38c250/040428f09c3cba08487d/review-prompts/verification-gap.md` completely and follow it as your review instructions.

Review content:

Diff từ baseline `77ba9af5b10056f3fbf1cd80a6d131d7c365d901` tới worktree hiện tại, bao gồm thay đổi UX-spine đã được người dùng phê duyệt và mockup Tài chính. Hãy lấy bằng:

```bash
git diff --no-index /dev/null _bmad-output/implementation-artifacts/spec-chuan-hoa-ux-mockup-tai-chinh.md
git diff 77ba9af5b10056f3fbf1cd80a6d131d7c365d901 -- _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04
```

Do not invoke any skill. If the instruction file is unreadable, report that exact failure and stop. Return only the review result.
