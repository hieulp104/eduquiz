/**
 * Kiểm thử danh sách lớp (không cần DB): năm học, tên lớp khóa mới, đọc Excel danh sách lớp.
 * Chạy: npm run verify
 */
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { nextClassName, schoolYearOf, shiftSchoolYear } from "@/modules/classes/class-board";
import { buildClassTemplate, parseClassWorkbook } from "@/modules/classes/class-import";

async function main() {
  // Năm học đổi từ tháng 8 (giờ VN)
  assert.equal(schoolYearOf(new Date("2026-11-08T00:00:00+07:00")), "2026-2027");
  assert.equal(schoolYearOf(new Date("2027-07-31T23:00:00+07:00")), "2026-2027");
  assert.equal(schoolYearOf(new Date("2027-08-01T00:30:00+07:00")), "2027-2028", "0h30 ngày 1/8 giờ VN = vẫn 31/7 UTC");
  assert.equal(shiftSchoolYear("2026-2027", 1), "2027-2028");

  // Tên lớp khóa mới: tăng khối ở đầu tên
  assert.equal(nextClassName("10A1"), "11A1");
  assert.equal(nextClassName("6/2"), "7/2");
  assert.equal(nextClassName("Lớp 9A"), "Lớp 10A");
  assert.equal(nextClassName("12C3"), "12C3", "lớp 12 giữ nguyên");
  assert.equal(nextClassName("Bồi dưỡng HSG"), "Bồi dưỡng HSG");

  // File mẫu đọc lại được
  const tpl = await parseClassWorkbook(Buffer.from(await buildClassTemplate()));
  assert.equal(tpl.rows.length, 4);
  assert.deepEqual(tpl.warnings, []);
  assert.equal(tpl.rows[0].groupName, "Khối 10");
  assert.equal(tpl.rows[3].groupName, null, "nhóm trống = Khác");

  // Năm học viết nhiều kiểu, dòng trùng, năm sai
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("S");
  ws.addRow(["Tên lớp", "Năm học", "Nhóm lớp"]);
  ws.addRow(["7A", "2025 - 2026", "Khối 7"]);
  ws.addRow(["7B", "2025/2026", ""]);
  ws.addRow(["7A", "2025-2026", ""]);
  ws.addRow(["8A", "abc", ""]);
  ws.addRow(["", "2025-2026", ""]);
  const r = await parseClassWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
  assert.deepEqual(r.rows.map((x) => [x.name, x.schoolYear]), [
    ["7A", "2025-2026"],
    ["7B", "2025-2026"],
    ["8A", schoolYearOf(new Date())],
  ]);
  assert.ok(r.warnings.some((w) => w.includes("trùng")));
  assert.ok(r.warnings.some((w) => w.includes('"abc"')));

  console.log("✔ verify-classes: năm học, tên lớp khóa mới, Excel danh sách lớp");
}

main().catch((e) => {
  console.error("✘ verify-classes:", e.message);
  process.exitCode = 1;
});
