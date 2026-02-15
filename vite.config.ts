import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error("INPUT environment variable is required");
}

export default defineConfig({
  root: path.dirname(INPUT),
  plugins: [viteSingleFile()],
  build: {
    outDir: path.resolve("dist"),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(INPUT),
    },
  },
});
