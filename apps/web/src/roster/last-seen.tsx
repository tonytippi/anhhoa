// Last use of this School by a staff member or parent; days are Vietnam calendar days, so last evening reads "Hôm qua".
const timeZone = "Asia/Ho_Chi_Minh";
const dayNumber = (date: Date) => Date.parse(new Intl.DateTimeFormat("en-CA", { timeZone }).format(date)) / 86_400_000;
const exactTime = (date: Date) =>
  `${new Intl.DateTimeFormat("vi-VN", { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(date)} ${new Intl.DateTimeFormat("vi-VN", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date)}`;

export function LastSeen({ value, empty = "Chưa truy cập" }: { value?: string | null; empty?: string }) {
  if (!value) return <span className="last-seen-empty">{empty}</span>;
  const date = new Date(value);
  const days = dayNumber(new Date()) - dayNumber(date);
  return (
    <span title={exactTime(date)}>
      {days <= 0 ? "Hôm nay" : days === 1 ? "Hôm qua" : `${days} ngày trước`}
      <small className="staff-contact">{exactTime(date)}</small>
    </span>
  );
}
