import matter from "gray-matter";
import { readFile } from "node:fs/promises";

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

export async function parseMarkdownFile(
  filePath: string
): Promise<ParsedMarkdown> {
  const raw = await readFile(filePath, "utf-8");
  return parseMarkdownString(raw);
}

export function parseMarkdownString(content: string): ParsedMarkdown {
  const { data, content: body } = matter(content);
  return { frontmatter: data, body: body.trim() };
}
