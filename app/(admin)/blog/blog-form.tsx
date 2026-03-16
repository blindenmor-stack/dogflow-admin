'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { createPost, updatePost, deletePost } from './actions'

interface BlogPostData {
  id?: string
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function BlogForm({ initialData }: { initialData?: BlogPostData }) {
  const router = useRouter()
  const isEdit = !!initialData?.id

  const [title, setTitle] = useState(initialData?.title || '')
  const [slug, setSlug] = useState(initialData?.slug || '')
  const [category, setCategory] = useState(initialData?.category || 'negocio')
  const [excerpt, setExcerpt] = useState(initialData?.excerpt || '')
  const [content, setContent] = useState(initialData?.content || '')
  const [metaDescription, setMetaDescription] = useState(initialData?.meta_description || '')
  const [keywordsStr, setKeywordsStr] = useState(initialData?.keywords?.join(', ') || '')
  const [readTime, setReadTime] = useState(initialData?.read_time || 5)
  const [author, setAuthor] = useState(initialData?.author || 'Equipe DogFlow')
  const [published, setPublished] = useState(initialData?.published || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleTitleChange = (value: string) => {
    setTitle(value)
    if (!isEdit || slug === slugify(initialData?.title || '')) {
      setSlug(slugify(value))
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !slug.trim() || !content.trim()) {
      setError('Titulo, slug e conteudo sao obrigatorios.')
      return
    }

    setSaving(true)
    setError('')

    const formData = {
      slug: slug.trim(),
      title: title.trim(),
      excerpt: excerpt.trim(),
      content: content.trim(),
      category,
      author: author.trim() || 'Equipe DogFlow',
      meta_description: metaDescription.trim(),
      keywords: keywordsStr.split(',').map((k) => k.trim()).filter(Boolean),
      read_time: readTime,
      published,
    }

    const result = isEdit
      ? await updatePost(initialData!.id!, formData)
      : await createPost(formData)

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.push('/blog')
    router.refresh()
  }

  const handleDelete = async () => {
    if (!initialData?.id) return
    if (!confirm('Tem certeza que deseja excluir este artigo?')) return

    const result = await deletePost(initialData.id)
    if (result.error) {
      setError(result.error)
      return
    }

    router.push('/blog')
    router.refresh()
  }

  const inputStyle = {
    borderRadius: '10px',
    border: '1px solid #E2E7F1',
    color: '#121217',
  }

  const labelStyle = { color: '#244C4E' }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/blog"
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F6F8FA] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" style={{ color: '#8A8AA3' }} />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: '#244C4E' }}>
              {isEdit ? 'Editar artigo' : 'Novo artigo'}
            </h1>
            <p className="text-[14px]" style={{ color: '#8A8AA3' }}>
              {isEdit ? 'Altere os campos e salve' : 'Preencha os campos para criar um artigo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEdit && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-[#FEF2F2]"
              style={{ color: '#DC2626', border: '1px solid #FECACA' }}
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#9EEA6C', color: '#244C4E' }}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="p-4 text-[13px] font-medium"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: '12px', border: '1px solid #FECACA' }}
        >
          {error}
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main content */}
        <div className="flex flex-col gap-5">
          <div
            className="flex flex-col gap-5 bg-white p-6"
            style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
          >
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={labelStyle}>
                Titulo
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ex: Como organizar seu negocio de adestramento"
                className="px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#9EEA6C]"
                style={inputStyle}
              />
            </div>

            {/* Slug */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={labelStyle}>
                Slug (URL)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[13px]" style={{ color: '#8A8AA3' }}>/blog/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="como-organizar-negocio-adestramento"
                  className="flex-1 px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#9EEA6C]"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Excerpt */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={labelStyle}>
                Resumo (excerpt)
              </label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Resumo curto do artigo para listagens e SEO"
                rows={2}
                className="px-3 py-2.5 text-[14px] outline-none resize-none focus:ring-2 focus:ring-[#9EEA6C]"
                style={inputStyle}
              />
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium" style={labelStyle}>
                Conteudo (HTML)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="<p>Seu conteudo aqui...</p>"
                rows={20}
                className="px-3 py-2.5 text-[13px] font-mono outline-none resize-y focus:ring-2 focus:ring-[#9EEA6C]"
                style={{ ...inputStyle, minHeight: '400px' }}
              />
              <span className="text-[11px]" style={{ color: '#8A8AA3' }}>
                Suporta HTML. Use tags &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;a&gt; etc.
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5">
          {/* Publish settings */}
          <div
            className="flex flex-col gap-4 bg-white p-5"
            style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
          >
            <h3 className="text-[14px] font-semibold" style={{ color: '#244C4E' }}>
              Publicacao
            </h3>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={labelStyle}>
                Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#9EEA6C] bg-white"
                style={inputStyle}
              >
                <option value="negocio">Negocio</option>
                <option value="adestramento">Adestramento</option>
                <option value="financas">Financas</option>
                <option value="marketing">Marketing</option>
                <option value="produto">Produto</option>
              </select>
            </div>

            {/* Author */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={labelStyle}>
                Autor
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#9EEA6C]"
                style={inputStyle}
              />
            </div>

            {/* Read time */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={labelStyle}>
                Tempo de leitura (min)
              </label>
              <input
                type="number"
                value={readTime}
                onChange={(e) => setReadTime(parseInt(e.target.value) || 5)}
                min={1}
                max={60}
                className="px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#9EEA6C]"
                style={inputStyle}
              />
            </div>

            {/* Published toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className="relative h-6 w-11 rounded-full transition-colors"
                style={{ backgroundColor: published ? '#9EEA6C' : '#E2E7F1' }}
                onClick={() => setPublished(!published)}
              >
                <div
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: published ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </div>
              <span className="text-[13px] font-medium" style={{ color: '#244C4E' }}>
                {published ? 'Publicado' : 'Rascunho'}
              </span>
            </label>
          </div>

          {/* SEO */}
          <div
            className="flex flex-col gap-4 bg-white p-5"
            style={{ borderRadius: '16px', border: '1px solid #E2E7F1' }}
          >
            <h3 className="text-[14px] font-semibold" style={{ color: '#244C4E' }}>
              SEO
            </h3>

            {/* Meta description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={labelStyle}>
                Meta description
              </label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Descricao para mecanismos de busca (max 160 chars)"
                rows={3}
                className="px-3 py-2.5 text-[13px] outline-none resize-none focus:ring-2 focus:ring-[#9EEA6C]"
                style={inputStyle}
              />
              <span className="text-[11px]" style={{ color: '#8A8AA3' }}>
                {metaDescription.length}/160
              </span>
            </div>

            {/* Keywords */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium" style={labelStyle}>
                Keywords (separadas por virgula)
              </label>
              <input
                type="text"
                value={keywordsStr}
                onChange={(e) => setKeywordsStr(e.target.value)}
                placeholder="adestramento, negocio, financas"
                className="px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#9EEA6C]"
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
