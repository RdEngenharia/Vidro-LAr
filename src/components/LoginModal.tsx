import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { Building2, Lock, Mail, ShieldCheck, ArrowRight, WifiOff, User, Gift } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
}

// Cadastro público (self-service): qualquer pessoa pode criar sua própria
// conta de vidraçaria por aqui. Isso é intencional — o sistema é SaaS pago
// com 7 dias de teste grátis automáticos; não existe mais gatekeeper manual
// (cadastro pelo Firebase Console) porque não faz sentido de negócio o
// administrador ter que criar conta pra cada cliente novo manualmente.
//
// O Painel do Desenvolvedor continua fora desta tela pública de propósito:
// só fica disponível depois de logar (pelo topo do sistema), para não expor
// informações de diagnóstico a qualquer visitante não autenticado do site.
export const LoginModal: React.FC<LoginModalProps> = ({ isOpen }) => {
  const { login, register, authError, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSentMessage, setResetSentMessage] = useState('');

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const resetFormState = () => {
    setErrorMessage('');
    setResetSentMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormState();

    if (!email || !password) {
      setErrorMessage('Informe e-mail e senha');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMessage('Informe seu nome');
        return;
      }
      if (!companyName.trim()) {
        setErrorMessage('Informe o nome da sua vidraçaria');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('A senha precisa ter pelo menos 6 caracteres');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('As senhas não conferem');
        return;
      }

      setIsSubmitting(true);
      const success = await register(name, companyName, email, password, cnpj);
      setIsSubmitting(false);
      if (!success) {
        setErrorMessage(authError || 'Não foi possível criar sua conta');
      }
      return;
    }

    setIsSubmitting(true);
    const success = await login(email, password);
    setIsSubmitting(false);
    if (!success) {
      setErrorMessage(authError || 'Credenciais inválidas');
    }
  };

  const handleForgotPassword = async () => {
    resetFormState();
    if (!email) {
      setErrorMessage('Digite seu e-mail no campo acima primeiro, depois clique em "Esqueci minha senha".');
      return;
    }
    setIsResettingPassword(true);
    const success = await requestPasswordReset(email);
    setIsResettingPassword(false);
    if (success) {
      setResetSentMessage(`Enviamos um link de redefinição de senha para ${email}. Verifique sua caixa de entrada (e o spam).`);
    } else {
      setErrorMessage(authError || 'Não foi possível enviar o e-mail de redefinição.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 my-8">

        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-lg mb-3 border border-blue-400">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black tracking-tight">Sistema Vidraçaria Pro</h2>
          <p className="text-xs text-slate-300 mt-1">
            Plataforma SaaS de Orçamentos & Pedidos com Suporte Offline (Firebase)
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-blue-300 text-[11px] font-semibold border border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Dados Isolados por Empresa (Multi-Tenant)</span>
          </div>
        </div>

        {/* Toggle Login / Cadastro */}
        <div className="flex border-b border-slate-100">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              resetFormState();
            }}
            className={`flex-1 py-3 text-xs font-bold transition-colors cursor-pointer ${
              mode === 'login' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              resetFormState();
            }}
            className={`flex-1 py-3 text-xs font-bold transition-colors cursor-pointer ${
              mode === 'register' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Criar Conta Grátis
          </button>
        </div>

        {/* Body */}
        <div className="p-6">

          {mode === 'register' && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-start gap-2">
              <Gift className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>
                <strong>7 dias grátis</strong>, sem precisar de cartão pra começar. Depois disso, R$ 49,90/mês
                (ou R$ 538,92/ano, com desconto).
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl text-center">
              {errorMessage}
            </div>
          )}

          {resetSentMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl text-center">
              {resetSentMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Seu Nome</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como podemos te chamar"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Vidraçaria</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Vidraçaria Silva"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CNPJ <span className="text-slate-400 font-normal">(opcional, pode completar depois)</span>
                  </label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail de Acesso</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@empresa.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirmar Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite a senha de novo"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>
                {isSubmitting
                  ? mode === 'register'
                    ? 'Criando conta...'
                    : 'Entrando...'
                  : mode === 'register'
                  ? 'Começar Teste Grátis de 7 Dias'
                  : 'Entrar no Sistema'}
              </span>
              <ArrowRight className="w-4 h-4 text-blue-400" />
            </button>
          </form>

          {mode === 'login' && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResettingPassword}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer disabled:opacity-60"
              >
                {isResettingPassword ? 'Enviando...' : 'Esqueci minha senha'}
              </button>
            </div>
          )}

          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Primeiro acesso exige internet. Depois disso, funciona offline (o Firebase guarda tudo em cache local) e sincroniza automaticamente quando houver conexão.</span>
          </div>

        </div>

      </div>
    </div>
  );
};
