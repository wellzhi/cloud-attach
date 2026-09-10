import type { LocalRef } from "./types";

function stripFragment(path: string): string {
  const index = path.indexOf("#");
  return index < 0 ? path : path.slice(0, index);
}

function decodeLinkPath(path: string): string {
  try { return decodeURIComponent(path); } catch { return path; }
}

function basename(path: string): string {
  return String(path || "").split("/").pop() || path;
}

function findCodeRegions(text: string): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  const fenced = /^(`{3,}|~{3,}).*?\n[\s\S]*?^\1/gm;
  let match: RegExpExecArray | null;
  while ((match = fenced.exec(text)) !== null) regions.push([match.index, match.index + match[0].length]);
  const inline = /(`+)([^`\n]*?)\1/g;
  while ((match = inline.exec(text)) !== null) regions.push([match.index, match.index + match[0].length]);
  return regions;
}

function inCode(pos: number, regions: Array<[number, number]>): boolean {
  return regions.some(([start, end]) => pos >= start && pos < end);
}

export function extractLocalRefs(text: string): LocalRef[] {
  const refs: LocalRef[] = [];
  const codeRegions = findCodeRegions(text);
  let match: RegExpExecArray | null;

  const wiki = /!?\[\[([^\]\n]+?)\]\]/g;
  while ((match = wiki.exec(text)) !== null) {
    if (inCode(match.index, codeRegions)) continue;
    const raw = match[0];
    const inner = match[1];
    const pipeIndex = inner.indexOf("|");
    const targetPart = pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
    const alias = pipeIndex >= 0 ? inner.slice(pipeIndex + 1) : "";
    const target = stripFragment(targetPart.trim());
    refs.push({
      start: match.index,
      end: match.index + raw.length,
      target,
      label: alias || basename(target)
    });
  }

  const markdown = /!?\[([^\]\n]*)\]\(([^)\n]+)\)/g;
  while ((match = markdown.exec(text)) !== null) {
    if (inCode(match.index, codeRegions)) continue;
    const raw = match[0];
    let href = match[2].trim();
    if (href.startsWith("<") && href.endsWith(">")) href = href.slice(1, -1);
    if (/^(https?:|mailto:|data:|obsidian:|#)/i.test(href)) continue;
    const target = stripFragment(decodeLinkPath(href));
    refs.push({
      start: match.index,
      end: match.index + raw.length,
      target,
      label: match[1] || basename(target)
    });
  }

  return refs.sort((a, b) => a.start - b.start);
}
