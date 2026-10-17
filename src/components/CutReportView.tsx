import { useMemo, useState } from 'react'
import {
  RefreshCw,
  Printer,
  Download,
  Ruler,
  ChevronDown,
  FileText,
} from 'lucide-react'

export interface RawCutPiece {
  id: string
  metal: string
  desc: string
  color: string
  cut: string
  lengthMm: number
  qty: number
  section?: string
  sectionTag?: string
  productionTag?: string
  isFastener?: boolean
}

interface CutReportViewProps {
  projectName?: string
  modelName?: string
  cuts: RawCutPiece[]
  onRefresh?: () => void
}

type CutUnit = 'mm' | 'cm' | 'pol'
type Decimals = 0 | 1 | 2
type ScopeMode = 'selected' | 'all'
type FilterCategory = 'all' | 'structures' | 'fixadores'
type RowFillMode = 0 | 1 | 2
type PrintScope = 'cutlist' | 'cutplan'

const COLOR_NAMES: Record<string, string> = {
  '#00E100': 'Verde Vivo',
  '#DC1E28': 'Vermelho',
  '#00B4FF': 'Azul Claro',
  '#5A1EFF': 'Roxo',
  '#FFB42D': 'Laranja',
  '#F0B4FF': 'Rosa',
  '#06D6A0': 'Verde Neon',
  '#118AB2': 'Azul Oceano',
  '#FFD166': 'Mostarda',
  '#EF476F': 'Magenta',
  '#2A9D8F': 'Verde Água',
  '#E76F51': 'Terracota',
  '#FF3232': 'Vermelho Alerta',
}

const DEFAULT_PALETTE = [
  '#00E100',
  '#DC1E28',
  '#00B4FF',
  '#5A1EFF',
  '#FFB42D',
  '#F0B4FF',
  '#06D6A0',
  '#118AB2',
  '#FFD166',
  '#EF476F',
]

function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '')
  if (clean.length < 6) return false
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  if (clean.length < 6) return `rgba(200,200,200,${alpha})`
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function formatMeasure(mm: number, unit: CutUnit, decimals: Decimals): string {
  let val = mm
  if (unit === 'cm') val = mm / 10
  else if (unit === 'pol') val = mm / 25.4
  return val.toFixed(decimals)
}

function formatLinearTotal(mm: number, qty: number, unit: CutUnit, decimals: Decimals): string {
  const totalMm = mm * qty
  if (unit === 'cm') return (totalMm / 10).toFixed(decimals)
  if (unit === 'pol') return (totalMm / 25.4).toFixed(decimals)
  return totalMm.toFixed(decimals)
}

interface Piece {
  len: number
  color: string
  id: string
  name: string
  cut: string
  productionTag?: string
}

interface Bar {
  pieces: Piece[]
  used: number
  remaining: number
  waste: number
  pct: number
}

interface CutPlanGroup {
  metal: string
  desc: string
  cor: string
  totalBars: number
  totalPieces: number
  avgPct: number
  totalWaste: number
  bars: Bar[]
}

function barLegendGroups(pieces: Piece[], fallbackColor: string) {
  const groups: Array<{ len: number; color: string; qty: number; code?: string }> = []
  const idx: Record<string, number> = {}

  pieces.forEach((p) => {
    const color = p.color || fallbackColor
    const code = p.productionTag || ''
    const k = `${p.len}|${color}|${code}`
    if (idx[k] === undefined) {
      idx[k] = groups.length
      groups.push({ len: p.len, color, qty: 0, code })
    }
    groups[idx[k]].qty++
  })

  return groups
}

export function CutReportView({ projectName, modelName, cuts, onRefresh }: CutReportViewProps) {
  const [activeTab, setActiveTab] = useState<'cutlist' | 'cutplan'>('cutlist')

  // Toolbar state
  const [scope, setScope] = useState<ScopeMode>('selected')
  const [category, setCategory] = useState<FilterCategory>('all')
  const [unit, setUnit] = useState<CutUnit>('mm')
  const [decimals, setDecimals] = useState<Decimals>(1)
  const [rowFill, setRowFill] = useState<RowFillMode>(0)

  // Plan parameters
  const [barLengthMm, setBarLengthMm] = useState<number>(6000)
  const [kerfMm, setKerfMm] = useState<number>(3)

  // Print controls
  const [printScope, setPrintScope] = useState<PrintScope>('cutlist')
  const [printDropdownOpen, setPrintDropdownOpen] = useState(false)

  // Interactive checked pieces in bars
  const [checkedPieces, setCheckedPieces] = useState<Record<string, boolean>>({})

  const togglePieceCheck = (key: string) => {
    setCheckedPieces((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // 1. Normaliza cores e filtra cortes
  const filteredCuts = useMemo(() => {
    return cuts.map((c, i) => {
      let color = c.color
      if (!color || color === '#CCCCCC' || color === '#ccc') {
        color = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]
      }
      return { ...c, color }
    }).filter((c) => {
      if (category === 'fixadores') return Boolean(c.isFastener)
      if (category === 'structures') return !c.isFastener
      return true
    })
  }, [cuts, category])

  // 2. Consolida a Lista de Corte (igual cutlist.js)
  const consolidated = useMemo(() => {
    const map: Record<string, {
      metal: string
      desc: string
      color: string
      cut: string
      lengthMm: number
      qty: number
      totalLinearMm: number
      sections: Set<string>
    }> = {}
    const order: string[] = []

    filteredCuts.forEach((c) => {
      if (c.lengthMm <= 0) return
      const metal = c.metal || 'Aço Carbono'
      const desc = c.desc || 'Tubo Quadrado'
      const color = c.color || '#00E100'
      const cut = c.cut || '—'
      const lenKey = c.lengthMm.toFixed(2)
      const key = `${metal}|${desc}|${color}|${cut}|${lenKey}`

      if (!map[key]) {
        map[key] = {
          metal,
          desc,
          color,
          cut,
          lengthMm: c.lengthMm,
          qty: 0,
          totalLinearMm: 0,
          sections: new Set(),
        }
        order.push(key)
      }

      map[key].qty += c.qty
      map[key].totalLinearMm += (c.lengthMm * c.qty)
      if (c.section) map[key].sections.add(c.section)
    })

    // Ordenação padrão: metal > desc > comprimento descrescente
    order.sort((a, b) => {
      const ra = map[a]
      const rb = map[b]
      if (ra.metal !== rb.metal) return ra.metal.localeCompare(rb.metal)
      if (ra.desc !== rb.desc) return ra.desc.localeCompare(rb.desc)
      return rb.lengthMm - ra.lengthMm
    })

    return order.map((k) => map[k])
  }, [filteredCuts])

  // 3. Plano de Corte: FFD Bin Packing (igual cutplan.js)
  const cutPlan = useMemo(() => {
    const barLen = barLengthMm > 0 ? barLengthMm : 6000
    const kerf = kerfMm >= 0 ? kerfMm : 3

    const gMap: Record<string, { metal: string; desc: string; cor: string; pieces: Piece[] }> = {}
    const gOrder: string[] = []

    filteredCuts.forEach((item) => {
      if (item.isFastener || item.lengthMm <= 0) return
      const metal = item.metal || 'Aço Carbono'
      const desc = item.desc || 'Tubo Quadrado'
      const cor = item.color || '#00E100'
      const gk = `${metal}|${desc}`
      if (!gMap[gk]) {
        gMap[gk] = { metal, desc, cor, pieces: [] }
        gOrder.push(gk)
      }
      const qty = Math.max(1, Math.min(1000, item.qty))
      for (let i = 0; i < qty; i++) {
        gMap[gk].pieces.push({
          len: item.lengthMm,
          color: cor,
          id: `${gk}-${i}`,
          name: desc,
          cut: item.cut,
          productionTag: item.productionTag,
        })
      }
    })

    let allBarsCount = 0
    let allUsedMm = 0
    const groups: CutPlanGroup[] = []

    gOrder.forEach((gk) => {
      const g = gMap[gk]
      // Ordenação FFD (decrescente de comprimento)
      g.pieces.sort((a, b) => b.len - a.len)

      const bars: Bar[] = []
      g.pieces.forEach((p) => {
        if (p.len <= 0) return
        let placed = false
        for (let bi = 0; bi < bars.length; bi++) {
          const needed = p.len + (bars[bi].pieces.length > 0 ? kerf : 0)
          if (bars[bi].remaining >= needed) {
            bars[bi].pieces.push(p)
            bars[bi].used += needed
            bars[bi].remaining -= needed
            placed = true
            break
          }
        }
        if (!placed) {
          bars.push({
            pieces: [p],
            used: p.len,
            remaining: barLen - p.len,
            waste: 0,
            pct: 0,
          })
        }
      })

      let totalUsed = 0
      bars.forEach((b) => {
        b.waste = Math.max(0, barLen - b.used)
        b.pct = barLen > 0 ? Math.round((b.used / barLen) * 100) : 0
        totalUsed += b.used
      })

      const totalBars = bars.length
      const avgPct = totalBars > 0 ? Math.round((totalUsed / (totalBars * barLen)) * 100) : 0
      const totalWaste = Math.max(0, totalBars * barLen - totalUsed)

      allBarsCount += totalBars
      allUsedMm += totalUsed

      groups.push({
        metal: g.metal,
        desc: g.desc,
        cor: g.cor,
        totalBars,
        totalPieces: g.pieces.length,
        avgPct,
        totalWaste,
        bars,
      })
    })

    const avgPct = allBarsCount > 0 ? Math.round((allUsedMm / (allBarsCount * barLen)) * 100) : 0
    const totalWaste = Math.max(0, allBarsCount * barLen - allUsedMm)

    return {
      groups,
      totalBars: allBarsCount,
      avgPct,
      totalWaste,
    }
  }, [filteredCuts, barLengthMm, kerfMm])

  // Disparo de Impressão / PDF com escopo selecionado
  const triggerPrint = (targetScope?: PrintScope) => {
    setPrintScope(targetScope || activeTab)
    setPrintDropdownOpen(false)
    setTimeout(() => {
      window.print()
    }, 150)
  }

  // Exportar CSV
  const handleExportCSV = () => {
    if (activeTab === 'cutlist') {
      const header = 'Metal;Cor;Descricao;Comprimento_mm;Quantidade;Total_Linear_mm\n'
      const rows = consolidated.map((c) =>
        `"${c.metal}";"${c.color}";"${c.desc}";${c.lengthMm.toFixed(1)};${c.qty};${c.totalLinearMm.toFixed(1)}`
      ).join('\n')
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lista_de_corte_${projectName || 'projeto'}.csv`
      a.click()
    } else {
      const header = 'Tipo_Tubo;Barra;Peca_Comprimento_mm;Cor_Hex;Sobra_Barra_mm;Aproveitamento_Pct\n'
      const rows: string[] = []
      cutPlan.groups.forEach((g) => {
        g.bars.forEach((b, bIdx) => {
          b.pieces.forEach((p) => {
            rows.push(`"${g.desc}";${bIdx + 1};${p.len.toFixed(1)};"${p.color}";${b.waste.toFixed(1)};${b.pct}%`)
          })
        })
      })
      const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `plano_de_corte_${projectName || 'projeto'}.csv`
      a.click()
    }
  }

  // Renderizador da Tabela de Lista de Corte (usado na tela e no print)
  const renderCutListTable = () => (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
      <table className="table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>
              Metal
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em', width: 110 }}>
              Cor
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>
              Descrição
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>
              Comprimento ({unit})
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>
              Quantidade
            </th>
            <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>
              Total Linear ({unit})
            </th>
          </tr>
        </thead>
        <tbody>
          {consolidated.map((c, idx) => {
            const isLight = isLightColor(c.color)
            const rowBg = rowFill === 2
              ? hexToRgba(c.color, 0.16)
              : rowFill === 1
              ? hexToRgba(c.color, 0.08)
              : (idx % 2 === 0 ? '#ffffff' : '#f8fafc')

            const hasSpecialAngle = c.cut && c.cut !== '—' && c.cut !== '90°' && c.cut !== '-'

            return (
              <tr
                key={idx}
                style={{
                  background: rowBg,
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.15s',
                }}
              >
                <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 500, color: 'var(--text)' }}>
                  {c.metal}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                  <span
                    title={COLOR_NAMES[c.color.toUpperCase()] || c.color}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      padding: '3px 8px',
                      background: c.color,
                      color: isLight ? '#0f172a' : '#ffffff',
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: 0.5,
                      borderRadius: 4,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.15)',
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {c.color.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>
                  {c.desc}
                  {hasSpecialAngle && (
                    <span style={{ fontSize: 10, background: 'var(--bg-soft)', color: 'var(--muted)', border: '1px solid var(--border)', padding: '1px 5px', borderRadius: 4, marginLeft: 8, fontWeight: 500 }}>
                      {c.cut}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                  {formatMeasure(c.lengthMm, unit, decimals)}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                  {c.qty}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--brand-dark)' }}>
                  {formatLinearTotal(c.lengthMm, c.qty, unit, decimals)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: 'var(--bg-soft)', borderTop: '2px solid var(--border)', fontWeight: 800, fontSize: 13 }}>
            <td colSpan={4} style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)' }}>Totais Gerais:</td>
            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text)' }}>
              {consolidated.reduce((sum, c) => sum + c.qty, 0)} peças
            </td>
            <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--brand-dark)' }}>
              {formatLinearTotal(consolidated.reduce((sum, c) => sum + c.totalLinearMm, 0), 1, unit, decimals)} {unit}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )

  // Renderizador dos Gráficos do Plano de Corte (usado na tela e no print)
  const renderCutPlanVisuals = () => (
    <div>
      {/* 4 Cards de Destaque no padrão moderno do site */}
      <div className="print-avoid-break" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', borderLeft: '4px solid var(--brand)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Barras Total</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            {cutPlan.totalBars} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>unid.</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', borderLeft: '4px solid #10b981', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aproveitamento Médio</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: cutPlan.avgPct >= 80 ? 'var(--brand-dark)' : '#d97706', marginTop: 4 }}>
            {cutPlan.avgPct}%
          </div>
          <div className="bar" style={{ height: 6, marginTop: 8 }}>
            <div className="bar-fill" style={{ width: `${Math.min(100, cutPlan.avgPct)}%`, background: cutPlan.avgPct >= 80 ? 'var(--brand)' : '#f59e0b' }} />
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', borderLeft: '4px solid #ef4444', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desperdício Total</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
            {formatMeasure(cutPlan.totalWaste, unit, decimals)} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{unit}</span>
          </div>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', borderLeft: '4px solid #64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comprimento Barra</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
            {formatMeasure(barLengthMm, unit, decimals)} <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{unit}</span>
          </div>
        </div>
      </div>

      {/* Tabela Resumo por Tipo de Tubo */}
      {cutPlan.groups.length > 0 && (
        <div className="print-avoid-break" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.03)', marginBottom: 18, overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 14, padding: '10px 12px' }} />
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>Tipo de Tubo</th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>Barras</th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>Peças</th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>Aproveit.</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.05em' }}>Desperdício</th>
              </tr>
            </thead>
            <tbody>
              {cutPlan.groups.map((g, gi) => (
                <tr key={gi} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, background: g.cor, borderRadius: 3, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' }} />
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text)' }}>
                    {g.metal} — {g.desc}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>{g.totalBars}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>{g.totalPieces}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <span className={`badge ${g.avgPct >= 80 ? 'active' : 'pending'}`} style={{ padding: '2px 8px', fontSize: 11 }}>
                      {g.avgPct}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>
                    {formatMeasure(g.totalWaste, unit, decimals)} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grupos de Barras Graficamente com Fidelidade de Cores e Estilo Moderno */}
      {cutPlan.groups.map((g, gi) => (
        <div key={gi} className="print-avoid-break" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.03)', marginBottom: 18, overflow: 'hidden' }}>
          {/* Cabeçalho do Card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-soft)' }}>
            <span style={{ width: 14, height: 14, background: g.cor, borderRadius: 3, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
              {g.metal} — {g.desc}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginLeft: 'auto' }}>
              {g.totalBars} {g.totalBars === 1 ? 'barra' : 'barras'} • {g.avgPct}% aproveitamento
            </span>
          </div>

          {/* Corpo do Card: Barras */}
          <div style={{ padding: '16px' }}>
            {g.bars.map((b, bi) => {
              const pctColor = b.pct >= 85 ? 'var(--brand-dark)' : b.pct >= 60 ? '#d97706' : '#dc2626'
              return (
                <div key={bi} className="print-avoid-break" style={{ marginBottom: 14 }}>
                  {/* Linha da Barra Gráfica */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      height: 36,
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: '#f1f5f9',
                      marginBottom: 8,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Índice da Barra à esquerda */}
                    <div
                      style={{
                        width: 38,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--muted)',
                        borderRight: '1px solid var(--border)',
                        background: 'var(--bg-soft)',
                        flexShrink: 0,
                      }}
                    >
                      #{bi + 1}
                    </div>

                    {/* Cortes na barra (Cores oficiais dos tubos preservadas) */}
                    <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
                      {b.pieces.map((p, pi) => {
                        const wPct = Math.min(100, (p.len / barLengthMm) * 100)
                        const isLight = isLightColor(p.color)
                        return (
                          <div
                            key={pi}
                            title={`${p.name}: ${formatMeasure(p.len, unit, decimals)} ${unit} (${p.cut || 'corte'})`}
                            style={{
                              width: `${wPct.toFixed(2)}%`,
                              background: p.color,
                              color: isLight ? '#0f172a' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 700,
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              borderRight: '1px solid rgba(0,0,0,0.15)',
                              padding: '0 4px',
                            }}
                          >
                            {wPct > 3 && formatMeasure(p.len, unit, decimals)}
                          </div>
                        )
                      })}

                      {/* Desperdício (Sobra) hachurada */}
                      {b.waste > 0 && (
                        <div
                          title={`Sobra: ${formatMeasure(b.waste, unit, decimals)} ${unit}`}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            color: 'var(--muted)',
                            fontWeight: 600,
                            background: 'repeating-linear-gradient(-45deg, #f8fafc, #f8fafc 4px, #e2e8f0 4px, #e2e8f0 8px)',
                          }}
                        >
                          {b.waste / barLengthMm > 0.06 && (
                            <span>sobra {formatMeasure(b.waste, unit, decimals)}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Badge de % de aproveitamento da barra à direita */}
                    <div
                      style={{
                        width: 54,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        color: pctColor,
                        borderLeft: '1px solid var(--border)',
                        background: 'var(--bg-soft)',
                        flexShrink: 0,
                      }}
                    >
                      {b.pct}%
                    </div>
                  </div>

                  {/* Legenda de Produção da Barra com Checkboxes Modernos */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 8px', marginLeft: 38, fontSize: 11 }}>
                    {barLegendGroups(b.pieces, g.cor).map((gr, gi) => {
                      const checkKey = `${gi}-${bi}-${gr.len}-${gr.color}`
                      const isChecked = Boolean(checkedPieces[checkKey])
                      return (
                        <label
                          key={gi}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            border: `1px solid ${isChecked ? 'var(--border)' : 'var(--border-hover)'}`,
                            borderRadius: 6,
                            padding: '3px 8px',
                            background: isChecked ? 'var(--bg-soft)' : 'var(--surface)',
                            color: isChecked ? 'var(--muted)' : 'var(--text)',
                            textDecoration: isChecked ? 'line-through' : 'none',
                            cursor: 'pointer',
                            userSelect: 'none',
                            boxShadow: isChecked ? 'none' : '0 1px 2px rgba(0,0,0,0.02)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePieceCheck(checkKey)}
                            style={{ width: 13, height: 13, cursor: 'pointer', accentColor: 'var(--brand)' }}
                          />
                          <span style={{ width: 8, height: 8, background: gr.color, display: 'inline-block', borderRadius: 2 }} />
                          <span style={{ fontWeight: 600 }}>
                            {gr.qty} &times; {formatMeasure(gr.len, unit, decimals)} {unit}
                          </span>
                        </label>
                      )
                    })}

                    {b.waste > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, marginLeft: 4 }}>
                        sobra {formatMeasure(b.waste, unit, decimals)} {unit}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="cut-report-container" style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* ========================================================= */}
      {/* 1. CABEÇALHO TÉCNICO OFICIAL DE IMPRESSÃO / PDF           */}
      {/* (Visível somente durante a impressão ou exportação PDF)   */}
      {/* ========================================================= */}
      <div className="cut-print-header">

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: '#f8fafc', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Obra / Projeto:</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{projectName || 'Projeto sem nome'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Modelo CAD:</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{modelName || 'Modelo 3D SketchUp'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Barra / Serra:</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{barLengthMm} mm (Perda: {kerfMm} mm)</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Barras & Aproveitamento:</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#16a34a' }}>{cutPlan.totalBars} barras ({cutPlan.avgPct}% aprov.)</div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. HEADER DA TELA DO SISTEMA (Oculto na impressão)       */}
      {/* ========================================================= */}
      <div className="cut-print-hide" style={{ background: 'var(--surface)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: 'var(--brand-surface)', color: 'var(--brand-dark)', border: '1px solid var(--brand-border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
            ACM360
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Plano & Lista de Corte
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            · {projectName || 'Projeto'} {modelName ? `(${modelName})` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onRefresh && (
            <button
              type="button"
              className="btn sm"
              onClick={onRefresh}
              title="Recarregar dados"
            >
              <RefreshCw size={12} /> Atualizar
            </button>
          )}
          <button
            type="button"
            className="btn sm"
            onClick={handleExportCSV}
            title="Baixar planilha para Excel ou CSV"
          >
            <Download size={12} /> Exportar CSV
          </button>

          {/* Botão de Impressão e PDF com Dropdown no padrão do site */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn primary sm"
              onClick={() => setPrintDropdownOpen((v) => !v)}
              title="Imprimir ou Salvar como PDF profissional"
            >
              <Printer size={12} /> Imprimir / PDF <ChevronDown size={12} />
            </button>

            {printDropdownOpen && (
              <div
                className="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 6,
                  width: 230,
                  zIndex: 50,
                  padding: '4px 0',
                }}
              >
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => triggerPrint('cutlist')}
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <FileText size={14} style={{ color: 'var(--brand)' }} />
                  <span>Lista de Corte</span>
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => triggerPrint('cutplan')}
                  style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Ruler size={14} style={{ color: 'var(--brand)' }} />
                  <span>Plano de Corte (Barras)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. SUB-TABS MODERNAS (Oculto na impressão)                */}
      {/* ========================================================= */}
      <div className="cut-print-hide" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg-soft)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: 3, borderRadius: 8, gap: 2 }}>
          <button
            type="button"
            onClick={() => setActiveTab('cutlist')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'cutlist' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'cutlist' ? 'var(--brand-dark)' : 'var(--muted)',
              boxShadow: activeTab === 'cutlist' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={13} /> Lista de Corte ({consolidated.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cutplan')}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: activeTab === 'cutplan' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'cutplan' ? 'var(--brand-dark)' : 'var(--muted)',
              boxShadow: activeTab === 'cutplan' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Ruler size={13} /> Plano de Corte ({cutPlan.totalBars} barras)
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. TOOLBAR DE CONFIGURAÇÕES (Oculto na impressão)        */}
      {/* ========================================================= */}
      <div className="cut-print-hide" style={{ background: 'var(--surface)', padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
        {activeTab === 'cutlist' ? (
          <>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exibir:</span>
            <button
              type="button"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: scope === 'selected' ? '1px solid var(--brand)' : '1px solid var(--border)',
                background: scope === 'selected' ? 'var(--brand)' : 'var(--surface)',
                color: scope === 'selected' ? '#ffffff' : 'var(--text)',
                cursor: 'pointer',
                boxShadow: scope === 'selected' ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
              }}
              onClick={() => setScope('selected')}
            >
              Selecionadas
            </button>
            <button
              type="button"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: scope === 'all' ? '1px solid var(--brand)' : '1px solid var(--border)',
                background: scope === 'all' ? 'var(--brand)' : 'var(--surface)',
                color: scope === 'all' ? '#ffffff' : 'var(--text)',
                cursor: 'pointer',
                boxShadow: scope === 'all' ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
              }}
              onClick={() => setScope('all')}
            >
              Todas
            </button>

            <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Itens:</span>
            {(['all', 'structures', 'fixadores'] as FilterCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: category === cat ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: category === cat ? 'var(--brand)' : 'var(--surface)',
                  color: category === cat ? '#ffffff' : 'var(--text)',
                  cursor: 'pointer',
                  boxShadow: category === cat ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onClick={() => setCategory(cat)}
              >
                {cat === 'all' ? 'Todos' : cat === 'structures' ? 'Estruturas' : 'Fixadores'}
              </button>
            ))}

            <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unidade:</span>
            {(['mm', 'cm', 'pol'] as CutUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: unit === u ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: unit === u ? 'var(--brand)' : 'var(--surface)',
                  color: unit === u ? '#ffffff' : 'var(--text)',
                  cursor: 'pointer',
                  boxShadow: unit === u ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onClick={() => setUnit(u)}
              >
                {u}
              </button>
            ))}

            <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decimais:</span>
            {([0, 1, 2] as Decimals[]).map((d) => (
              <button
                key={d}
                type="button"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: decimals === d ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: decimals === d ? 'var(--brand)' : 'var(--surface)',
                  color: decimals === d ? '#ffffff' : 'var(--text)',
                  cursor: 'pointer',
                  boxShadow: decimals === d ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onClick={() => setDecimals(d)}
              >
                {d === 0 ? '0' : d === 1 ? '0,0' : '0,00'}
              </button>
            ))}

            <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Linhas:</span>
            {([0, 1, 2] as RowFillMode[]).map((f) => (
              <button
                key={f}
                type="button"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: rowFill === f ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: rowFill === f ? 'var(--brand)' : 'var(--surface)',
                  color: rowFill === f ? '#ffffff' : 'var(--text)',
                  cursor: 'pointer',
                  boxShadow: rowFill === f ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onClick={() => setRowFill(f)}
              >
                {f === 0 ? 'Sem' : f === 1 ? '50%' : '100%'}
              </button>
            ))}
          </>
        ) : (
          <>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Barra:</span>
            <input
              type="number"
              value={barLengthMm}
              onChange={(e) => setBarLengthMm(Math.max(500, Number(e.target.value) || 6000))}
              style={{
                width: 75,
                padding: '4px 8px',
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'center',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>mm</span>

            <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Perda serra:</span>
            <input
              type="number"
              step="0.5"
              value={kerfMm}
              onChange={(e) => setKerfMm(Math.max(0, Number(e.target.value) || 3))}
              style={{
                width: 55,
                padding: '4px 8px',
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'center',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>mm</span>

            <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unidade:</span>
            {(['mm', 'cm', 'pol'] as CutUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: unit === u ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: unit === u ? 'var(--brand)' : 'var(--surface)',
                  color: unit === u ? '#ffffff' : 'var(--text)',
                  cursor: 'pointer',
                  boxShadow: unit === u ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onClick={() => setUnit(u)}
              >
                {u}
              </button>
            ))}

            <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />

            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Decimais:</span>
            {([0, 1, 2] as Decimals[]).map((d) => (
              <button
                key={d}
                type="button"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: decimals === d ? '1px solid var(--brand)' : '1px solid var(--border)',
                  background: decimals === d ? 'var(--brand)' : 'var(--surface)',
                  color: decimals === d ? '#ffffff' : 'var(--text)',
                  cursor: 'pointer',
                  boxShadow: decimals === d ? '0 1px 2px rgba(16,185,129,0.3)' : '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onClick={() => setDecimals(d)}
              >
                {d === 0 ? '0' : d === 1 ? '0,0' : '0,00'}
              </button>
            ))}
          </>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. VISUALIZAÇÃO INTERATIVA EM TELA                        */}
      {/* (Oculta na impressão para renderizar o layout de folha)  */}
      {/* ========================================================= */}
      <div className="cut-print-hide" style={{ padding: '16px 16px 24px', background: 'var(--bg)' }}>
        {consolidated.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}>
            <Ruler size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <h4 style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text)' }}>Nenhum corte metálico encontrado</h4>
            <p style={{ margin: 0, fontSize: 12 }}>
              Crie montantes ou estruturas de tubo no SketchUp e publique a revisão para visualizar a Lista e Plano de Corte.
            </p>
          </div>
        ) : activeTab === 'cutlist' ? (
          renderCutListTable()
        ) : (
          renderCutPlanVisuals()
        )}
      </div>

      {/* ========================================================= */}
      {/* 6. CONTEÚDO IMPRESSO (Renderiza com fidelidade A4 / PDF)  */}
      {/* ========================================================= */}
      <div className="cut-print-only" style={{ padding: '10px 0' }}>
        {consolidated.length > 0 && (
          <>
            {/* Bloco 1: Lista de Corte na folha */}
            {printScope === 'cutlist' && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={15} style={{ color: 'var(--brand-dark)' }} />
                  <span>Lista de Corte Consolidada de Tubos e Perfis</span>
                </div>
                {renderCutListTable()}
              </div>
            )}

            {/* Bloco 2: Plano de Corte na folha */}
            {printScope === 'cutplan' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ruler size={15} style={{ color: 'var(--brand-dark)' }} />
                  <span>Plano de Corte de Barras (Nesting Linear - FFD)</span>
                </div>
                {renderCutPlanVisuals()}
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================================================= */}
      {/* 7. RODAPÉ DE VALIDAÇÃO TÉCNICA E OFICINA (Só na impressão)*/}
      {/* ========================================================= */}
      <div className="cut-print-footer">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 14 }}>
          <div style={{ borderTop: '1px solid #475569', paddingTop: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a' }}>Responsável Técnico / Projetista</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Assinatura e Registro</div>
          </div>
          <div style={{ borderTop: '1px solid #475569', paddingTop: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a' }}>Operador da Serra / Serralheiro</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>Assinatura de Execução</div>
          </div>
          <div style={{ borderTop: '1px solid #475569', paddingTop: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a' }}>Conferência de Qualidade</div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>[ &nbsp; ] Aprovado &nbsp; [ &nbsp; ] Ajustado</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 8.5, color: '#94a3b8', marginTop: 14 }}>
          Documento gerado automaticamente pelo Portal Meu ACM / GOACM. Válido para execução e montagem de estruturas.
        </div>
      </div>
    </div>
  )
}
