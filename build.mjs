import { context, build } from "esbuild";

/**
 * The only build step. It exists because `heic-to` is an npm package carrying an
 * inlined libheif wasm worker — browsers can't resolve that from a bare import.
 * Everything else is plain ES modules that would run unbundled.
 *
 * `splitting` is not optional here: the HEIC decoder is ~3 MB and is reached
 * through a dynamic import precisely so it only downloads for the people who
 * need it. Without splitting, esbuild inlines it into the entry bundle and
 * every visitor pays for a decoder most browsers never run.
 */
const options = {
  entryPoints: ["src/client/main.js"],
  outdir: "public/js",
  bundle: true,
  splitting: true,
  format: "esm",
  target: ["es2022", "chrome111", "safari16", "firefox115"],
  entryNames: "[name]",
  chunkNames: "heic-[hash]",
  sourcemap: true,
  minify: !process.argv.includes("--watch"),
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("esbuild watching src/client → public/js");
} else {
  await build(options);
}
