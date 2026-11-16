// TẠM — so sánh bộ đọc cũ (git HEAD, chép vào src/modules/exams/_old) với bộ đọc mới trên các file thật. Xóa sau khi xong.
import fs from "node:fs";
import path from "node:path";
import { importExamFile } from "@/modules/exams/exam-import";
import { parseExamText } from "@/modules/exams/exam-text";
import { importExamFile as oldImport } from "@/modules/exams/_old/exam-import";
import { parseExamText as oldParse } from "@/modules/exams/_old/exam-text";

const L = "ABCDEFGH";
const answers = (qs: { options: { isCorrect: boolean }[] }[]) => qs.map((q) => L[q.options.findIndex((o) => o.isCorrect)] ?? "?").join("");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

async function main() {
  const verbose = process.argv.includes("--v");
  for (const file of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
    const buf = fs.readFileSync(file);
    const name = path.basename(file);
    const o = await oldImport(name, buf);
    const n = await importExamFile(name, buf);
    const op = oldParse(o.text);
    const np = parseExamText(n.text);
    console.log(`\n═══ ${name}`);
    console.log(`  câu: ${op.questions.length} → ${np.questions.length} · nhóm: ${op.groups.length} → ${np.groups.length} · cảnh báo: ${o.warnings.length + op.warnings.length} → ${n.warnings.length + np.warnings.length}`);
    const oa = answers(op.questions);
    const na = answers(np.questions);
    console.log(`  đáp án cũ : ${oa}`);
    if (oa !== na) console.log(`  đáp án mới: ${na}`);
    // Câu cùng số: nội dung / phương án / nhóm có đổi không
    const oldByNo = new Map(op.questions.map((q) => [q.no, q]));
    let changed = 0;
    for (const q of np.questions) {
      const was = oldByNo.get(q.no);
      if (!was) continue;
      const diffs: string[] = [];
      if (norm(was.content) !== norm(q.content)) diffs.push(`nội dung: "${norm(was.content).slice(0, 70)}" → "${norm(q.content).slice(0, 70)}"`);
      const wo = was.options.map((x) => norm(x.content)).join(" | ");
      const no = q.options.map((x) => norm(x.content)).join(" | ");
      if (wo !== no) diffs.push(`phương án: "${wo.slice(0, 90)}" → "${no.slice(0, 90)}"`);
      const wg = was.groupIndex === null ? "" : norm(op.groups[was.groupIndex].content);
      const ng = q.groupIndex === null ? "" : norm(np.groups[q.groupIndex].content);
      if (wg !== ng) diffs.push(`nhóm: "${wg.slice(0, 60)}…" → "${ng.slice(0, 60)}…"`);
      if (diffs.length) {
        changed++;
        if (verbose) console.log(`   câu ${q.no}: ${diffs.join(" ; ")}`);
      }
    }
    console.log(`  câu có thay đổi nội dung / phương án / nhóm: ${changed}`);
    for (const w of [...n.warnings, ...np.warnings]) console.log(`  ⚠ ${w}`);
  }
}

main();
