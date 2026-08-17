import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/tests/markdownLinks.test.ts",
    outDir: ".test-dist",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "markdownLinks.test.mjs",
      },
    },
  },
});
