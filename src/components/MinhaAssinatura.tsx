import React, { useState, useEffect } from 'react';
import { getSubscriptionStatus } from '../lib/billingApi';
import { SubscriptionStatus } from '../types';
import { Checkout } from './Checkout';
import { Loader2, Crown, Clock, CalendarClock, RefreshCw, CreditCard, QrCode } from 'lucide-react';

const CICLO_LABEL: Record<string, string> = { monthly: 'Mensal', annual: 'Anual' };
const METODO_LABEL: Record<string, string> = { pix: 'Pix', cartao: 'Cartão de Crédito' };

export const MinhaAssinatura: React.FC = () => {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChangingPlan, setIsChangingPlan] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const s = await getSubscriptionStatus();
      setStatus(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatarData = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin mx-auto" />
      </div>
    );
  }

  if (isChangingPlan) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-lg">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Trocar de Plano</h2>
        <Checkout
          fullScreen={false}
          onCancel={() => setIsChangingPlan(false)}
          onPaymentConfirmed={() => {
            setIsChangingPlan(false);
            load();
          }}
        />
      </div>
    );
  }

  if (!status) return null;

  const isPremium = status.planType === 'premium';
  const isTrial = status.planType === 'trial';

  return (
    <div className="space-y-6 max-w-lg">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${isPremium ? 'bg-amber-100' : 'bg-blue-100'}`}>
            {isPremium ? <Crown className="w-5 h-5 text-amber-600" /> : <Clock className="w-5 h-5 text-blue-600" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {isPremium ? 'Assinatura Premium' : isTrial ? 'Período de Teste Grátis' : 'Assinatura Expirada'}
            </h2>
            <p className="text-xs text-slate-500">
              {isPremium
                ? 'Sua assinatura está ativa'
                : isTrial
                ? 'Aproveitando os 7 dias gratuitos'
                : 'Escolha um plano para reativar o acesso'}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          {isTrial && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-blue-800 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Teste termina em
              </span>
              <span className="font-bold text-blue-900">{formatarData(status.trialEndsAt)}</span>
            </div>
          )}

          {isPremium && (
            <>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" /> Válido até
                </span>
                <span className="font-bold text-slate-900">{formatarData(status.premiumUntil)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-600 font-semibold">Ciclo</span>
                <span className="font-bold text-slate-900">{CICLO_LABEL[status.billingCycle || ''] || '—'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-600 font-semibold flex items-center gap-1.5">
                  {status.paymentMethod === 'pix' ? <QrCode className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                  Forma de pagamento
                </span>
                <span className="font-bold text-slate-900">{METODO_LABEL[status.paymentMethod || ''] || '—'}</span>
              </div>
              {status.subscriptionType === 'recurring' && (
                <p className="text-[11px] text-slate-400 px-1">
                  Renova automaticamente no cartão. Para cancelar, acesse sua conta no Mercado Pago
                  (Assinaturas) — o acesso continua até o fim do período já pago.
                </p>
              )}
            </>
          )}
        </div>

        <button
          onClick={() => setIsChangingPlan(true)}
          className="w-full mt-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {isPremium ? 'Trocar de Plano' : 'Assinar Agora'}
        </button>
      </div>
    </div>
  );
};
