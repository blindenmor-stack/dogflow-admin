'use client'

import { useRouter } from 'next/navigation'
import { Pencil, Eye, EyeOff, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { togglePublishPost, deletePost } from './actions'

export function BlogActions({ postId, published }: { postId: string; published: boolean }) {
  const router = useRouter()

  const handleTogglePublish = async () => {
    const result = await togglePublishPost(postId, published)
    if (result.error) {
      alert('Erro ao atualizar status: ' + result.error)
      return
    }
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja excluir este artigo?')) return

    const result = await deletePost(postId)
    if (result.error) {
      alert('Erro ao excluir: ' + result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/blog/${postId}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F6F8FA] transition-colors"
        title="Editar"
      >
        <Pencil className="h-3.5 w-3.5" style={{ color: '#8A8AA3' }} />
      </Link>
      <button
        onClick={handleTogglePublish}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F6F8FA] transition-colors"
        title={published ? 'Despublicar' : 'Publicar'}
      >
        {published ? (
          <EyeOff className="h-3.5 w-3.5" style={{ color: '#F59E0B' }} />
        ) : (
          <Eye className="h-3.5 w-3.5" style={{ color: '#16A34A' }} />
        )}
      </button>
      <button
        onClick={handleDelete}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#FEF2F2] transition-colors"
        title="Excluir"
      >
        <Trash2 className="h-3.5 w-3.5" style={{ color: '#DC2626' }} />
      </button>
    </div>
  )
}
