import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/tests/sprintC.test.ts",
    outDir: ".test-dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "sprintC.test.mjs",
      },
    },
  },
});
