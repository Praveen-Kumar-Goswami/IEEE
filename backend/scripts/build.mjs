import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { build } from "esbuild";

const packageJson = `${JSON.stringify({ type: "module" })}\n`;
const indexJs = "export { handler } from \"./handler.js\";\n";

mkdirSync("dist", { recursive: true });
rmSync("lambda-artifact", { recursive: true, force: true });
mkdirSync("lambda-artifact", { recursive: true });

await build({
  entryPoints: ["src/handler.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/handler.js",
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});

const handler = readFileSync("dist/handler.js");
if (!handler.includes("export {\n  handler\n}")) {
  throw new Error("Lambda bundle is missing the handler export.");
}
writeFileSync("dist/package.json", packageJson);
writeFileSync("dist/index.js", indexJs);
writeFileSync("lambda-artifact/handler.js", handler);
writeFileSync("lambda-artifact/index.js", indexJs);
writeFileSync("lambda-artifact/package.json", packageJson);
writeFileSync("dist/lambda.zip", zipStore([
  { name: "handler.js", data: handler },
  { name: "index.js", data: Buffer.from(indexJs) },
  { name: "package.json", data: Buffer.from(packageJson) },
]));

function crc32(buffer) {
  let crc = ~0;
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function zipStore(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const compressed = deflateRawSync(file.data);
    const name = Buffer.from(file.name);
    const checksum = crc32(file.data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    parts.push(local, compressed);
    const directory = Buffer.alloc(46 + name.length);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(file.data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    name.copy(directory, 46);
    central.push(directory);
    offset += local.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
}
