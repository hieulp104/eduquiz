/**
 * Danh sách lớp bằng Excel (CHỈ chạy ở server — exceljs).
 * Cột: "Tên lớp" (bắt buộc) · "Năm học" (VD 2026-2027, bỏ trống = năm học hiện tại) · "Nhóm lớp" (bỏ trống = Khác).
 * File mẫu sinh tại chỗ (GET /api/classes/template) — sửa bộ đọc thì sửa mẫu cùng lúc.
 */
import { isSchoolYear, schoolYearOf, shiftSchoolYear } from "@/modules/classes/class-board";

export type ClassImportRow = { name: string; schoolYear: string; groupName: string | null };

export async function buildClassTemplate(): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sách lớp");
  ws.columns = [
    { header: "STT", width: 6 },
    { header: "Tên lớp", width: 24 },
    { header: "Năm học", width: 14 },
    { header: "Nhóm lớp", width: 22 },
  ];
  ws.getRow(1).font = { bold: true };
  const year = schoolYearOf(new Date());
  [
    ["10A1", year, "Khối 10"],
    ["10A2", year, "Khối 10"],
    ["11B1", year, "Khối 11"],
    ["Lớp bồi dưỡng HSG", year, ""],
  ].forEach((r, i) => ws.addRow([i + 1, ...r]));
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

export function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result ?? "");
  if (typeof v === "object" && "text" in (v as object)) return String((v as { text: unknown }).text ?? "");
  return String(v);
}

/** "2026-2027" · "2026 - 2027" · "2026/2027" · "2026" → "2026-2027"; không hợp lệ → null. */
function readYear(raw: string): string | null {
  const t = raw.replace(/\s/g, "").replace("/", "-");
  if (isSchoolYear(t)) return t;
  if (/^\d{4}$/.test(t)) return shiftSchoolYear(`${t}-${Number(t) + 1}`, 0);
  return null;
}

export async function parseClassWorkbook(buffer: Buffer): Promise<{ rows: ClassImportRow[]; warnings: string[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], warnings: ["File không có trang tính nào."] };

  const col: { name?: number; year?: number; group?: number } = {};
  ws.getRow(1).eachCell((cell, i) => {
    const h = norm(cellText(cell.value));
    if (/^(tên lớp|lớp|class)/.test(h)) col.name ??= i;
    else if (/^(năm học|năm|school year)/.test(h)) col.year = i;
    else if (/^(nhóm|nhóm lớp|group)/.test(h)) col.group = i;
  });
  if (!col.name) return { rows: [], warnings: ['Không thấy cột "Tên lớp" ở dòng 1. Tải file mẫu để xem.'] };

  const current = schoolYearOf(new Date());
  const rows: ClassImportRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = cellText(row.getCell(col.name).value).trim();
    if (!name) continue;
    if (name.length > 100) {
      warnings.push(`Dòng ${r}: tên lớp quá 100 ký tự — bỏ qua.`);
      continue;
    }
    const rawYear = col.year ? cellText(row.getCell(col.year).value).trim() : "";
    const year = rawYear ? readYear(rawYear) : current;
    if (!year) warnings.push(`Dòng ${r}: năm học "${rawYear}" không hợp lệ — dùng ${current}.`);
    const groupName = col.group ? cellText(row.getCell(col.group).value).trim().slice(0, 100) || null : null;
    const key = `${name.toLowerCase()}|${year ?? current}`;
    if (seen.has(key)) {
      warnings.push(`Dòng ${r}: lớp "${name}" bị trùng trong file — bỏ qua.`);
      continue;
    }
    seen.add(key);
    rows.push({ name, schoolYear: year ?? current, groupName });
  }
  if (rows.length > 200) {
    warnings.push(`File có ${rows.length} lớp — chỉ lấy 200 lớp đầu.`);
    rows.length = 200;
  }
  if (rows.length === 0 && warnings.length === 0) warnings.push("File không có lớp nào (từ dòng 2).");
  return { rows, warnings };
}
