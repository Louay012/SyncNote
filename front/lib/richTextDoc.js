const COLOR_SPAN_REGEX = /^<span style="color:(#[0-9a-fA-F]{6})">([\s\S]*?)<\/span>/;
const UNDERLINE_REGEX = /^<u>([\s\S]*?)<\/u>/;
const BOLD_REGEX = /^\*\*([\s\S]*?)\*\*/;

const EMPTY_DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [] }]
};

function isDocNode(value) {
  return (
    value &&
    typeof value === "object" &&
    value.type === "doc" &&
    Array.isArray(value.content)
  );
}

function textNode(text, marks = []) {
  const node = {
    type: "text",
    text: String(text || "")
  };

  if (marks.length) {
    node.marks = marks;
  }

  return node;
}

function parseInlineLegacyText(text) {
  const source = String(text || "");
  const nodes = [];
  let cursor = 0;

  while (cursor < source.length) {
    const remaining = source.slice(cursor);

    const colorMatch = remaining.match(COLOR_SPAN_REGEX);
    if (colorMatch) {
      nodes.push(textNode(colorMatch[2], [{ type: "textStyle", attrs: { color: colorMatch[1] } }]));
      cursor += colorMatch[0].length;
      continue;
    }

    const underlineMatch = remaining.match(UNDERLINE_REGEX);
    if (underlineMatch) {
      nodes.push(textNode(underlineMatch[1], [{ type: "underline" }]));
      cursor += underlineMatch[0].length;
      continue;
    }

    const boldMatch = remaining.match(BOLD_REGEX);
    if (boldMatch) {
      nodes.push(textNode(boldMatch[1], [{ type: "bold" }]));
      cursor += boldMatch[0].length;
      continue;
    }

    const nextCandidates = [
      remaining.indexOf("<span style=\"color:"),
      remaining.indexOf("<u>"),
      remaining.indexOf("**")
    ].filter((value) => value >= 0);

    const nextToken = nextCandidates.length ? Math.min(...nextCandidates) : -1;
    const plainText = nextToken === -1 ? remaining : remaining.slice(0, nextToken);

    if (plainText) {
      nodes.push(textNode(plainText));
      cursor += plainText.length;
      continue;
    }

    nodes.push(textNode(remaining[0]));
    cursor += 1;
  }

  return nodes;
}

export function createRichDocFromLegacyText(value) {
  const lines = String(value ?? "").split("\n");

  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: parseInlineLegacyText(line)
    }))
  };
}

export function normalizeStoredRichDocString(value) {
  const raw = String(value ?? "");
  if (!raw.trim()) {
    return JSON.stringify(EMPTY_DOC);
  }

  try {
    const parsed = JSON.parse(raw);
    if (isDocNode(parsed)) {
      return JSON.stringify(parsed);
    }
  } catch {
    // Fall through and interpret as legacy plain text markup.
  }

  return JSON.stringify(createRichDocFromLegacyText(raw));
}

export function parseStoredRichDoc(value) {
  return JSON.parse(normalizeStoredRichDocString(value));
}
