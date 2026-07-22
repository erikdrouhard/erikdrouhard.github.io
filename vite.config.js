import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        work: resolve(__dirname, "work/index.html"),
        dragonDrive: resolve(__dirname, "work/dragon-drive/index.html"),
        microsoft: resolve(__dirname, "work/microsoft/index.html"),
        coreAIRedirect: resolve(__dirname, "work/core-ai/index.html"),
        mixDialog: resolve(__dirname, "work/mix-dialog/index.html"),
      },
    },
  },
});
