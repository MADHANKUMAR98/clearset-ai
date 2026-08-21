// ============================================================================
// ClearSet AI — Frontend API Client
// All Snowflake communication happens server-side. This module only
// communicates with our Express backend at /api/...
// No Snowflake credentials are ever passed to browser code.
// ============================================================================

export type ApiMode = 'snowflake' | 'local';

const DEFAULT_TIMEOUT_MS = 8000;
const CORTEX_TIMEOUT_MS = 30000; // Cortex calls can take longer

// ============================================================================
// Generic fetch helper with AbortController timeout
// ============================================================================
async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// Response shape interfaces
// ============================================================================

export interface ApiListResponse {
  success: boolean;
  mode: ApiMode;
  data: Record<string, unknown>[];
  message?: string;
  error?: string;
}

export interface ApiSingleResponse {
  success: boolean;
  mode: ApiMode;
  data: Record<string, unknown> | null;
  message?: string;
  error?: string;
}

/** Legacy alias kept for Stage 2 compatibility */
export type ExceptionsApiResponse = ApiListResponse;

export interface HealthApiResponse {
  mode: ApiMode;
  snowflake: boolean;
  message?: string;
  session?: unknown;
  error?: string;
}

export interface CortexSearchApiResponse {
  success: boolean;
  mode: ApiMode;
  results: Record<string, unknown>[];
  message?: string;
  error?: string;
}

export interface CortexAnalystApiResponse {
  success: boolean;
  mode: ApiMode;
  question?: string;
  sql?: string | null;
  interpretation?: string | null;
  data: Record<string, unknown>[];
  message?: string;
  error?: string;
  analystResponse?: unknown;
}

// ============================================================================
// /api/health
// ============================================================================
export async function fetchHealth(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<HealthApiResponse> {
  try {
    return await fetchWithTimeout<HealthApiResponse>('/api/health', {}, timeoutMs);
  } catch {
    return { mode: 'local', snowflake: false, error: 'Backend unreachable' };
  }
}

// ============================================================================
// /api/exceptions  (Stage 2 — preserved unchanged)
// ============================================================================
export async function fetchExceptionsFromApi(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ExceptionsApiResponse> {
  try {
    const payload = await fetchWithTimeout<ExceptionsApiResponse>(
      '/api/exceptions',
      {},
      timeoutMs,
    );
    if (!payload || !Array.isArray(payload.data)) {
      return { success: false, mode: 'local', data: [], message: 'Snowflake unavailable' };
    }
    return payload;
  } catch {
    return { success: false, mode: 'local', data: [], message: 'Snowflake unavailable' };
  }
}

// ============================================================================
// /api/trades
// ============================================================================
export async function fetchTradesFromApi(
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ApiListResponse> {
  try {
    const payload = await fetchWithTimeout<ApiListResponse>('/api/trades', {}, timeoutMs);
    if (!payload || !Array.isArray(payload.data)) {
      return { success: false, mode: 'local', data: [], message: 'Snowflake unavailable' };
    }
    return payload;
  } catch {
    return { success: false, mode: 'local', data: [], message: 'Snowflake unavailable' };
  }
}

// ============================================================================
// /api/counterparties/:id
// ============================================================================
export async function fetchCounterpartyFromApi(
  cpId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ApiSingleResponse> {
  try {
    const payload = await fetchWithTimeout<ApiSingleResponse>(
      `/api/counterparties/${encodeURIComponent(cpId)}`,
      {},
      timeoutMs,
    );
    return payload;
  } catch {
    return { success: false, mode: 'local', data: null, message: 'Snowflake unavailable' };
  }
}

// ============================================================================
// /api/settlement-events/:tradeId
// ============================================================================
export async function fetchSettlementEventsFromApi(
  tradeId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ApiListResponse> {
  try {
    const payload = await fetchWithTimeout<ApiListResponse>(
      `/api/settlement-events/${encodeURIComponent(tradeId)}`,
      {},
      timeoutMs,
    );
    if (!payload || !Array.isArray(payload.data)) {
      return { success: false, mode: 'local', data: [], message: 'Snowflake unavailable' };
    }
    return payload;
  } catch {
    return { success: false, mode: 'local', data: [], message: 'Snowflake unavailable' };
  }
}

// ============================================================================
// POST /api/cortex/search
// ============================================================================
export async function fetchCortexSearch(
  query: string,
  limit: number = 5,
  filter?: Record<string, unknown>,
  timeoutMs: number = CORTEX_TIMEOUT_MS,
): Promise<CortexSearchApiResponse> {
  try {
    const payload = await fetchWithTimeout<CortexSearchApiResponse>(
      '/api/cortex/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit, ...(filter ? { filter } : {}) }),
      },
      timeoutMs,
    );
    if (!payload || !Array.isArray(payload.results)) {
      return { success: false, mode: 'local', results: [], message: 'Cortex Search unavailable' };
    }
    return payload;
  } catch {
    return { success: false, mode: 'local', results: [], message: 'Cortex Search unavailable' };
  }
}

// ============================================================================
// POST /api/cortex/analyst
// ============================================================================
export async function fetchCortexAnalyst(
  question: string,
  timeoutMs: number = CORTEX_TIMEOUT_MS,
): Promise<CortexAnalystApiResponse> {
  try {
    const payload = await fetchWithTimeout<CortexAnalystApiResponse>(
      '/api/cortex/analyst',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      },
      timeoutMs,
    );
    if (!payload) {
      return {
        success: false,
        mode: 'local',
        data: [],
        message: 'Cortex Analyst unavailable',
      };
    }
    return payload;
  } catch {
    return {
      success: false,
      mode: 'local',
      data: [],
      message: 'Cortex Analyst unavailable',
    };
  }
}
