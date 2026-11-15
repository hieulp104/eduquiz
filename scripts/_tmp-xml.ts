// TẠM — soi XML của file docx. Xóa sau khi xong.
import fs from "node:fs";
import JSZip from "jszip";

async function main() {
  const [file, mode, arg] = process.argv.slice(2);
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const read = async (name: string) => (await zip.file(name)?.async("string")) ?? "";
  if (mode === "files") {
    console.log(Object.keys(zip.files).join("\n"));
    return;
  }
  if (mode === "numbering") {
    const xml = await read("word/numbering.xml");
    console.log(xml.length, "bytes");
    for (const m of xml.matchAll(/<w:abstractNum [^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
      const lvls = [...m[2].matchAll(/<w:lvl [^>]*w:ilvl="(\d)"[^>]*>([\s\S]*?)<\/w:lvl>/g)].slice(0, 2).map((l) => {
        const fmt = l[2].match(/<w:numFmt w:val="([^"]+)"/)?.[1];
        const text = l[2].match(/<w:lvlText w:val="([^"]*)"/)?.[1];
        const start = l[2].match(/<w:start w:val="([^"]+)"/)?.[1];
        return `L${l[1]} ${fmt} "${text}" start=${start}`;
      });
      console.log("abstract", m[1], "|", lvls.join(" | "));
    }
    for (const m of xml.matchAll(/<w:num [^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) {
      const abs = m[2].match(/<w:abstractNumId w:val="(\d+)"/)?.[1];
      const over = [...m[2].matchAll(/<w:lvlOverride w:ilvl="(\d)"[^>]*>([\s\S]*?)<\/w:lvlOverride>/g)].map(
        (o) => `ilvl${o[1]}:start=${o[2].match(/<w:startOverride w:val="(\d+)"/)?.[1] ?? "-"}${o[2].includes("<w:lvl ") ? "+lvl" : ""}`,
      );
      console.log("num", m[1], "→ abstract", abs, over.join(" "));
    }
    return;
  }
  const xml = await read("word/document.xml");
  const paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  if (mode === "paras") {
    // In từng đoạn: numPr + chữ + các kiểu định dạng xuất hiện trong run
    const from = Number(arg ?? 0);
    paras.slice(from, from + 400).forEach((p, i) => {
      const num = p.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/)?.[1];
      const numId = num?.match(/<w:numId w:val="(\d+)"/)?.[1];
      const ilvl = num?.match(/<w:ilvl w:val="(\d+)"/)?.[1];
      const style = p.match(/<w:pStyle w:val="([^"]+)"/)?.[1];
      const runs = [...p.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)].map((r) => {
        const t = [...r[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\/>/g)].map((x) => (x[0] === "<w:tab/>" ? "\\t" : x[1])).join("");
        const rpr = r[0].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
        const flags = [
          /<w:b\/>|<w:b w:val="(1|true)"/.test(rpr) && "b",
          /<w:u /.test(rpr) && "u",
          rpr.match(/<w:color w:val="([^"]+)"/)?.[1] && `c:${rpr.match(/<w:color w:val="([^"]+)"/)?.[1]}`,
          rpr.match(/<w:highlight w:val="([^"]+)"/)?.[1] && `hl:${rpr.match(/<w:highlight w:val="([^"]+)"/)?.[1]}`,
          rpr.match(/<w:shd [^>]*w:fill="([^"]+)"/)?.[1] && `shd:${rpr.match(/<w:shd [^>]*w:fill="([^"]+)"/)?.[1]}`,
        ].filter(Boolean);
        return t ? (flags.length ? `{${flags.join(",")}|${t}}` : t) : "";
      });
      const text = runs.join("");
      if (!text.trim() && !numId) return;
      console.log(String(from + i).padStart(4), numId ? `[num ${numId}/${ilvl ?? 0}]` : "", style ? `<${style}>` : "", text.slice(0, 230));
    });
    return;
  }
  if (mode === "raw") {
    console.log(paras[Number(arg)]);
  }
}

main();
