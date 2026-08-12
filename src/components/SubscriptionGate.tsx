import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { getSubscriptionStatus } from '../lib/billingApi';
import { SubscriptionStatus } from '../types';
import { Checkout } from './Checkout';
import { Loader2, Clock, ShieldCheck, X, Zap } from 'lucide-react';

interface SubscriptionGateProps {
  children: React.ReactNode;
}

// Decide, a cada carregamento do app, se libera o sistema ou mostra a tela de
// pagamento. A verdade sempre vem da Cloud Function (que recalcula na hora),
// nunca de um valor guardado localmente — sem isso, alguém poderia manter o
// navegador aberto pra sempre com um estado "premium" que já expirou.
export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const loadStatus = async () => {
    try {
      const s = await getSubscriptionStatus();
      setStatus(s);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Erro ao verificar sua assinatura.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadStatus();
  }, [user]);

  if (!user) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-6 rounded-2xl border border-rose-200 max-w-md text-center">
          <p className="text-sm font-bold text-rose-700 mb-2">Não foi possível verificar sua assinatura</p>
          <p className="text-xs text-slate-500 mb-4">{error}</p>
          <button
            onClick={loadStatus}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!status) return <>{children}</>;

  // Acesso liberado — Premium ativo.
  if (status.planType === 'premium') {
    return <>{children}</>;
  }

  // Teste grátis ainda dentro do prazo — libera, mas mostra quanto tempo resta
  // e um jeito fácil de já assinar antes de acabar (mensal recorrente no
  // cartão, anual com desconto, ou avulso no Pix — a pessoa escolhe).
  if (status.planType === 'trial') {
    const diasRestantes = status.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;
    return (
      <>
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-3 text-xs font-semibold text-amber-800 flex-wrap">
          <span className="inline-flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            {diasRestantes > 0
              ? `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''} do seu teste grátis`
              : 'Seu teste grátis termina hoje'}
          </span>
          {user.role === 'master' && (
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-800 hover:bg-amber-900 text-white rounded-full text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Zap className="w-3 h-3" />
              Assinar Agora
            </button>
          )}
        </div>

        {isUpgradeModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 my-8 relative">
              <button
                onClick={() => setIsUpgradeModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-bold text-slate-900 mb-1">Assinar antes do teste acabar</h2>
              <p className="text-xs text-slate-500 mb-4">
                Você ainda tem {diasRestantes} dia{diasRestantes !== 1 ? 's' : ''} de teste — mas pode garantir seu
                plano agora mesmo, sem perder nada do tempo que já passou.
              </p>
              <Checkout
                fullScreen={false}
                onCancel={() => setIsUpgradeModalOpen(false)}
                onPaymentConfirmed={() => {
                  setIsUpgradeModalOpen(false);
                  loadStatus();
                }}
              />
            </div>
          </div>
        )}

        {children}
      </>
    );
  }

  // Expirado (teste acabou sem pagar, ou assinatura venceu) — bloqueia tudo.
  // Só o mestre vê a tela de pagamento; um membro vê um aviso pra procurar o
  // administrador da conta (a assinatura é da conta inteira, não individual).
  if (user.role !== 'master') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 max-w-md text-center shadow-xs">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-900">Assinatura da empresa expirada</p>
          <p className="text-xs text-slate-500 mt-2">
            Peça ao administrador da conta (usuário mestre) para renovar a assinatura para continuar usando o sistema.
          </p>
        </div>
      </div>
    );
  }

  return <Checkout onPaymentConfirmed={loadStatus} />;
};
