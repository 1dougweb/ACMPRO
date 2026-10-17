import { useCallback, useEffect, useState } from 'react'
import { Laptop, AlertTriangle, Trash2 } from 'lucide-react'
import { api, type Device, type License } from '../api'
import { usePageMeta } from '../lib/usePageMeta'

export default function Devices() {
  usePageMeta('Dispositivos', 'Autorize e revogue máquinas com o plugin instalado.')
  const [devices, setDevices] = useState<Device[]>([])
  const [license, setLicense] = useState<License | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const [d, l] = await Promise.all([api.listDevices(), api.getLicense()])
    setDevices(d)
    setLicense(l)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const revoke = async (id: string) => {
    setError('')
    try {
      await api.revokeDevice(id)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <>
      <h1 className="page-title">Dispositivos</h1>
      <p className="muted">
        {license ? `${devices.length} computador(es) autorizado(s). Cada pessoa ativa pode usar 1.` : 'Carregando…'}
      </p>

      <section className="card">
        <h2>Trocar de computador</h2>
        <p className="muted">Cada pessoa pode autorizar 1 computador. Para trocar, revogue o computador anterior e entre no plugin GOACM pela nova máquina com o mesmo e-mail e senha usados no portal.</p>
        {error && <div className="alert" role="alert"><AlertTriangle size={15} /> {error}</div>}
      </section>

      <section className="card">
        <h2>Máquinas autorizadas</h2>
        {devices.length === 0 ? (
          <p className="empty">Nenhum dispositivo autorizado ainda.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {license?.role === 'owner' && <th>Pessoa</th>}
                <th>Computador</th>
                <th>ID da máquina</th>
                <th>Último acesso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  {license?.role === 'owner' && <td>{d.memberName || d.memberEmail || 'Titular'}</td>}
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Laptop size={14} style={{ color: 'var(--brand)' }} />
                      {d.name}
                    </span>
                  </td>
                  <td><code>{d.machineId.slice(0, 8)}…</code></td>
                  <td>{new Date(d.lastSeen).toLocaleString('pt-BR')}</td>
                  <td className="right">
                    <button className="btn danger sm" onClick={() => revoke(d.id)}>
                      <Trash2 size={12} /> Revogar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
