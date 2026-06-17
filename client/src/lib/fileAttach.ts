import JSZip from "jszip";

const MAX_FILE_CHARS = 50_000;
const MAX_TOTAL_CHARS = 200_000;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "csv", "tsv", "json", "jsonl", "ndjson", "yaml", "yml", "toml",
  "xml", "html", "htm", "css", "scss", "sass", "less",
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "py", "rb", "go", "rs", "java", "kt", "kts", "swift",
  "dart", "c", "h", "cpp", "cc", "cxx", "hpp", "hh", "cs", "php", "sh", "bash", "zsh", "fish",
  "sql", "graphql", "gql", "ini", "cfg", "conf", "properties", "env", "log", "r", "lua", "pl",
  "scala", "clj", "cljs", "ex", "exs", "erl", "vue", "svelte", "astro", "tf", "gradle", "bat", "ps1",
]);

const TEXT_BASENAMES = new Set([
  "dockerfile", "makefile", "license", "readme", "changelog", "gemfile", "procfile",
  ".gitignore", ".env", ".npmrc", ".prettierrc", ".eslintrc",
]);

export interface AttachmentSummary {
  name: string;
  detail: string;
}

function extOf(name: string): string {
  const base = name.split("/").pop() ?? name;
  const i = base.lastIndexOf(".");
  return i > 0 ? base.slice(i + 1).toLowerCase() : "";
}

function looksTextual(name: string): boolean {
  const base = (name.split("/").pop() ?? name).toLowerCase();
  if (TEXT_BASENAMES.has(base)) return true;
  return TEXT_EXTENSIONS.has(extOf(name));
}

function isProbablyBinary(text: string): boolean {
  if (text.includes("\u0000")) return true;
  const sample = text.slice(0, 2000);
  if (!sample) return false;
  let bad = 0;
  for (const ch of sample) if (ch === "\uFFFD") bad++;
  return bad > sample.length * 0.05;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtFile(label: string, text: string, clipped: boolean): string {
  const lang = extOf(label);
  const note = clipped ? "\n…(truncated)" : "";
  return `[File: ${label}]\n\`\`\`${lang}\n${text}${note}\n\`\`\``;
}

export function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith(".zip") || file.type.includes("zip");
}

/**
 * Read a list of attached files into a single text block suitable for sending
 * to a text LLM. Text files are inlined; .zip archives are unpacked and their
 * text entries inlined; binary files are noted but skipped. Output is capped so
 * we never blow past the model context or the server body limit.
 */
export async function buildAttachmentBlock(
  files: File[]
): Promise<{ block: string; summaries: AttachmentSummary[] }> {
  const parts: string[] = [];
  const summaries: AttachmentSummary[] = [];
  let remaining = MAX_TOTAL_CHARS;

  for (const file of files) {
    if (isZipFile(file)) {
      try {
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entries = Object.values(zip.files).filter((e) => !e.dir);
        const entryParts: string[] = [];
        let included = 0;

        for (const entry of entries) {
          if (remaining <= 0) break;
          if (!looksTextual(entry.name)) continue;
          const raw = await entry.async("string");
          if (isProbablyBinary(raw)) continue;
          const take = Math.min(raw.length, remaining, MAX_FILE_CHARS);
          const text = raw.slice(0, take);
          remaining -= text.length;
          entryParts.push(fmtFile(`${file.name} → ${entry.name}`, text, take < raw.length));
          included++;
        }

        const header = `[Attached archive: ${file.name} — ${entries.length} entr${entries.length === 1 ? "y" : "ies"}, ${included} text file${included === 1 ? "" : "s"} included]`;
        parts.push(included > 0 ? `${header}\n\n${entryParts.join("\n\n")}` : `${header} (no readable text files found)`);
        summaries.push({ name: file.name, detail: `zip · ${included}/${entries.length} files` });
      } catch {
        parts.push(`[Attached archive: ${file.name} — could not be read]`);
        summaries.push({ name: file.name, detail: "zip · unreadable" });
      }
      continue;
    }

    let raw: string;
    try {
      raw = await file.text();
    } catch {
      parts.push(`[Attached file: ${file.name} — could not be read]`);
      summaries.push({ name: file.name, detail: "unreadable" });
      continue;
    }

    if (isProbablyBinary(raw)) {
      parts.push(`[Attached file: ${file.name} — binary file (${humanSize(file.size)}); text contents can't be extracted]`);
      summaries.push({ name: file.name, detail: `${humanSize(file.size)} · binary` });
      continue;
    }

    const take = Math.min(raw.length, Math.max(remaining, 0), MAX_FILE_CHARS);
    const text = raw.slice(0, take);
    remaining -= text.length;
    parts.push(fmtFile(file.name, text, take < raw.length));
    summaries.push({ name: file.name, detail: humanSize(file.size) });
  }

  if (parts.length === 0) return { block: "", summaries };

  const block =
    "----- BEGIN UNTRUSTED ATTACHED FILE CONTENT -----\n" +
    parts.join("\n\n") +
    "\n----- END UNTRUSTED ATTACHED FILE CONTENT -----";

  return { block, summaries };
}
