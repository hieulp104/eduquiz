import sanitizeHtml from "sanitize-html";

/**
 * Lọc HTML từ trình soạn thảo trước khi lưu — chặn XSS (script, onerror, javascript:...).
 * Chỉ giữ các thẻ/kiểu mà thanh công cụ tạo ra: đậm, nghiêng, tô màu, căn lề, danh sách.
 * Nội dung sau khi lọc mới được render bằng dangerouslySetInnerHTML.
 */
export function sanitizeRichText(html: string): string {
  const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "mark", "ul", "ol", "li", "h2", "h3", "blockquote"],
    allowedAttributes: {
      mark: ["style", "data-color"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
    },
    allowedStyles: {
      "*": { "text-align": [/^(left|center|right|justify)$/] },
      mark: { "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i] },
    },
  });
  // Trình soạn thảo trống trả về "<p></p>" — coi như không có nội dung.
  return clean.replace(/<p><\/p>/g, "").trim();
}
