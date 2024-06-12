import React from 'react';
import {remark} from 'remark';
import {rehype} from 'rehype';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMathjax from 'rehype-mathjax';
import {unified} from 'unified';
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import markdownStyles from './markdown-styles.module.css';
import 'katex/dist/katex.min.css'

interface MarkdownProps {
  content: string;
}

const Markdown: React.FC<MarkdownProps> = ({ content }) => {
  const renderMarkdown =():string => {
    const result = unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeKatex)
      .use(rehypeStringify)
      .processSync(content);
    return result.toString();
  };

  return (
    <div className="flex justify-center w-1/2">
    <div
      className={`${markdownStyles.markdown} w-1/2`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown() }}
    />
    </div>

  );
};

export default Markdown;
