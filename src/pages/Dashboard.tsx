import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useOutletContext } from 'react-router-dom'
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
  Scissors,
  Grid,
  Ruler,
  Printer,
  Copy,
  Clock,
  User,
} from 'lucide-react'
import { api, type Project, type ProjectDetails, type ProjectStatus } from '../api'
import { usePageMeta } from '../lib/usePageMeta'
import { CutReportView, type RawCutPiece } from '../components/CutReportView'

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
  const context = useOutletContext<{ hasActivePlan?: boolean } | null>()
  if (context && context.hasActivePlan === false) {
    return <Navigate to="/app/plans" replace />
  }

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
  const [detailTab, setDetailTab] = useState<'overview' | 'planifications' | 'structures' | 'cutlist' | 'revisions'>('overview')
  const [copiedNotification, setCopiedNotification] = useState('')

  // Extrai estruturas, planificações, cortes metálicos e métricas detalhadas dos datasets
  const extracted = useMemo(() => {
    if (!details) {
      return {
        structures: [] as Array<{ id: string; name: string; tags: string[]; totalTubes: number; totalLengthM: number | null; profiles: string[]; revision: number }>,
        planifications: [] as Array<{ id: string; name: string; tags: string[]; widthMm: number; heightMm: number; thicknessMm: number; areaM2: number; quantity: number; folds?: string | null; revision: number }>,
        cuts: [] as RawCutPiece[],
        totalAreaM2: 0,
        totalTubesM: 0,
        totalTraysCount: 0,
      }
    }

    const structures: Array<{ id: string; name: string; tags: string[]; totalTubes: number; totalLengthM: number | null; profiles: string[]; revision: number }> = []
    const planifications: Array<{ id: string; name: string; tags: string[]; widthMm: number; heightMm: number; thicknessMm: number; areaM2: number; quantity: number; folds?: string | null; revision: number }> = []
    const cuts: RawCutPiece[] = []
    const seenPlanifications = new Set<string>()

    // 1. Processa das publicações (datasets)
    for (const pub of details.publications) {
      const rawDatasets = Array.isArray(pub.datasets) ? pub.datasets : []
      for (let i = 0; i < rawDatasets.length; i++) {
        const ds = rawDatasets[i] as Record<string, unknown> | null
        if (!ds || typeof ds !== 'object') continue

        const kind = String(ds.kind || ds.role || '').toLowerCase()
        const label = String(ds.label || ds.name || `Item ${i + 1}`)
        const tags = Array.isArray(ds.tags) ? ds.tags.map(String) : []
        const payload = (ds.payload && typeof ds.payload === 'object' ? ds.payload : {}) as Record<string, unknown>

        // Estrutura
        if (kind === 'structure') {
          const profiles: string[] = []
          if (Array.isArray(payload.profiles)) {
            profiles.push(...payload.profiles.map(String))
          } else if (payload.profile) {
            profiles.push(String(payload.profile))
          }
          structures.push({
            id: String(ds.item_id || `${pub.id}-struct-${i}`),
            name: label,
            tags,
            totalTubes: Number(payload.total_tubes || payload.tubes_count || (Array.isArray(payload.tubes) ? payload.tubes.length : 0)),
            totalLengthM: payload.total_length_m ? Number(payload.total_length_m) : (payload.length_m ? Number(payload.length_m) : null),
            profiles,
            revision: pub.revision,
          })
        }

        // Lista de Corte (metal_cut_list / cut_list do SketchUp)
        if (kind === 'metal_cut_list' || kind === 'cutlist') {
          const rawCuts = (
            Array.isArray(payload.cut_list)
              ? payload.cut_list
              : Array.isArray(payload.cuts)
              ? payload.cuts
              : Array.isArray(payload.rows)
              ? payload.rows
              : Array.isArray(ds.cuts)
              ? ds.cuts
              : []
          ) as Array<Record<string, unknown>>

          for (let j = 0; j < rawCuts.length; j++) {
            const c = rawCuts[j]
            const len = Number(c.length_mm != null ? c.length_mm : (Number(c.length_cm || 0) * 10))
            const qty = Number(c.qty || c.quantity || 1)
            const metal = String(c.metal_name || c.metal || 'Aço Carbono')
            const desc = String(c.tube_desc || c.tube_type || c.profile || c.section || 'Tubo Quadrado 20 x 20 - 1.25mm')
            const color = String(c.color || '')
            const cutAngle = String(c.cut || c.angle || c.angles || '—')
            const prodTag = c.production && typeof c.production === 'object' ? String((c.production as Record<string, unknown>).tube_label || '') : undefined

            cuts.push({
              id: `${pub.id}-cut-${i}-${j}`,
              metal,
              desc,
              color,
              cut: cutAngle,
              lengthMm: len,
              qty,
              section: String(c.section || label.replace(/^Lista de corte:\s*/i, '')),
              sectionTag: c.section_tag ? String(c.section_tag) : undefined,
              productionTag: prodTag,
              isFastener: Boolean(c.is_fastener || metal.toLowerCase().includes('fixador') || desc.toLowerCase().includes('parafuso')),
            })
          }
        }

        // Planificação de Chapa/Bandeja
        if (kind === 'flat_tray' || kind === 'tray' || kind === 'sheet' || kind === 'planification' || (ds.role === 'data' && kind !== 'structure' && kind !== 'metal_cut_list')) {
          const w = Number(payload.width_mm || payload.width || 0)
          const h = Number(payload.height_mm || payload.height || 0)
          const qty = Number(payload.qty || payload.quantity || 1)
          const area = Number(payload.area_m2 || (w && h ? (w * h) / 1_000_000 : 0))
          const key = `${label}-${w}x${h}`
          if (!seenPlanifications.has(key)) {
            seenPlanifications.add(key)
            planifications.push({
              id: String(ds.item_id || `${pub.id}-tray-${i}`),
              name: label,
              tags,
              widthMm: w,
              heightMm: h,
              thicknessMm: Number(payload.thickness_mm || 3),
              areaM2: area,
              quantity: qty,
              folds: payload.flanges ? JSON.stringify(payload.flanges) : null,
              revision: pub.revision,
            })
          }
        }
      }
    }

    // 2. Incorpora peças de details.parts
    for (const p of details.parts) {
      const key = `${p.name}-${p.widthMm}x${p.heightMm}`
      if (!seenPlanifications.has(key)) {
        seenPlanifications.add(key)
        planifications.push({
          id: p.id,
          name: p.name,
          tags: [],
          widthMm: p.widthMm,
          heightMm: p.heightMm,
          thicknessMm: 3,
          areaM2: (p.widthMm * p.heightMm) / 1_000_000,
          quantity: p.quantity,
          revision: 1,
        })
      }
    }

    const totalAreaM2 = planifications.reduce((sum, item) => sum + (item.areaM2 * item.quantity), 0)
    const totalTubesM = cuts.reduce((sum, item) => sum + ((item.lengthMm * item.qty) / 1000), 0)
    const totalTraysCount = planifications.reduce((sum, item) => sum + item.quantity, 0)

    return { structures, planifications, cuts, totalAreaM2, totalTubesM, totalTraysCount }
  }, [details])

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
      {/* Conteúdo principal do Dashboard (Oculto na impressão do modal) */}
      <div className="cut-print-hide">
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
                  {Boolean(project.totalAreaM2 && project.totalAreaM2 > 0) && (
                    <span style={{ color: 'var(--brand-dark)', fontWeight: 600 }}>
                      <Grid size={12} />
                      {project.totalAreaM2?.toFixed(1)} m² ACM
                    </span>
                  )}
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
      </div>

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

      {/* MODAL DE DETALHES DO PROJETO COM ESTRUTURAS, PLANIFICAÇÕES E LISTAS DE CORTE */}
      {selectedProjectId && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProjectId(null) }}
        >
          <section
            className="profile-modal"
            style={{ maxWidth: 960, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-details-title"
          >
            <button className="modal-close" aria-label="Fechar" onClick={() => setSelectedProjectId(null)}>
              <X size={16} />
            </button>

            {loadingDetails && !details ? (
              <div className="splash" style={{ minHeight: 260 }}>
                <div className="spinner" />
              </div>
            ) : details ? (
              <div>
                {/* Cabeçalho do Projeto em Tela (com botões de status e ações) */}
                <div className="profile-modal-heading cut-print-hide" style={{ marginBottom: 14 }}>
                  <span className="profile-alert-icon" aria-hidden="true" style={{ background: 'var(--brand-surface)', color: 'var(--brand-dark)' }}>
                    <Box size={18} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-dark)', background: 'var(--brand-surface)', border: '1px solid var(--brand-border)', borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase' }}>
                          Projeto
                        </span>
                        <h2 id="modal-details-title" style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
                          {details.project.name}
                        </h2>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Status:</span>
                        {(['rascunho', 'em_producao', 'concluido'] as ProjectStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={updatingStatus}
                            className={`status-badge-interactive ${st} ${details.project.status === st ? 'active' : ''}`}
                            style={{
                              opacity: details.project.status === st ? 1 : 0.5,
                              fontWeight: details.project.status === st ? 700 : 500,
                              transform: details.project.status === st ? 'scale(1.02)' : 'none',
                              fontSize: 11,
                              padding: '3px 8px',
                            }}
                            onClick={() => handleStatusChange(details.project.id, st)}
                          >
                            {details.project.status === st && <Check size={11} />}
                            {statusLabels[st]}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => window.print()}
                          style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 4 }}
                          title="Imprimir ou Salvar PDF deste projeto"
                        >
                          <Printer size={12} /> Imprimir / PDF
                        </button>
                      </div>
                    </div>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
                      Cliente: <strong>{details.project.customerName || 'Não informado'}</strong> · Criado em {new Date(details.project.createdAt).toLocaleDateString('pt-BR')} · Última sincronização: {details.project.lastPublicationAt ? new Date(details.project.lastPublicationAt).toLocaleString('pt-BR') : 'Ainda não publicado'}
                    </p>
                  </div>
                </div>

                {/* Cabeçalho de Impressão Oficial do Projeto (Aparece no topo da folha A4) */}
                <div className="cut-print-only" style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 10, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand-dark)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        ACM360 • GOACM &nbsp;•&nbsp; RELATÓRIO TÉCNICO DE ENGENHARIA
                      </div>
                      <h1 style={{ margin: '4px 0 2px', fontSize: 24, fontWeight: 900, color: '#0f172a', letterSpacing: -0.5 }}>
                        Projeto: {details.project.name}
                      </h1>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                        Cliente: <strong>{details.project.customerName || 'Não informado'}</strong> &nbsp;•&nbsp;
                        Criado em: {new Date(details.project.createdAt).toLocaleDateString('pt-BR')} &nbsp;•&nbsp;
                        Última Sincronização: {details.project.lastPublicationAt ? new Date(details.project.lastPublicationAt).toLocaleString('pt-BR') : 'Sem publicação'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 4, border: '1.5px solid #0f172a', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>
                        STATUS: {statusLabels[details.project.status]?.toUpperCase() || 'RASCUNHO'}
                      </span>
                      <span style={{ fontSize: 9.5, color: '#64748b' }}>
                        Emissão: {new Date().toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>

                {copiedNotification && (
                  <div className="success" style={{ marginBottom: 12, fontSize: 12, padding: '6px 12px' }}>
                    <CheckCircle2 size={14} /> {copiedNotification}
                  </div>
                )}

                {/* Abas de Navegação */}
                <div className="modal-tabs" style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 18, overflowX: 'auto' }}>
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setDetailTab('overview')}
                  >
                    <Info size={14} /> Visão Geral
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === 'planifications' ? 'active' : ''}`}
                    onClick={() => setDetailTab('planifications')}
                  >
                    <Grid size={14} /> Planificações ACM ({extracted.planifications.length})
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === 'structures' ? 'active' : ''}`}
                    onClick={() => setDetailTab('structures')}
                  >
                    <Box size={14} /> Estruturas 3D ({extracted.structures.length})
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === 'cutlist' ? 'active' : ''}`}
                    onClick={() => setDetailTab('cutlist')}
                  >
                    <Ruler size={14} /> Lista & Plano de Corte ({extracted.cuts.length})
                  </button>
                  <button
                    type="button"
                    className={`modal-tab-btn ${detailTab === 'revisions' ? 'active' : ''}`}
                    onClick={() => setDetailTab('revisions')}
                  >
                    <Layers size={14} /> Revisões CAD ({details.publications.length})
                  </button>
                </div>

                {/* TAB 1: VISÃO GERAL */}
                {detailTab === 'overview' && (
                  <div>
                    {/* 4 Cards de Destaque */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                      <div className="project-details-card" style={{ borderLeft: '3px solid var(--brand)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Grid size={13} style={{ color: 'var(--brand)' }} /> Área Total de ACM
                        </label>
                        <strong style={{ fontSize: 18 }}>{extracted.totalAreaM2 > 0 ? `${extracted.totalAreaM2.toFixed(2)} m²` : 'Calculando…'}</strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 3 }}>
                          {extracted.totalTraysCount} chapa(s) / bandeja(s)
                        </span>
                      </div>
                      <div className="project-details-card" style={{ borderLeft: '3px solid #3b82f6' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Scissors size={13} style={{ color: '#3b82f6' }} /> Planificações
                        </label>
                        <strong style={{ fontSize: 18 }}>{extracted.planifications.length} modelo(s)</strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 3 }}>
                          {extracted.totalTraysCount} peças planificadas
                        </span>
                      </div>
                      <div className="project-details-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Box size={13} style={{ color: '#8b5cf6' }} /> Estruturas 3D
                        </label>
                        <strong style={{ fontSize: 18 }}>{extracted.structures.length} estrutura(s)</strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 3 }}>
                          Montantes e perfis modelados
                        </span>
                      </div>
                      <div className="project-details-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Ruler size={13} style={{ color: '#f59e0b' }} /> Serralheria / Tubos
                        </label>
                        <strong style={{ fontSize: 18 }}>
                          {extracted.totalTubesM > 0 ? `${extracted.totalTubesM.toFixed(1)} m` : `${extracted.cuts.length} cortes`}
                        </strong>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginTop: 3 }}>
                          {extracted.cuts.reduce((sum, c) => sum + c.qty, 0)} barras para corte
                        </span>
                      </div>
                    </div>

                    {/* Resumo da Última Publicação */}
                    {details.publications.length > 0 ? (
                      <div style={{ padding: '14px 16px', background: 'var(--bg-soft)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Layers size={14} style={{ color: 'var(--brand)' }} />
                            Última Revisão Publicada: <span className="count-pill">r{details.publications[0].revision}</span>
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} /> {new Date(details.publications[0].publishedAt || details.publications[0].createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text)' }}>
                          {details.publications[0].message || 'Sem mensagem descritiva de publicação.'}
                        </p>
                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                          <span>Arquivo SketchUp: <strong>{details.publications[0].modelName || 'Modelo 3D'}</strong></span>
                          <span>Projetista: <strong>{details.publications[0].authorName || 'Projetista'}</strong></span>
                        </div>
                      </div>
                    ) : (
                      <div className="project-empty" style={{ minHeight: 140, padding: 20, marginBottom: 20 }}>
                        <div className="project-empty-icon" style={{ color: 'var(--brand)', marginBottom: 6 }}><Layers size={28} /></div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 14 }}>Nenhuma publicação recebida do SketchUp ainda</h4>
                        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                          Abra o SketchUp com o plugin GOACM, vincule este projeto e clique em "Publicar Revisão" para enviar planificações, estruturas e cortes.
                        </p>
                      </div>
                    )}

                    {/* Atalhos para as outras abas */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Grid size={14} style={{ color: 'var(--brand)' }} /> Planificações de Bandejas
                          </h4>
                          <button type="button" className="btn sm" onClick={() => setDetailTab('planifications')}>
                            Ver todas ({extracted.planifications.length})
                          </button>
                        </div>
                        {extracted.planifications.slice(0, 3).map((item) => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            <span className="muted">{item.widthMm} × {item.heightMm} mm ({item.quantity} un.)</span>
                          </div>
                        ))}
                        {extracted.planifications.length === 0 && (
                          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Nenhuma bandeja planificada.</p>
                        )}
                      </div>

                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Box size={14} style={{ color: '#8b5cf6' }} /> Estruturas Modeladas
                          </h4>
                          <button type="button" className="btn sm" onClick={() => setDetailTab('structures')}>
                            Ver todas ({extracted.structures.length})
                          </button>
                        </div>
                        {extracted.structures.slice(0, 3).map((item) => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            <span className="muted">{item.totalTubes > 0 ? `${item.totalTubes} tubos` : 'Estrutura 3D'}</span>
                          </div>
                        ))}
                        {extracted.structures.length === 0 && (
                          <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Nenhuma estrutura catalogada.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: PLANIFICAÇÕES (BANDEJAS ACM) */}
                {detailTab === 'planifications' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                          Bandejas Planificadas ({extracted.planifications.length})
                        </span>
                        <span className="badge active" style={{ fontSize: 11 }}>
                          Total: {extracted.totalAreaM2.toFixed(2)} m² ACM
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => {
                            const header = 'Nome,Largura(mm),Altura(mm),Espessura(mm),Area(m2),Qtd,AreaTotal(m2)\n'
                            const rows = extracted.planifications.map((p) => `"${p.name}",${p.widthMm},${p.heightMm},${p.thicknessMm},${p.areaM2.toFixed(3)},${p.quantity},${(p.areaM2 * p.quantity).toFixed(3)}`).join('\n')
                            navigator.clipboard.writeText(header + rows)
                            setCopiedNotification('Tabela de planificações copiada para a área de transferência!')
                            setTimeout(() => setCopiedNotification(''), 4000)
                          }}
                          title="Copiar lista de bandejas para colar no Excel"
                        >
                          <Copy size={12} /> Copiar CSV
                        </button>
                      </div>
                    </div>

                    {extracted.planifications.length === 0 ? (
                      <div className="project-empty" style={{ minHeight: 180, padding: 24 }}>
                        <div className="project-empty-icon" style={{ color: 'var(--brand)' }}><Grid size={32} /></div>
                        <h3>Nenhuma planificação encontrada</h3>
                        <p className="muted" style={{ maxWidth: 480, margin: '6px auto', fontSize: 13 }}>
                          Para enviar bandejas para o site, use a ferramenta de <strong>Planificação</strong> no plugin GOACM do SketchUp e clique em <strong>Publicar</strong>.
                        </p>
                      </div>
                    ) : (
                      <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Peça / Bandeja</th>
                              <th>Etiqueta / Tag</th>
                              <th>Largura</th>
                              <th>Altura</th>
                              <th>Espessura</th>
                              <th>Área Unit.</th>
                              <th>Qtd</th>
                              <th>Área Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {extracted.planifications.map((item) => (
                              <tr key={item.id}>
                                <td>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                                    <Grid size={13} style={{ color: 'var(--brand)' }} />
                                    {item.name}
                                  </span>
                                </td>
                                <td>
                                  {item.tags.length ? (
                                    <span style={{ fontSize: 11, background: 'var(--bg-soft)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                                      {item.tags.join(', ')}
                                    </span>
                                  ) : <span className="muted">—</span>}
                                </td>
                                <td>{item.widthMm ? `${item.widthMm} mm` : '—'}</td>
                                <td>{item.heightMm ? `${item.heightMm} mm` : '—'}</td>
                                <td>{item.thicknessMm} mm</td>
                                <td>{item.areaM2 ? `${item.areaM2.toFixed(3)} m²` : '—'}</td>
                                <td><strong>{item.quantity} un.</strong></td>
                                <td>
                                  <strong style={{ color: 'var(--brand-dark)' }}>
                                    {(item.areaM2 * item.quantity).toFixed(3)} m²
                                  </strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: 'var(--bg-soft)', fontWeight: 700 }}>
                              <td colSpan={6} style={{ textAlign: 'right' }}>Total Geral de Chapas:</td>
                              <td>{extracted.totalTraysCount} un.</td>
                              <td style={{ color: 'var(--brand-dark)', fontSize: 13 }}>{extracted.totalAreaM2.toFixed(2)} m²</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: ESTRUTURAS 3D */}
                {detailTab === 'structures' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        Estruturas Modeladas no SketchUp ({extracted.structures.length})
                      </span>
                    </div>

                    {extracted.structures.length === 0 ? (
                      <div className="project-empty" style={{ minHeight: 180, padding: 24 }}>
                        <div className="project-empty-icon" style={{ color: '#8b5cf6' }}><Box size={32} /></div>
                        <h3>Nenhuma estrutura identificada</h3>
                        <p className="muted" style={{ maxWidth: 480, margin: '6px auto', fontSize: 13 }}>
                          Crie estruturas (tubos, montantes, gradis) no SketchUp pelo plugin GOACM e publique a revisão para acompanhar aqui no portal.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                        {extracted.structures.map((item) => (
                          <div key={item.id} style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                                <Box size={16} style={{ color: '#8b5cf6' }} />
                                {item.name}
                              </span>
                              <span className="count-pill">r{item.revision}</span>
                            </div>

                            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Etiqueta:</span>
                                <strong style={{ color: 'var(--text)' }}>{item.tags.join(', ') || 'Sem etiqueta'}</strong>
                              </div>
                              {item.totalTubes > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Tubos/Barras:</span>
                                  <strong style={{ color: 'var(--text)' }}>{item.totalTubes} peças</strong>
                                </div>
                              )}
                              {item.totalLengthM !== null && item.totalLengthM > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Metros Lineares:</span>
                                  <strong style={{ color: 'var(--brand-dark)' }}>{item.totalLengthM.toFixed(2)} m</strong>
                                </div>
                              )}
                              {item.profiles.length > 0 && (
                                <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                                  <span style={{ display: 'block', fontSize: 11, marginBottom: 3 }}>Perfis aplicados:</span>
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                    {item.profiles.map((prof, idx) => (
                                      <span key={idx} style={{ fontSize: 10, background: 'var(--bg-soft)', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border)' }}>
                                        {prof}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: LISTA E PLANO DE CORTE (COMPONENTE RETRO-MODERNO IDÊNTICO AO PLUGIN) */}
                {detailTab === 'cutlist' && (
                  <CutReportView
                    cuts={extracted.cuts}
                    projectName={details.project.name}
                    modelName={details.publications[0]?.modelName}
                    onRefresh={loadProjects}
                  />
                )}

                {/* TAB 5: HISTÓRICO DE REVISÕES CAD */}
                {detailTab === 'revisions' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        Revisões Publicadas pelo Plugin GOACM ({details.publications.length})
                      </span>
                    </div>

                    {details.publications.length === 0 ? (
                      <p className="empty" style={{ padding: '20px 0', fontSize: 13 }}>
                        Nenhuma versão publicada via SketchUp para este projeto ainda.
                      </p>
                    ) : (
                      <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Rev.</th>
                              <th>Modelo / Descrição</th>
                              <th>Projetista</th>
                              <th>Data e Hora</th>
                              <th>Status</th>
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
                                <td>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <User size={12} style={{ color: 'var(--muted)' }} />
                                    {pub.authorName || 'Projetista'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--muted)' }}>
                                    <Clock size={12} />
                                    {new Date(pub.publishedAt || pub.createdAt).toLocaleString('pt-BR')}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${pub.status === 'published' ? 'active' : 'none'}`}>
                                    {pub.status === 'published' ? 'Publicado' : 'Pendente'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
