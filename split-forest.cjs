const fs = require("fs");
const path = require("path");

const SOURCE = "forest.json";
const OUT_DIR = "model";
const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MiB, aman di bawah limit Pages 25 MiB

if (!fs.existsSync(SOURCE)) {
  console.error("forest.json tidak ditemukan di folder webapp.");
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const data = fs.readFileSync(SOURCE, "utf8");
const parts = [];

for (let i = 0; i < data.length; i += CHUNK_SIZE) {
  const index = String(parts.length).padStart(3, "0");
  const filename = `forest.part${index}.json`;
  const chunk = data.slice(i, i + CHUNK_SIZE);

  fs.writeFileSync(path.join(OUT_DIR, filename), chunk, "utf8");
  parts.push(filename);

  console.log(`created ${filename} (${Buffer.byteLength(chunk)} bytes)`);
}

fs.writeFileSync(
  path.join(OUT_DIR, "manifest.json"),
  JSON.stringify(
    {
      version: 1,
      encoding: "utf8",
      source: "forest.json",
      totalLength: data.length,
      parts,
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Done. ${parts.length} chunks written to ${OUT_DIR}/`);