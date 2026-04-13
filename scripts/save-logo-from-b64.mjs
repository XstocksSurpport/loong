/**
 * 将你提供的 JPEG base64（不含 data: 前缀）写入 public/logo.jpg
 * 用法：把 base64 存为 user-logo.b64（单行），然后运行：
 *   node scripts/save-logo-from-b64.mjs user-logo.b64
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const arg = process.argv[2] || "user-logo.b64";
const b64Path = resolve(root, arg);
const raw = readFileSync(b64Path, "utf8").replace(/\s/g, "");
const buf = Buffer.from(raw, "base64");
if (buf.length < 100) {
  console.error("解码结果过小，请检查 base64 是否完整。");
  process.exit(1);
}
const out = resolve(root, "public", "logo.jpg");
mkdirSync(resolve(root, "public"), { recursive: true });
writeFileSync(out, buf);
console.log("已写入", out, "大小", buf.length, "bytes");
