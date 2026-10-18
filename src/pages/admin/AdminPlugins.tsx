import { useEffect, useState, type FormEvent } from 'react'
import {
  Package,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  FileCode,
} from 'lucide-react'
import { api } from '../../api'
import type { PluginRelease } from '../../api/types'
import { usePageMeta } from '../../lib/usePageMeta'

export default function AdminPlugins() {
  usePageMeta('Admin • Releases do Plugin', 'Upload e distribuição de atualizações do GOACM.')
  const [releases, setReleases] = useState<PluginRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadVersion, setUploadVersion] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadMinSu, setUploadMinSu] = useState('2021')
  const [uploadMandatory, setUploadMandatory] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const loadReleases = async () => {
    setLoading(true)
    try {
      const data = await api.listPluginReleases()
      setReleases(data)
    } catch {
      // Silently handle error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReleases()
  }, [])

  const handlePublishRelease = async (e: FormEvent) => {
    e.preventDefault()
    if (!uploadVersion.trim()) {
      setError('Informe o número da versão (ex: 1.1.46).')
      return
    }
    if (!selectedFile) {
      setError('Selecione o arquivo da extensão (.rbz).')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const res = await api.uploadPluginRelease({
        version: uploadVersion.trim(),
        notes: uploadNotes.trim(),
        file: selectedFile,
        minSketchupVersion: uploadMinSu,
        isMandatory: uploadMandatory,
      })

      setSuccess(`Versão v${res.release.version} publicada com sucesso! Os usuários receberão esta atualização no SketchUp.`)
      setUploadVersion('')
      setUploadNotes('')
      setSelectedFile(null)
      await loadReleases()
    } catch (err: unknown) {
      setError((err as Error).message || 'Falha ao fazer upload da versão.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Distribuição & Updates do Plugin SketchUp</h1>
          <p>Faça upload de novas versões compiladas (.rbz). O SketchUp notificará e atualizará os usuários automaticamente.</p>
        </div>
        {releases[0] && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', borderRadius: 8, fontSize: 13, color: 'var(--brand-dark)', fontWeight: 500 }}>
            <Sparkles size={16} />
            <span>Versão ativa no SketchUp: <strong>v{releases[0].version}</strong></span>
          </div>
        )}
      </div>

      {success && (
        <div className="admin-card" style={{ background: 'var(--brand-surface)', borderColor: 'var(--brand-border)', padding: 16 }}>
          <p style={{ color: 'var(--brand-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
            <CheckCircle2 size={18} /> {success}
          </p>
        </div>
      )}

      {error && (
        <div className="admin-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', padding: 16 }}>
          <p style={{ color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} /> {error}
          </p>
        </div>
      )}

      {/* Formulário de Upload */}
      <div className="admin-card">
        <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UploadCloud size={18} style={{ color: '#10b981' }} /> Publicar Nova Versão (.rbz)
        </h2>

        <form onSubmit={handlePublishRelease} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <div className="admin-form-group">
            <label htmlFor="plugin-version">Número da Versão</label>
            <input
              id="plugin-version"
              type="text"
              placeholder="ex: 1.1.46"
              value={uploadVersion}
              onChange={(e) => setUploadVersion(e.target.value)}
              required
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="plugin-minsu">SketchUp Mínimo</label>
            <input
              id="plugin-minsu"
              type="text"
              placeholder="2021"
              value={uploadMinSu}
              onChange={(e) => setUploadMinSu(e.target.value)}
            />
          </div>

          <div className="admin-form-group">
            <label htmlFor="plugin-file">Arquivo (.rbz / .zip)</label>
            <input
              id="plugin-file"
              type="file"
              accept=".rbz,.zip"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>

          <div className="admin-form-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="plugin-notes">Changelog / O que há de novo</label>
            <textarea
              id="plugin-notes"
              rows={2}
              placeholder="Descreva as melhorias ou correções desta versão…"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
              <input
                type="checkbox"
                checked={uploadMandatory}
                onChange={(e) => setUploadMandatory(e.target.checked)}
              />
              Atualização obrigatória (forçar SketchUp a exigir o update)
            </label>

            <button type="submit" className="admin-btn primary" disabled={uploading}>
              <UploadCloud size={16} /> {uploading ? 'Enviando arquivo…' : 'Publicar Versão'}
            </button>
          </div>
        </form>
      </div>

      {/* Histórico de Releases */}
      <div className="admin-card">
        <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={18} style={{ color: '#0284c7' }} /> Histórico de Releases Disponíveis
        </h2>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#10b981' }}>
            <Loader2 size={24} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>Carregando releases…</p>
          </div>
        ) : !releases.length ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Nenhum release registrado no banco de dados.</p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Versão</th>
                  <th>Arquivo</th>
                  <th>Tamanho</th>
                  <th>SketchUp Mín.</th>
                  <th>Changelog</th>
                  <th>Publicação</th>
                  <th style={{ textAlign: 'right' }}>Download</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((rel, idx) => (
                  <tr key={rel.id || idx}>
                    <td>
                      <strong style={{ color: idx === 0 ? 'var(--brand-dark)' : 'var(--text)' }}>
                        v{rel.version}
                      </strong>
                      {idx === 0 && (
                        <span className="admin-badge active" style={{ marginLeft: 6, fontSize: 10 }}>Atual</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      <FileCode size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
                      {rel.file_name || `ACMGO-v${rel.version}.rbz`}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      {rel.file_size_bytes ? `${(rel.file_size_bytes / (1024 * 1024)).toFixed(2)} MB` : '—'}
                    </td>
                    <td>{rel.min_sketchup_version || '2021'}+</td>
                    <td style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }} title={rel.notes}>
                      {rel.notes || '—'}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(rel.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <a
                        href={rel.file_url}
                        download={rel.file_name || `ACMGO-v${rel.version}.rbz`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="admin-btn"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        <Download size={13} /> Baixar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
