/**
 * Kiểm tra toàn bộ ngân hàng câu hỏi (cần đã chạy db:seed).
 * Chạy: npm run verify
 *
 * - correctIndex hợp lệ, ≥ 2 phương án, không phương án trùng
 * - Câu dạng phép tính "a + b = ?", "a - b = ?", "a + ...... = c", "a ...... b" (dấu)
 *   được tính lại và so với đáp án đã lưu
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/shared/prisma/prisma.service";

async function main() {
  const questions = await prisma.bankQuestion.findMany();
  assert.ok(questions.length > 0, "Ngân hàng trống — chạy npm run db:seed");

  let checkedMath = 0;
  for (const q of questions) {
    const where = `[${q.id}] ${q.content}`;
    assert.ok(q.options.length >= 2, `Ít hơn 2 phương án: ${where}`);
    assert.equal(new Set(q.options).size, q.options.length, `Phương án trùng: ${where}`);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length, `correctIndex sai: ${where}`);
    const answer = q.options[q.correctIndex];

    let m: RegExpMatchArray | null;
    if ((m = q.content.match(/^(\d+) ([+-]) (\d+) = (\?|\.\.\.\.\.\.)$/))) {
      const v = m[2] === "+" ? +m[1] + +m[3] : +m[1] - +m[3];
      assert.equal(answer, String(v), `Sai phép tính: ${where} → ${answer}`);
      checkedMath++;
    } else if ((m = q.content.match(/^(\d+) ([+-]) \.\.\.\.\.\. = (\d+)$/))) {
      const v = m[2] === "+" ? +m[3] - +m[1] : +m[1] - +m[3];
      assert.equal(answer, String(v), `Sai số cần điền: ${where} → ${answer}`);
      checkedMath++;
    } else if ((m = q.content.match(/(\d+) \.\.\.\.\.\. (\d+)( là:)?$/))) {
      const a = +m[1];
      const b = +m[2];
      assert.equal(answer, a > b ? ">" : a < b ? "<" : "=", `Sai dấu: ${where} → ${answer}`);
      checkedMath++;
    }
  }
  console.log(`✔ verify-question-bank: ${questions.length} câu hợp lệ, ${checkedMath} câu phép tính đã tính lại`);
}

main()
  .catch((e) => {
    console.error("✘ verify-question-bank:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
