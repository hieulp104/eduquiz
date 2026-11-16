// TẠM — đối chiếu đáp án bộ đọc nhận được với chữ tô đỏ đọc thẳng từ XML (cách độc lập). Xóa sau khi xong.
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { importExamFile } from "@/modules/exams/exam-import";
import { parseExamText } from "@/modules/exams/exam-text";

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Chữ cái các nhãn phương án được tô màu (không đen), theo thứ tự trong file. */
async function redLabels(file: string): Promise<string[]> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const xml = (await zip.file("word/document.xml")!.async("string")) ?? "";
  const out: string[] = [];
  for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []) {
    let text = "";
    const red: boolean[] = [];
    for (const r of p.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
      const color = r.match(/<w:rPr>[\s\S]*?<w:color w:val="([0-9A-Fa-f]{6})"/)?.[1];
      const isRed = Boolean(color && !/^(0{6}|[0-3][0-9a-f]){1,3}$/i.test(color) && color.toUpperCase() !== "000000");
      for (const piece of r.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\/>/g)) {
        const t = piece[0] === "<w:tab/>" ? "\t" : decode(piece[1]);
        text += t;
        for (let i = 0; i < t.length; i++) red.push(isRed);
      }
    }
    const bare = text.trim() && text.trim().split(/\s+/).every((t) => /^[A-H]$/.test(t));
    const re = bare ? /(^|\s)([A-H])(?=\s|$)/g : /(^|\s)([A-H])\s*[.)]/g;
    for (const m of text.matchAll(re)) {
      const at = m.index + m[1].length;
      // nhãn đỏ, hoặc phần lớn nội dung ngay sau nhãn đỏ
      const after = red.slice(at, at + 6);
      if (red[at] || after.filter(Boolean).length >= 4) out.push(m[2]);
    }
  }
  return out;
}

async function main() {
  for (const file of process.argv.slice(2)) {
    const draft = await importExamFile(path.basename(file), fs.readFileSync(file));
    const parsed = parseExamText(draft.text);
    const got = parsed.questions.map((q) => "ABCDEFGH"[q.options.findIndex((o) => o.isCorrect)] ?? "?");
    const want = await redLabels(file);
    const same = got.join("") === want.join("");
    console.log(`\n═══ ${path.basename(file)}: ${same ? "KHỚP" : "LỆCH"} (${got.length} câu, ${want.length} nhãn đỏ)`);
    console.log("  bộ đọc :", got.join(""));
    console.log("  XML đỏ :", want.join(""));
    if (!same) got.forEach((g, i) => g !== want[i] && console.log(`   câu #${i + 1} (no ${parsed.questions[i].no}): bộ đọc ${g} ≠ đỏ ${want[i]} — ${parsed.questions[i].content.slice(0, 60)}`));
  }
}

main();
