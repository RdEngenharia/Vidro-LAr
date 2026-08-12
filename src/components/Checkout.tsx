import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/authContext';
import { createCheckout, getSubscriptionStatus, generateIdempotencyKey } from '../lib/billingApi';
import { BillingCycle, SubscriptionPaymentMethod } from '../types';
import { Check, Loader2, Copy, QrCode, CreditCard, ShieldCheck, AlertTriangle } from 'lucide-react';

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

const MP_PUBLIC_KEY = import.meta.env.VITE_MP_PUBLIC_KEY || '';

const PRECOS = {
  monthly: { valor: 49.9, label: 'R$ 49,90', sufixo: '/mês' },
  annual: { valor: 538.92, label: 'R$ 538,92', sufixo: '/ano (10% de desconto)' },
};

interface CheckoutProps {
  onPaymentConfirmed: () => void;
}

export const Checkout: React.FC<CheckoutProps> = ({ onPaymentConfirmed }) => {
  const { user, logout } = useAuth();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<SubscriptionPaymentMethod>('pix');

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Chave de idempotência gerada UMA VEZ quando a tela abre, reaproveitada em
  // toda tentativa desta mesma compra — nunca regenerada a cada clique.
  const idempotencyKeyRef = useRef(generateIdempotencyKey(user?.tenantId || 'anon'));

  // Estado do Pix
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState('');
  const [pixCopied, setPixCopied] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estado do Cartão
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState(''); // MM/AA
  const [cardCvv, setCardCvv] = useState('');
  const [cardCpf, setCardCpf] = useState('');
  const [mpReady, setMpReady] = useState(false);
  const mpInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Carrega o SDK do Mercado Pago (script já incluso no index.html) — só
    // inicializa quando ele realmente terminar de carregar.
    if (window.MercadoPago && MP_PUBLIC_KEY) {
      mpInstanceRef.current = new window.MercadoPago(MP_PUBLIC_KEY);
      setMpReady(true);
    } else {
      const checkInterval = setInterval(() => {
        if (window.MercadoPago && MP_PUBLIC_KEY) {
          mpInstanceRef.current = new window.MercadoPago(MP_PUBLIC_KEY);
          setMpReady(true);
          clearInterval(checkInterval);
        }
      }, 300);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // Limpa o polling do Pix se a pessoa trocar de forma de pagamento ou sair
  // da tela — nunca deixar um intervalo rodando sem controle.
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const startPolling = () => {
    setIsPolling(true);
    // "Burra e teimosa": roda enquanto o cliente está com o celular na mão,
    // olhando o QR Code. Qualquer erro de rede é ignorado silenciosamente —
    // nunca some com o QR Code por causa de uma falha passageira de conexão.
    pollIntervalRef.current = setInterval(async () => {
      try {
        const status = await getSubscriptionStatus();
        if (status.planType === 'premium') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsPolling(false);
          onPaymentConfirmed();
        }
      } catch {
        // Ignora e tenta de novo no próximo ciclo — sem internet momentânea
        // não pode apagar o QR Code da tela de quem já está pagando.
      }
    }, 4000);
  };

  const handlePixCheckout = async () => {
    setError('');
    setIsProcessing(true);
    try {
      const result = await createCheckout({
        billingCycle,
        paymentMethod: 'pix',
        payerEmail: user?.email || '',
        idempotencyKey: idempotencyKeyRef.current,
      });
      if (result.qrCode) {
        setPixQrCode(result.qrCode);
        setPixQrCodeBase64(result.qrCodeBase64 || '');
        startPolling();
      } else if (result.status === 'approved') {
        onPaymentConfirmed();
      } else {
        setError('Não foi possível gerar o QR Code do Pix. Tente novamente.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao gerar cobrança Pix.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!mpReady || !mpInstanceRef.current) {
      setError('Aguarde o carregamento do formulário de pagamento e tente novamente.');
      return;
    }
    if (!cardNumber || !cardName || !cardExpiry || !cardCvv || !cardCpf) {
      setError('Preencha todos os campos do cartão.');
      return;
    }

    const [expMonth, expYear] = cardExpiry.split('/').map((s) => s.trim());
    if (!expMonth || !expYear) {
      setError('Validade inválida. Use o formato MM/AA.');
      return;
    }

    setIsProcessing(true);
    try {
      // Tokenização acontece AQUI, no navegador, direto com o Mercado Pago —
      // o número do cartão, CVV e validade nunca chegam ao nosso servidor,
      // só o token descartável abaixo.
      const tokenResponse = await mpInstanceRef.current.createCardToken({
        cardNumber: cardNumber.replace(/\s/g, ''),
        cardholderName: cardName,
        cardExpirationMonth: expMonth,
        cardExpirationYear: expYear.length === 2 ? `20${expYear}` : expYear,
        securityCode: cardCvv,
        identificationType: 'CPF',
        identificationNumber: cardCpf.replace(/\D/g, ''),
      });

      if (!tokenResponse?.id) {
        throw new Error('Não foi possível validar o cartão. Confira os dados e tente novamente.');
      }

      const result = await createCheckout({
        billingCycle,
        paymentMethod: 'cartao',
        payerEmail: user?.email || '',
        cardToken: tokenResponse.id,
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (result.status === 'approved' || result.status === 'authorized') {
        onPaymentConfirmed();
      } else {
        setError(
          `O pagamento não foi aprovado (status: ${result.status}). Confira os dados do cartão ou tente outro cartão.`
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao processar o pagamento.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixQrCode);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg max-w-lg w-full p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Assine o Vidraçaria Pro</h1>
          <p className="text-xs text-slate-500 mt-1">
            Seu período de teste terminou. Escolha um plano para continuar usando o sistema.
          </p>
        </div>

        {!pixQrCode && (
          <>
            {/* Seleção de ciclo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => {
                const isSelected = billingCycle === cycle;
                return (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      isSelected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase text-slate-400">
                      {cycle === 'annual' ? 'Anual — economize' : 'Mensal'}
                    </p>
                    <p className="text-lg font-black text-slate-900 mt-1">{PRECOS[cycle].label}</p>
                    <p className="text-[10px] text-slate-500">{PRECOS[cycle].sufixo}</p>
                  </button>
                );
              })}
            </div>

            {/* Seleção de forma de pagamento */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setPaymentMethod('pix')}
                className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-bold transition-all cursor-pointer ${
                  paymentMethod === 'pix' ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'
                }`}
              >
                <QrCode className="w-4 h-4" /> Pix
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cartao')}
                className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-bold transition-all cursor-pointer ${
                  paymentMethod === 'cartao' ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'
                }`}
              >
                <CreditCard className="w-4 h-4" /> Cartão
              </button>
            </div>

            {paymentMethod === 'cartao' && billingCycle === 'monthly' && (
              <p className="text-[10px] text-slate-400 mb-4 text-center">
                No cartão, o plano mensal renova automaticamente todo mês. Cancele quando quiser.
              </p>
            )}

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl mb-4 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {paymentMethod === 'pix' ? (
              <button
                onClick={handlePixCheckout}
                disabled={isProcessing}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                {isProcessing ? 'Gerando QR Code...' : 'Gerar QR Code Pix'}
              </button>
            ) : (
              <form onSubmit={handleCardCheckout} className="space-y-3">
                <input
                  type="text"
                  placeholder="Número do cartão"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  maxLength={19}
                />
                <input
                  type="text"
                  placeholder="Nome impresso no cartão"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="MM/AA"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    maxLength={5}
                  />
                  <input
                    type="text"
                    placeholder="CVV"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                    maxLength={4}
                  />
                  <input
                    type="text"
                    placeholder="CPF"
                    value={cardCpf}
                    onChange={(e) => setCardCpf(e.target.value)}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !mpReady}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  {isProcessing ? 'Processando...' : !mpReady ? 'Carregando...' : `Assinar — ${PRECOS[billingCycle].label}`}
                </button>
              </form>
            )}
          </>
        )}

        {/* QR Code do Pix gerado */}
        {pixQrCode && (
          <div className="text-center space-y-4">
            {pixQrCodeBase64 && (
              <img
                src={`data:image/png;base64,${pixQrCodeBase64}`}
                alt="QR Code Pix"
                className="w-48 h-48 mx-auto border border-slate-200 rounded-xl"
              />
            )}
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 font-mono text-[10px]">
                {pixQrCode}
              </code>
              <button
                onClick={handleCopyPix}
                className="shrink-0 p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                {pixCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
              {isPolling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Aguardando confirmação do pagamento...
            </p>
          </div>
        )}

        <button onClick={logout} className="w-full mt-4 text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer">
          Sair da conta
        </button>
      </div>
    </div>
  );
};
