




import React from 'react';

interface PostHeadProps {
  title: string;
}

export default function PostHead({title}:PostHeadProps){

    return (
        <h1 className="text-3xl font-bold mb-4 mt-8">
          {title}
        </h1>
      );


} 
