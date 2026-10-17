import { useState } from 'react'
import {
  GraduationCap,
  BookOpen,
  Clock,
  X,
} from 'lucide-react'
import { usePageMeta } from '../lib/usePageMeta'

type Lesson = { title: string; minutes?: number }
type Course = { title: string; description?: string; lessonTotal?: number; lessons: Lesson[] }

const courses: Course[] = [
  {
    title: 'Tutorial GOACM',
    lessons: [
      { title: 'Novidades do GOACM' },
      { title: 'Estruturas', minutes: 27 },
      { title: 'Planificação', minutes: 11 },
    ],
  },
  { title: 'LIVE DE LANÇAMENTO', lessons: [{ title: 'Apresentação GOACM', minutes: 50 }] },
  {
    title: 'Modelagem 3D — SketchUp',
    description: 'Aprenda as ferramentas do SketchUp e pratique a modelagem de fachadas e elementos em ACM.',
    lessonTotal: 22,
    lessons: [
      ['Interface SketchUp', 12], ['Navegação', 4], ['Ferramentas Fundamentais', 28], ['Modelagem Base', 19],
      ['Atalhos', 4], ['Criando Abertura de Porta', 9], ['3D Warehouse', 8], ['Modelagem Sobre a Foto', 14],
    ].map(([title, minutes]) => ({ title: String(title), minutes: Number(minutes) })),
  },
]

const totalLessons = 35

export default function Training() {
  usePageMeta('Treinamentos', 'Aulas e treinamentos GOACM.')
  const [selected, setSelected] = useState<Lesson | null>(null)
  const completed = 0
  const percentage = 0
  const lessonCount = totalLessons

  return (
    <div className="training-page">
      <div className="training-heading">
        <div>
          <h1 className="page-title">Treinamentos</h1>
          <p className="muted">Consulte a trilha de treinamento GOACM e acompanhe as aulas que serão disponibilizadas no portal.</p>
        </div>
        <span className="training-community-note">
          <GraduationCap size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4, color: 'var(--brand)' }} />
          Aulas disponíveis conforme o material vinculado ao portal
        </span>
      </div>

      <section className="training-progress card" aria-label="Progresso dos treinamentos">
        <div>
          <strong>{completed} de {lessonCount} aulas com material disponível</strong>
          <span>{percentage}%</span>
        </div>
        <div className="training-progress-track">
          <span style={{ width: `${percentage}%` }} />
        </div>
        <p className="hint">Os vídeos e arquivos das aulas ainda não foram vinculados ao portal.</p>
      </section>

      {courses.map((course, courseIndex) => {
        const courseTotal = course.lessonTotal ?? course.lessons.length
        return (
          <section className="training-course card" key={course.title}>
            <header>
              <h2>
                <BookOpen size={17} style={{ color: 'var(--brand)' }} />
                {course.title}
              </h2>
              <span>0 de {courseTotal} aulas disponíveis</span>
            </header>
            {course.description && <p className="muted">{course.description}</p>}
            <div className="lesson-list">
              {course.lessons.map((lesson, lessonIndex) => {
                return (
                  <button className="lesson-row" key={`${courseIndex}-${lessonIndex}`} onClick={() => setSelected(lesson)}>
                    <span className="lesson-state" aria-label="Material ainda não vinculado" />
                    <span className="lesson-number">{lessonIndex + 1}.</span>
                    <span className="lesson-title">{lesson.title}</span>
                    <span className="lesson-duration">
                      {lesson.minutes ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {lesson.minutes} min
                        </span>
                      ) : (
                        'Material pendente'
                      )}
                    </span>
                  </button>
                )
              })}
              {courseTotal > course.lessons.length && (
                <div className="lesson-extra">
                  Mais {courseTotal - course.lessons.length} aulas deste curso ainda não foram cadastradas no portal.
                </div>
              )}
            </div>
          </section>
        )
      })}

      <p className="training-content-note">As aulas ainda não têm vídeos, arquivos ou links de material cadastrados. Abra uma aula para ver esse status.</p>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
          <section className="profile-modal lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-modal-title">
            <button className="modal-close" aria-label="Fechar" onClick={() => setSelected(null)}>
              <X size={16} />
            </button>
            <p className="label">Treinamento GOACM</p>
            <h2 id="lesson-modal-title">{selected.title}</h2>
            <p className="muted">Esta aula está listada, mas ainda não tem vídeo, arquivo ou link de acesso cadastrado. O portal não registra progresso sem um material disponível.</p>
          </section>
        </div>
      )}
    </div>
  )
}
