import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/tests/i18n.test.ts",
    outDir: ".test-dist",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "i18n.test.mjs",
      },
    },
  },
});

