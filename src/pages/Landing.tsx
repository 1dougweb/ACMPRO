import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Laptop,
  ArrowRight,
  Layers,
  Calculator,
  FileText,
  Check,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Zap,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { api, type PublicOffers } from '../api'
import { formatBRL } from '../lib/formatMoney'
import { usePageMeta } from '../lib/usePageMeta'

export default function Landing() {
  usePageMeta('Plugin para SketchUp', 'Modele estruturas, extraia quantitativos e prepare seus projetos para produção com plugin, treinamento e suporte.')
  const { user } = useAuth()
  const [offers, setOffers] = useState<PublicOffers | null>(null)
  const [offersError, setOffersError] = useState<'project_mismatch' | 'unavailable' | null>(null)

  useEffect(() => {
    void api.getPublicOffers().then(setOffers).catch((error: unknown) => {
      const code = (error as { code?: string } | null)?.code
      setOffersError(code === 'backend_project_mismatch' ? 'project_mismatch' : 'unavailable')
    })
  }, [])

  const accountHref = user ? '/app' : '/register'
  const monthlyHref = user ? '/app?offer=pro_monthly' : '/register?offer=pro_monthly'
  const annualHref = user ? '/app?offer=pro_annual' : '/register?offer=pro_annual'

  return (
    <main className="sales-page">
      <header className="sales-nav">
        <Link className="sales-brand" to="/" aria-label="ACMGO início"><img src="/logo-acmgo.svg" alt="ACMGO" /></Link>
        <nav className="sales-nav-links" aria-label="Navegação do site">
          <a href="#recursos">O plugin</a><a href="#incluido">O que está incluído</a><a href="#planos">Planos</a>
        </nav>
        <div className="sales-nav-actions">
          <Link className="sales-login" to={user ? '/app' : '/login'}>{user ? 'Minha conta' : 'Entrar'}</Link>
          <Link className="sales-button sales-button-small" to={accountHref}>
            {user ? 'Abrir portal' : 'Começar agora'} <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <section className="sales-hero">
        <div className="sales-hero-copy">
          <div className="sales-eyebrow">
            <span /> Plugin SketchUp · treinamento · suporte
          </div>
          <h1>Do modelo 3D à <em>produção.</em></h1>
          <p className="sales-lead">Modele estruturas e fachadas no SketchUp, extraia informações do projeto e aprenda a preparar a documentação para produção — com o GOACM ao seu lado.</p>
          <div className="sales-hero-actions">
            <a className="sales-button" href="#planos">
              Ver planos e preços <ArrowRight size={14} />
            </a>
            <a className="sales-button sales-button-quiet" href="#recursos">Conhecer o GOACM</a>
          </div>
          <div className="sales-trust-row">
            <span><Users size={14} style={{ color: 'var(--brand)' }} /> 3 acessos por conta</span>
            <span><Laptop size={14} style={{ color: 'var(--brand)' }} /> 1 computador por pessoa</span>
            <span><ShieldCheck size={14} style={{ color: 'var(--brand)' }} /> Treinamento e suporte incluídos</span>
          </div>
        </div>

        <div className="sales-preview" aria-label="Ilustração do fluxo de projeto no GOACM">
          <div className="sales-preview-window">
            <div className="sales-preview-bar">
              <div className="sales-window-dots"><i /><i /><i /></div>
              <span>GOACM <b>/</b> Projeto fachada · exemplo</span>
              <span className="sales-live-pill">ILUSTRATIVO</span>
            </div>
            <div className="sales-preview-body">
              <div className="sales-model-canvas">
                <div className="sales-canvas-label">MODELO 3D <span>01 — 03</span></div>
                <div className="sales-wireframe" aria-hidden="true">
                  <div className="sales-frame-roof" /><div className="sales-frame-post post-one" /><div className="sales-frame-post post-two" /><div className="sales-frame-post post-three" />
                  <div className="sales-frame-beam beam-one" /><div className="sales-frame-beam beam-two" /><div className="sales-frame-beam beam-three" /><div className="sales-frame-base" />
                </div>
                <div className="sales-axis"><span>X</span><span>Y</span><span>Z</span></div>
              </div>
              <aside className="sales-preview-panel">
                <div className="sales-panel-heading">Quantitativos</div>
                <div className="sales-quantity"><span>Perfis</span><b>24 <small>un.</small></b></div>
                <div className="sales-quantity"><span>Área</span><b>18,6 <small>m²</small></b></div>
                <div className="sales-quantity"><span>Fixadores</span><b>32 <small>un.</small></b></div>
                <div className="sales-panel-footer"><i /> Dados do projeto organizados</div>
              </aside>
            </div>
            <div className="sales-preview-status">
              <span>PROJETO</span>
              <b>Fachada comercial</b>
              <span className="sales-status-right">
                <CheckCircle2 size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }} />
                Salvo
              </span>
            </div>
          </div>
          <div className="sales-preview-note">
            <span style={{ color: 'var(--brand)' }}>01</span>
            <div><b>Do desenho ao planejamento</b><small>Um fluxo de trabalho no SketchUp</small></div>
          </div>
        </div>
      </section>

      <section className="sales-metrics" aria-label="O plano GOACM inclui">
        <div><b>01</b><span>plugin para SketchUp</span></div>
        <div><b>02</b><span>membros além do titular</span></div>
        <div><b>100%</b><span>treinamento e suporte incluídos</span></div>
      </section>

      <section className="sales-section" id="recursos">
        <div className="sales-section-heading">
          <div>
            <div className="sales-eyebrow">O fluxo de trabalho</div>
            <h2>Mais clareza entre o projeto <em>e a execução.</em></h2>
          </div>
          <p>O GOACM reúne ferramentas de modelagem e planejamento para ajudar você a levar o projeto do SketchUp para a documentação de produção.</p>
        </div>
        <div className="sales-feature-grid">
          <article className="sales-feature-card sales-feature-main">
            <span className="sales-feature-index">01 / MODELAGEM</span>
            <div className="sales-feature-icon"><Layers size={20} /></div>
            <h3>Estruturas inteligentes</h3>
            <p>Ajuste montantes e travessas no SketchUp e acesse os comandos pelo menu radial.</p>
          </article>
          <article className="sales-feature-card">
            <span className="sales-feature-index">02 / PLANEJAMENTO</span>
            <div className="sales-feature-icon"><Calculator size={20} /></div>
            <h3>Quantitativos e cortes</h3>
            <p>Consulte comprimentos e quantidades, configure fixadores e organize o plano de corte.</p>
          </article>
          <article className="sales-feature-card">
            <span className="sales-feature-index">03 / DOCUMENTAÇÃO</span>
            <div className="sales-feature-icon"><FileText size={20} /></div>
            <h3>Do detalhe às pranchas</h3>
            <p>Aprenda a detalhar o projeto e organizar as pranchas de entrega no LayOut.</p>
          </article>
        </div>
      </section>

      <section className="sales-included" id="incluido">
        <div className="sales-included-copy">
          <div className="sales-eyebrow">Um plano para aprender e fazer</div>
          <h2>Ferramenta, treinamento e suporte. <em>Juntos.</em></h2>
          <p>Comece pelo essencial, desenvolva seu projeto e avance até a documentação técnica com conteúdo pensado para o fluxo de estruturas e fachadas.</p>
          <a className="sales-text-link" href="#planos">
            Conhecer os planos <ArrowRight size={14} />
          </a>
        </div>
        <div className="sales-included-list">
          <article>
            <span>01</span>
            <div><h3>Plugin GOACM para SketchUp</h3><p>Modelagem de estruturas, quantitativos, planificação e planos de corte.</p></div>
            <b><Check size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 3 }} />Incluído</b>
          </article>
          <article>
            <span>02</span>
            <div><h3>Painel de gestão de projetos</h3><p>Organize os projetos e acompanhe as informações publicadas pelo plugin.</p></div>
            <b><Check size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 3 }} />Incluído</b>
          </article>
          <article>
            <span>03</span>
            <div><h3>Treinamento do básico à documentação</h3><p>SketchUp, detalhamento técnico e organização de pranchas no LayOut.</p></div>
            <b><Check size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 3 }} />Incluído</b>
          </article>
          <article>
            <span>04</span>
            <div><h3>Suporte e grupo VIP</h3><p>Dúvidas sobre o plugin e as aulas, inclusive pelo WhatsApp. Não inclui consultoria nem criação ou revisão de projetos.</p></div>
            <b><Check size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 3 }} />Incluído</b>
          </article>
          <article>
            <span>05</span>
            <div><h3>Até três acessos</h3><p>Uma conta titular e dois membros. Cada pessoa pode autorizar um computador.</p></div>
            <b><Check size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 3 }} />Incluído</b>
          </article>
        </div>
      </section>

      <section className="sales-pricing" id="planos">
        <div className="sales-pricing-heading">
          <div className="sales-eyebrow">Escolha sua forma de pagamento</div>
          <h2>Seu próximo projeto começa <em>aqui.</em></h2>
          <p>Todos os recursos, treinamento e suporte GOACM incluídos nos dois planos.</p>
        </div>
        <div className="sales-plan-grid">
          <article className="sales-plan-card sales-plan-featured">
            <div className="sales-plan-top">
              <span style={{ color: 'var(--brand-dark)' }}>MAIS FLEXÍVEL</span>
              <span>01 / 02</span>
            </div>
            <h3>Pro mensal</h3>
            <p>Para começar e pagar mês a mês.</p>
            <div className="sales-price">
              <strong>{offers ? formatBRL(offers.monthlyAmountCents) : '—'}</strong>
              <span>/ mês</span>
            </div>
            <div className="sales-plan-note">
              {offers?.monthlyTrialDays ? `${offers.monthlyTrialDays} dias grátis; depois cobrança recorrente no cartão. Cancele antes da primeira cobrança pelo portal.` : 'Cobrança recorrente no cartão. Cancele a renovação pelo portal.'}
            </div>
            <ul>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> Plugin GOACM para SketchUp</li>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> Treinamento completo</li>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> Suporte e grupo VIP</li>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> 3 acessos: titular + 2 membros</li>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> 1 computador por pessoa</li>
            </ul>
            {offers ? (
              <Link className="sales-button" to={monthlyHref}>
                <CreditCard size={15} /> Assinar plano mensal
              </Link>
            ) : (
              <button className="sales-button" disabled>{offersError ? 'Plano indisponível' : 'Carregando preço…'}</button>
            )}
          </article>
          <article className="sales-plan-card">
            <div className="sales-plan-top">
              <span>À VISTA</span>
              <span>02 / 02</span>
            </div>
            <h3>Pro anual</h3>
            <p>Um pagamento para doze meses de acesso.</p>
            <div className="sales-price">
              <strong>{offers?.annualAmountCents ? formatBRL(offers.annualAmountCents) : '—'}</strong>
              <span>/ ano</span>
            </div>
            <div className="sales-plan-note">Pagamento único via Pix. Sem renovação automática.</div>
            <ul>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> Plugin GOACM para SketchUp</li>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> Treinamento completo</li>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> Suporte e grupo VIP</li>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> 3 acessos: titular + 2 membros</li>
              <li><Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} /> 1 computador por pessoa</li>
            </ul>
            {offers?.annualAmountCents ? (
              <Link className="sales-button sales-button-quiet" to={annualHref}>
                <Zap size={15} /> Comprar plano anual via Pix
              </Link>
            ) : (
              <button className="sales-button sales-button-quiet" disabled>{offersError ? 'Plano indisponível' : 'Carregando preço…'}</button>
            )}
          </article>
        </div>
        {offersError === 'project_mismatch' && (
          <p className="sales-pricing-error" role="status">
            A conexão do portal está em configuração. Os planos ficarão disponíveis quando o portal e o plugin estiverem ligados ao mesmo serviço de licença.
          </p>
        )}
        {offersError === 'unavailable' && (
          <p className="sales-pricing-error" role="status">Não foi possível carregar os preços agora. Atualize a página para tentar novamente.</p>
        )}
        <p className="sales-pricing-footnote">A licença do SketchUp é contratada separadamente. O plano GOACM inclui o plugin, treinamento e suporte.</p>
      </section>

      <section className="sales-faq" aria-labelledby="sales-faq-title">
        <div className="sales-faq-heading">
          <div className="sales-eyebrow">Dúvidas comuns</div>
          <h2 id="sales-faq-title">Antes de começar.</h2>
        </div>
        <div className="sales-faq-list">
          <details><summary>Preciso saber usar SketchUp?</summary><p>Não. O treinamento começa pelos fundamentos e avança até a documentação técnica e as pranchas no LayOut.</p></details>
          <details><summary>A licença do SketchUp está incluída?</summary><p>Não. O plano inclui o plugin GOACM, o treinamento e o suporte. A licença do SketchUp é separada.</p></details>
          <details><summary>Como funciona o plano mensal?</summary><p>{offers?.monthlyTrialDays ? `${offers.monthlyTrialDays} dias de teste grátis após autorizar a assinatura no Mercado Pago. Depois, o cartão é cobrado mensalmente de forma recorrente. Cancele pelo portal antes do fim do teste para evitar a primeira cobrança.` : 'O cartão é cobrado mensalmente de forma recorrente. Você pode cancelar a renovação pelo portal; o acesso continua até o fim do período pago.'}</p></details>
          <details><summary>Como funciona o plano anual?</summary><p>O pagamento é feito uma vez via Pix e não há renovação automática.</p></details>
          <details><summary>Em quantos computadores posso usar?</summary><p>Cada pessoa da conta pode autorizar 1 computador. O plano inclui até três pessoas: titular e dois membros.</p></details>
          <details><summary>O que está incluído no suporte?</summary><p>O suporte ajuda com dúvidas sobre o plugin e o treinamento. Não inclui consultoria nem criação ou revisão de projetos.</p></details>
          <details><summary>Como funciona o direito de arrependimento?</summary><p>Você pode desistir em até 7 dias da contratação e solicitar reembolso integral do valor pago pelo suporte GOACM, conforme as condições dos Termos de Uso.</p></details>
          <details><summary>O treinamento monta as pranchas automaticamente?</summary><p>Não. Você aprende a organizar e montar as pranchas no LayOut durante o treinamento.</p></details>
        </div>
      </section>

      <footer className="sales-footer">
        <Link className="sales-brand" to="/" aria-label="ACMGO início"><img src="/logo-acmgo.svg" alt="ACMGO" /></Link>
        <p>Plugin, treinamento e suporte para projetos no SketchUp.</p>
        <div>
          <Link to="/login">Entrar</Link>
          <Link to="/register">Criar conta</Link>
          <Link to="/terms">Termos</Link>
          <Link to="/privacy">Privacidade</Link>
        </div>
        <small>© {new Date().getFullYear()} GOACM</small>
      </footer>
    </main>
  )
}
