import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useOutletContext } from 'react-router-dom'
import {
  GraduationCap,
  Play,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  FileText,
  Download,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Video,
  FileArchive,
  Search,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import { api } from '../api'
import type {
  TrainingModule,
  TrainingLesson,
  TrainingAttachment,
} from '../api/types'
import { parseVideoUrl } from '../lib/videoUtils'
import { usePageMeta } from '../lib/usePageMeta'

export default function Training() {
  usePageMeta('Treinamentos & Aulas', 'Plataforma de cursos e capacitação GOACM.')
  const context = useOutletContext<{ hasActivePlan?: boolean } | null>()
  if (context && context.hasActivePlan === false) {
    return <Navigate to="/app/plans" replace />
  }

  const [modules, setModules] = useState<TrainingModule[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Aula selecionada
  const [selectedLesson, setSelectedLesson] = useState<TrainingLesson | null>(null)

  // Módulos expandidos na sidebar (Map ou Set de IDs)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})

  // Controle de largura e visualização da sidebar direita (Modo Cinema / Foco no Vídeo)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Busca de aulas
  const [searchQuery, setSearchQuery] = useState('')

  // Modais de Administração
  const [moduleModalOpen, setModuleModalOpen] = useState(false)
  const [moduleForm, setModuleForm] = useState<{ id?: string; title: string; description: string; orderIndex: number }>({
    title: '',
    description: '',
    orderIndex: 0,
  })

  const [lessonModalOpen, setLessonModalOpen] = useState(false)
  const [lessonForm, setLessonForm] = useState<{
    id?: string
    moduleId: string
    title: string
    description: string
    videoUrl: string
    durationMinutes: number
    orderIndex: number
    attachments: TrainingAttachment[]
  }>({
    moduleId: '',
    title: '',
    description: '',
    videoUrl: '',
    durationMinutes: 10,
    orderIndex: 0,
    attachments: [],
  })

  // Novo anexo temporário no form da aula
  const [newAttachTitle, setNewAttachTitle] = useState('')
  const [newAttachUrl, setNewAttachUrl] = useState('')
  const [newAttachType, setNewAttachType] = useState('pdf')

  const [submitting, setSubmitting] = useState(false)

  // Carrega conteúdo dos treinamentos
  const loadTraining = async (preserveSelectedLessonId?: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getTrainingContent()
      setModules(data.modules)
      setCompletedIds(data.completedLessonIds)
      setIsAdmin(data.isAdmin)

      // Expande todos os módulos inicialmente
      const initialExpanded: Record<string, boolean> = {}
      data.modules.forEach((m) => {
        initialExpanded[m.id] = true
      })
      setExpandedModules((prev) => Object.keys(prev).length ? prev : initialExpanded)

      // Seleciona aula
      if (preserveSelectedLessonId) {
        for (const m of data.modules) {
          const found = m.lessons.find((l) => l.id === preserveSelectedLessonId)
          if (found) {
            setSelectedLesson(found)
            return
          }
        }
      }

      // Senão, seleciona a primeira aula disponível
      if (!selectedLesson && data.modules[0]?.lessons[0]) {
        setSelectedLesson(data.modules[0].lessons[0])
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Falha ao carregar treinamentos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTraining()
  }, [])

  // Total de aulas e progresso
  const allLessons = modules.flatMap((m) => m.lessons)
  const totalLessons = allLessons.length
  const completedCount = allLessons.filter((l) => completedIds.includes(l.id)).length
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0

  // Alterna expansão de módulo
  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Marcar / desmarcar aula como concluída
  const handleToggleComplete = async (lesson: TrainingLesson) => {
    const isDone = completedIds.includes(lesson.id)
    const newStatus = !isDone

    // Atualização otimista
    setCompletedIds((prev) =>
      newStatus ? [...prev, lesson.id] : prev.filter((id) => id !== lesson.id)
    )

    try {
      const res = await api.toggleLessonProgress(lesson.id, newStatus)
      setCompletedIds(res.completedLessonIds)
    } catch {
      // Reverte se falhou
      setCompletedIds((prev) =>
        isDone ? [...prev, lesson.id] : prev.filter((id) => id !== lesson.id)
      )
    }
  }

  // Navegação: Próxima e Anterior
  const currentIdx = allLessons.findIndex((l) => l.id === selectedLesson?.id)
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null
  const nextLesson = currentIdx >= 0 && currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null

  // Filtro de busca de aulas
  const filteredModules = modules.map((m) => {
    if (!searchQuery.trim()) return m
    const filtered = m.lessons.filter((l) =>
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    return { ...m, lessons: filtered }
  }).filter((m) => !searchQuery.trim() || m.lessons.length > 0)

  // -------------------------------------------------------------
  // Ações de Administrador: Módulos
  // -------------------------------------------------------------
  const handleOpenModuleModal = (moduleToEdit?: TrainingModule) => {
    if (moduleToEdit) {
      setModuleForm({
        id: moduleToEdit.id,
        title: moduleToEdit.title,
        description: moduleToEdit.description || '',
        orderIndex: moduleToEdit.orderIndex || 0,
      })
    } else {
      setModuleForm({
        title: '',
        description: '',
        orderIndex: modules.length + 1,
      })
    }
    setModuleModalOpen(true)
  }

  const handleSaveModule = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.saveTrainingModule(moduleForm)
      setModuleModalOpen(false)
      await loadTraining(selectedLesson?.id)
    } catch (err: unknown) {
      alert((err as Error).message || 'Erro ao salvar módulo.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteModule = async (moduleId: string, moduleTitle: string) => {
    if (!confirm(`Deseja realmente excluir o módulo "${moduleTitle}" e todas as suas aulas?`)) return
    try {
      await api.deleteTrainingModule(moduleId)
      if (selectedLesson?.moduleId === moduleId) {
        setSelectedLesson(null)
      }
      await loadTraining()
    } catch (err: unknown) {
      alert((err as Error).message || 'Erro ao excluir módulo.')
    }
  }

  // -------------------------------------------------------------
  // Ações de Administrador: Aulas
  // -------------------------------------------------------------
  const handleOpenLessonModal = (lessonToEdit?: TrainingLesson, defaultModuleId?: string) => {
    if (lessonToEdit) {
      setLessonForm({
        id: lessonToEdit.id,
        moduleId: lessonToEdit.moduleId,
        title: lessonToEdit.title,
        description: lessonToEdit.description || '',
        videoUrl: lessonToEdit.videoUrl || '',
        durationMinutes: lessonToEdit.durationMinutes || 10,
        orderIndex: lessonToEdit.orderIndex || 0,
        attachments: lessonToEdit.attachments ? [...lessonToEdit.attachments] : [],
      })
    } else {
      setLessonForm({
        moduleId: defaultModuleId || modules[0]?.id || '',
        title: '',
        description: '',
        videoUrl: '',
        durationMinutes: 15,
        orderIndex: 0,
        attachments: [],
      })
    }
    setNewAttachTitle('')
    setNewAttachUrl('')
    setLessonModalOpen(true)
  }

  const handleAddAttachment = () => {
    if (!newAttachTitle.trim() || !newAttachUrl.trim()) {
      alert('Informe o nome e o link do material de apoio.')
      return
    }
    setLessonForm((prev) => ({
      ...prev,
      attachments: [
        ...prev.attachments,
        {
          title: newAttachTitle.trim(),
          url: newAttachUrl.trim(),
          type: newAttachType,
        },
      ],
    }))
    setNewAttachTitle('')
    setNewAttachUrl('')
  }

  const handleRemoveAttachment = (index: number) => {
    setLessonForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }

  const handleSaveLesson = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.saveTrainingLesson(lessonForm)
      setLessonModalOpen(false)
      await loadTraining(res.lessonId)
    } catch (err: unknown) {
      alert((err as Error).message || 'Erro ao salvar aula.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteLesson = async (lessonId: string, lessonTitle: string) => {
    if (!confirm(`Deseja realmente excluir a aula "${lessonTitle}"?`)) return
    try {
      await api.deleteTrainingLesson(lessonId)
      if (selectedLesson?.id === lessonId) {
        setSelectedLesson(null)
      }
      await loadTraining()
    } catch (err: unknown) {
      alert((err as Error).message || 'Erro ao excluir aula.')
    }
  }

  // Processa o player de vídeo da aula ativa
  const parsedVideo = parseVideoUrl(selectedLesson?.videoUrl)
  const isCurrentDone = selectedLesson ? completedIds.includes(selectedLesson.id) : false
  const currentModule = modules.find((m) => m.id === selectedLesson?.moduleId)

  return (
    <div className="training-page">
      {/* Cabeçalho da Página */}
      <div className="training-heading">
        <div>
          <h1 className="page-title">Treinamentos & Cursos GOACM</h1>
          <p>Assista aos módulos práticos, acesse os materiais de apoio e acompanhe seu progresso.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="btn outline sm"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Expandir vídeo para largura total do container (Modo Cinema)" : "Exibir lista de aulas na lateral direita"}
          >
            {sidebarOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            <span>{sidebarOpen ? 'Modo Cinema' : 'Ver Menu Lateral'}</span>
          </button>

          {isAdmin && (
            <div className="training-admin-actions">
              <button className="btn outline sm" onClick={() => handleOpenModuleModal()}>
                <Plus size={15} /> Novo Módulo
              </button>
              <button className="btn primary sm" onClick={() => handleOpenLessonModal(undefined, currentModule?.id)}>
                <Plus size={15} /> Nova Aula
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--brand)' }}>
          <Loader2 size={36} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Carregando aulas e materiais…</p>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', padding: 24 }}>
          <p style={{ color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} /> {error}
          </p>
        </div>
      ) : (
        /* LAYOUT PRINCIPAL: CLASSROOM (ESQUERDA) + RIGHT SIDEBAR (DIREITA) */
        <div className={`training-layout ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
          {/* ========================================================
              COLUNA ESQUERDA: PLAYER DE VÍDEO & CONTEÚDO DA AULA
              ======================================================== */}
          <main className="training-main-area">
            {/* Player de Vídeo 16:9 */}
            <div className="training-player-container">
              {parsedVideo.type === 'youtube' || parsedVideo.type === 'vimeo' || parsedVideo.type === 'embed' ? (
                <iframe
                  className="training-player-frame"
                  src={parsedVideo.src}
                  title={selectedLesson?.title || 'Player de Treinamento'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : parsedVideo.type === 'mp4' ? (
                <video
                  className="training-player-video"
                  src={parsedVideo.src}
                  controls
                  playsInline
                />
              ) : (
                <div className="training-player-empty">
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', display: 'grid', placeItems: 'center', color: '#10b981' }}>
                    <Video size={28} />
                  </div>
                  <h3>Nenhum vídeo publicado nesta aula</h3>
                  <p>
                    O conteúdo em vídeo desta aula está sendo preparado ou ainda não teve o link anexado.
                  </p>
                  {isAdmin && selectedLesson && (
                    <button
                      className="btn primary sm"
                      style={{ marginTop: 8 }}
                      onClick={() => handleOpenLessonModal(selectedLesson)}
                    >
                      <Plus size={14} /> Inserir Link do Vídeo (YouTube, Vimeo, MP4)
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Barra de Controles da Aula (Concluir & Navegação) */}
            {selectedLesson && (
              <div className="training-lesson-ctrls">
                <button
                  className={`training-complete-btn ${isCurrentDone ? 'completed' : ''}`}
                  onClick={() => handleToggleComplete(selectedLesson)}
                >
                  <CheckCircle2 size={18} style={{ color: isCurrentDone ? '#10b981' : '#94a3b8' }} />
                  <span>{isCurrentDone ? 'Aula Concluída' : 'Marcar como Concluída'}</span>
                </button>

                <div className="training-lesson-nav">
                  <button
                    className="btn outline sm"
                    disabled={!prevLesson}
                    onClick={() => prevLesson && setSelectedLesson(prevLesson)}
                    title={prevLesson ? `Anterior: ${prevLesson.title}` : undefined}
                  >
                    <ArrowLeft size={14} /> Anterior
                  </button>
                  <button
                    className="btn outline sm"
                    disabled={!nextLesson}
                    onClick={() => nextLesson && setSelectedLesson(nextLesson)}
                    title={nextLesson ? `Próxima: ${nextLesson.title}` : undefined}
                  >
                    Próxima <ArrowRight size={14} />
                  </button>
                  <button
                    className="btn outline sm"
                    onClick={() => setSidebarOpen((v) => !v)}
                    title={sidebarOpen ? "Expandir vídeo para largura total (Modo Cinema)" : "Abrir menu lateral de aulas"}
                  >
                    {sidebarOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                    <span>{sidebarOpen ? 'Modo Cinema' : 'Ver Aulas'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Detalhes, Descrição e Materiais de Apoio */}
            {selectedLesson && (
              <div className="training-lesson-details">
                <div className="training-lesson-title-row">
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--brand-dark)', background: 'var(--brand-surface)', padding: '2px 8px', borderRadius: 4, marginBottom: 8 }}>
                      <GraduationCap size={13} /> {currentModule?.title || 'Módulo'}
                    </div>
                    <h2>{selectedLesson.title}</h2>
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn outline sm"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => handleOpenLessonModal(selectedLesson)}
                        title="Editar conteúdo da aula"
                      >
                        <Edit size={13} /> Editar
                      </button>
                      <button
                        className="btn danger sm"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => handleDeleteLesson(selectedLesson.id, selectedLesson.title)}
                        title="Excluir aula"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="training-lesson-meta">
                  {selectedLesson.durationMinutes ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} /> {selectedLesson.durationMinutes} minutos de duração
                    </span>
                  ) : null}
                  {selectedLesson.attachments && selectedLesson.attachments.length > 0 && (
                    <span>• {selectedLesson.attachments.length} materiais de apoio anexados</span>
                  )}
                </div>

                {selectedLesson.description ? (
                  <p className="training-lesson-desc">{selectedLesson.description}</p>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: 13, fontStyle: 'italic', margin: '0 0 16px' }}>
                    Nenhuma descrição cadastrada para esta aula.
                  </p>
                )}

                {/* Seção de Materiais de Apoio */}
                <div className="training-materials-section">
                  <div className="training-materials-header">
                    <h3>
                      <FileArchive size={17} style={{ color: '#10b981' }} />
                      Materiais de Apoio para Download
                    </h3>
                    {isAdmin && (
                      <button
                        className="btn outline sm"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => handleOpenLessonModal(selectedLesson)}
                      >
                        <Plus size={13} /> Gerenciar Materiais
                      </button>
                    )}
                  </div>

                  {!selectedLesson.attachments || selectedLesson.attachments.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
                      Nenhum material complementar (PDF, planilha ou projeto) vinculado a esta aula.
                    </p>
                  ) : (
                    <div className="training-materials-grid">
                      {selectedLesson.attachments.map((attach, idx) => (
                        <a
                          key={idx}
                          href={attach.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="training-material-card"
                        >
                          <div className="training-material-info">
                            <div style={{ width: 34, height: 34, borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: '#047857', flexShrink: 0 }}>
                              <FileText size={16} />
                            </div>
                            <div>
                              <strong>{attach.title}</strong>
                              <span>{attach.type?.toUpperCase() || 'ARQUIVO'} {attach.size ? `• ${attach.size}` : ''}</span>
                            </div>
                          </div>
                          <Download size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* ========================================================
              COLUNA DIREITA: MENU LATERAL DIREITO (SIDEBAR DE AULAS)
              ======================================================== */}
          {sidebarOpen && (
            <aside className="training-sidebar-right">
            {/* Header da Sidebar com Progresso */}
            <div className="training-sidebar-header">
              <h3>
                <span>Conteúdo do Curso</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-dark)' }}>
                  {progressPercent}%
                </span>
              </h3>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {completedCount} de {totalLessons} aulas concluídas
              </div>
              <div className="training-progress-mini">
                <div className="training-progress-mini-bar">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              {/* Barra de Pesquisa de Aulas */}
              <div style={{ position: 'relative', marginTop: 12 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar aula ou tema…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    fontSize: 12,
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    outline: 'none',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 8, top: 8, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Acordeão de Módulos e Aulas */}
            <div className="training-modules-accordion">
              {!filteredModules.length ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Nenhuma aula encontrada para a busca "{searchQuery}".
                </div>
              ) : (
                filteredModules.map((module, modIdx) => {
                  const isExpanded = Boolean(expandedModules[module.id])
                  const modLessons = module.lessons || []
                  const modDone = modLessons.filter((l) => completedIds.includes(l.id)).length

                  return (
                    <div key={module.id} className="training-module-item">
                      {/* Cabeçalho do Módulo */}
                      <div
                        className={`training-module-header ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => toggleModule(module.id)}
                      >
                        <div className="training-module-title-box">
                          <strong>Módulo {modIdx + 1}: {module.title}</strong>
                          <span>{modDone}/{modLessons.length} concluídas</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isAdmin && (
                            <div
                              style={{ display: 'flex', gap: 4 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}
                                onClick={() => handleOpenLessonModal(undefined, module.id)}
                                title="Adicionar aula neste módulo"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}
                                onClick={() => handleOpenModuleModal(module)}
                                title="Editar módulo"
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                                onClick={() => handleDeleteModule(module.id, module.title)}
                                title="Excluir módulo"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}

                          {isExpanded ? (
                            <ChevronDown size={16} style={{ color: 'var(--muted)' }} />
                          ) : (
                            <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
                          )}
                        </div>
                      </div>

                      {/* Lista de Aulas do Módulo */}
                      {isExpanded && (
                        <div>
                          {modLessons.map((lesson, lessonIdx) => {
                            const isSelected = selectedLesson?.id === lesson.id
                            const isDone = completedIds.includes(lesson.id)

                            return (
                              <button
                                key={lesson.id}
                                className={`training-lesson-btn ${isSelected ? 'active' : ''}`}
                                onClick={() => setSelectedLesson(lesson)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                  <div
                                    className={`training-lesson-indicator ${isDone ? 'completed' : isSelected ? 'current' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      void handleToggleComplete(lesson)
                                    }}
                                    title={isDone ? 'Clique para desmarcar' : 'Clique para marcar como concluída'}
                                  >
                                    {isDone ? '✓' : isSelected ? <Play size={8} fill="currentColor" /> : null}
                                  </div>

                                  <span className="training-lesson-name" title={lesson.title}>
                                    {lessonIdx + 1}. {lesson.title}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  {lesson.attachments && lesson.attachments.length > 0 && (
                                    <span title={`${lesson.attachments.length} materiais de apoio`} style={{ display: 'inline-flex' }}>
                                      <FileText size={12} style={{ color: '#10b981' }} />
                                    </span>
                                  )}
                                  {lesson.durationMinutes ? (
                                    <span className="training-lesson-time">
                                      {lesson.durationMinutes}m
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </aside>
          )}
        </div>
      )}

      {/* ========================================================
          MODAIS ADMINISTRATIVOS (CRIAR/EDITAR MÓDULO E AULA)
          ======================================================== */}
      {/* Modal de Módulo */}
      {moduleModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModuleModalOpen(false) }}>
          <section className="profile-modal" style={{ maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setModuleModalOpen(false)}>
              <X size={16} />
            </button>
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16 }}>
              {moduleForm.id ? 'Editar Módulo' : 'Novo Módulo de Treinamento'}
            </h2>

            <form onSubmit={handleSaveModule} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="admin-form-group">
                <label>Título do Módulo</label>
                <input
                  type="text"
                  placeholder="ex: Modelagem Avançada de Fachadas"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label>Descrição (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Resumo do que os alunos aprenderão neste módulo…"
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>Ordem de Exibição</label>
                <input
                  type="number"
                  value={moduleForm.orderIndex}
                  onChange={(e) => setModuleForm({ ...moduleForm, orderIndex: Number(e.target.value) })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn outline" onClick={() => setModuleModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" disabled={submitting}>
                  {submitting ? 'Salvando…' : 'Salvar Módulo'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal de Aula & Materiais de Apoio */}
      {lessonModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setLessonModalOpen(false) }}>
          <section className="profile-modal" style={{ maxWidth: 620, maxHeight: '90vh' }}>
            <button className="modal-close" onClick={() => setLessonModalOpen(false)}>
              <X size={16} />
            </button>
            <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16 }}>
              {lessonForm.id ? 'Editar Aula' : 'Nova Aula de Treinamento'}
            </h2>

            <form onSubmit={handleSaveLesson} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="admin-form-group">
                <label>Módulo</label>
                <select
                  value={lessonForm.moduleId}
                  onChange={(e) => setLessonForm({ ...lessonForm, moduleId: e.target.value })}
                  required
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label>Título da Aula</label>
                <input
                  type="text"
                  placeholder="ex: Planificação Automática de Chapas"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div className="admin-form-group">
                  <label>Link do Vídeo (YouTube, Vimeo, MP4 ou Embed)</label>
                  <input
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={lessonForm.videoUrl}
                    onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                    Suporta YouTube, Vimeo, Loom, Google Drive ou link direto MP4.
                  </small>
                </div>

                <div className="admin-form-group">
                  <label>Duração (min)</label>
                  <input
                    type="number"
                    min={1}
                    value={lessonForm.durationMinutes}
                    onChange={(e) => setLessonForm({ ...lessonForm, durationMinutes: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label>Descrição / Conteúdo da Aula</label>
                <textarea
                  rows={3}
                  placeholder="Orientações, passos importantes e resumo da aula…"
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                />
              </div>

              {/* Gerenciamento de Materiais de Apoio */}
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={15} style={{ color: '#10b981' }} /> Materiais de Apoio & Downloads
                </div>

                {lessonForm.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                    {lessonForm.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 380 }}>
                          📄 <strong>{att.title}</strong> ({att.url})
                        </span>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 2 }}
                          onClick={() => handleRemoveAttachment(idx)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Nome do arquivo (ex: Modelo.skp)"
                    value={newAttachTitle}
                    onChange={(e) => setNewAttachTitle(e.target.value)}
                    style={{ fontSize: 12, padding: 6 }}
                  />
                  <input
                    type="text"
                    placeholder="URL (Google Drive, Dropbox, CDN)"
                    value={newAttachUrl}
                    onChange={(e) => setNewAttachUrl(e.target.value)}
                    style={{ fontSize: 12, padding: 6 }}
                  />
                  <select
                    value={newAttachType}
                    onChange={(e) => setNewAttachType(e.target.value)}
                    style={{ fontSize: 12, padding: 6 }}
                  >
                    <option value="pdf">PDF</option>
                    <option value="skp">SKP</option>
                    <option value="dwg">DWG</option>
                    <option value="zip">ZIP</option>
                    <option value="link">Link</option>
                  </select>
                  <button
                    type="button"
                    className="btn outline sm"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    onClick={handleAddAttachment}
                  >
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn outline" onClick={() => setLessonModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" disabled={submitting}>
                  {submitting ? 'Salvando…' : 'Salvar Aula'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
