import { createElement as h, useRef, useState, useEffect } from 'react'
import { MindmapPanel } from './preview.tsx'
import { isMarkdownPath } from './detect.ts'

const EXAMPLE = '---\nmarkmap: true\n---\n\n# Mindmap\n\n## Ý tưởng\n- Ghi chú\n- Công việc\n'
const MAX_BYTES = 2 * 1024 * 1024

/** Native studio uses only user-selected browser files; no host filesystem access. */
export function StandaloneStudio() {
  const [doc, setDoc] = useState({ name: 'mindmap.md', content: EXAMPLE, revision: 0 })
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const input = useRef<HTMLInputElement | null>(null)
  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  const replace = (name: string, content: string) => {
    setDirty(false)
    setError('')
    setDoc(previous => ({ name, content, revision: previous.revision + 1 }))
  }
  const open = async (file: File) => {
    const request = ++generation.current
    try {
      if (!isMarkdownPath(file.name) || file.size > MAX_BYTES) throw new Error('Chọn file Markdown không quá 2 MB.')
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
      if (content.includes('\0')) throw new Error('File không phải Markdown văn bản.')
      if (request === generation.current) replace(file.name, content)
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : String(reason))
    }
  }
  return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 } },
    h('input', { ref: input, type: 'file', accept: '.md,.markdown', hidden: true,
      onChange: (event: { currentTarget: HTMLInputElement }) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (file) void open(file)
      } }),
    h('div', { style: { padding: '4px 9px', fontSize: 12, overflowWrap: 'anywhere' } }, doc.name + ' · Local file' + (dirty ? ' •' : '')),
    error ? h('p', { role: 'alert' }, error) : null,
    h(MindmapPanel, { key: doc.revision, path: doc.name, scope: { sessionId: '' }, content: doc.content,
      onDirtyChange: setDirty,
      onOpenLocal: () => input.current?.click(),
      onNewLocal: () => { generation.current++; replace('mindmap.md', EXAMPLE) },
    }),
  )
}
