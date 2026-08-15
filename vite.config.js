import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const experimentsDirectory = resolve(__dirname, "experiments");
const experimentEntries = Object.fromEntries(
  readdirSync(experimentsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => [
      `experiment-${entry.name}`,
      resolve(experimentsDirectory, entry.name, "index.html"),
    ]),
);

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        work: resolve(__dirname, "work/index.html"),
        experiments: resolve(__dirname, "experiments/index.html"),
        ...experimentEntries,
        dragonDrive: resolve(__dirname, "work/dragon-drive/index.html"),
        microsoft: resolve(__dirname, "work/microsoft/index.html"),
        coreAIRedirect: resolve(__dirname, "work/core-ai/index.html"),
        mixDialog: resolve(__dirname, "work/mix-dialog/index.html"),
        verseDesignSystem: resolve(__dirname, "work/verse-design-system/index.html"),
      },
    },
  },
});
