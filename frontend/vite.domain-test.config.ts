import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/tests/domainFoundation.test.ts",
    outDir: ".test-dist",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "domainFoundation.test.mjs",
      },
    },
  },
});
