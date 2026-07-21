import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        work: resolve(__dirname, "work/index.html"),
        coreAI: resolve(__dirname, "work/core-ai/index.html"),
      },
    },
  },
});
