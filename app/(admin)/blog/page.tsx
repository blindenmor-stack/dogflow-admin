import { createServiceClient } from '@/lib/supabase/server'
import { FileText, Eye, EyeOff, Plus } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BlogActions } from './blog-actions'

export const dynamic = 'force-dynamic'

const categoryLabels: Record<string, string> = {
  negocio: 'Negocio',
  adestramento: 'Adestramento',
  financas: 'Financas',
  marketing: 'Marketing',
  produto: 'Produto',
}

const categoryBadgeStyle: Record<string, { bg: string; color: string }> = {
  negocio: { bg: '#244C4E', color: '#FFFFFF' },
  adestramento: { bg: '#9EEA6C', color: '#244C4E' },
  financas: { bg: '#E2E7F1', color: '#244C4E' },
  marketing: { bg: '#8BD85E', color: '#244C4E' },
  produto: { bg: '#F6F8FA', color: '#244C4E' },
}

async function getBlogData() {
  const supabase = await createServiceClient()

  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching blog posts:', error)
  }

  const all = posts || []
  const published = all.filter((p) => p.published)
  const drafts = all.filter((p) => !p.published)

  return { posts: all, totalCount: all.length, publishedCount: published.length, draftCount: drafts.length }
}

export default async function BlogPage() {
  const data = await getBlogData()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>
            Blog
          </h1>
          <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
            Gerenciar artigos do blog DogFlow
          </p>
        </div>
        <Link
          href="/blog/new"
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors"
          style={{ backgroundColor: '#9EEA6C', color: '#244C4E' }}
        >
          <Plus className="h-4 w-4" />
          Novo artigo
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          className="flex flex-col gap-2 bg-white p-5"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: '#244C4E' }} />
            <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
              Total artigos
            </span>
          </div>
          <span className="text-[28px] font-bold" style={{ color: '#121217' }}>
            {data.totalCount}
          </span>
        </div>

        <div
          className="flex flex-col gap-2 bg-white p-5"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" style={{ color: '#16A34A' }} />
            <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
              Publicados
            </span>
          </div>
          <span className="text-[28px] font-bold" style={{ color: '#121217' }}>
            {data.publishedCount}
          </span>
        </div>

        <div
          className="flex flex-col gap-2 bg-white p-5"
          style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
        >
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4" style={{ color: '#F59E0B' }} />
            <span className="text-[13px] font-medium" style={{ color: '#8A8AA3' }}>
              Rascunhos
            </span>
          </div>
          <span className="text-[28px] font-bold" style={{ color: '#121217' }}>
            {data.draftCount}
          </span>
        </div>
      </div>

      {/* Table */}
      <div
        className="overflow-hidden bg-white"
        style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: '#F6F8FA' }}>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Titulo
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Categoria
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Status
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Data
              </th>
              <th className="px-4 py-3 text-left text-[12px] font-medium uppercase tracking-wider" style={{ color: '#8A8AA3' }}>
                Acoes
              </th>
            </tr>
          </thead>
          <tbody>
            {data.posts.map((post) => {
              const catStyle = categoryBadgeStyle[post.category] || categoryBadgeStyle.produto

              return (
                <tr
                  key={post.id}
                  className="border-t hover:bg-[#F6F8FA] transition-colors"
                  style={{ borderColor: '#E2E7F1' }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/blog/${post.id}`}
                      className="text-[13px] font-medium hover:underline"
                      style={{ color: '#121217' }}
                    >
                      {post.title}
                    </Link>
                    <p className="text-[11px] mt-0.5" style={{ color: '#8A8AA3' }}>
                      /{post.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: catStyle.bg, color: catStyle.color }}
                    >
                      {categoryLabels[post.category] || post.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={
                        post.published
                          ? { backgroundColor: '#F0FDF4', color: '#16A34A' }
                          : { backgroundColor: '#FFFBEB', color: '#F59E0B' }
                      }
                    >
                      {post.published ? 'Publicado' : 'Rascunho'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px]" style={{ color: '#8A8AA3' }}>
                    {format(new Date(post.created_at), "dd MMM yyyy", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <BlogActions postId={post.id} published={post.published} />
                  </td>
                </tr>
              )
            })}
            {data.posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[13px]" style={{ color: '#8A8AA3' }}>
                  Nenhum artigo criado ainda. Clique em &quot;Novo artigo&quot; para comecar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
