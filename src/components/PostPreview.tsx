import Post, { getTagsArray } from "../interfaces/post";
import Link from "next/link";

export default function PostPreview(article: Post) {
  return (
    <>
      <Link
        href={`/posts/${article.slug}`}
        className="text-xl font-semibold hover:underline font-mono"
      >
        {article.title}
      </Link>
      <div className="text-sm font-medium mt-1 font-mono">
        {article.description}
      </div>
      <div className="flex items-center  mt-2">
        <span className="text-xs font-medium font-mono mr-3">Tags: </span>

        {getTagsArray(article.tags).map((tag) => (
          <span
            key={`tag-${tag}`}
            className="text-xs font-medium mr-2 font-mono"
          >
            {tag}
          </span>
        ))}
      </div>
    </>
  );
}
