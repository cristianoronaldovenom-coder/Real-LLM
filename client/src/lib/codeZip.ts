import JSZip from "jszip";

export interface CodeBlock {
  lang: string;
  filename: string | null;
  code: string;
}

const EXT_BY_LANG: Record<string, string> = {
  javascript: "js", js: "js", jsx: "jsx", mjs: "mjs",
  typescript: "ts", ts: "ts", tsx: "tsx",
  python: "py", py: "py", ruby: "rb", go: "go", golang: "go",
  rust: "rs", java: "java", kotlin: "kt", swift: "swift", dart: "dart",
  c: "c", cpp: "cpp", "c++": "cpp", cc: "cpp", csharp: "cs", "c#": "cs",
  php: "php", html: "html", xml: "xml", css: "css", scss: "scss", sass: "sass",
  json: "json", yaml: "yml", yml: "yml", toml: "toml",
  bash: "sh", sh: "sh", shell: "sh", zsh: "sh", powershell: "ps1",
  sql: "sql", graphql: "graphql", markdown: "md", md: "md",
  dockerfile: "dockerfile", makefile: "mk", text: "txt", plaintext: "txt", "": "txt",
};

/**
 * Extract fenced code blocks (``` … ```) from a chat message. Supports info
 * strings like ```ts, ```ts:src/app.ts, ```js app.js, ```python title=main.py.
 */
export function parseCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(content)) !== null) {
    const info = match[1].trim();
    const code = match[2].replace(/\n+$/, "");
    if (!code.trim()) continue;

    let lang = "";
    let filename: string | null = null;

    if (info) {
      const firstToken = info.split(/[\s:]/)[0] ?? "";
      lang = firstToken.toLowerCase();
      let rest = info.slice(firstToken.length).replace(/^[\s:]+/, "").trim();
      rest = rest.replace(/^(title|filename|file)=/i, "").replace(/^["']|["']$/g, "").trim();
      if (rest && (rest.includes(".") || rest.includes("/"))) filename = rest;
    }

    blocks.push({ lang, filename, code });
  }

  return blocks;
}

export function countCodeBlocks(content: string): number {
  return parseCodeBlocks(content).length;
}

/**
 * Neutralize model-supplied filenames so they can never escape the archive
 * root (Zip Slip). Keeps any nested folder structure but drops drive letters,
 * leading slashes, "." / ".." segments, and unsafe characters.
 */
function sanitizeZipPath(name: string): string {
  return name
    .replace(/\\/g, "/")
    .replace(/^[a-zA-Z]:/, "")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== "..")
    .map((s) => s.replace(/[\x00-\x1f<>:"|?*]/g, "_"))
    .join("/");
}

/**
 * Package every code block in a message into a downloadable .zip. Returns the
 * number of files written (0 if there were no code blocks).
 */
export async function downloadCodeAsZip(content: string, zipName = "llm-studio-code.zip"): Promise<number> {
  const blocks = parseCodeBlocks(content);
  if (blocks.length === 0) return 0;

  const zip = new JSZip();
  const used = new Set<string>();

  blocks.forEach((b, i) => {
    const safe = b.filename ? sanitizeZipPath(b.filename) : "";
    let name = safe || `snippet-${i + 1}.${EXT_BY_LANG[b.lang] ?? "txt"}`;

    let finalName = name;
    let n = 1;
    while (used.has(finalName)) {
      const dot = name.lastIndexOf(".");
      finalName = dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`;
      n++;
    }
    used.add(finalName);
    zip.file(finalName, b.code);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return blocks.length;
}
