// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jwtVerify } from 'jose'

class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}

const storage = new MemoryStorage()
vi.stubGlobal('localStorage', storage)

const { mockApi } = await import('./mockApi')

beforeEach(() => {
  storage.clear()
  vi.useRealTimers()
})

describe('mockApi', () => {
  it('rejeita credenciais inválidas', async () => {
    await expect(mockApi.login('demo@example.com', 'errada')).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('faz login com o usuário demo e mantém a sessão', async () => {
    const u = await mockApi.login('demo@example.com', 'demo1234')
    expect(u.email).toBe('demo@example.com')
    expect((await mockApi.me())?.id).toBe(u.id)
    await mockApi.logout()
    expect(await mockApi.me()).toBeNull()
  })

  it('não permite e-mail duplicado no cadastro', async () => {
    await expect(mockApi.register('X', 'demo@example.com', '12345678')).rejects.toMatchObject({ code: 'email_taken' })
  })

  it('novo cadastro começa no plano free com 1 dispositivo', async () => {
    await mockApi.register('Ana', 'ana@example.com', '12345678')
    const lic = await mockApi.getLicense()
    expect(lic.plan).toBe('free')
    expect(lic.deviceLimit).toBe(1)
  })

  it('bloqueia o segundo computador da mesma pessoa', async () => {
    await mockApi.login('demo@example.com', 'demo1234')
    await mockApi.activateDevice('A', 'm-1')
    await expect(mockApi.activateDevice('B', 'm-2')).rejects.toMatchObject({ code: 'device_limit' })
    // mesma máquina não consome vaga extra
    await expect(mockApi.activateDevice('A', 'm-1')).resolves.toBeTruthy()
  })

  it('revogar libera vaga', async () => {
    await mockApi.login('demo@example.com', 'demo1234')
    const a = await mockApi.activateDevice('A', 'm-1')
    await mockApi.revokeDevice(a.id)
    await expect(mockApi.activateDevice('C', 'm-3')).resolves.toBeTruthy()
  })

  it('emite JWT com plano, limite e expiração', async () => {
    await mockApi.login('demo@example.com', 'demo1234')
    const lic = await mockApi.getLicense()
    const secret = new TextEncoder().encode('demo-secret-nao-usar-em-producao')
    const { payload } = await jwtVerify(lic.token, secret)
    expect(payload.plan).toBe('pro')
    expect(payload.dev).toBe(1)
    expect(payload.grace_days).toBe(7)
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000)
  })
})
