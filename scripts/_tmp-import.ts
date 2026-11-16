// TẠM — chạy bộ đọc đề trên file trong demau/ để xem kết quả. Xóa sau khi xong.
import fs from "node:fs";
import path from "node:path";
import { importExamFile } from "@/modules/exams/exam-import";
import { parseExamText } from "@/modules/exams/exam-text";

async function main() {
  const args = process.argv.slice(2);
  const dump = args.includes("--dump");
  const files = args.filter((a) => !a.startsWith("--"));
  const list = files.length ? files : fs.readdirSync("demau").filter((f) => /\.(docx|txt)$/i.test(f)).map((f) => path.join("demau", f));
  for (const file of list) {
    const draft = await importExamFile(path.basename(file), fs.readFileSync(file));
    const parsed = parseExamText(draft.text, draft.title);
    console.log(`\n═══ ${file} → ${parsed.questions.length} câu · ${parsed.groups.length} nhóm`);
    const noAnswer = parsed.questions.flatMap((q, i) => (q.options.some((o) => o.isCorrect) ? [] : [`#${i + 1}(no ${q.no})`]));
    console.log("  chưa có đáp án:", noAnswer.join(" ") || "—");
    for (const w of [...draft.warnings, ...parsed.warnings]) console.log("  ⚠", w);
    if (dump) {
      const lines = draft.text.split("\n");
      lines.forEach((l, i) => console.log(String(i + 1).padStart(4), `[${parsed.lineKinds[i].padEnd(8)}]`, JSON.stringify(l)));
    }
  }
}

main();

// --q: in câu hỏi đã đọc (nhóm, nội dung, phương án, đáp án)
export async function printQuestions(file: string) {
  const draft = await importExamFile(path.basename(file), fs.readFileSync(file));
  const parsed = parseExamText(draft.text, draft.title);
  parsed.groups.forEach((g, i) => console.log(`[nhóm ${i + 1}] ${g.content.replace(/\n/g, " ⏎ ").slice(0, 150)}`));
  for (const q of parsed.questions) {
    const opts = q.options.map((o, i) => `${o.isCorrect ? "✔" : ""}${"ABCDEFGH"[i]}.${o.content}`).join(" | ");
    console.log(`${String(q.no).padStart(2)} (g${q.groupIndex === null ? "-" : q.groupIndex + 1}) ${q.content.replace(/\n/g, " ⏎ ").slice(0, 80)}  ⟹ ${opts.slice(0, 150)}`);
  }
}
if (process.argv.includes("--q")) void printQuestions(process.argv.filter((a) => !a.startsWith("--")).at(-1)!);
