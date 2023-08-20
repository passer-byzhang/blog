import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeReact from 'rehype-react'; // 新增
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import markdownStyles from './markdown-styles.module.css'
import 'katex/dist/katex.min.css'
interface MarkdownProps {
  slug: string;
  content: string;
}

interface LaTeXRendererProps {
    value: string;
  }
  

const PostBody: React.FC<MarkdownProps> = ({ slug,content }) => {
    const renderers = {
        code: ({ language, value }: { language: string; value: string }) => {
          return (
            <SyntaxHighlighter language={language} style={docco}>
              {value}
            </SyntaxHighlighter>
          );
        },
      };
    
  return (
    <div className="flex justify-center">
    <div className={`${markdownStyles.markdown} w-1/2`}>
        <ReactMarkdown 
        remarkPlugins={[remarkMath,remarkGfm]} 
        rehypePlugins={[rehypeKatex]}
        transformImageUri={uri =>
            uri.startsWith("http") ? uri : `${"/images/"}${slug}/${uri}`
          }      
        >
            {content}
        </ReactMarkdown>
    </div>
    </div>
  );
};

export default PostBody;