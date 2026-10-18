import { requestContext } from '../_shared/auth.ts'
import { errorMessage, preflight, respond } from '../_shared/http.ts'
import { verifiedEmail } from '../_shared/site-admin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight(req)

  const ctx = await requestContext(req)
  if (!ctx) {
    return respond(req, { error: 'unauthorized', message: 'Entre novamente no portal.' }, 401)
  }

  const isAdmin = verifiedEmail(ctx.user)

  try {
    const url = new URL(req.url)
    const body = (req.method === 'POST' ? await req.json().catch(() => ({})) : {}) as Record<string, any>
    const action = body.action || url.searchParams.get('action') || (req.method === 'GET' ? 'list' : 'list')

    // 1. LISTAR MÓDULOS, AULAS E PROGRESSO
    if (action === 'list') {
      const [modulesRes, lessonsRes, progressRes] = await Promise.all([
        ctx.admin.from('training_modules').select('*').order('order_index', { ascending: true }),
        ctx.admin.from('training_lessons').select('*').order('order_index', { ascending: true }),
        ctx.admin.from('training_progress').select('lesson_id, completed').eq('user_id', ctx.user.id),
      ])

      if (modulesRes.error) throw modulesRes.error
      if (lessonsRes.error) throw lessonsRes.error

      const completedLessonIds = (progressRes.data ?? [])
        .filter((p) => p.completed)
        .map((p) => p.lesson_id)

      const lessonsByModule = new Map<string, any[]>()
      for (const lesson of lessonsRes.data ?? []) {
        const list = lessonsByModule.get(lesson.module_id) ?? []
        list.push({
          id: lesson.id,
          moduleId: lesson.module_id,
          title: lesson.title,
          description: lesson.description || '',
          videoUrl: lesson.video_url || '',
          durationMinutes: lesson.duration_minutes || 0,
          attachments: Array.isArray(lesson.attachments) ? lesson.attachments : [],
          orderIndex: lesson.order_index,
          completed: completedLessonIds.includes(lesson.id),
        })
        lessonsByModule.set(lesson.module_id, list)
      }

      const modules = (modulesRes.data ?? []).map((mod) => ({
        id: mod.id,
        title: mod.title,
        description: mod.description || '',
        orderIndex: mod.order_index,
        lessons: lessonsByModule.get(mod.id) ?? [],
      }))

      return respond(req, {
        success: true,
        isAdmin,
        modules,
        completedLessonIds,
      })
    }

    // 2. ALTERAR PROGRESSO (CONCLUIR / DESMARCAR AULA)
    if (action === 'toggle-progress') {
      const { lessonId, completed } = body
      if (!lessonId) {
        return respond(req, { error: 'bad_request', message: 'ID da aula não informado.' }, 400)
      }

      if (completed) {
        await ctx.admin.from('training_progress').upsert({
          user_id: ctx.user.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_id' })
      } else {
        await ctx.admin.from('training_progress').delete()
          .eq('user_id', ctx.user.id)
          .eq('lesson_id', lessonId)
      }

      const { data: updatedProgress } = await ctx.admin
        .from('training_progress')
        .select('lesson_id')
        .eq('user_id', ctx.user.id)
        .eq('completed', true)

      return respond(req, {
        success: true,
        completedLessonIds: (updatedProgress ?? []).map((p) => p.lesson_id),
      })
    }

    // ==========================================
    // AÇÕES DE ADMINISTRADOR
    // ==========================================
    if (!isAdmin) {
      return respond(req, { error: 'forbidden', message: 'Apenas administradores podem gerenciar o conteúdo dos treinamentos.' }, 403)
    }

    // 3. SALVAR / CRIAR MÓDULO
    if (action === 'save-module') {
      const { id, title, description, orderIndex } = body
      if (!title?.trim()) {
        return respond(req, { error: 'bad_request', message: 'Título do módulo é obrigatório.' }, 400)
      }

      const payload = {
        title: title.trim(),
        description: description?.trim() || null,
        order_index: typeof orderIndex === 'number' ? orderIndex : 0,
        updated_at: new Date().toISOString(),
      }

      let resultId = id
      if (id) {
        const { error } = await ctx.admin.from('training_modules').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await ctx.admin.from('training_modules').insert(payload).select('id').single()
        if (error) throw error
        resultId = data.id
      }

      return respond(req, { success: true, moduleId: resultId, message: 'Módulo salvo com sucesso!' })
    }

    // 4. EXCLUIR MÓDULO
    if (action === 'delete-module') {
      const { moduleId } = body
      if (!moduleId) {
        return respond(req, { error: 'bad_request', message: 'ID do módulo não informado.' }, 400)
      }

      const { error } = await ctx.admin.from('training_modules').delete().eq('id', moduleId)
      if (error) throw error

      return respond(req, { success: true, message: 'Módulo excluído com sucesso!' })
    }

    // 5. SALVAR / CRIAR AULA
    if (action === 'save-lesson') {
      const { id, moduleId, title, description, videoUrl, durationMinutes, attachments, orderIndex } = body
      if (!moduleId) {
        return respond(req, { error: 'bad_request', message: 'Módulo de destino não informado.' }, 400)
      }
      if (!title?.trim()) {
        return respond(req, { error: 'bad_request', message: 'Título da aula é obrigatório.' }, 400)
      }

      const payload = {
        module_id: moduleId,
        title: title.trim(),
        description: description?.trim() || null,
        video_url: videoUrl?.trim() || null,
        duration_minutes: Number(durationMinutes) || 0,
        attachments: Array.isArray(attachments) ? attachments : [],
        order_index: typeof orderIndex === 'number' ? orderIndex : 0,
        updated_at: new Date().toISOString(),
      }

      let resultId = id
      if (id) {
        const { error } = await ctx.admin.from('training_lessons').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await ctx.admin.from('training_lessons').insert(payload).select('id').single()
        if (error) throw error
        resultId = data.id
      }

      return respond(req, { success: true, lessonId: resultId, message: 'Aula salva com sucesso!' })
    }

    // 6. EXCLUIR AULA
    if (action === 'delete-lesson') {
      const { lessonId } = body
      if (!lessonId) {
        return respond(req, { error: 'bad_request', message: 'ID da aula não informado.' }, 400)
      }

      const { error } = await ctx.admin.from('training_lessons').delete().eq('id', lessonId)
      if (error) throw error

      return respond(req, { success: true, message: 'Aula excluída com sucesso!' })
    }

    return respond(req, { error: 'invalid_action', message: 'Ação não reconhecida.' }, 400)
  } catch (error) {
    console.error('training-content failed', errorMessage(error))
    return respond(req, { error: 'training_failed', message: errorMessage(error) || 'Erro no sistema de treinamentos.' }, 500)
  }
})
