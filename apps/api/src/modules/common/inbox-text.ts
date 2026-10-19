// One wording for a Parent inbox event, shared by the in-app inbox and Web Push so both say the same thing.
export function inboxText(event: { sourceType: string; state?: string | null; payload?: unknown }) {
  const className = (event.payload as { className?: unknown } | null)?.className;
  const classLabel = typeof className === "string" && className ? ` ${className}` : "";
  if (event.sourceType === "CLASS_NOTE") return `Lớp${classLabel} có bản tin mới`;
  if (event.sourceType === "MESSAGE") return `Giáo viên lớp${classLabel} gửi tin nhắn mới`;
  if (event.sourceType === "HANDOVER") return "Đã xác nhận trả trẻ";
  return event.state === "PRESENT" ? "Đã ghi nhận có mặt" : "Đã ghi nhận vắng mặt";
}
