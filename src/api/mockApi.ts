import { SignJWT } from 'jose'
import {
  ApiError,
  type AdminOverview,
  type Api,
  type Device,
  type License,
  type Member,
  type OfferKey,
  type Plan,
  type PluginRelease,
  type LatestPluginRelease,
  type Project,
  type ProjectDetails,
  type ProjectPublication,
  type ProjectStatus,
  type PublicOffers,
  type User,
} from './types'

// ATENÇÃO: mock apenas para validar fluxo e UI. Não é seguro.
// Em produção o JWT deve ser assinado no servidor (RS256, chave privada).
const DEMO_SECRET = new TextEncoder().encode('demo-secret-nao-usar-em-producao')
const KEY = 'meuacm_mock_db_v1'
const SESSION = 'meuacm_mock_session_v1'
const LICENSE_DAYS = 30

interface Account extends User {
  password: string
  plan: Plan
  expiresAt: string
  devices: Device[]
  members?: Member[]
  projects?: Project[]
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const uid = () => crypto.randomUUID()

const isBrowser = typeof window !== 'undefined'

function load(): Account[] {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    const list = JSON.parse(raw) as Account[]
    if (isBrowser) {
      const demo = list.find((a) => a.email.toLowerCase() === 'demo@example.com')
      if (demo && (!demo.devices || demo.devices.length === 0)) {
        demo.devices = [
          {
            id: 'dev-demo-1',
            name: 'Workstation Dell Precision (SketchUp 3D)',
            machineId: '8f7a2b1c4e9d0a1b2c3d4e5f6a7b8c9d',
            lastSeen: new Date().toISOString(),
            memberName: demo.name,
            memberEmail: demo.email,
          },
        ]
        save(list)
      }
    }
    return list
  }
  const seed: Account[] = [
    {
      id: uid(),
      name: 'Usuário Demo',
      email: 'demo@example.com',
      password: 'demo1234',
      plan: 'pro',
      expiresAt: new Date(Date.now() + LICENSE_DAYS * 864e5).toISOString(),
      devices: isBrowser
        ? [
            {
              id: 'dev-demo-1',
              name: 'Workstation Dell Precision (SketchUp 3D)',
              machineId: '8f7a2b1c4e9d0a1b2c3d4e5f6a7b8c9d',
              lastSeen: new Date().toISOString(),
              memberName: 'Usuário Demo',
              memberEmail: 'demo@example.com',
            },
          ]
        : [],
      members: [{ id: 'member-demo-owner', email: 'demo@example.com', name: 'Usuário Demo', role: 'owner', status: 'active', createdAt: new Date().toISOString() }],
    },
  ]
  save(seed)
  return seed
}

function save(db: Account[]) {
  localStorage.setItem(KEY, JSON.stringify(db))
}

function current(): Account | null {
  const id = localStorage.getItem(SESSION)
  return load().find((a) => a.id === id) ?? null
}

function required(): Account {
  const acc = current()
  if (!acc) throw new ApiError('unauthenticated', 'Sessão expirada. Entre novamente.')
  return acc
}

const pub = (a: Account): User => ({ id: a.id, name: a.name, email: a.email, phone: a.phone ?? '' })

export async function signLicenseToken(a: Pick<Account, 'id' | 'plan' | 'expiresAt'>) {
  return new SignJWT({
    plan: a.plan,
    dev: 1,
    grace_days: 7,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(a.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(new Date(a.expiresAt).getTime() / 1000))
    .sign(DEMO_SECRET)
}

export const mockApi: Api = {
  async listProjects() {
    await delay(100)
    return required().projects ?? []
  },

  async createProject(name, customerName = '') {
    await delay()
    const account = required()
    const db = load()
    const target = db.find((item) => item.id === account.id)!
    const now = new Date().toISOString()
    const project: Project = {
      id: uid(), name: name.trim(), customerName: customerName.trim(), status: 'rascunho',
      createdAt: now, updatedAt: now, lastPublicationAt: null,
    }
    target.projects = [...(target.projects ?? []), project]
    save(db)
    return project
  },

  async updateProjectStatus(projectId: string, status: ProjectStatus) {
    await delay()
    const account = required()
    const db = load()
    const target = db.find((item) => item.id === account.id)!
    const project = target.projects?.find((item) => item.id === projectId)
    if (!project) throw new ApiError('project_not_found', 'Projeto não encontrado.')
    project.status = status
    project.updatedAt = new Date().toISOString()
    save(db)
    return project
  },

  async getProjectDetails(projectId: string): Promise<ProjectDetails> {
    await delay(100)
    const project = (required().projects ?? []).find((item) => item.id === projectId)
    if (!project) throw new ApiError('project_not_found', 'Projeto não encontrado.')
    const samplePublication: ProjectPublication = {
      id: `pub-${projectId}-1`,
      revision: 1,
      message: 'Publicação de Estruturas e Planificações CAD',
      modelName: 'Projeto Estrutural.skp',
      authorName: required().name,
      status: 'published',
      metrics: { total_area_m2: 14.8, total_tubes_m: 21.5 },
      datasets: [
        {
          kind: 'metal_cut_list',
          label: 'Lista de Corte - Gradil Principal',
          role: 'data',
          tags: ['Estruturas'],
          payload: {
            project_name: project.name,
            total_pieces: 16,
            total_meters: 21.497,
            cut_list: [
              { metal_name: 'Aço Carbono', color: '#00E100', tube_desc: 'Tubo Quadrado 20 x 20 - 1.25mm', cut: '—', length_mm: 2265.0, qty: 4, section: 'Gradil 1' },
              { metal_name: 'Aço Carbono', color: '#DC1E28', tube_desc: 'Tubo Quadrado 20 x 20 - 1.25mm', cut: '—', length_mm: 1273.5, qty: 4, section: 'Gradil 1' },
              { metal_name: 'Aço Carbono', color: '#00B4FF', tube_desc: 'Tubo Quadrado 20 x 20 - 1.25mm', cut: '—', length_mm: 1233.5, qty: 1, section: 'Gradil 1' },
              { metal_name: 'Aço Carbono', color: '#5A1EFF', tube_desc: 'Tubo Quadrado 20 x 20 - 1.25mm', cut: '—', length_mm: 1122.5, qty: 1, section: 'Gradil 1' },
              { metal_name: 'Aço Carbono', color: '#FFB42D', tube_desc: 'Tubo Quadrado 20 x 20 - 1.25mm', cut: '—', length_mm: 606.8, qty: 2, section: 'Gradil 1' },
              { metal_name: 'Aço Carbono', color: '#F0B4FF', tube_desc: 'Tubo Quadrado 20 x 20 - 1.25mm', cut: '—', length_mm: 372.0, qty: 4, section: 'Gradil 1' },
            ],
          },
        },
      ],
      createdAt: project.createdAt,
      publishedAt: project.createdAt,
    }
    return { project, publications: [samplePublication], parts: [] }
  },

  async getPublicOffers(): Promise<PublicOffers> {
    await delay(100)
    return { monthlyAmountCents: 9700, annualAmountCents: 97000, monthlyTrialDays: 7 }
  },

  async getAdminOverview(): Promise<AdminOverview> {
    throw new ApiError('site_admin_required', 'A administração está disponível somente para contas autorizadas.')
  },

  async login(email, password) {
    await delay()
    const acc = load().find((a) => a.email.toLowerCase() === email.toLowerCase())
    if (!acc || acc.password !== password) {
      throw new ApiError('invalid_credentials', 'E-mail ou senha inválidos.')
    }
    localStorage.setItem(SESSION, acc.id)
    return pub(acc)
  },

  async register(name, email, password) {
    await delay()
    const db = load()
    if (db.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
      throw new ApiError('email_taken', 'Este e-mail já está cadastrado.')
    }
    const acc: Account = {
      id: uid(),
      name,
      email,
      password,
      plan: 'free',
      expiresAt: new Date(Date.now() + LICENSE_DAYS * 864e5).toISOString(),
      devices: [],
      members: [{ id: uid(), email: email.toLowerCase(), name, role: 'owner', status: 'active', createdAt: new Date().toISOString() }],
    }
    db.push(acc)
    save(db)
    localStorage.setItem(SESSION, acc.id)
    return pub(acc)
  },

  async updateProfile(profile) {
    await delay()
    const account = required()
    const db = load()
    const target = db.find((item) => item.id === account.id)!
    target.name = profile.name.trim()
    target.phone = profile.phone.trim()
    save(db)
    return pub(target)
  },

  async logout() {
    await delay(100)
    localStorage.removeItem(SESSION)
  },

  async requestPasswordReset(_email: string) {
    await delay()
    throw new ApiError('mock_not_supported', 'A recuperação de senha exige a conexão com o Supabase.')
  },

  async updatePassword() {
    await delay()
    throw new ApiError('mock_not_supported', 'A redefinição de senha exige a conexão com o Supabase.')
  },

  async me() {
    await delay(100)
    const acc = current()
    return acc ? pub(acc) : null
  },

  async getLicense(): Promise<License> {
    await delay()
    const acc = required()
    const expired = new Date(acc.expiresAt).getTime() < Date.now()
    const activeMembers = acc.members?.filter((member) => member.status === 'active').length ?? 1
    return {
      plan: acc.plan,
      status: expired ? 'expired' : 'active',
      expiresAt: acc.expiresAt,
      deviceLimit: activeMembers,
      hasSubscription: acc.plan !== 'free' && !expired,
      seatLimit: 3,
      seatsUsed: acc.members?.filter((member) => member.status !== 'removed').length ?? 1,
      role: 'owner',
      cancellable: false,
      token: await signLicenseToken(acc),
    }
  },

  async listDevices() {
    await delay()
    return required().devices
  },

  async listMembers() {
    await delay()
    const account = required()
    return account.members ?? [{ id: account.id, email: account.email, name: account.name, role: 'owner', status: 'active', createdAt: new Date().toISOString() }]
  },

  async inviteMember(email, profile) {
    await delay()
    const account = required()
    const db = load()
    const target = db.find((a) => a.id === account.id)!
    target.members ??= [{ id: target.id, email: target.email, name: target.name, role: 'owner', status: 'active', createdAt: new Date().toISOString() }]
    const normalizedEmail = email.trim().toLowerCase()
    if (target.members.some((member) => member.email.toLowerCase() === normalizedEmail && member.status !== 'removed')) {
      throw new ApiError('member_exists', 'Este e-mail já está na equipe ou tem um convite pendente.')
    }
    if (target.members.filter((member) => member.status !== 'removed').length >= 3) {
      throw new ApiError('seat_limit', 'O plano atual permite até 3 acessos, incluindo o titular.')
    }
    const member: Member = { id: uid(), email: normalizedEmail, name: profile?.name?.trim() || null, role: 'member', status: 'invited', createdAt: new Date().toISOString() }
    target.members.push(member)
    save(db)
    return member
  },

  async removeMember(id) {
    await delay()
    const account = required()
    const db = load()
    const target = db.find((a) => a.id === account.id)!
    const member = target.members?.find((item) => item.id === id)
    if (!member || member.role === 'owner') throw new ApiError('member_not_found', 'Membro não encontrado.')
    member.status = 'removed'
    save(db)
  },

  async startCheckout(_offer: OfferKey) {
    await delay()
    throw new ApiError('mock_not_supported', 'O checkout exige a conexão com o Mercado Pago e está desativado no modo de demonstração.')
  },

  async cancelSubscription() {
    throw new ApiError('mock_not_supported', 'O cancelamento de assinatura está disponível quando o portal estiver conectado ao backend.')
  },

  async activateDevice(name, machineId) {
    await delay()
    const acc = required()
    const db = load()
    const target = db.find((a) => a.id === acc.id)!
    const existing = target.devices.find((d) => d.machineId === machineId)
    if (existing) {
      existing.lastSeen = new Date().toISOString()
      save(db)
      return existing
    }
    if (target.devices.length >= 1) {
      throw new ApiError(
        'device_limit',
        'Cada pessoa pode autorizar um computador. Revogue o anterior para trocar de máquina.',
      )
    }
    const device: Device = {
      id: uid(),
      name,
      machineId,
      lastSeen: new Date().toISOString(),
      memberName: acc.name,
      memberEmail: acc.email,
    }
    target.devices.push(device)
    save(db)
    return device
  },

  async revokeDevice(id) {
    await delay()
    const acc = required()
    const db = load()
    const target = db.find((a) => a.id === acc.id)!
    target.devices = target.devices.filter((d) => d.id !== id)
    save(db)
  },

  async listPluginReleases(): Promise<PluginRelease[]> {
    await delay()
    return [
      {
        id: 'rel-1',
        version: '1.1.38',
        notes: 'Cores atualizadas conforme o portal (Verde Esmeralda), novo layout de impressão e sistema de updates.',
        file_url: 'https://acmgo.vercel.app/download',
        file_name: 'GOACM-1.1.38.rbz',
        file_size_bytes: 4500000,
        min_sketchup_version: '2021',
        is_mandatory: false,
        created_at: new Date().toISOString(),
      },
    ]
  },

  async getLatestPluginRelease(): Promise<LatestPluginRelease | null> {
    await delay()
    return {
      version: '1.1.44',
      downloadUrl: 'https://dqwrxsbekfeyzbzvnubg.supabase.co/storage/v1/object/public/plugin-releases/releases/1792276608596_GOACM-1.1.44.rbz',
      fileName: 'GOACM-1.1.44.rbz',
      notes: 'Versão oficial mais recente do ACMGO.',
    }
  },

  async loginWithGoogle(): Promise<void> {
    await delay(300)
    const acc = load()[0]
    if (acc) {
      localStorage.setItem(SESSION, acc.id)
    }
  },

  async uploadPluginRelease(data) {
    await delay(500)
    const release: PluginRelease = {
      id: uid(),
      version: data.version,
      notes: data.notes,
      file_url: 'https://acmgo.vercel.app/download',
      file_name: data.file.name,
      file_size_bytes: data.file.size,
      min_sketchup_version: data.minSketchupVersion || '2021',
      is_mandatory: Boolean(data.isMandatory),
      created_at: new Date().toISOString(),
    }
    return { success: true, release }
  },
}
