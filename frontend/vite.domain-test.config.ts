import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "src/tests/f2Transform.test.ts",
    outDir: ".test-dist",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "f2Transform.test.mjs",
      },
    },
  },
});
