type PostType = {
  slug: string;
  title: string;
  date: string;
  description: string;
  content: string;
  tags: string | string[];
};

// 自定义类型谓词函数，判断是否为字符串数组
function isStringArray(tags: string | string[]): tags is string[] {
  return Array.isArray(tags);
}

// 添加一个工具函数，根据 tags 返回数组
export function getTagsArray(tags: string | string[]): string[] {
  if (isStringArray(tags)) {
    return tags;
  } else if (typeof tags === "string") {
    return [tags];
  } else {
    return [];
  }
}

export default PostType;
