export type Plan = 'free' | 'pro' | 'team'
export type LicenseStatus = 'active' | 'expired' | 'suspended' | 'past_due' | 'pending' | 'none'
export type OfferKey = 'pro_monthly' | 'pro_annual'
export type ProjectStatus = 'rascunho' | 'em_producao' | 'concluido'

export interface Project {
  id: string
  name: string
  customerName: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  lastPublicationAt: string | null
  totalAreaM2?: number
  totalTubesM?: number
}

export interface ProjectPublication {
  id: string
  revision: number
  message: string
  modelName: string
  authorName: string
  status: 'pending' | 'published'
  metrics: Record<string, unknown>
  datasets: unknown[]
  partsSummary?: Record<string, unknown>
  activity?: unknown[]
  artifacts?: unknown[]
  createdAt: string
  publishedAt: string | null
}

export interface ProjectPart {
  id: string
  name: string
  widthMm: number
  heightMm: number
  quantity: number
  createdAt: string
}

export interface ProjectDetails {
  project: Project
  publications: ProjectPublication[]
  parts: ProjectPart[]
}

export interface PublicOffers {
  monthlyAmountCents: number
  annualAmountCents: number | null
  monthlyTrialDays: number
}

export interface AdminOverview {
  accountCount: number
  activeLicenseCount: number
  activeMemberCount: number
  pendingOrderCount: number
  recentAccounts: Array<{
    id: string
    name: string
    email: string | null
    createdAt: string
  }>
  recentOrders: Array<{
    id: string
    offerKey: OfferKey
    status: string
    amountCents: number
    createdAt: string
  }>
}

export function isOfferKey(value: string | null): value is OfferKey {
  return value === 'pro_monthly' || value === 'pro_annual'
}

export interface User {
  id: string
  name: string
  email: string
  phone?: string
}

export interface Device {
  id: string
  name: string
  machineId: string
  lastSeen: string
  memberName?: string | null
  memberEmail?: string | null
}

export interface License {
  plan: Plan
  status: LicenseStatus
  expiresAt: string | null
  trialEndsAt?: string | null
  deviceLimit: number | null
  hasSubscription?: boolean
  lifetime?: boolean
  seatLimit?: number | null
  seatsUsed?: number
  devicesUsed?: number
  role?: 'owner' | 'member'
  offerKey?: OfferKey | null
  cancellable?: boolean
  cancelAtPeriodEnd?: boolean
  /** JWT assinado. No MVP é assinado pelo mock (demonstração). */
  token: string
}

export interface Member {
  id: string
  email: string
  name: string | null
  role: 'owner' | 'member'
  status: 'active' | 'invited' | 'removed'
  createdAt: string
}

export type PreferredLocale = 'pt-BR' | 'en' | 'es'

export interface Api {
  listProjects(): Promise<Project[]>
  createProject(name: string, customerName?: string): Promise<Project>
  updateProjectStatus(projectId: string, status: ProjectStatus): Promise<Project>
  getProjectDetails(projectId: string): Promise<ProjectDetails>
  getPublicOffers(): Promise<PublicOffers>
  getAdminOverview(): Promise<AdminOverview>
  login(email: string, password: string): Promise<User>
  register(name: string, email: string, password: string): Promise<User>
  updateProfile(profile: { name: string; phone: string }): Promise<User>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  logout(): Promise<void>
  me(): Promise<User | null>
  getLicense(): Promise<License>
  listDevices(): Promise<Device[]>
  listMembers(): Promise<Member[]>
  inviteMember(email: string, profile?: { name?: string; preferredLocale?: PreferredLocale }): Promise<Member>
  removeMember(id: string): Promise<void>
  startCheckout(offer: OfferKey): Promise<{ url: string }>
  cancelSubscription(): Promise<void>
  /** Falha se a pessoa já tiver um computador ativo. */
  activateDevice(name: string, machineId: string): Promise<Device>
  revokeDevice(id: string): Promise<void>
  listPluginReleases(): Promise<PluginRelease[]>
  getLatestPluginRelease(): Promise<LatestPluginRelease | null>
  loginWithGoogle(): Promise<void>
  uploadPluginRelease(data: {
    version: string
    notes: string
    file: File
    minSketchupVersion?: string
    isMandatory?: boolean
  }): Promise<{ success: boolean; release: PluginRelease }>
}

export interface LatestPluginRelease {
  version: string
  downloadUrl: string
  fileName?: string
  notes?: string
}

export interface PluginRelease {
  id: string
  version: string
  notes: string
  file_url: string
  file_name?: string
  file_size_bytes?: number
  sha256?: string
  min_sketchup_version?: string
  is_mandatory?: boolean
  created_at: string
}

export const PLAN_LIMITS: Record<Plan, number> = { free: 1, pro: 1, team: 1 }
export const PLAN_LABELS: Record<Plan, string> = { free: 'Free', pro: 'Pro', team: 'Equipe' }

export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
