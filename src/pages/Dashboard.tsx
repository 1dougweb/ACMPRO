import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  FolderKanban,
  FileEdit,
  Hammer,
  CheckCircle2,
  LayoutGrid,
  List,
  DollarSign,
  Search,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  Info,
  X,
  BookOpen,
  Building2,
  Calendar,
  Layers,
  Box,
  RotateCw,
  Sparkles,
  Eye,
  Check,
} from 'lucide-react'
import { api, type Project, type ProjectDetails, type ProjectStatus } from '../api'
import { usePageMeta } from '../lib/usePageMeta'

type FilterKey = 'todos' | 'rascunho' | 'em_producao' | 'concluido'
type SortKey = 'recent' | 'oldest' | 'name_asc' | 'customer_asc'
type ViewMode = 'grid' | 'table' | 'values'

const statusLabels: Record<ProjectStatus, string> = {
  rascunho: 'Em projeto',
  em_producao: 'Em produção',
  concluido: 'Concluído',
}

const statusBadgeClass: Record<ProjectStatus, string> = {
  rascunho: 'pending',
  em_producao: 'active',
  concluido: 'active',
}

export default function Dashboard() {
  usePageMeta('Projetos', 'Acompanhe seus projetos GOACM.')

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [filter, setFilter] = useState<FilterKey>('todos')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortOpen, setSortOpen] = useState(false)

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTab, setNewTab] = useState<'create' | 'sketchup'>('create')
  const [newName, setNewName] = useState('')
  const [newCustomer, setNewCustomer] = useState('')
  const [creating, setCreating] = useState(false)

  // Details Modal
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [details, setDetails] = useState<ProjectDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)

  const loadProjects = useCallback(async () => {
    try {
      setError('')
      const list = await api.listProjects()
      setProjects(list)
    } catch (err) {
      setError((err as Error).message || 'Não foi possível carregar os projetos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  // Fecha dropdown de sort ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Atalho Ctrl+K para buscar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Carrega detalhes ao selecionar projeto
  useEffect(() => {
    if (!selectedProjectId) {
      setDetails(null)
      return
    }
    let active = true
    setLoadingDetails(true)
    void api.getProjectDetails(selectedProjectId)
      .then((res) => { if (active) setDetails(res) })
      .catch((err) => {
        if (active) {
          const fallback = projects.find((p) => p.id === selectedProjectId)
          if (fallback) {
            setDetails({ project: fallback, publications: [], parts: [] })
          } else {
            setError((err as Error).message)
          }
        }
      })
      .finally(() => { if (active) setLoadingDetails(false) })
    return () => { active = false }
  }, [selectedProjectId, projects])

  // Contadores para os stat cards
  const stats = useMemo(() => {
    const total = projects.length
    const rascunho = projects.filter((p) => p.status === 'rascunho').length
    const producao = projects.filter((p) => p.status === 'em_producao').length
    const concluido = projects.filter((p) => p.status === 'concluido').length
    return { total, rascunho, producao, concluido }
  }, [projects])

  // Filtra e ordena projetos
  const visibleProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      const matchFilter = filter === 'todos' || p.status === filter
      const query = search.trim().toLowerCase()
      const matchSearch = !query
        || p.name.toLowerCase().includes(query)
        || (p.customerName || '').toLowerCase().includes(query)
      return matchFilter && matchSearch
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name)
      if (sortBy === 'customer_asc') return (a.customerName || '').localeCompare(b.customerName || '')
      return 0
    })
  }, [projects, filter, search, sortBy])

  // Criar novo projeto
  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    setError('')
    setNotice('')
    try {
      const created = await api.createProject(newName.trim(), newCustomer.trim())
      setProjects((prev) => [created, ...prev])
      setShowNewModal(false)
      setNewName('')
      setNewCustomer('')
      setNotice(`Projeto “${created.name}” criado com sucesso!`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  // Alterar status do projeto
  const handleStatusChange = async (projectId: string, newStatus: ProjectStatus) => {
    setUpdatingStatus(true)
    try {
      const updated = await api.updateProjectStatus(projectId, newStatus)
      setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)))
      if (details) {
        setDetails({ ...details, project: updated })
      }
      setNotice(`Status do projeto alterado para ${statusLabels[newStatus]}.`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUpdatingStatus(false)
    }
  }

  const sortLabels: Record<SortKey, string> = {
    recent: 'Mais recentes',
    oldest: 'Mais antigos',
    name_asc: 'Nome (A-Z)',
    customer_asc: 'Cliente (A-Z)',
  }

  return (
    <div className="projects-page">
      <div className="projects-breadcrumb">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <FolderKanban size={13} style={{ color: 'var(--brand)' }} />
          Workspace
        </span>
        <ChevronRight size={13} aria-hidden="true" />
        <strong>Projetos</strong>
      </div>

      <div className="projects-heading">
        <div>
          <p className="label">Visão geral</p>
          <h1 className="projects-title">Projetos<span>.</span></h1>
          <p className="muted">Gerencie, acompanhe o status e publique modelos do SketchUp.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => { setNewTab('sketchup'); setShowNewModal(true) }}>
            <Sparkles size={15} style={{ color: 'var(--brand)' }} /> Publicar do SketchUp
          </button>
          <button className="btn primary project-create" onClick={() => { setNewTab('create'); setShowNewModal(true) }}>
            <Plus size={16} aria-hidden="true" /> Novo projeto
          </button>
        </div>
      </div>

      {notice && (
        <div className="success" role="status" style={{ marginBottom: 12 }}>
          <CheckCircle2 size={16} />
          <span>{notice}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }} onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          <Info size={16} />
          <span>{error}</span>
          <button style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', color: 'inherit' }} onClick={() => setError('')}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Cards de Resumo / Filtros Rápidos */}
      <section className="project-stat-grid" aria-label="Resumo de projetos">
        <button
          type="button"
          className={`project-stat ${filter === 'todos' ? 'project-stat-selected' : ''}`}
          onClick={() => setFilter('todos')}
        >
          <span>Total de projetos</span>
          <strong>{stats.total < 10 ? `0${stats.total}` : stats.total}</strong>
          <small>Todos os registros</small>
          <span className="project-stat-icon" aria-hidden="true">
            <FolderKanban size={22} />
          </span>
        </button>

        <button
          type="button"
          className={`project-stat ${filter === 'rascunho' ? 'project-stat-selected' : ''}`}
          onClick={() => setFilter('rascunho')}
        >
          <span>Em projeto</span>
          <strong>{stats.rascunho < 10 ? `0${stats.rascunho}` : stats.rascunho}</strong>
          <small>Em planejamento</small>
          <span className="project-stat-icon" aria-hidden="true">
            <FileEdit size={22} />
          </span>
        </button>

        <button
          type="button"
          className={`project-stat ${filter === 'em_producao' ? 'project-stat-selected' : ''}`}
          onClick={() => setFilter('em_producao')}
        >
          <span>Em produção</span>
          <strong>{stats.producao < 10 ? `0${stats.producao}` : stats.producao}</strong>
          <small>Execução e usinagem</small>
          <span className="project-stat-icon" aria-hidden="true">
            <Hammer size={22} />
          </span>
        </button>

        <button
          type="button"
          className={`project-stat ${filter === 'concluido' ? 'project-stat-selected' : ''}`}
          onClick={() => setFilter('concluido')}
        >
          <span>Concluídos</span>
          <strong>{stats.concluido < 10 ? `0${stats.concluido}` : stats.concluido}</strong>
          <small>Projetos finalizados</small>
          <span className="project-stat-icon" aria-hidden="true">
            <CheckCircle2 size={22} />
          </span>
        </button>
      </section>

      {/* Navegador de Projetos */}
      <section className="project-browser card">
        <div className="project-browser-heading">
          <h2>
            Seus projetos
            <span className="count-pill">{visibleProjects.length}</span>
            {loading && <RotateCw size={14} className="spin-icon" style={{ marginLeft: 8, color: 'var(--brand)' }} />}
          </h2>
          <div className="project-view-switch" aria-label="Modo de visualização">
            <button
              aria-label="Grade"
              className={viewMode === 'grid' ? 'selected' : ''}
              onClick={() => setViewMode('grid')}
              title="Visualização em grade"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              aria-label="Lista"
              className={viewMode === 'table' ? 'selected' : ''}
              onClick={() => setViewMode('table')}
              title="Visualização em tabela"
            >
              <List size={15} />
            </button>
            <button
              aria-label="Valores e métricas"
              className={viewMode === 'values' ? 'selected' : ''}
              onClick={() => setViewMode('values')}
              title="Visão de métricas e quantitativos"
            >
              <DollarSign size={15} />
            </button>
          </div>
        </div>

        <div className="project-toolbar">
          <label className="project-search">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por projeto ou cliente…"
              aria-label="Buscar projeto ou cliente"
            />
            {search ? (
              <button
                type="button"
                className="project-search-clear"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
              >
                <X size={13} />
              </button>
            ) : (
              <kbd>Ctrl K</kbd>
            )}
          </label>

          <div className="project-filters" role="group" aria-label="Filtrar projetos">
            <button className={filter === 'todos' ? 'selected' : ''} onClick={() => setFilter('todos')}>
              Todos ({stats.total})
            </button>
            <button className={filter === 'rascunho' ? 'selected' : ''} onClick={() => setFilter('rascunho')}>
              Em projeto ({stats.rascunho})
            </button>
            <button className={filter === 'em_producao' ? 'selected' : ''} onClick={() => setFilter('em_producao')}>
              Em produção ({stats.producao})
            </button>
            <button className={filter === 'concluido' ? 'selected' : ''} onClick={() => setFilter('concluido')}>
              Concluídos ({stats.concluido})
            </button>
          </div>

          <div className="project-sort-wrapper" ref={sortRef}>
            <button
              type="button"
              className="project-sort"
              onClick={() => setSortOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
            >
              <span>{sortLabels[sortBy]}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {sortOpen && (
              <div className="project-sort-menu" role="listbox">
                {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={sortBy === key}
                    className={sortBy === key ? 'active' : ''}
                    onClick={() => {
                      setSortBy(key)
                      setSortOpen(false)
                    }}
                  >
                    <span>{sortLabels[key]}</span>
                    {sortBy === key && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conteúdo: Estado Vazio ou Visualizações */}
        {visibleProjects.length === 0 ? (
          <div className="project-empty">
            <div className="project-empty-icon" aria-hidden="true">
              <FolderOpen size={48} strokeWidth={1.5} />
            </div>
            <h3>{search ? 'Nenhum resultado encontrado' : filter !== 'todos' ? 'Nenhum projeto neste status' : 'Nenhum projeto ainda'}</h3>
            <p>
              {search
                ? 'Tente buscar com outros termos ou limpe o campo de busca.'
                : 'Crie seu primeiro projeto no portal ou publique direto pelo plugin GOACM no SketchUp.'}
            </p>
            <div>
              <button className="btn primary" onClick={() => { setNewTab('create'); setShowNewModal(true) }}>
                <Plus size={15} /> Criar projeto agora
              </button>
              <button className="btn" onClick={() => { setNewTab('sketchup'); setShowNewModal(true) }}>
                <Info size={15} /> Como publicar do SketchUp
              </button>
              <Link className="btn" to="/app/training">
                <BookOpen size={15} /> Ver treinamentos
              </Link>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* MODO GRADE */
          <div className="project-grid">
            {visibleProjects.map((project) => (
              <article
                key={project.id}
                className="project-card-item"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <div className="project-card-header">
                  <div>
                    <h3 className="project-card-title">
                      <Box size={16} style={{ color: 'var(--brand)' }} />
                      {project.name}
                    </h3>
                    <p className="project-card-customer">
                      <Building2 size={12} />
                      {project.customerName || 'Cliente não informado'}
                    </p>
                  </div>
                  <span className={`badge ${statusBadgeClass[project.status]}`}>
                    {statusLabels[project.status]}
                  </span>
                </div>

                <div className="project-card-meta">
                  <span>
                    <Calendar size={12} />
                    {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                  <span>
                    <Layers size={12} />
                    {project.lastPublicationAt ? 'Sincronizado' : 'Manual'}
                  </span>
                </div>

                <div className="project-card-footer">
                  <span className="muted" style={{ fontSize: 11 }}>
                    {project.lastPublicationAt
                      ? `Publ.: ${new Date(project.lastPublicationAt).toLocaleDateString('pt-BR')}`
                      : 'Sem publicação CAD'}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--brand-dark)', fontWeight: 600 }}>
                    Detalhes <ChevronRight size={13} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : viewMode === 'table' ? (
          /* MODO TABELA */
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Última sincronização</th>
                  <th className="right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((project) => (
                  <tr
                    key={project.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600 }}>
                        <Box size={14} style={{ color: 'var(--brand)' }} />
                        {project.name}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}>
                        <Building2 size={13} />
                        {project.customerName || '—'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass[project.status]}`}>
                        {statusLabels[project.status]}
                      </span>
                    </td>
                    <td>{new Date(project.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {project.lastPublicationAt ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--brand-dark)' }}>
                          <CheckCircle2 size={13} />
                          {new Date(project.lastPublicationAt).toLocaleDateString('pt-BR')}
                        </span>
                      ) : (
                        <span className="muted">Não publicado</span>
                      )}
                    </td>
                    <td className="right">
                      <button
                        type="button"
                        className="btn sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProjectId(project.id)
                        }}
                      >
                        <Eye size={12} /> Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* MODO VALORES / MÉTRICAS */
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Cliente</th>
                  <th>Status Executivo</th>
                  <th>Origem</th>
                  <th>Atualizado em</th>
                  <th className="right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((project) => (
                  <tr
                    key={project.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <td>
                      <strong>{project.name}</strong>
                    </td>
                    <td>{project.customerName || '—'}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass[project.status]}`}>
                        {statusLabels[project.status]}
                      </span>
                    </td>
                    <td>
                      {project.lastPublicationAt ? (
                        <span style={{ color: 'var(--brand-dark)', fontWeight: 600 }}>Plugin SketchUp 3D</span>
                      ) : (
                        <span className="muted">Portal Direto</span>
                      )}
                    </td>
                    <td>{new Date(project.updatedAt || project.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="right">
                      <button
                        type="button"
                        className="btn sm primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProjectId(project.id)
                        }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="project-browser-footer">
          <span>{visibleProjects.length ? `${visibleProjects.length} projeto(s) listado(s)` : 'Nenhum projeto'}</span>
          <span>Clique em um projeto para ver publicações do SketchUp, peças e alterar status</span>
        </div>
      </section>

      {/* MODAL DE NOVO PROJETO / GUIA SKETCHUP */}
      {showNewModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowNewModal(false) }}
        >
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="modal-new-title">
            <button className="modal-close" aria-label="Fechar" onClick={() => setShowNewModal(false)}>
              <X size={16} />
            </button>

            <div className="profile-modal-heading" style={{ marginBottom: 16 }}>
              <span className="profile-alert-icon" aria-hidden="true">
                <FolderPlus size={15} />
              </span>
              <div>
                <h2 id="modal-new-title">Novo Projeto</h2>
                <p className="muted">Cadastre um projeto para sua equipe ou acompanhe a sincronização do SketchUp.</p>
              </div>
            </div>

            <div className="modal-tabs">
              <button
                type="button"
                className={`modal-tab-btn ${newTab === 'create' ? 'active' : ''}`}
                onClick={() => setNewTab('create')}
              >
                <Plus size={14} /> Cadastrar no Portal
              </button>
              <button
                type="button"
                className={`modal-tab-btn ${newTab === 'sketchup' ? 'active' : ''}`}
                onClick={() => setNewTab('sketchup')}
              >
                <Sparkles size={14} /> Publicar do SketchUp
              </button>
            </div>

            {newTab === 'create' ? (
              <form onSubmit={handleCreateProject}>
                <label className="field">
                  Nome do Projeto
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex.: Fachada Comercial Alpha"
                    required
                    autoFocus
                  />
                </label>
                <label className="field">
                  Nome do Cliente (opcional)
                  <input
                    value={newCustomer}
                    onChange={(e) => setNewCustomer(e.target.value)}
                    placeholder="Ex.: Construtora Horizonte"
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                  <button type="button" className="btn" onClick={() => setShowNewModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn primary" disabled={creating || !newName.trim()}>
                    <Plus size={15} /> {creating ? 'Criando…' : 'Criar projeto'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <p className="muted" style={{ lineHeight: 1.6, marginBottom: 16 }}>
                  Ao usar o plugin <strong>GOACM</strong> dentro do SketchUp, as exportações de corte e pranchas podem ser enviadas diretamente para o portal:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className="count-pill">1</span>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>
                      Abra o modelo 3D da fachada ou estrutura no SketchUp com o plugin GOACM ativo.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className="count-pill">2</span>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>
                      Execute a planificação e clique em <strong>Exportar / Imprimir Lista de Corte</strong>.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span className="count-pill">3</span>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>
                      Confirme a publicação no diálogo do plugin: o projeto e todas as peças aparecerão aqui instantaneamente.
                    </span>
                  </div>
                </div>
                <button type="button" className="btn primary block" onClick={() => setShowNewModal(false)}>
                  Entendi
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* MODAL DE DETALHES DO PROJETO */}
      {selectedProjectId && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProjectId(null) }}
        >
          <section
            className="profile-modal"
            style={{ maxWidth: 680 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-details-title"
          >
            <button className="modal-close" aria-label="Fechar" onClick={() => setSelectedProjectId(null)}>
              <X size={16} />
            </button>

            {loadingDetails && !details ? (
              <div className="splash" style={{ minHeight: 200 }}>
                <div className="spinner" />
              </div>
            ) : details ? (
              <div>
                <div className="profile-modal-heading" style={{ marginBottom: 12 }}>
                  <span className="profile-alert-icon" aria-hidden="true">
                    <Box size={16} />
                  </span>
                  <div>
                    <h2 id="modal-details-title">{details.project.name}</h2>
                    <p className="muted">
                      Cliente: {details.project.customerName || 'Não informado'} · Criado em {new Date(details.project.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* Status Interativo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-soft)', border: '1px solid var(--border)', borderRadius: 8, margin: '14px 0' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Status do Projeto:</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['rascunho', 'em_producao', 'concluido'] as ProjectStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={updatingStatus}
                        className={`status-badge-interactive ${st} ${details.project.status === st ? 'active' : ''}`}
                        style={{
                          opacity: details.project.status === st ? 1 : 0.6,
                          fontWeight: details.project.status === st ? 700 : 500,
                          transform: details.project.status === st ? 'scale(1.03)' : 'none',
                        }}
                        onClick={() => handleStatusChange(details.project.id, st)}
                      >
                        {details.project.status === st && <Check size={12} />}
                        {statusLabels[st]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cards de Métricas do Projeto */}
                <div className="project-details-grid">
                  <div className="project-details-card">
                    <label>Publicações do Plugin</label>
                    <strong>{details.publications.length} revisão(ões)</strong>
                  </div>
                  <div className="project-details-card">
                    <label>Peças & Quantitativos</label>
                    <strong>
                      {details.parts.length
                        ? `${details.parts.reduce((acc, p) => acc + p.quantity, 0)} peça(s) catalogada(s)`
                        : 'Nenhuma peça exportada'}
                    </strong>
                  </div>
                </div>

                {/* Histórico de Publicações do SketchUp */}
                <div style={{ marginTop: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={15} style={{ color: 'var(--brand)' }} />
                    Histórico de Publicações CAD
                  </h3>
                  {details.publications.length === 0 ? (
                    <p className="empty" style={{ padding: '14px 0', fontSize: 13 }}>
                      Nenhuma versão publicada via SketchUp para este projeto ainda.
                    </p>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Rev.</th>
                            <th>Modelo / Mensagem</th>
                            <th>Autor</th>
                            <th>Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.publications.map((pub) => (
                            <tr key={pub.id}>
                              <td><span className="count-pill">r{pub.revision}</span></td>
                              <td>
                                <strong>{pub.modelName || 'Modelo SketchUp'}</strong>
                                {pub.message && <small className="table-subtitle">{pub.message}</small>}
                              </td>
                              <td>{pub.authorName || 'Projetista'}</td>
                              <td>{new Date(pub.publishedAt || pub.createdAt).toLocaleString('pt-BR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Peças e Chapas se houver */}
                {details.parts.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Box size={15} style={{ color: 'var(--brand)' }} />
                      Lista de Peças de ACM
                    </h3>
                    <div className="table-wrap" style={{ maxHeight: 180, overflowY: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Peça</th>
                            <th>Largura (mm)</th>
                            <th>Altura (mm)</th>
                            <th>Qtd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {details.parts.map((part) => (
                            <tr key={part.id}>
                              <td>{part.name}</td>
                              <td>{part.widthMm} mm</td>
                              <td>{part.heightMm} mm</td>
                              <td><strong>{part.quantity} un.</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button type="button" className="btn" onClick={() => setSelectedProjectId(null)}>
                    Fechar
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}
