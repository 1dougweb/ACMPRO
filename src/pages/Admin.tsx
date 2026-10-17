import { useEffect, useState, type FormEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Users,
  KeyRound,
  UserCheck,
  Clock,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  UploadCloud,
  Download,
  FileCode,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { api } from '../api'
import type { AdminOverview, PluginRelease } from '../api/types'
import { formatBRL } from '../lib/formatMoney'
import { usePageMeta } from '../lib/usePageMeta'

interface AdminOutletContext {
  adminOverview: AdminOverview | null
  adminChecked: boolean
  adminError: string
}

const offerLabels = { pro_monthly: 'Pro mensal', pro_annual: 'Pro anual' }
const orderStatusLabels: Record<string, string> = {
  pending: 'Pendente', paid: 'Pago', canceled: 'Cancelado', expired: 'Expirado', refunded: 'Reembolsado',
}

export default function Admin() {
  usePageMeta('Administração', 'Resumo das contas, pagamentos e atualizações do portal GOACM.')
  const { adminOverview, adminChecked, adminError } = useOutletContext<AdminOutletContext>()

  // Estado do gerenciamento de releases do plugin
  const [releases, setReleases] = useState<PluginRelease[]>([])
  const [releasesLoading, setReleasesLoading] = useState(true)
  const [uploadVersion, setUploadVersion] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadMinSu, setUploadMinSu] = useState('2021')
  const [uploadMandatory, setUploadMandatory] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    let active = true
    api.listPluginReleases()
      .then((data) => {
        if (active) setReleases(data)
      })
      .catch(() => {
        // Silently handle error without exposing in console
      })
      .finally(() => {
        if (active) setReleasesLoading(false)
      })
    return () => { active = false }
  }, [])

  const handlePublishRelease = async (e: FormEvent) => {
    e.preventDefault()
    if (!uploadVersion.trim()) {
      setUploadError('Informe a versão do plugin (ex: 1.1.39).')
      return
    }
    if (!selectedFile) {
      setUploadError('Selecione o arquivo da extensão (.rbz).')
      return
    }

    setUploading(true)
    setUploadError('')
    setUploadSuccess('')

    try {
      const res = await api.uploadPluginRelease({
        version: uploadVersion.trim(),
        notes: uploadNotes.trim(),
        file: selectedFile,
        minSketchupVersion: uploadMinSu,
        isMandatory: uploadMandatory,
      })

      setUploadSuccess(`Versão v${res.release.version} publicada com sucesso! O SketchUp agora receberá este update.`)
      setUploadVersion('')
      setUploadNotes('')
      setSelectedFile(null)
      // Atualiza lista
      const list = await api.listPluginReleases()
      setReleases(list)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao fazer upload da versão.'
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  if (!adminChecked) return <div className="splash"><div className="spinner" /></div>
  if (!adminOverview) {
    return (
      <section className="card admin-denied" role="alert">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldAlert size={26} style={{ color: 'var(--danger)' }} />
          Acesso administrativo indisponível
        </h1>
        <p className="muted">{adminError || 'Esta conta não está autorizada a acessar a administração.'}</p>
      </section>
    )
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <p className="label">Portal GOACM</p>
          <h1 className="page-title">Administração</h1>
          <p className="muted">Resumo das contas, pagamentos e atualizações do plugin.</p>
        </div>
        <span className="badge active">
          <ShieldCheck size={13} /> Acesso autorizado
        </span>
      </div>

      <section className="admin-stats" aria-label="Resumo do portal">
        <article className="card">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Users size={12} /> Contas
          </span>
          <strong>{adminOverview.accountCount}</strong>
        </article>
        <article className="card">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <KeyRound size={12} /> Licenças ativas
          </span>
          <strong>{adminOverview.activeLicenseCount}</strong>
        </article>
        <article className="card">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <UserCheck size={12} /> Pessoas ativas
          </span>
          <strong>{adminOverview.activeMemberCount}</strong>
        </article>
        <article className="card">
          <span className="label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={12} /> Pedidos pendentes
          </span>
          <strong>{adminOverview.pendingOrderCount}</strong>
        </article>
      </section>

      {/* SEÇÃO: ATUALIZAÇÕES DO PLUGIN (SKETCHUP) */}
      <section className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UploadCloud size={20} style={{ color: 'var(--brand)' }} />
              Distribuição e Updates do Plugin (SketchUp)
            </h2>
            <p className="muted">
              Faça upload do arquivo <code>.rbz</code> compilado. Quando os usuários abrirem o SketchUp, receberão o alerta de atualização automática.
            </p>
          </div>
          {releases[0] && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', borderRadius: 8, fontSize: 13 }}>
              <Sparkles size={14} style={{ color: 'var(--brand-dark)' }} />
              <span>Versão ativa: <strong>v{releases[0].version}</strong></span>
            </div>
          )}
        </div>

        {uploadSuccess && (
          <div className="success" style={{ marginBottom: 16 }}>
            <CheckCircle2 size={16} /> {uploadSuccess}
          </div>
        )}
        {uploadError && (
          <div className="alert" style={{ marginBottom: 16 }}>
            <AlertCircle size={16} /> {uploadError}
          </div>
        )}

        <form onSubmit={handlePublishRelease} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, background: 'var(--bg)', padding: 18, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 24 }}>
          <div>
            <label className="field" htmlFor="rel-ver">Número da Versão</label>
            <input
              id="rel-ver"
              type="text"
              placeholder="ex: 1.1.39"
              value={uploadVersion}
              onChange={(e) => setUploadVersion(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="field" htmlFor="rel-min-su">SketchUp Mínimo</label>
            <input
              id="rel-min-su"
              type="text"
              placeholder="2021"
              value={uploadMinSu}
              onChange={(e) => setUploadMinSu(e.target.value)}
            />
          </div>

          <div>
            <label className="field" htmlFor="rel-file">Arquivo da Extensão (.rbz)</label>
            <input
              id="rel-file"
              type="file"
              accept=".rbz,.zip"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="field" htmlFor="rel-notes">Novidades / Changelog da Versão</label>
            <textarea
              id="rel-notes"
              rows={2}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', font: 'inherit', resize: 'vertical' }}
              placeholder="Descreva o que mudou (ex: Novas cores do tema oficial, correções no plano de corte...)"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
            />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={uploadMandatory}
                onChange={(e) => setUploadMandatory(e.target.checked)}
              />
              Atualização obrigatória (avisa com prioridade máxima)
            </label>

            <button
              type="submit"
              className="btn primary"
              disabled={uploading}
              style={{ padding: '10px 22px' }}
            >
              {uploading ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Enviando extensão...
                </>
              ) : (
                <>
                  <UploadCloud size={16} /> Publicar Update para o SketchUp
                </>
              )}
            </button>
          </div>
        </form>

        {/* Histórico de versões */}
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Histórico de Lançamentos</h3>
          {releasesLoading ? (
            <p className="muted">Carregando versões disponíveis...</p>
          ) : releases.length === 0 ? (
            <p className="empty">Nenhum update publicado ainda.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Versão</th>
                    <th>Arquivo</th>
                    <th>Notas</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((rel) => (
                    <tr key={rel.id}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                          <FileCode size={15} style={{ color: 'var(--brand)' }} />
                          v{rel.version}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: 12 }}>{rel.file_name || `GOACM-${rel.version}.rbz`}</code>
                        {rel.file_size_bytes ? (
                          <small style={{ color: 'var(--muted)', display: 'block' }}>
                            {(rel.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                          </small>
                        ) : null}
                      </td>
                      <td style={{ maxWidth: 300 }}>
                        <span style={{ fontSize: 12, color: 'var(--text)' }}>
                          {rel.notes || '—'}
                        </span>
                      </td>
                      <td>{new Date(rel.created_at).toLocaleDateString('pt-BR')}</td>
                      <td style={{ textAlign: 'right' }}>
                        <a
                          href={rel.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                        >
                          <Download size={13} /> Baixar .rbz
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* GUIA DA ASSINATURA DIGITAL TRIMBLE */}
        <div style={{ marginTop: 24, padding: 18, background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', borderRadius: 10 }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, color: 'var(--brand-dark)', fontSize: 14 }}>
            <ShieldCheck size={18} />
            Como resolver o aviso &quot;Não assinado&quot; no SketchUp
          </h4>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#1e293b', margin: '8px 0 10px' }}>
            O aviso <strong>&quot;⚠️ Não assinado&quot;</strong> aparece porque o SketchUp valida se o arquivo <code>.rbz</code> passou pelo portal oficial de assinatura digital da Trimble.
          </p>
          <ol style={{ fontSize: 13, lineHeight: 1.6, color: '#334155', paddingLeft: 20, margin: '0 0 10px' }}>
            <li>
              Acesse o portal gratuito de desenvolvedores da Trimble:{' '}
              <a
                href="https://extensions.sketchup.com/developer_center"
                target="_blank"
                rel="noreferrer"
                style={{ fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 3 }}
              >
                Trimble Extension Warehouse Developer Center <ExternalLink size={12} />
              </a>
            </li>
            <li>
              Faça login com sua conta Trimble (Trimble ID gratuita).
            </li>
            <li>
              No menu do desenvolvedor, clique em <strong>&quot;Sign Extension&quot;</strong> (ou &quot;Assinar Extensão&quot;).
            </li>
            <li>
              Faça upload do arquivo <code>.rbz</code> gerado (ex: <code>GOACM-1.1.38-test.rbz</code>). O robô da Trimble assina os arquivos instantaneamente (em ~15 segundos).
            </li>
            <li>
              Baixe o arquivo assinado da Trimble e faça o upload dele aqui acima. Assim, todos os usuários verão o selo verde <strong>&quot;✓ Assinado&quot;</strong> no Gerenciador de Extensões!
            </li>
          </ol>
          <div style={{ fontSize: 12, color: 'var(--muted)', background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
            💡 <strong>Configuração no SketchUp:</strong> Em <em>Janela &gt; Gerenciador de Extensões &gt; Engrenagem de Configurações</em>, certifique-se de que a <strong>Política de Carregamento</strong> esteja marcada como <em>&quot;Não restrito&quot;</em>. Isso permite que qualquer versão do GOACM funcione sem bloqueios de segurança.
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-row">
          <div>
            <h2>Contas recentes</h2>
            <p className="muted">Titular e data de criação.</p>
          </div>
        </div>
        {adminOverview.recentAccounts.length === 0 ? (
          <p className="empty">Ainda não há contas cadastradas.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Conta</th>
                  <th>E-mail do titular</th>
                  <th>Criada em</th>
                </tr>
              </thead>
              <tbody>
                {adminOverview.recentAccounts.map((account) => (
                  <tr key={account.id}>
                    <td><strong>{account.name || 'Conta GOACM'}</strong></td>
                    <td>{account.email ?? 'Não disponível'}</td>
                    <td>{new Date(account.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div>
          <h2>Pedidos recentes</h2>
          <p className="muted">O acesso à licença é liberado pelo webhook confirmado do Mercado Pago.</p>
        </div>
        {adminOverview.recentOrders.length === 0 ? (
          <p className="empty">Ainda não há pedidos.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {adminOverview.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <CreditCard size={13} style={{ color: 'var(--brand)' }} />
                        {offerLabels[order.offerKey]}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${order.status === 'paid' ? 'active' : order.status === 'pending' ? 'pending' : 'expired'}`}>
                        {orderStatusLabels[order.status] ?? order.status}
                      </span>
                    </td>
                    <td><strong>{formatBRL(order.amountCents)}</strong></td>
                    <td>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

