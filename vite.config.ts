// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Outside the Lovable sandbox (e.g. a Netlify CI build) we target Netlify Functions so the
// TanStack Start SSR server actually runs there. Inside Lovable the sandbox overrides this
// with its own Cloudflare preset, so both hosts keep working from the same config.
export default defineConfig({
  nitro: {
    preset: process.env["NITRO_PRESET"] || (process.env["NETLIFY"] ? "netlify" : undefined),
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
