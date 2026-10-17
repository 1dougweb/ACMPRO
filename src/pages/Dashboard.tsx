import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/usePageMeta'

type ProjectFilter = 'Todos' | 'Em projeto' | 'Em produção' | 'Concluído'

export default function Dashboard() {
  usePageMeta('Projetos', 'Acompanhe seus projetos GOACM.')
  const [filter, setFilter] = useState<ProjectFilter>('Todos')
  const [search, setSearch] = useState('')
  const [showPublishInfo, setShowPublishInfo] = useState(false)
  const filters: ProjectFilter[] = ['Todos', 'Em projeto', 'Em produção', 'Concluído']
  const projects = useMemo(() => [] as Array<{ name: string; customer: string; status: ProjectFilter }>, [])
  const visibleProjects = projects.filter((project) => (filter === 'Todos' || project.status === filter)
    && `${project.name} ${project.customer}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="projects-page">
      <div className="projects-breadcrumb"><span>Workspace</span><span aria-hidden="true">›</span><strong>Projetos</strong></div>
      <div className="projects-heading">
        <div>
          <p className="label">Visão geral</p>
          <h1 className="projects-title">Projetos<span>.</span></h1>
          <p className="muted">Acompanhe cada etapa. Encontre o que precisa.</p>
        </div>
        <button className="btn project-create" onClick={() => setShowPublishInfo(true)}><span aria-hidden="true">＋</span> Novo projeto</button>
      </div>

      <section className="project-stat-grid" aria-label="Resumo de projetos">
        <article className="project-stat project-stat-selected"><span>Total de projetos</span><strong>00</strong><small>Todos os projetos</small><span className="project-stat-icon" aria-hidden="true">▱</span></article>
        <article className="project-stat"><span>Em projeto</span><strong>00</strong><small>Em planejamento</small><span className="project-stat-icon" aria-hidden="true">⌁</span></article>
        <article className="project-stat"><span>Em produção</span><strong>00</strong><small>Execução em andamento</small><span className="project-stat-icon" aria-hidden="true">◈</span></article>
        <article className="project-stat"><span>Concluídos</span><strong>00</strong><small>Projetos finalizados</small><span className="project-stat-icon" aria-hidden="true">◉</span></article>
      </section>

      <section className="project-browser card">
        <div className="project-browser-heading"><h2>Seus projetos <span className="count-pill">{visibleProjects.length}</span></h2><div className="project-view-switch" aria-label="Modo de visualização"><button aria-label="Grade" className="selected">▦</button><button aria-label="Lista">▤</button><button aria-label="Valores">$</button></div></div>
        <div className="project-toolbar">
          <label className="project-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projeto ou cliente" aria-label="Buscar projeto ou cliente" /><kbd>Ctrl K</kbd></label>
          <div className="project-filters" role="group" aria-label="Filtrar projetos">{filters.map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
          <button className="project-sort">Mais recentes <span aria-hidden="true">⌄</span></button>
        </div>
        {visibleProjects.length === 0 ? (
          <div className="project-empty"><div className="project-empty-icon" aria-hidden="true">▱</div><h3>{search ? 'Nenhum resultado' : 'Nenhum projeto ainda'}</h3><p>{search ? 'Tente buscar por outro nome de projeto ou cliente.' : 'Quando você publicar pelo plugin GOACM no SketchUp, o projeto aparecerá aqui.'}</p><div><Link className="btn" to="/app/training">Ver treinamentos</Link><button className="btn primary" onClick={() => setShowPublishInfo(true)}>Como publicar um projeto</button></div></div>
        ) : <div className="table-wrap"><table className="table"><thead><tr><th>Projeto</th><th>Cliente</th><th>Status</th></tr></thead><tbody>{visibleProjects.map((project) => <tr key={project.name}><td>{project.name}</td><td>{project.customer}</td><td>{project.status}</td></tr>)}</tbody></table></div>}
        <div className="project-browser-footer"><span>{visibleProjects.length ? `${visibleProjects.length} projeto(s)` : 'Nenhum projeto'}</span><span>Clique em uma linha para abrir o projeto</span></div>
      </section>

      {showPublishInfo && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPublishInfo(false) }}><section className="profile-modal info-modal" role="dialog" aria-modal="true" aria-labelledby="project-info-title"><button className="modal-close" aria-label="Fechar" onClick={() => setShowPublishInfo(false)}>×</button><p className="label">Projetos GOACM</p><h2 id="project-info-title">Publique pelo SketchUp</h2><p className="muted">Os projetos são enviados pelo plugin GOACM ao exportar ou imprimir uma lista de corte. Abra o projeto no SketchUp, conclua a exportação e confirme a publicação quando o plugin perguntar.</p><button className="btn primary" onClick={() => setShowPublishInfo(false)}>Entendi</button></section></div>}
    </div>
  )
}
