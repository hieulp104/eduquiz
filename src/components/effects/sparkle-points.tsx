/*
 * Chấm sáng bay lên trong nút chính — chuyển từ `floating-dots-cta` của bộ threeui.
 * Dùng: thêm class `cta-sparkle` cho nút / link rồi đặt <SparklePoints /> làm con đầu tiên.
 * CSS ở app/globals.css (mục "Nút chính có chấm sáng"). Tắt khi prefers-reduced-motion.
 */
export function SparklePoints() {
  return (
    <span aria-hidden className="cta-sparkle-points">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}
