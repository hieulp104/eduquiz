import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * Kho lưu file. Hiện ghi ra ổ đĩa (thư mục STORAGE_DIR, mặc định ./storage — đã gitignore).
 * Muốn chuyển sang MinIO / S3: chỉ thay phần thân 3 hàm dưới, chữ ký giữ nguyên.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "storage");

/** Chặn objectKey chứa ".." thoát ra ngoài thư mục gốc. */
function resolveKey(objectKey: string): string {
  const full = path.resolve(ROOT, objectKey);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("objectKey không hợp lệ");
  return full;
}

export async function putObject(objectKey: string, data: Uint8Array): Promise<void> {
  const full = resolveKey(objectKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** Trả về stream web + kích thước, null nếu file không còn. */
export async function getObject(
  objectKey: string,
): Promise<{ stream: ReadableStream; size: number } | null> {
  const full = resolveKey(objectKey);
  const info = await stat(full).catch(() => null);
  if (!info?.isFile()) return null;
  return {
    stream: Readable.toWeb(createReadStream(full)) as ReadableStream,
    size: info.size,
  };
}

export async function deleteObject(objectKey: string): Promise<void> {
  await rm(resolveKey(objectKey), { force: true });
}
