import { createHash } from "node:crypto";
import { cp, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const src = resolve(root, "src");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(src, dist, { recursive: true });

await addAssetHashes();

console.log(`Built static site at ${dist}`);

async function addAssetHashes() {
  const indexPath = resolve(dist, "index.html");
  const cssHash = await hashFile(resolve(dist, "styles.css"));
  const jsHash = await hashFile(resolve(dist, "app.js"));
  const hashedCss = `styles.${cssHash}.css`;
  const hashedJs = `app.${jsHash}.js`;

  await copyFile(resolve(dist, "styles.css"), resolve(dist, hashedCss));
  await copyFile(resolve(dist, "app.js"), resolve(dist, hashedJs));

  const indexHtml = await readFile(indexPath, "utf8");
  const updatedIndexHtml = indexHtml
    .replace('href="styles.css"', `href="${hashedCss}"`)
    .replace('src="app.js"', `src="${hashedJs}"`);

  await writeFile(indexPath, updatedIndexHtml);
}

async function hashFile(path) {
  const content = await readFile(path);
  return createHash("sha256").update(content).digest("hex").slice(0, 10);
}
