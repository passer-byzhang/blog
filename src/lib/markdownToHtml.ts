import { remark } from "remark";
import html from "remark-html";
import math from "remark-math";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeKatex from "rehype-katex";
import rehypeDocument from "rehype-document";
import rehypeStringify from "rehype-stringify";

export default async function markdownToHtml(markdown: string) {
  const result = await remark().use(math).use(html).process(markdown);
  //return result.toString();
  const htmlString = result.toString();
  const katexHtml = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeKatex)
    .use(rehypeDocument, {
      css: "https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css",
    })
    .use(rehypeStringify)
    .process(htmlString);

  return katexHtml.toString();
}
