export default function MessageUnreadBadge({ count, className = "" }) {
  const n = Number(count || 0);
  if (n <= 0) return null;
  return (
    <span
      className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${className}`}
      style={{ background: "#FA6F30" }}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}
