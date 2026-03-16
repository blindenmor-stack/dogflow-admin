'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function togglePublishPost(postId: string, currentPublished: boolean) {
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('blog_posts')
    .update({ published: !currentPublished, updated_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/blog')
  return { success: true }
}

export async function deletePost(postId: string) {
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', postId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/blog')
  return { success: true }
}

export async function createPost(formData: {
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  author: string
  meta_description: string
  keywords: string[]
  read_time: number
  published: boolean
}) {
  const supabase = await createServiceClient()

  const { data, error } = await supabase
    .from('blog_posts')
    .insert([formData])
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/blog')
  return { success: true, id: data.id }
}

export async function updatePost(
  postId: string,
  formData: {
    slug: string
    title: string
    excerpt: string
    content: string
    category: string
    author: string
    meta_description: string
    keywords: string[]
    read_time: number
    published: boolean
  }
) {
  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('blog_posts')
    .update({ ...formData, updated_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/blog')
  return { success: true }
}
