import React from 'react';
import Post from '../interfaces/post'
import Link from 'next/link'

interface GroupedArticles {
  year: string;
  month: string;
  articles: Post[];
}

function groupArticlesByMonth(articles: Post[]): GroupedArticles[] {
  const grouped: { [year: string]: { [month: string]: Post[] } } = {};

  for (const article of articles) {
    console.log("date: "+ article.date);
    const [year, month] = article.date.split('-');
    if (!grouped[year]) {
      grouped[year] = {};
    }
    if (!grouped[year][month]) {
      grouped[year][month] = [];
    }
    grouped[year][month].push(article);
  }

  const result: GroupedArticles[] = [];
  for (const year in grouped) {
    for (const month in grouped[year]) {
      result.push({
        year,
        month,
        articles: grouped[year][month],
      });
    }
  }

  return result;
}

export default function PostsList({ posts }:{posts:Post[]} ): JSX.Element {
  const groupedArticles: GroupedArticles[] = groupArticlesByMonth(posts);

  return (
    <div className="mt-40">
      <div className="flex justify-center">
        <div className="space-y-10">
          {groupedArticles.map(({ year, month, articles }) => (
            <div key={`${year}-${month}`}>
              <h2 className="text-xl font-bold mb-4">{`${month} / ${year}`}</h2>
              <ul className="space-y-4">
                {articles.map((article) => (
                  <li key={article.title}>
                    <Link as={`/posts/${article.slug}`} href="/posts/[slug]" className="text-xxl font-semibold hover:underline">{article.title}</Link>
                    <p className="font-semibold mt-2">{article.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}