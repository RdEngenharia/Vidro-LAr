export interface LogEntry {
  id: string;
  timestamp: string; // ISO string
  level: 'error' | 'warn' | 'info';
  tenantId: string;
  userEmail?: string;
  action: string;
  message: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
  userAgent?: string;
}

const LOGS_STORAGE_KEY = 'vidracaria_dev_logs_v1';
const MAX_LOGS = 500;

let currentTenantId = 'tenant_default';
let currentUserEmail = 'anonymous';

export function setLoggerContext(tenantId: string, userEmail?: string) {
  currentTenantId = tenantId || 'tenant_default';
  currentUserEmail = userEmail || 'anonymous';
}

export function getStoredLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLogEntry(entry: Omit<LogEntry, 'id' | 'timestamp' | 'tenantId' | 'userEmail' | 'userAgent'>) {
  const fullEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    level: entry.level,
    tenantId: currentTenantId,
    userEmail: currentUserEmail,
    action: entry.action,
    message: entry.message,
    stackTrace: entry.stackTrace,
    metadata: entry.metadata,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  try {
    const logs = getStoredLogs();
    logs.unshift(fullEntry); // newest first
    if (logs.length > MAX_LOGS) {
      logs.length = MAX_LOGS; // cap max logs
    }
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save log entry locally:', e);
  }

  // Dispatch custom event for real-time UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vidracaria_new_log', { detail: fullEntry }));
  }

  return fullEntry;
}

export function logError(action: string, error: any, metadata?: Record<string, any>) {
  const message = error?.message || String(error) || 'Erro desconhecido';
  const stackTrace = error?.stack || undefined;

  console.error(`[DEV-LOG][ERROR][${action}]`, error);
  return saveLogEntry({
    level: 'error',
    action,
    message,
    stackTrace,
    metadata,
  });
}

export function logWarn(action: string, message: string, metadata?: Record<string, any>) {
  console.warn(`[DEV-LOG][WARN][${action}]`, message);
  return saveLogEntry({
    level: 'warn',
    action,
    message,
    metadata,
  });
}

export function logInfo(action: string, message: string, metadata?: Record<string, any>) {
  console.log(`[DEV-LOG][INFO][${action}]`, message);
  return saveLogEntry({
    level: 'info',
    action,
    message,
    metadata,
  });
}

export function clearLogs() {
  try {
    localStorage.removeItem(LOGS_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vidracaria_new_log'));
    }
  } catch (e) {
    console.error('Error clearing logs:', e);
  }
}

export function exportLogsAsJson() {
  const logs = getStoredLogs();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `relatorio-erros-vidracaria-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Global unhandled error interception
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logError('UNHANDLED_EXCEPTION', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError('UNHANDLED_PROMISE_REJECTION', event.reason, {
      type: 'UnhandledPromiseRejection',
    });
  });
}
