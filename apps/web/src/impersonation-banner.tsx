// Shown while a Platform Operator acts as this user (opened from the Ops portal); it floats so the reviewed layout is untouched.
export type Impersonation = { id: string; operatorEmail: string };

export function ImpersonationBanner({ email, impersonation, onEnd }: { email: string; impersonation?: Impersonation; onEnd: () => void }) {
  if (!impersonation) return null;
  return (
    <div role="status" style={{ position: "fixed", right: 16, bottom: 16, zIndex: 2147483000, maxWidth: "min(420px, calc(100vw - 32px))", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "#7c2d12", color: "#fff", boxShadow: "0 6px 24px rgb(0 0 0 / .25)", font: "500 14px/1.4 system-ui, sans-serif" }}>
      <span>
        Đang giả lập <b>{email}</b>
        <br />
        <small>bởi {impersonation.operatorEmail} · mọi thao tác được ghi nhận</small>
      </span>
      <button type="button" onClick={onEnd} style={{ flex: "none", padding: "6px 10px", borderRadius: 6, border: 0, background: "#fff", color: "#7c2d12", font: "600 13px system-ui, sans-serif", cursor: "pointer" }}>
        Kết thúc
      </button>
    </div>
  );
}
