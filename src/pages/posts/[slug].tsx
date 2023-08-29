import Post from '../../interfaces/post'
import PostBody from '@/components/PostBody'
import PostHead from '@/components/PostHead'
import { useRouter } from 'next/router'
import { getPostBySlug, getAllPosts } from '../../lib/api'
import { useEffect,useState } from 'react'
import Layout from '../../components/Layout'

export default function Artical({post}:{post:Post}){

    return (
      <Layout>
            <div className="flex flex-col items-center">
                <PostHead title={post.title}/>
                    <PostBody slug={post.slug} content={post.content} />
            </div>
      </Layout>

    ) 
}

type Params = {
    params: {
      slug: string
    }
  }
  

export async function getStaticProps({ params }: Params) {
    const post = JSON.parse(JSON.stringify(getPostBySlug(params.slug, [
      'title',
      'date',
      'slug',
      'description',
      'content'
    ])))
    //const content = await markdownToHtml(post.content || '')
    return {
      props: {
        post,
      },
    }
  }
  
  export async function getStaticPaths() {
    const posts = getAllPosts(['slug'])
  
    return {
      paths: posts.map((post) => {
        return {
          params: {
            slug: post.slug,
          },
        }
      }),
      fallback: false,
    }
  }