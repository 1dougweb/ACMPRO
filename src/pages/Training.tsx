import { useEffect, useState } from 'react'
import { usePageMeta } from '../lib/usePageMeta'

type Lesson = { title: string; minutes?: number; ready?: boolean }
type Course = { title: string; description?: string; lessonTotal?: number; lessons: Lesson[] }

const courses: Course[] = [
  {
    title: 'Tutorial GOACM',
    lessons: [
      { title: 'Novidades do GOACM', ready: true },
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

// The reference screen shows 35 lessons in the complete library. Only titles
// visible in the supplied material are listed here; missing lessons stay unavailable.
const totalLessons = 35
const PROGRESS_KEY = 'goacm_training_completed_v1'

function initialProgress(): string[] {
  try {
    const saved = localStorage.getItem(PROGRESS_KEY)
    return saved ? JSON.parse(saved) as string[] : ['0-0']
  } catch {
    return []
  }
}

export default function Training() {
  usePageMeta('Treinamentos', 'Aulas e treinamentos GOACM.')
  const [completed, setCompleted] = useState<string[]>(initialProgress)
  const [selected, setSelected] = useState<{ lesson: Lesson; key: string } | null>(null)
  const percentage = Math.round((completed.length / totalLessons) * 100)
  const lessonCount = totalLessons

  useEffect(() => { localStorage.setItem(PROGRESS_KEY, JSON.stringify(completed)) }, [completed])

  const markComplete = (key: string) => {
    setCompleted((current) => current.includes(key) ? current : [...current, key])
  }

  return (
    <div className="training-page">
      <div className="training-heading">
        <div>
          <h1 className="page-title">Treinamentos</h1>
          <p className="muted">Aprenda SketchUp do zero ao projeto executivo e acompanhe seu progresso em cada aula.</p>
        </div>
        <span className="training-community-note">Aulas disponíveis conforme o material vinculado ao portal</span>
      </div>

      <section className="training-progress card" aria-label="Progresso dos treinamentos">
        <div><strong>{completed.length} de {lessonCount} aulas</strong><span>{percentage}%</span></div>
        <div className="training-progress-track"><span style={{ width: `${percentage}%` }} /></div>
        <p className="hint">O progresso das aulas disponíveis fica salvo neste navegador.</p>
      </section>

      {courses.map((course, courseIndex) => {
        const courseCompleted = course.lessons.filter((_, lessonIndex) => completed.includes(`${courseIndex}-${lessonIndex}`)).length
        const courseTotal = course.lessonTotal ?? course.lessons.length
        return (
          <section className="training-course card" key={course.title}>
            <header><h2>{course.title}</h2><span>{courseCompleted} de {courseTotal} aulas</span></header>
            {course.description && <p className="muted">{course.description}</p>}
            <div className="lesson-list">
              {course.lessons.map((lesson, lessonIndex) => {
                const key = `${courseIndex}-${lessonIndex}`
                const done = completed.includes(key)
                return (
                  <button className="lesson-row" key={key} onClick={() => setSelected({ lesson, key })}>
                    <span className={`lesson-state ${done ? 'done' : lesson.ready ? 'current' : ''}`} aria-label={done ? 'Concluída' : lesson.ready ? 'Disponível' : 'Em breve'}>{done ? '✓' : lesson.ready ? '▶' : ''}</span>
                    <span className="lesson-number">{lessonIndex + 1}.</span>
                    <span className="lesson-title">{lesson.title}</span>
                    <span className="lesson-duration">{lesson.minutes ? `${lesson.minutes} min` : lesson.ready ? '' : 'Em breve'}</span>
                  </button>
                )
              })}
              {courseTotal > course.lessons.length && <div className="lesson-extra">Mais {courseTotal - course.lessons.length} aulas deste curso ainda não foram cadastradas no portal.</div>}
            </div>
          </section>
        )
      })}

      <p className="training-content-note">A biblioteca indica {lessonCount} aulas. As 23 aulas restantes ainda não têm título e material cadastrados neste portal.</p>

      {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
        <section className="profile-modal lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-modal-title">
          <button className="modal-close" aria-label="Fechar" onClick={() => setSelected(null)}>×</button>
          <p className="label">Treinamento GOACM</p>
          <h2 id="lesson-modal-title">{selected.lesson.title}</h2>
          {selected.lesson.ready
            ? <><p className="muted">Esta aula já está disponível no material introdutório do GOACM.</p><button className="btn primary" onClick={() => { markComplete(selected.key); setSelected(null) }}>Marcar como concluída</button></>
            : <p className="muted">O material desta aula ainda não foi vinculado ao portal. Sua lista e seu progresso ficam salvos neste navegador.</p>}
        </section>
      </div>}
    </div>
  )
}
