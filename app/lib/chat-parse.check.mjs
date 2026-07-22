// Self-check: the chat feed parser in data.ts depends on the session jsonl
// shape (type:"message" records, message.role, content text blocks, and a
// <harness-metadata> prefix on operator messages). This pins those assumptions
// against a REAL session file so a harness format change fails loudly here.
//
//   node web/lib/chat-parse.check.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const jsonl = join(
  here,
  "../../harness/agents/rosie/sessions/test/012a4133-de41-46db-bc38-4a543fa3d944.jsonl",
);

const cleanText = (raw) =>
  raw.replace(/<harness-metadata>[\s\S]*?<\/harness-metadata>\s*/g, "").trim();

// Same parse as loadChat() in data.ts.
const parse = (entries) => {
  const out = [];
  for (const e of entries) {
    if (e.type !== "message" || !e.message) continue;
    const role = e.message.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = cleanText(
      (e.message.content ?? [])
        .filter((c) => c.type === "text" && c.text)
        .map((c) => c.text)
        .join("\n"),
    );
    if (!text) continue;
    out.push({ role, text });
  }
  return out;
};

const entries = readFileSync(jsonl, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));

const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
};

// Raw shape the parser relies on.
const rawUser = entries.find((e) => e.type === "message" && e.message?.role === "user");
assert(rawUser, "expected at least one user message record");
const rawUserText = (rawUser.message.content ?? []).find((c) => c.type === "text")?.text ?? "";
assert(rawUserText.includes("<harness-metadata>"), "operator message should carry a metadata block");

const msgs = parse(entries);
assert(msgs.length >= 2, `expected >=2 chat messages, got ${msgs.length}`);
assert(
  msgs.some((m) => m.role === "user") && msgs.some((m) => m.role === "assistant"),
  "expected both user and assistant messages",
);
assert(
  !msgs.some((m) => m.text.includes("<harness-metadata>")),
  "metadata block must be stripped from rendered text",
);
assert(
  !msgs.some((m) => m.text === ""),
  "thinking/tool-only turns must be dropped (no empty bubbles)",
);

console.log(`ok — parsed ${msgs.length} chat messages from real session jsonl`);
