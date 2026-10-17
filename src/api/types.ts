export type Plan = 'free' | 'pro' | 'team'
export type LicenseStatus = 'active' | 'expired' | 'suspended' | 'past_due' | 'pending' | 'none'
export type OfferKey = 'pro_monthly' | 'pro_annual'

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
  seatLimit?: number
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

export interface Api {
  getPublicOffers(): Promise<PublicOffers>
  getAdminOverview(): Promise<AdminOverview>
  login(email: string, password: string): Promise<User>
  register(name: string, email: string, password: string): Promise<User>
  requestPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  logout(): Promise<void>
  me(): Promise<User | null>
  getLicense(): Promise<License>
  listDevices(): Promise<Device[]>
  listMembers(): Promise<Member[]>
  inviteMember(email: string): Promise<Member>
  removeMember(id: string): Promise<void>
  startCheckout(offer: OfferKey): Promise<{ url: string }>
  cancelSubscription(): Promise<void>
  /** Falha se a pessoa já tiver um computador ativo. */
  activateDevice(name: string, machineId: string): Promise<Device>
  revokeDevice(id: string): Promise<void>
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
