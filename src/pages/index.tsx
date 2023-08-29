import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import Alvan from '../components/Alvan'
import PostsList from '../components/PostsList'
import Layout from '../components/Layout'
const inter = Inter({ subsets: ['latin'] })
import { getAllPosts } from '../lib/api'
import Post from '../interfaces/post'


type Props = {
  allPosts: Post[]
  //allPosts: string[]
}

export default function Index({ allPosts }: Props) {
  const Posts = allPosts.slice(0)
  return (
    <>
      <Layout>
        <Alvan/>
        <PostsList posts={Posts}/>
      </Layout>
    </>
  )
}

export const getStaticProps = async () => {
  const allPosts = getAllPosts([
    'title',
    'date',
    'slug',
    'description',
    'content',
    'tags'
  ])  
  return {
    props: {allPosts: JSON.parse(JSON.stringify(allPosts)) },
  }
}