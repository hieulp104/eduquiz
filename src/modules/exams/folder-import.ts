/**
 * Đọc danh sách thư mục từ Excel cho "Tạo thư mục bằng excel".
 * Cột đầu tiên có chữ ở mỗi dòng (từ dòng 2) là ĐƯỜNG DẪN, các cấp ngăn bằng "/" hoặc ">":
 *   Lớp 6A1 24-25
 *   Lớp 6A1 24-25/Chương 1
 *   Lớp 6A1 24-25 > Chương 2 > Kiểm tra 15 phút
 * Hoặc chia mỗi cấp 1 cột: | Cấp 1 | Cấp 2 | Cấp 3 | (ô trống ở cuối dòng thì dừng).
 */
import { MAX_FOLDER_DEPTH, MAX_FOLDERS_PER_IMPORT } from "@/modules/exams/exam-library.service";

export type FolderImportResult = { paths: string[][]; warnings: string[] };

const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 100);

export async function parseFolderXlsx(buffer: Buffer): Promise<FolderImportResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return { paths: [], warnings: ["File Excel không có trang tính nào."] };

  const text = (v: unknown): string => {
    if (v == null) return "";
    if (typeof v === "object" && "richText" in (v as object)) {
      return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
    }
    if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result ?? "");
    return String(v);
  };

  const warnings: string[] = [];
  const seen = new Set<string>();
  const paths: string[][] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= Math.max(row.cellCount, 1); c++) cells.push(text(row.getCell(c).value));

    // 1 ô có "/" hoặc ">" → tách đường dẫn; nhiều ô → mỗi ô 1 cấp (dừng ở ô trống đầu tiên sau cấp 1).
    const filled = cells.map(clean);
    const firstIdx = filled.findIndex(Boolean);
    if (firstIdx < 0) continue;
    let parts: string[];
    const nonEmpty = filled.slice(firstIdx);
    const stop = nonEmpty.findIndex((x) => !x);
    const levels = (stop < 0 ? nonEmpty : nonEmpty.slice(0, stop)).filter(Boolean);
    if (levels.length === 1) parts = levels[0].split(/\s*[/>]\s*/).map(clean).filter(Boolean);
    else parts = levels;

    if (parts.length === 0) continue;
    if (parts.length > MAX_FOLDER_DEPTH) {
      warnings.push(`Dòng ${r}: quá ${MAX_FOLDER_DEPTH} cấp — chỉ lấy ${MAX_FOLDER_DEPTH} cấp đầu.`);
      parts = parts.slice(0, MAX_FOLDER_DEPTH);
    }
    const key = parts.join("/").toLocaleLowerCase("vi");
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push(parts);
    if (paths.length >= MAX_FOLDERS_PER_IMPORT) {
      warnings.push(`Chỉ nhận ${MAX_FOLDERS_PER_IMPORT} dòng đầu tiên.`);
      break;
    }
  }

  if (paths.length === 0) warnings.push("Không có tên thư mục nào (đọc từ dòng 2, cột đầu tiên).");
  return { paths, warnings };
}
