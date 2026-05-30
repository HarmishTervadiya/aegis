const fs = require("fs");
const path = require("path");
function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith("logger.ts")) return;

  const dir = path.dirname(filePath);
  const relPath = path
    .relative(dir, path.join(__dirname, "src/utils/logger.ts"))
    .replace(/\\/g, "/")
    .replace(".ts", ".js");
  let importPath = relPath.startsWith(".") ? relPath : "./" + relPath;

  if (content.includes("console.")) {
    content = `import { logger } from "${importPath}";\n` + content;
    content = content.replace(/console\.log/g, "logger.info");
    content = content.replace(/console\.error/g, "logger.error");
    content = content.replace(/console\.warn/g, "logger.warn");
    fs.writeFileSync(filePath, content);
    console.log("Updated", filePath);
  }
}
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts")) replaceInFile(p);
  }
}
walk(path.join(__dirname, "src"));
