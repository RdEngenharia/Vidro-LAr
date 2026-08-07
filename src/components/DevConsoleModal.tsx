import React, { useState, useEffect } from 'react';
import {
  Terminal,
  AlertTriangle,
  XCircle,
  Info,
  Search,
  Trash2,
  Download,
  Activity,
  CheckCircle2,
  RefreshCw,
  X,
  Bug,
  ShieldAlert,
  Database,
  Wifi,
  Filter,
  Lock,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';
import {
  LogEntry,
  getStoredLogs,
  clearLogs,
  exportLogsAsJson,
  logError,
  logInfo,
  logWarn
} from '../lib/logger';
import { getCustomers, getQuotes } from '../lib/db';
import { syncEngine } from '../lib/sync';

interface DevConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTenantId: string;
  currentUserEmail?: string;
}

const DEFAULT_DEV_PASSWORD = 'dev123';

export const DevConsoleModal: React.FC<DevConsoleModalProps> = ({
  isOpen,
  onClose,
  currentTenantId,
  currentUserEmail,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [tenantFilter, setTenantFilter] = useState<'all' | 'current'>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  
  // Password Lock State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [inputPassword, setInputPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changePasswordMsg, setChangePasswordMsg] = useState('');

  // Diagnostic status
  const [dbHealth, setDbHealth] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [dbDetails, setDbDetails] = useState<string>('');
  const [syncQueueCount, setSyncQueueCount] = useState<number>(0);

  const getSavedDevPassword = () => {
    return localStorage.getItem('vidracaria_dev_password') || DEFAULT_DEV_PASSWORD;
  };

  const loadLogs = () => {
    const all = getStoredLogs();
    setLogs(all);
    setSyncQueueCount(syncEngine.getStatus().pendingCount);
  };

  useEffect(() => {
    if (isOpen) {
      // Check session unlock
      const unlockedSession = sessionStorage.getItem('vidracaria_dev_unlocked') === 'true';
      setIsUnlocked(unlockedSession);
      setInputPassword('');
      setPasswordError('');
      setIsChangingPassword(false);
      setChangePasswordMsg('');

      if (unlockedSession) {
        loadLogs();
      }

      const handleNewLog = () => loadLogs();
      window.addEventListener('vidracaria_new_log', handleNewLog);
      return () => {
        window.removeEventListener('vidracaria_new_log', handleNewLog);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = getSavedDevPassword();
    if (inputPassword === correctPassword) {
      sessionStorage.setItem('vidracaria_dev_unlocked', 'true');
      setIsUnlocked(true);
      setPasswordError('');
      loadLogs();
      logInfo('DEV_CONSOLE_UNLOCKED', 'Acesso ao console de desenvolvedor liberado via senha', {
        unlockedBy: currentUserEmail || 'Dev',
      });
    } else {
      setPasswordError('Senha de desenvolvedor incorreta. Tente novamente.');
      logWarn('DEV_CONSOLE_INVALID_PASSWORD', 'Tentativa de acesso ao modo dev com senha incorreta');
    }
  };

  const handleLockSession = () => {
    sessionStorage.removeItem('vidracaria_dev_unlocked');
    setIsUnlocked(false);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    localStorage.setItem('vidracaria_dev_password', newPassword.trim());
    setChangePasswordMsg('Senha do desenvolvedor alterada com sucesso!');
    setNewPassword('');
    setTimeout(() => {
      setIsChangingPassword(false);
      setChangePasswordMsg('');
    }, 2000);
  };

  // Filtered logs
  const filteredLogs = logs.filter((log) => {
    // Level filter
    if (selectedLevel !== 'all' && log.level !== selectedLevel) {
      return false;
    }
    // Tenant filter
    if (tenantFilter === 'current' && log.tenantId !== currentTenantId) {
      return false;
    }
    // Search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchMsg = log.message?.toLowerCase().includes(term);
      const matchAction = log.action?.toLowerCase().includes(term);
      const matchEmail = log.userEmail?.toLowerCase().includes(term);
      const matchTenant = log.tenantId?.toLowerCase().includes(term);
      const matchStack = log.stackTrace?.toLowerCase().includes(term);
      return matchMsg || matchAction || matchEmail || matchTenant || matchStack;
    }
    return true;
  });

  const totalErrors = logs.filter((l) => l.level === 'error').length;
  const totalWarnings = logs.filter((l) => l.level === 'warn').length;

  const handleClearLogs = () => {
    if (window.confirm('Deseja realmente apagar todo o histórico de logs do sistema?')) {
      clearLogs();
      setLogs([]);
    }
  };

  const handleSimulateError = () => {
    try {
      // Intentionally trigger a test exception
      throw new Error('Simulação de Erro de Teste disparada pelo desenvolvedor');
    } catch (err: any) {
      logError('SIMULATED_TEST_ERROR', err, {
        simulatedBy: currentUserEmail || 'Dev',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleTestDatabase = async () => {
    setDbHealth('testing');
    setDbDetails('Testando leitura e gravação no IndexedDB local...');
    try {
      const startTime = performance.now();
      const [custs, quotes] = await Promise.all([
        getCustomers(currentTenantId),
        getQuotes(currentTenantId),
      ]);
      const duration = (performance.now() - startTime).toFixed(1);

      setDbHealth('ok');
      setDbDetails(`Base de Dados Saudável. (${custs.length} Clientes, ${quotes.length} Orçamentos lidos em ${duration}ms)`);
      logInfo('DB_HEALTH_CHECK', 'Diagnóstico de base de dados finalizado com sucesso', {
        customersCount: custs.length,
        quotesCount: quotes.length,
        durationMs: duration,
      });
    } catch (err: any) {
      setDbHealth('error');
      setDbDetails(`Falha no Diagnóstico da Base: ${err?.message || err}`);
      logError('DB_HEALTH_CHECK_FAILED', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto animate-fade-in">
      {!isUnlocked ? (
        /* Password Gate Screen */
        <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 w-full max-w-md shadow-2xl overflow-hidden font-sans p-6 sm:p-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
              <Lock className="w-6 h-6 text-blue-400" />
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-xl font-extrabold text-white mb-2">
            Acesso Restrito ao Desenvolvedor
          </h3>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Digite a senha de acesso para visualizar o registro de erros, logs e diagnóstico individual do sistema.
          </p>

          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Senha do Desenvolvedor
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={inputPassword}
                  onChange={(e) => {
                    setInputPassword(e.target.value);
                    setPasswordError('');
                  }}
                  placeholder="Digite a senha..."
                  autoFocus
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-red-400 font-medium mt-1.5 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {passwordError}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-md inline-flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Acessar Modo Dev</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Full Unlocked Console */
        <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden font-sans">
          
          {/* Top Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
                <Terminal className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-white text-base">Painel do Desenvolvedor & Logs de Erros</h3>
                  <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono text-[10px]">
                    Modo Dev v1.0 (Protegido)
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Monitoramento de falhas individuais, logs de requisições e diagnóstico de usuários
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsChangingPassword(!isChangingPassword)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Alterar senha de acesso do Modo Dev"
              >
                <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Alterar Senha</span>
              </button>

              <button
                onClick={handleLockSession}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Bloquear Painel"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Bloquear</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Change Password Bar */}
          {isChangingPassword && (
            <div className="p-3 bg-blue-950/40 border-b border-blue-900/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0 animate-fade-in">
              <div className="flex items-center gap-2 text-blue-200">
                <KeyRound className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Defina uma nova senha para proteger o Painel do Desenvolvedor:</span>
              </div>
              <form onSubmit={handleChangePassword} className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha..."
                  className="px-3 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden w-full sm:w-48"
                />
                <button
                  type="submit"
                  disabled={!newPassword.trim()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-xs shrink-0"
                >
                  Salvar
                </button>
              </form>
              {changePasswordMsg && (
                <span className="text-emerald-400 font-bold text-xs">{changePasswordMsg}</span>
              )}
            </div>
          )}

        {/* System Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900 border-b border-slate-800 shrink-0 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Total de Logs</span>
              <span className="text-lg font-bold text-white">{logs.length}</span>
            </div>
            <Activity className="w-5 h-5 text-slate-500" />
          </div>

          <div className="p-3 bg-red-950/30 rounded-xl border border-red-900/40 flex items-center justify-between">
            <div>
              <span className="text-red-400/80 block text-[11px]">Falhas & Erros</span>
              <span className="text-lg font-bold text-red-400">{totalErrors}</span>
            </div>
            <XCircle className="w-5 h-5 text-red-400" />
          </div>

          <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-900/40 flex items-center justify-between">
            <div>
              <span className="text-amber-400/80 block text-[11px]">Avisos</span>
              <span className="text-lg font-bold text-amber-400">{totalWarnings}</span>
            </div>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-slate-400 block text-[11px]">Empresa / Tenant</span>
              <span className="text-xs font-semibold text-blue-300 truncate max-w-[110px] block" title={currentTenantId}>
                {currentTenantId}
              </span>
            </div>
            <ShieldAlert className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        {/* Quick Diagnostics Action Bar */}
        <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleTestDatabase}
              disabled={dbHealth === 'testing'}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>{dbHealth === 'testing' ? 'Testando...' : 'Diagnosticar Banco Local'}</span>
            </button>

            <button
              onClick={handleSimulateError}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
            >
              <Bug className="w-3.5 h-3.5 text-amber-400" />
              <span>Simular Erro de Teste</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportLogsAsJson}
              disabled={logs.length === 0}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg inline-flex items-center gap-1.5 font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Relatório (.JSON)</span>
            </button>

            <button
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              className="px-3 py-1.5 bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/60 rounded-lg inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar Logs</span>
            </button>
          </div>
        </div>

        {/* Database diagnostic feedback */}
        {dbDetails && (
          <div className={`p-2.5 px-4 text-xs font-mono border-b ${
            dbHealth === 'ok' ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/50' : 'bg-red-950/40 text-red-300 border-red-900/50'
          }`}>
            ▸ {dbDetails}
          </div>
        )}

        {/* Filters and Search Bar */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Level tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
            <button
              onClick={() => setSelectedLevel('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedLevel === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({logs.length})
            </button>
            <button
              onClick={() => setSelectedLevel('error')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedLevel === 'error' ? 'bg-red-900/60 text-red-300 border border-red-700/60 font-bold' : 'text-slate-400 hover:text-red-400'
              }`}
            >
              <XCircle className="w-3 h-3 text-red-400" />
              Erros ({totalErrors})
            </button>
            <button
              onClick={() => setSelectedLevel('warn')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedLevel === 'warn' ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60 font-bold' : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Avisos ({totalWarnings})
            </button>
            <button
              onClick={() => setSelectedLevel('info')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                selectedLevel === 'info' ? 'bg-blue-900/60 text-blue-300 border border-blue-700/60 font-bold' : 'text-slate-400 hover:text-blue-400'
              }`}
            >
              <Info className="w-3 h-3 text-blue-400" />
              Info
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por erro, ação, usuário ou tenant..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-950/50 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2 font-sans">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-80" />
              <p className="font-semibold text-slate-300 text-sm">Nenhum log ou erro registrado para este filtro</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Todos os eventos da aplicação e exceções dos usuários aparecerão aqui em tempo real.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isErr = log.level === 'error';
              const isWarn = log.level === 'warn';

              return (
                <div
                  key={log.id}
                  className={`rounded-xl border transition-all ${
                    isErr
                      ? 'bg-red-950/20 border-red-900/40 hover:border-red-700/60'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-3 flex items-start justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-2.5 overflow-hidden">
                      {isErr ? (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      )}

                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap text-[11px]">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                              isErr
                                ? 'bg-red-500/20 text-red-300'
                                : isWarn
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {log.level}
                          </span>
                          <span className="text-blue-400 font-bold">[{log.action}]</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString('pt-BR')}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 text-[10px] bg-slate-800 px-1.5 py-0.5 rounded">
                            Tenant: {log.tenantId}
                          </span>
                        </div>

                        <p className={`font-semibold break-words ${isErr ? 'text-red-300' : isWarn ? 'text-amber-200' : 'text-slate-200'}`}>
                          {log.message}
                        </p>
                      </div>
                    </div>

                    <button className="text-slate-500 hover:text-slate-300 text-[11px] underline shrink-0 mt-0.5">
                      {isExpanded ? 'Ocultar' : 'Detalhes'}
                    </button>
                  </div>

                  {/* Expanded details / stack trace */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-800/80 bg-slate-950/80 text-[11px] space-y-2 text-slate-300">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">ID do Registro & Data Completa:</span>
                        <code>{log.id} ({new Date(log.timestamp).toLocaleString('pt-BR')})</code>
                      </div>

                      {log.userEmail && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">Usuário que sofreu a falha:</span>
                          <code>{log.userEmail}</code>
                        </div>
                      )}

                      {log.stackTrace && (
                        <div>
                          <span className="text-red-400 block text-[10px] uppercase font-bold mb-0.5">Rastreamento de Erro (Stack Trace):</span>
                          <pre className="p-2.5 bg-black/60 rounded-lg text-red-300/90 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] border border-red-900/30">
                            {log.stackTrace}
                          </pre>
                        </div>
                      )}

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <span className="text-blue-400 block text-[10px] uppercase font-bold mb-0.5">Metadados e Contexto Adicional:</span>
                          <pre className="p-2 bg-slate-900 rounded-lg text-slate-300 overflow-x-auto font-mono text-[10px] border border-slate-800">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.userAgent && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold mb-0.5">Navegador / Dispositivo:</span>
                          <code className="text-slate-400 text-[10px] block truncate" title={log.userAgent}>
                            {log.userAgent}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between shrink-0">
          <span>O painel intercepta e registra automaticamente qualquer exceção no navegador.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>

      </div>
      )}
    </div>
  );
};
