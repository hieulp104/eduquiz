/**
 * Danh sách giáo viên bằng Excel (CHỈ chạy ở server — exceljs).
 * Cột: "Họ và tên" (bắt buộc) · "Số điện thoại hoặc email" (bắt buộc; SĐT 10 chữ số — kiểm tra lúc thêm).
 * File mẫu sinh tại chỗ (GET /api/teachers/template) — sửa bộ đọc thì sửa mẫu cùng lúc.
 */
import { cellText } from "@/modules/classes/class-import";

export type TeacherImportRow = { name: string; contact: string };

export async function buildTeacherTemplate(): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sách giáo viên");
  ws.columns = [
    { header: "STT", width: 6 },
    { header: "Họ và tên", width: 28 },
    { header: "Số điện thoại hoặc email", width: 32 },
  ];
  ws.getRow(1).font = { bold: true };
  [
    ["Nguyễn Văn A", "0912345678"],
    ["Trần Thị B", "tran.thi.b@truong.edu.vn"],
  ].forEach((r, i) => ws.addRow([i + 1, ...r]));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

export async function parseTeacherWorkbook(buffer: Buffer): Promise<{ rows: TeacherImportRow[]; warnings: string[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], warnings: ["File không có trang tính nào."] };

  const col: { name?: number; login?: number } = {};
  ws.getRow(1).eachCell((cell, i) => {
    const h = norm(cellText(cell.value));
    if (/^(họ và tên|họ tên|tên|name)/.test(h)) col.name ??= i;
    else if (/(điện thoại|sđt|email|phone|tài khoản)/.test(h)) col.login ??= i;
  });
  if (!col.login) return { rows: [], warnings: ['Không thấy cột "Số điện thoại hoặc email" ở dòng 1. Tải file mẫu để xem.'] };

  const rows: TeacherImportRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const login = cellText(row.getCell(col.login).value).trim();
    const name = col.name ? cellText(row.getCell(col.name).value).trim() : "";
    if (!login && !name) continue;
    if (!login) {
      warnings.push(`Dòng ${r}: thiếu số điện thoại / email — bỏ qua.`);
      continue;
    }
    if (login.length > 200 || name.length > 100) {
      warnings.push(`Dòng ${r}: dữ liệu quá dài — bỏ qua.`);
      continue;
    }
    if (seen.has(login.toLowerCase())) {
      warnings.push(`Dòng ${r}: "${login}" bị trùng trong file — bỏ qua.`);
      continue;
    }
    seen.add(login.toLowerCase());
    if (!name) {
      warnings.push(`Dòng ${r}: thiếu họ và tên — bỏ qua.`);
      continue;
    }
    rows.push({ name, contact: login });
  }
  if (rows.length > 200) {
    warnings.push(`File có ${rows.length} giáo viên — chỉ lấy 200 dòng đầu.`);
    rows.length = 200;
  }
  if (rows.length === 0 && warnings.length === 0) warnings.push("File không có giáo viên nào (từ dòng 2).");
  return { rows, warnings };
}
