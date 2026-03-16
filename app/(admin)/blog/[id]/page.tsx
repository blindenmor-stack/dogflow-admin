import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { BlogForm } from '../blog-form'

export const dynamic = 'force-dynamic'

interface EditBlogPostPageProps {
  params: Promise<{ id: string }>
}

export default async function EditBlogPostPage({ params }: EditBlogPostPageProps) {
  const { id } = await params
  const supabase = await createServiceClient()

  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !post) {
    notFound()
  }

  return (
    <BlogForm
      initialData={{
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt || '',
        content: post.content,
        category: post.category,
        author: post.author || 'Equipe DogFlow',
        meta_description: post.meta_description || '',
        keywords: post.keywords || [],
        read_time: post.read_time || 5,
        published: post.published || false,
      }}
    />
  )
}
