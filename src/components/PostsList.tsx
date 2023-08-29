import React from 'react';
import Post,{getTagsArray} from '../interfaces/post'
import Link from 'next/link'
import PostPreview from './PostPreview';
interface GroupedArticles {
  year: string;
  month: string;
  articles: Post[];
}

function groupArticlesByMonth(articles: Post[]): GroupedArticles[] {
  const grouped: { [year: string]: { [month: string]: Post[] } } = {};

  for (const article of articles) {
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

  return result.sort(compareGroupedArticles);
}

function compareGroupedArticles(a:GroupedArticles, b:GroupedArticles) {
  if (a.year !== b.year) {
    return Number(b.year) - Number(a.year); // Sort by year in descending order
  } else {
    return Number(b.month) - Number(a.month); // Sort by month in descending order
  }
}
export default function PostsList({ posts }:{posts:Post[]} ): JSX.Element {
  const groupedArticles: GroupedArticles[] = groupArticlesByMonth(posts);

  return (
    <div className="mt-40">
      <div className="flex justify-center">
        <div className="space-y-10">
          {groupedArticles.map(({ year, month, articles }) => (
            <div key={`${year}-${month}`}>
              <h2 className="text-xl mb-4">{`${month} / ${year}`}</h2>
              <ul className="space-y-6">
                {articles.map((article) => (
                  <li key={article.title}>
                    <PostPreview {...article} />
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