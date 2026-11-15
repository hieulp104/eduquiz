import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Đóng gói standalone cho Docker: .next/standalone chứa server.js + node_modules
  // tối thiểu → ảnh gọn, không cần cài lại dependencies khi chạy.
  output: "standalone",
  // Nút "N" của dev server mặc định ở góc trái dưới — đè lên nút Cài đặt của sidebar.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
