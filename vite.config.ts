import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

/**
 * Custom Vite plugin that processes public/sw.js at build time,
 * replacing __BUILD_HASH__ with a unique build timestamp.
 * This ensures every production build produces a new service worker
 * with a different cache name, triggering the browser's SW update flow.
 */
function serviceWorkerBuildPlugin(): Plugin {
  return {
    name: "sw-build-hash",
    apply: "build",
    closeBundle() {
      const swPath = path.resolve(__dirname, "dist/sw.js");
      if (fs.existsSync(swPath)) {
        const buildHash = Date.now().toString(36);
        let content = fs.readFileSync(swPath, "utf-8");
        content = content.replace("__BUILD_HASH__", buildHash);
        fs.writeFileSync(swPath, content);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    serviceWorkerBuildPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
