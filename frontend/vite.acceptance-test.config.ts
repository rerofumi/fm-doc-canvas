import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/tests/acceptanceGaps.test.ts",
    outDir: ".test-dist",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "acceptanceGaps.test.mjs",
      },
    },
  },
});
