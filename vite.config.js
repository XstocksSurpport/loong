import { defineConfig } from "vite";

/**
 * GitHub Pages 项目站地址为 https://<user>.github.io/<仓库名>/
 * 仅在 CI 中设置 GITHUB_PAGES=true 时使用子路径，本地 dev/build 仍为 "/"。
 */
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base =
  process.env.GITHUB_PAGES === "true" && repo ? `/${repo}/` : "/";

export default defineConfig({
  base,
  server: {
    port: 5173,
    open: true,
  },
});
