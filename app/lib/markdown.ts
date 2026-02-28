import "server-only";

import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: Array.from(new Set([...(defaultSchema.tagNames ?? []), "img"])),
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    img: ["src", "alt", "title", "loading", "width", "height"],
  },
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    src: ["https"],
  },
} as const;

export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, sanitizeSchema as any)
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
}

