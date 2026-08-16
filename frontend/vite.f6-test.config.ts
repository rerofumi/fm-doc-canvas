import { defineConfig } from "vite";

export default defineConfig({
  build: { ssr: "src/tests/f6Orchestration.test.ts", outDir: ".test-dist", emptyOutDir: false, rollupOptions: { output: { entryFileNames: "f6Orchestration.test.mjs" } } },
});
