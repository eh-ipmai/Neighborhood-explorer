import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

function copyDataDirPlugin() {
  return {
    name: "copy-data-dir",
    closeBundle() {
      const srcDir = path.resolve(process.cwd(), "data");
      const outDir = path.resolve(process.cwd(), "dist", "data");
      if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, outDir, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [copyDataDirPlugin()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
