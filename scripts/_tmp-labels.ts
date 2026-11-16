// TẠM — in nhãn đánh số tự động mà bộ chuẩn bị file sinh ra cho từng đoạn. Xóa sau khi xong.
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { transformDocumentXml } from "@/modules/exams/docx-prepare";

async function main() {
  for (const file of process.argv.slice(2)) {
    const zip = await JSZip.loadAsync(fs.readFileSync(file));
    const read = async (n: string) => (await zip.file(n)?.async("string")) ?? null;
    const xml = (await read("word/document.xml")) ?? "";
    const numbering = await read("word/numbering.xml");
    const before = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0]);
    const after = [...transformDocumentXml(xml, numbering, await read("word/styles.xml")).matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0]);
    const text = (p: string) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("").replace(/[-]|c[0-9A-F]{6}/g, "");
    // numId → abstract, để biết danh sách nào dùng chung định nghĩa
    const abs = new Map([...(numbering ?? "").matchAll(/<w:num [^>]*w:numId="(\d+)"[^>]*>[\s\S]*?<w:abstractNumId w:val="(\d+)"/g)].map((m) => [m[1], m[2]]));
    const rows: string[] = [];
    const usedAbs = new Map<string, Set<string>>();
    before.forEach((p, i) => {
      const num = p.match(/<w:numPr>[\s\S]*?<w:numId w:val="(\d+)"/)?.[1];
      if (!num || num === "0") return;
      const lvl = p.match(/<w:numPr>[\s\S]*?<w:ilvl w:val="(\d+)"/)?.[1] ?? "0";
      const a = abs.get(num) ?? "?";
      usedAbs.set(a, (usedAbs.get(a) ?? new Set()).add(num));
      const label = text(after[i] ?? "").slice(0, Math.max(0, text(after[i] ?? "").length - text(p).length));
      rows.push(`${label.trim() || "(•)"}{n${num}/${lvl}→a${a}}`);
    });
    const shared = [...usedAbs].filter(([, s]) => s.size > 1).map(([a, s]) => `a${a}←n${[...s].join(",n")}`);
    console.log(`\n═══ ${path.basename(file)}: ${rows.length} đoạn đánh số${before.length !== after.length ? " (LỆCH SỐ ĐOẠN!)" : ""}`);
    if (shared.length) console.log("  dùng chung định nghĩa:", shared.join(" · "));
    console.log("  " + rows.join(" "));
  }
}

main();
