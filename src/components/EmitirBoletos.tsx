import React, { useState, useEffect, useMemo } from 'react';
import { Customer, Quote, Boleto, BoletoProvider } from '../types';
import {
  getBoletoConfigStatus,
  getBoletoProviders,
  saveBoletoCredentials,
  removeBoletoCredentials,
  issueBoleto,
  getBoletos,
} from '../lib/boletoApi';
import {
  Lock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Trash2,
  Receipt,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Download,
  Info,
} from 'lucide-react';

interface EmitirBoletosProps {
  tenantId: string;
  customers: Customer[];
  quotes: Quote[];
  // Pré-preenchimento vindo do botão "Emitir Boleto" dentro de um orçamento específico
  prefill?: { customerId: string; quoteId: string } | null;
  onClearPrefill?: () => void;
}

interface CredentialField {
  id: string;
  label: string;
  type: 'text' | 'password' | 'file';
  optional?: boolean;
  accept?: string;
  hint?: string;
}

export const EmitirBoletos: React.FC<EmitirBoletosProps> = ({
  tenantId,
  customers,
  quotes,
  prefill,
  onClearPrefill,
}) => {
  // Lista de bancos — vem do servidor, não é mais fixa aqui. Se um banco ainda
  // não tem a integração pronta, a tela mostra isso claramente em vez de deixar
  // a pessoa descobrir só na hora de cobrar o cliente de verdade.
  const [providers, setProviders] = useState<
    Array<{ id: BoletoProvider; label: string; implemented: boolean; credentialFields: CredentialField[] }>
  >([]);

  // Cofre / configuração
  const [configLoading, setConfigLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [configuredProvider, setConfiguredProvider] = useState<BoletoProvider | null>(null);
  const [configuredAmbiente, setConfiguredAmbiente] = useState<'producao' | 'homologacao'>('producao');
  const [configuredIdentificacao, setConfiguredIdentificacao] = useState('');
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [vaultProvider, setVaultProvider] = useState<BoletoProvider>('simulado');
  const [vaultAmbiente, setVaultAmbiente] = useState<'producao' | 'homologacao'>('producao');
  // Valores dos campos de credencial — genérico porque cada banco pede campos
  // diferentes (ver credentialFields, vindo do servidor). Ex: { apiKey: '...' }
  // para o Asaas, ou { clientId, clientSecret, certificateBase64 } pra Efí/Inter.
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldFileNames, setFieldFileNames] = useState<Record<string, string>>({});
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [vaultError, setVaultError] = useState('');
  const [vaultSuccess, setVaultSuccess] = useState('');

  // Emissão
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [amountOption, setAmountOption] = useState<'total' | 'entrada' | 'saldo' | 'custom'>('total');
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [description, setDescription] = useState('');
  const [isDescriptionManual, setIsDescriptionManual] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [lastResult, setLastResult] = useState<Awaited<ReturnType<typeof issueBoleto>> | null>(null);
  const [copiedBarcode, setCopiedBarcode] = useState(false);

  // Histórico
  const [history, setHistory] = useState<Boleto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadProviders = async () => {
    try {
      const list = await getBoletoProviders();
      setProviders(list);
      if (list.length > 0 && !list.some((p) => p.id === vaultProvider)) {
        setVaultProvider(list[0].id);
      }
    } catch {
      // Se as Cloud Functions ainda não foram publicadas, mostramos isso mais
      // abaixo (vaultError ao tentar salvar) em vez de travar a tela toda aqui.
      setProviders([{ id: 'simulado', label: 'Modo Teste (Simulado)', implemented: true, credentialFields: [] }]);
    }
  };

  const providerLabel = (id: BoletoProvider | null) => {
    if (!id) return '';
    return providers.find((p) => p.id === id)?.label || id;
  };

  const currentCredentialFields = useMemo(
    () => providers.find((p) => p.id === vaultProvider)?.credentialFields || [],
    [providers, vaultProvider]
  );

  const handleFieldChange = (fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileFieldChange = async (fieldId: string, file: File | null) => {
    if (!file) return;
    setFieldFileNames((prev) => ({ ...prev, [fieldId]: file.name }));
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo do certificado.'));
        reader.onloadend = () => {
          const result = reader.result as string;
          // readAsDataURL devolve "data:<mime>;base64,<dados>" — guardamos só a
          // parte útil, o servidor não precisa do prefixo.
          resolve(result.split(',')[1] || result);
        };
        reader.readAsDataURL(file);
      });
      handleFieldChange(fieldId, base64);
    } catch (err: any) {
      setVaultError(err?.message || 'Erro ao ler o arquivo do certificado.');
    }
  };

  const loadConfigStatus = async () => {
    setConfigLoading(true);
    try {
      const status = await getBoletoConfigStatus(tenantId);
      setConfigured(status.configured);
      setConfiguredProvider(status.provider);
      setConfiguredAmbiente(status.ambiente || 'producao');
      setConfiguredIdentificacao(status.identificacao || '');
      setIsVaultOpen(!status.configured);
      if (status.provider) setVaultProvider(status.provider);
      if (status.ambiente) setVaultAmbiente(status.ambiente);
    } catch {
      setConfigured(false);
    } finally {
      setConfigLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const list = await getBoletos(tenantId);
      setHistory(list);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
    loadConfigStatus();
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Aplica pré-preenchimento vindo do botão "Emitir Boleto" de dentro de um orçamento
  useEffect(() => {
    if (prefill) {
      setSelectedCustomerId(prefill.customerId);
      setSelectedQuoteId(prefill.quoteId);
      onClearPrefill && onClearPrefill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  const customerQuotes = useMemo(
    () => quotes.filter((q) => q.customerId === selectedCustomerId),
    [quotes, selectedCustomerId]
  );

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) || null,
    [quotes, selectedQuoteId]
  );

  // Opções de valor dinâmicas — respeita a forma de pagamento real do orçamento,
  // igual já fazemos no PDF e no WhatsApp (sem inventar um "50%" que não existe).
  const amountOptions = useMemo(() => {
    if (!selectedQuote) return [];
    const opts: Array<{ id: typeof amountOption; label: string; value: number }> = [];

    opts.push({ id: 'total', label: `Total do Orçamento (100%)`, value: selectedQuote.totalAmount });

    const hasSplitDeposit =
      selectedQuote.depositAmount > 0 && selectedQuote.depositAmount < selectedQuote.totalAmount;
    if (hasSplitDeposit) {
      opts.push({
        id: 'entrada',
        label: `Entrada (${selectedQuote.depositPercent ?? Math.round((selectedQuote.depositAmount / selectedQuote.totalAmount) * 100)}%)`,
        value: selectedQuote.depositAmount,
      });
      if (selectedQuote.remainingAmount > 0) {
        opts.push({
          id: 'saldo',
          label: `Saldo Restante (${100 - (selectedQuote.depositPercent ?? 50)}%)`,
          value: selectedQuote.remainingAmount,
        });
      }
    }

    opts.push({ id: 'custom', label: 'Valor Personalizado', value: customAmount });
    return opts;
  }, [selectedQuote, customAmount]);

  const finalAmount = useMemo(() => {
    if (amountOption === 'custom') return customAmount;
    const opt = amountOptions.find((o) => o.id === amountOption);
    return opt ? opt.value : 0;
  }, [amountOption, amountOptions, customAmount]);

  // Monta uma descrição legível a partir dos itens reais do orçamento (ex:
  // "1x Vidro Temperado Incolor (1,000m x 1,000m); 2x Box de Banheiro") em vez
  // de deixar só "Orçamento #1002" — isso é o que aparece pro cliente no
  // campo de instruções do boleto.
  const buildQuoteDescription = (quote: Quote): string => {
    if (!quote.items || quote.items.length === 0) return `Orçamento #${quote.codeNumber}`;
    const parts = quote.items.slice(0, 3).map((item) => {
      const dims = item.heightM && item.widthM ? ` (${item.heightM.toFixed(2)}m x ${item.widthM.toFixed(2)}m)` : '';
      return `${item.quantity}x ${item.productName}${dims}`;
    });
    const suffix = quote.items.length > 3 ? ` e mais ${quote.items.length - 3} item(ns)` : '';
    return `${parts.join('; ')}${suffix} — Orçamento #${quote.codeNumber}`;
  };

  // Reset da opção de valor sempre que troca de orçamento (evita levar "saldo"
  // de um orçamento pro outro sem querer). Também preenche a descrição
  // automaticamente com os itens do orçamento — mas só se a pessoa ainda não
  // tiver digitado nada manualmente, pra nunca sobrescrever uma edição sua.
  useEffect(() => {
    setAmountOption('total');
    setCustomAmount(selectedQuote?.totalAmount || 0);
    if (!isDescriptionManual) {
      setDescription(selectedQuote ? buildQuoteDescription(selectedQuote) : '');
    }
  }, [selectedQuoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setVaultError('');
    setVaultSuccess('');

    // Padrão "deixe em branco para manter o atual": só exige preencher os
    // campos obrigatórios se for a primeira vez, ou se estiver trocando de
    // provedor. Campos marcados como "optional" (ex: senha do certificado)
    // nunca são obrigatórios.
    const isUpdatingSameProvider = configured && configuredProvider === vaultProvider;
    const missingRequired = currentCredentialFields.some(
      (f) => !f.optional && !fieldValues[f.id]?.trim() && !isUpdatingSameProvider
    );

    if (missingRequired) {
      setVaultError(
        `Preencha todos os campos obrigatórios: ${currentCredentialFields
          .filter((f) => !f.optional)
          .map((f) => f.label)
          .join(', ')}.`
      );
      return;
    }

    setIsSavingVault(true);
    try {
      await saveBoletoCredentials({
        provider: vaultProvider,
        ambiente: vaultAmbiente,
        clientId: fieldValues.clientId?.trim() || undefined,
        apiKey: fieldValues.apiKey?.trim() || undefined,
        clientSecret: fieldValues.clientSecret?.trim() || undefined,
        certificateBase64: fieldValues.certificateBase64 || undefined,
        certificatePassword: fieldValues.certificatePassword?.trim() || undefined,
      });
      setVaultSuccess('Cofre configurado com sucesso!');
      // Limpa os segredos da tela assim que saem daqui — nunca ficam visíveis
      // de novo, nem para quem acabou de digitá-los.
      setFieldValues({});
      setFieldFileNames({});
      await loadConfigStatus();
      setTimeout(() => setVaultSuccess(''), 3000);
    } catch (err: any) {
      setVaultError(err?.message || 'Erro ao salvar as credenciais. Verifique se as Cloud Functions estão publicadas.');
    } finally {
      setIsSavingVault(false);
    }
  };

  const handleRemoveVault = async () => {
    if (!window.confirm('Remover as credenciais de boleto configuradas? Você poderá cadastrar novas depois.')) return;
    try {
      await removeBoletoCredentials();
      await loadConfigStatus();
    } catch (err: any) {
      setVaultError(err?.message || 'Erro ao remover as credenciais.');
    }
  };

  const handleIssue = async () => {
    setIssueError('');
    setLastResult(null);

    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) {
      setIssueError('Selecione um cliente.');
      return;
    }
    if (finalAmount <= 0) {
      setIssueError('Informe um valor válido para o boleto.');
      return;
    }

    // Boletos registrados no Banco Central exigem CPF/CNPJ e endereço do
    // pagador. Sem CPF/CNPJ cadastrado, ainda deixamos emitir no modo
    // simulado/teste, mas avisamos — em produção, o banco vai recusar.
    if (configuredProvider !== 'simulado' && !customer.cpfCnpj) {
      setIssueError(
        `O cliente "${customer.name}" não tem CPF/CNPJ cadastrado. A maioria dos bancos exige isso para registrar o boleto — edite o cadastro do cliente antes de emitir.`
      );
      return;
    }

    // Aproveita endereço + "Cidade - UF" já cadastrados no cliente
    const [cidade, uf] = (customer.cityState || '').split('-').map((s) => s.trim());

    setIsIssuing(true);
    try {
      const result = await issueBoleto({
        customerId: customer.id,
        customerName: customer.name,
        customerDocument: customer.cpfCnpj || undefined,
        customerAddress: customer.address
          ? { logradouro: customer.address, cidade: cidade || '', uf: uf || '' }
          : undefined,
        quoteId: selectedQuote?.id,
        quoteCodeNumber: selectedQuote?.codeNumber,
        amount: finalAmount,
        dueDate,
        description: description || undefined,
      });
      setLastResult(result);
      await loadHistory();
    } catch (err: any) {
      setIssueError(err?.message || 'Erro ao emitir o boleto.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode).then(() => {
      setCopiedBarcode(true);
      setTimeout(() => setCopiedBarcode(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-blue-600" />
          Emitir Boletos
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Gere boletos para seus clientes a partir dos orçamentos cadastrados. Suas credenciais bancárias ficam
          guardadas com segurança e nunca são vistas por outros usuários do sistema.
        </p>
      </div>

      {/* Cofre de Credenciais */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsVaultOpen(!isVaultOpen)}
          className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${configured ? 'bg-emerald-100' : 'bg-amber-100'}`}>
              <Lock className={`w-4 h-4 ${configured ? 'text-emerald-700' : 'text-amber-700'}`} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">Cofre de Credenciais Bancárias</p>
              <p className="text-[11px] text-slate-500">
                {configLoading
                  ? 'Verificando...'
                  : configured
                  ? `Configurado — ${providerLabel(configuredProvider)} · ${
                      configuredAmbiente === 'homologacao' ? 'Homologação (teste)' : 'Produção'
                    }${configuredIdentificacao ? ` · ${configuredIdentificacao}` : ''}`
                  : 'Nenhuma credencial configurada ainda'}
              </p>
            </div>
          </div>
          {isVaultOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {isVaultOpen && (
          <div className="p-5 border-t border-slate-100 space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Suas credenciais são cifradas e guardadas num cofre isolado, acessível apenas pela sua conta — nem
                administradores do sistema conseguem lê-las de volta pela tela. Só usamos "Modo Teste (Simulado)"?
                Você pode gerar boletos de exemplo sem precisar de credenciais reais, ideal para testar o fluxo antes
                de configurar seu banco de verdade.
              </span>
            </div>

            <form onSubmit={handleSaveVault} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Banco / Gateway</label>
                <select
                  value={vaultProvider}
                  onChange={(e) => setVaultProvider(e.target.value as BoletoProvider)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                      {!p.implemented ? ' — ainda não emite' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {vaultProvider !== 'simulado' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ambiente</label>
                    <select
                      value={vaultAmbiente}
                      onChange={(e) => setVaultAmbiente(e.target.value as 'producao' | 'homologacao')}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="producao">Produção — cobra de verdade</option>
                      <option value="homologacao">Homologação — só para testar</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      As chaves de teste não funcionam em produção, e vice-versa. Use o par que o banco entregou para
                      o ambiente escolhido aqui.
                    </p>
                  </div>

                  {!providers.find((p) => p.id === vaultProvider)?.implemented && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>
                        A integração com {providerLabel(vaultProvider)} ainda precisa ser finalizada no servidor
                        (veja <code className="bg-amber-100 px-1 rounded">functions/providers/{vaultProvider}.js</code>).
                        Você já pode salvar suas credenciais aqui, mas a emissão só funcionará de verdade depois disso
                        ser implementado.
                      </span>
                    </div>
                  )}

                  {/* Campos de credencial variam por banco: Asaas só pede uma Chave de
                      API; Efí/Inter pedem Client ID + Client Secret + certificado digital.
                      A lista vem do servidor (providers[].credentialFields). */}
                  {currentCredentialFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {field.label}
                        {field.optional && <span className="text-slate-400 font-normal"> (opcional)</span>}
                      </label>

                      {field.type === 'file' ? (
                        <>
                          <input
                            type="file"
                            accept={field.accept}
                            onChange={(e) => handleFileFieldChange(field.id, e.target.files?.[0] || null)}
                            className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                          />
                          {fieldFileNames[field.id] && (
                            <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
                              <Check className="w-3 h-3" /> {fieldFileNames[field.id]} carregado
                            </p>
                          )}
                          {!fieldFileNames[field.id] && configured && configuredProvider === vaultProvider && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              Deixe em branco para manter o certificado já enviado.
                            </p>
                          )}
                        </>
                      ) : (
                        <input
                          type={field.type}
                          value={fieldValues[field.id] || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                          placeholder={
                            configured && configuredProvider === vaultProvider
                              ? `Deixe em branco para manter ${field.type === 'password' ? '— nunca é mostrado de novo' : 'o atual'}`
                              : `${field.label} fornecido pelo banco`
                          }
                          autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                        />
                      )}
                      {field.hint && <p className="text-[10px] text-slate-400 mt-1">{field.hint}</p>}
                    </div>
                  ))}
                </>
              )}

              {vaultError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
                  {vaultError}
                </div>
              )}
              {vaultSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> {vaultSuccess}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSavingVault}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {isSavingVault ? 'Salvando...' : 'Salvar Credenciais'}
                </button>
                {configured && (
                  <button
                    type="button"
                    onClick={handleRemoveVault}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover Credenciais
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Emissão */}
      {configured && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">Novo Boleto</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value);
                  setSelectedQuoteId('');
                  setIsDescriptionManual(false);
                  setDescription('');
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Selecione um cliente...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{!c.cpfCnpj ? ' (sem CPF/CNPJ)' : ''}
                  </option>
                ))}
              </select>
              {selectedCustomerId && configuredProvider !== 'simulado' && !customers.find((c) => c.id === selectedCustomerId)?.cpfCnpj && (
                <p className="text-[10px] text-amber-700 mt-1 flex items-start gap-1">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  Este cliente não tem CPF/CNPJ cadastrado — a maioria dos bancos exige isso para registrar o boleto.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Orçamento (opcional)</label>
              <select
                value={selectedQuoteId}
                onChange={(e) => setSelectedQuoteId(e.target.value)}
                disabled={!selectedCustomerId}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
              >
                <option value="">Sem orçamento vinculado</option>
                {customerQuotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    #{q.codeNumber} — R$ {q.totalAmount.toFixed(2)}
                  </option>
                ))}
              </select>
              {selectedCustomerId && customerQuotes.length === 0 && (
                <p className="text-[10px] text-slate-400 mt-1">Este cliente ainda não tem orçamentos cadastrados.</p>
              )}
            </div>
          </div>

          {selectedQuote && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Valor do Boleto</label>
              <div className="flex flex-wrap gap-2">
                {amountOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAmountOption(opt.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      amountOption === opt.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                    {opt.id !== 'custom' && ` — R$ ${opt.value.toFixed(2)}`}
                  </button>
                ))}
              </div>
              {amountOption === 'custom' && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  className="mt-2 w-40 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  placeholder="0,00"
                />
              )}
            </div>
          )}

          {!selectedQuote && selectedCustomerId && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Valor do Boleto (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customAmount}
                onChange={(e) => setCustomAmount(Number(e.target.value))}
                className="w-40 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                placeholder="0,00"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vencimento</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição</label>
              <input
                type="text"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setIsDescriptionManual(true);
                }}
                placeholder="Ex: Instalação de vidros"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
              />
              {selectedQuote && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Preenchido automaticamente com os itens do orçamento — edite se quiser personalizar.
                </p>
              )}
            </div>
          </div>

          {issueError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {issueError}
            </div>
          )}

          <button
            type="button"
            onClick={handleIssue}
            disabled={isIssuing || !selectedCustomerId || finalAmount <= 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {isIssuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            <span>{isIssuing ? 'Emitindo...' : `Emitir Boleto${finalAmount > 0 ? ` — R$ ${finalAmount.toFixed(2)}` : ''}`}</span>
          </button>

          {lastResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              {lastResult.simulated && (
                <div className="flex items-center gap-1.5 text-amber-700 text-[11px] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Boleto de TESTE — nenhuma cobrança real foi gerada</span>
                </div>
              )}
              <p className="text-sm font-bold text-emerald-800">Boleto emitido!</p>
              {lastResult.barcode && (
                <div className="flex items-center gap-2">
                  <code className="text-[11px] bg-white px-2 py-1.5 rounded-lg border border-emerald-200 font-mono flex-1 truncate">
                    {lastResult.barcode}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyBarcode(lastResult.barcode!)}
                    className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                    title="Copiar linha digitável"
                  >
                    {copiedBarcode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}
              {lastResult.boletoUrl && (
                <a
                  href={lastResult.boletoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar / Ver Boleto
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Histórico */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Boletos Emitidos</h3>
        </div>
        {historyLoading ? (
          <div className="p-6 text-center text-xs text-slate-400">Carregando...</div>
        ) : history.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">Nenhum boleto emitido ainda.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((b) => (
              <div key={b.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {b.customerName}
                    {b.quoteCodeNumber ? ` — Orçamento #${b.quoteCodeNumber}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Vencimento: {new Date(b.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')} · {providerLabel(b.provider)}
                    {b.simulated && ' · TESTE'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">R$ {b.amount.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">{b.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
