import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/usePageMeta'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="legal-page">
      <header className="legal-nav">
        <Link className="sales-brand" to="/" aria-label="GOACM início"><img src="/goacm-logo.svg" alt="GOACM" /></Link>
        <Link to="/">Voltar ao site</Link>
      </header>
      <article className="legal-content">
        <div className="sales-eyebrow">GOACM</div>
        <h1>{title}</h1>
        <p className="legal-updated">Atualizado em 16 de outubro de 2026</p>
        {children}
      </article>
      <footer className="legal-footer"><Link to="/terms">Termos de Uso</Link><Link to="/privacy">Privacidade</Link><a href="mailto:suporte@acm360.com.br">Fale com o suporte</a></footer>
    </main>
  )
}

export function TermsPage() {
  usePageMeta('Termos de Uso', 'Condições dos planos, pagamentos, licenças e suporte GOACM.')
  return (
    <LegalLayout title="Termos de Uso">
      <p>Estes termos explicam as condições para usar o plugin GOACM, o painel de projetos, o treinamento e o suporte incluídos na assinatura. Ao criar uma conta ou contratar um plano, você concorda com estas condições.</p>

      <h2>Planos e pagamento</h2>
      <p>O plano Pro mensal custa R$ 97 por mês no cartão. Novos assinantes têm 7 dias de teste grátis após a autorização da assinatura no Mercado Pago; a primeira cobrança ocorre ao final do teste, se a renovação não for cancelada antes.</p>
      <p>O plano Pro anual custa R$ 970, pagos uma vez via Pix, e dá acesso por 12 meses sem renovação automática. Os preços vigentes são exibidos na página de planos antes da contratação.</p>

      <h2>Cancelamento e arrependimento</h2>
      <p>A assinatura mensal pode ser cancelada pelo titular no portal, sem multa. O cancelamento impede cobranças futuras; o acesso permanece até o fim do período pago ou, durante o teste, até o término dos 7 dias, sem cobrança mensal.</p>
      <p>O direito de arrependimento pode ser exercido em até 7 dias, conforme a legislação aplicável, com reembolso integral do valor pago dentro desse prazo. Para solicitar o reembolso, escreva para <a href="mailto:suporte@acm360.com.br">suporte@acm360.com.br</a> dentro do prazo. Cancelar a renovação pelo portal interrompe cobranças futuras, mas não envia um pedido de estorno. O reembolso aprovado é feito pelo mesmo meio de pagamento.</p>

      <h2>Licença e acessos</h2>
      <p>O plano inclui até três pessoas: titular e dois membros. Cada pessoa deve usar seu próprio e-mail e pode autorizar um computador. Para trocar de máquina, revogue o computador anterior no portal e entre novamente pelo plugin.</p>
      <p>A licença do SketchUp é contratada separadamente. O suporte GOACM responde dúvidas sobre o plugin e o treinamento; não inclui consultoria nem criação ou revisão de projetos.</p>

      <h2>Uso e propriedade intelectual</h2>
      <p>O software, a marca, o treinamento e os materiais GOACM pertencem ao GOACM ou a seus licenciadores. Não é permitido copiar, redistribuir, alterar ou tentar fazer engenharia reversa do software, nem usar o serviço para fins ilegais ou para prejudicar seu funcionamento.</p>

      <h2>Contato</h2>
      <p>Para dúvidas sobre estes termos, escreva para <a href="mailto:suporte@acm360.com.br">suporte@acm360.com.br</a>.</p>
    </LegalLayout>
  )
}

export function PrivacyPage() {
  usePageMeta('Política de Privacidade', 'Como o GOACM trata os dados de conta, licença e pagamento.')
  return (
    <LegalLayout title="Política de Privacidade">
      <p>Esta política descreve os dados usados para fornecer o portal, o plugin, os planos e o suporte GOACM.</p>

      <h2>Dados tratados</h2>
      <ul>
        <li>Cadastro e conta: nome, e-mail, credenciais de autenticação e estado de confirmação do e-mail.</li>
        <li>Equipe: e-mails de convite, função e estado de cada acesso na conta.</li>
        <li>Licença: identificador e nome do computador, data de ativação e último acesso do plugin.</li>
        <li>Assinatura e pagamento: plano, valor, datas, estado e identificadores de transação. Os dados do cartão são tratados pelo Mercado Pago e não são armazenados pelo GOACM.</li>
        <li>Dados técnicos necessários para proteger e operar o serviço, como registros de acesso mantidos pelos provedores de hospedagem e autenticação.</li>
      </ul>

      <h2>Finalidades e compartilhamento</h2>
      <p>Usamos os dados para criar e proteger contas, liberar e administrar licenças, processar pagamentos, gerenciar a equipe, prestar suporte, evitar fraude e cumprir obrigações legais. Não vendemos dados pessoais.</p>
      <p>Compartilhamos apenas os dados necessários com os provedores que operam a hospedagem, o banco de dados, a autenticação, o envio de e-mails e os pagamentos, incluindo Vercel, Supabase e Mercado Pago. Também podemos compartilhar informações quando a lei exigir ou quando você autorizar.</p>

      <h2>Armazenamento e segurança</h2>
      <p>Os dados são mantidos enquanto a conta e a licença forem necessárias para prestar o serviço. Depois do encerramento, podem ser conservados por até 90 dias para concluir a desativação e atender solicitações, exceto registros que precisem ser mantidos por obrigação legal. Aplicamos controles de acesso e proteção técnica para reduzir o risco de uso indevido.</p>

      <h2>Seus direitos</h2>
      <p>Você pode solicitar acesso, correção, exclusão, portabilidade e informações sobre o uso e compartilhamento dos seus dados, nos termos da LGPD. Algumas informações podem precisar ser mantidas para cumprir obrigações legais ou financeiras.</p>

      <h2>Contato</h2>
      <p>Para exercer seus direitos ou tirar dúvidas sobre privacidade, escreva para <a href="mailto:suporte@acm360.com.br">suporte@acm360.com.br</a>.</p>
    </LegalLayout>
  )
}
