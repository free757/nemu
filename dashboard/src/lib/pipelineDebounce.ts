import { ProcessSpeechParams } from './realtimePipeline';

// ---------------------------------------------------------------------------
// Request tracing configuration
// ---------------------------------------------------------------------------

// Primary and fallback model definitions
const PRIMARY_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
const FALLBACK_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-3-4b-it:free',
];

// Cooldown state after a 429 response
let cooldownUntil = 0;
const COOLDOWN_DURATION_MS = 8000; // 8 seconds

// Exponential backoff delays in ms
const BACKOFF_DELAYS_MS = [1000, 2000, 4000];

// Helper to generate a fingerprint hash of a transcript string
export function getTranscriptHash(text: string): string {
  let hash = 5381;
  const clean = text.replace(/\s+/g, '').toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 33) ^ clean.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

// ---------------------------------------------------------------------------
// Debounce Controller
// ---------------------------------------------------------------------------

/**
 * Debounce controller to manage incoming voice recognition transcript chunks.
 * Enforces stabilization delay, filters out duplicates, and checks length.
 */
export class PipelineDebounce {
  private timeoutId: NodeJS.Timeout | null = null;
  private lastProcessedHash = '';

  public debounceSpeech(
    params: ProcessSpeechParams,
    onApproved: (params: ProcessSpeechParams) => void
  ): void {
    const text = params.chunk.trim();

    const words = text.split(/\s+/).filter(Boolean);
    if (text.length < 5 || words.length < 2) {
      return;
    }

    const currentHash = getTranscriptHash(text);
    if (currentHash === this.lastProcessedHash) {
      console.log('[Debounce] duplicate transcript ignored');
      return;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    console.log('[Debounce] waiting for stabilization');
    this.timeoutId = setTimeout(() => {
      this.lastProcessedHash = currentHash;
      console.log('[Debounce] processing approved');
      onApproved(params);
    }, 350);
  }

  public reset(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.lastProcessedHash = '';
  }
}

// ---------------------------------------------------------------------------
// Global Throttler State
// ---------------------------------------------------------------------------

let lastAIRequestTimestamp = 0;
let currentSessionId = '';
const lastProcessedAIHash: Record<string, string> = {};

interface InFlightRequest {
  controller: AbortController;
  type: 'semantic' | 'draft' | 'final';
  hash: string;
  sessionId?: string;
  requestId: string;
  startedAt: number;
}
const activeRequests = new Map<string, InFlightRequest>();

export function startNewSession(): string {
  currentSessionId = Math.random().toString(36).substring(7);
  console.log(`[Pipeline] New microphone session started: ${currentSessionId}`);
  abortAllActiveRequests('session_change');
  return currentSessionId;
}

export function getCurrentSessionId(): string {
  return currentSessionId;
}

export function abortAllActiveRequests(reason: string = 'manual'): void {
  if (activeRequests.size > 0) {
    for (const [key, req] of activeRequests.entries()) {
      console.log(`[Throttle] stale request cancelled (type: ${req.type}, requestId: ${req.requestId}, reason: ${reason})`);
      req.controller.abort();
    }
    activeRequests.clear();
  }
}

// ---------------------------------------------------------------------------
// OpenRouter diagnostics helper
// ---------------------------------------------------------------------------

function logOpenRouterResponse(
  requestId: string,
  type: string,
  response: Response,
  model: string
): void {
  const status = response.status;
  const retryAfter = response.headers.get('retry-after');
  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
  const rateLimitReset = response.headers.get('x-ratelimit-reset');
  const provider = response.headers.get('x-openrouter-provider') ?? 'unknown';

  console.log(
    `[Request] response | requestId=${requestId} type=${type} status=${status} model=${model} provider=${provider}` +
    (retryAfter ? ` retry-after=${retryAfter}s` : '') +
    (rateLimitRemaining ? ` ratelimit-remaining=${rateLimitRemaining}` : '') +
    (rateLimitReset ? ` ratelimit-reset=${rateLimitReset}` : '')
  );
}

// ---------------------------------------------------------------------------
// Core fetch wrapper: tracing + backoff + fallback
// ---------------------------------------------------------------------------

/**
 * Executes a fetch to the OpenRouter chat completions endpoint with:
 * - Full request tracing (UUID, lifecycle, hash, session, timestamp, model)
 * - Exponential backoff on transient failures
 * - Automatic fallback to secondary models on 429
 * - Cooldown enforcement
 */
export async function openRouterFetch(
  requestId: string,
  type: 'semantic' | 'draft' | 'final',
  sessionId: string | undefined,
  transcriptHash: string,
  body: object,
  signal: AbortSignal
): Promise<Response> {
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError: Error = new Error('No models attempted');

  for (let modelIdx = 0; modelIdx < modelsToTry.length; modelIdx++) {
    const model = modelsToTry[modelIdx];
    if (modelIdx > 0) {
      console.log(`[Provider] fallback activated | requestId=${requestId} model=${model}`);
    }

    for (let attempt = 0; attempt <= BACKOFF_DELAYS_MS.length; attempt++) {
      if (signal.aborted) {
        console.log(`[Request] aborted | requestId=${requestId} type=${type}`);
        throw new DOMException('Aborted', 'AbortError');
      }

      // Enforce cooldown
      const now = Date.now();
      if (now < cooldownUntil) {
        const waitMs = cooldownUntil - now;
        console.log(`[Cooldown] AI requests temporarily paused | requestId=${requestId} resumeIn=${Math.ceil(waitMs / 1000)}s`);
        await new Promise(r => setTimeout(r, waitMs));
      }

      const openRouterKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
      const requestBody = { ...(body as any), model };

      console.log(
        `[Request] started | requestId=${requestId} type=${type} sessionId=${sessionId ?? 'none'} hash=${transcriptHash} model=${model} attempt=${attempt + 1} ts=${Date.now()}`
      );
      console.log(`[Throttle] activeRequests=${activeRequests.size} pendingRequests=${activeRequests.size}`);

      let response: Response;
      try {
        response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openRouterKey}`,
            'HTTP-Referer': 'https://nemu-dashboard-ten.vercel.app',
            'X-Title': 'Nemu AI Interview Assistant',
          },
          body: JSON.stringify(requestBody),
          signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          console.log(`[Request] aborted | requestId=${requestId} type=${type}`);
          throw fetchErr;
        }
        lastError = fetchErr;
        const delay = BACKOFF_DELAYS_MS[attempt] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
        console.warn(`[Request] failed (network) | requestId=${requestId} attempt=${attempt + 1} retryIn=${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      logOpenRouterResponse(requestId, type, response, model);

      if (response.status === 429) {
        // Enter cooldown
        cooldownUntil = Date.now() + COOLDOWN_DURATION_MS;
        console.log(`[Provider] rate limited | requestId=${requestId} model=${model} cooldownFor=${COOLDOWN_DURATION_MS / 1000}s`);
        console.log(`[Cooldown] AI requests temporarily paused`);

        // Try next model in fallback chain (break inner retry loop)
        break;
      }

      if (!response.ok) {
        const delay = BACKOFF_DELAYS_MS[attempt] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1];
        console.warn(`[Request] failed | requestId=${requestId} status=${response.status} attempt=${attempt + 1} retryIn=${delay}ms`);
        lastError = new Error(`HTTP ${response.status}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      console.log(`[Request] completed | requestId=${requestId} type=${type} model=${model} ts=${Date.now()}`);
      return response;
    }
  }

  // All models and retries exhausted
  console.error(`[Request] failed | requestId=${requestId} type=${type} all models exhausted`);
  throw lastError;
}

// ---------------------------------------------------------------------------
// throttleAIRequest
// ---------------------------------------------------------------------------

/**
 * Throttles AI requests to prevent double semantic checking, duplicate draft answer prep,
 * and duplicate final answer generation. Adds full request tracing and 429 protection.
 */
export async function throttleAIRequest<T>(
  type: 'semantic' | 'draft' | 'final',
  transcript: string,
  execute: (signal: AbortSignal) => Promise<T>,
  sessionId?: string
): Promise<T | null> {
  // 1. Session ownership validation
  if (sessionId && sessionId !== currentSessionId) {
    console.log('[Pipeline] orphan request prevented');
    return null;
  }

  const hash = getTranscriptHash(transcript);

  // 2. Duplicate AI request fingerprint protection
  if (lastProcessedAIHash[type] === hash) {
    console.log('[Debounce] duplicate transcript ignored');
    return null;
  }

  // 3. Final generation overlap detection
  if (type === 'final') {
    for (const [, req] of activeRequests.entries()) {
      if (req.type === 'final') {
        console.log(`[Throttle] final generation already running | existingRequestId=${req.requestId}`);
        return null;
      }
    }
  }

  // 4. Cancel any other stale in-flight requests
  if (activeRequests.size > 0) {
    for (const [key, req] of activeRequests.entries()) {
      console.log(`[Throttle] stale request cancelled (overlapping ${type} started) | requestId=${req.requestId}`);
      req.controller.abort();
      activeRequests.delete(key);
    }
  }

  // 5. Minimum interval protection (2 seconds between consecutive 'final' AI requests)
  const now = Date.now();
  if (type === 'final') {
    const timeSinceLast = now - lastAIRequestTimestamp;
    if (timeSinceLast < 2000) {
      console.log('[Throttle] request blocked');
      return null;
    }
  }

  // 6. Cooldown check
  if (now < cooldownUntil) {
    const remaining = Math.ceil((cooldownUntil - now) / 1000);
    console.log(`[Cooldown] AI requests temporarily paused | resumeIn=${remaining}s`);
    return null;
  }

  // Register the new request
  const requestId = crypto.randomUUID();
  const controller = new AbortController();
  const reqKey = `${type}-${hash}`;
  activeRequests.set(reqKey, {
    controller,
    type,
    hash,
    sessionId,
    requestId,
    startedAt: now,
  });

  if (type === 'final') {
    lastAIRequestTimestamp = now;
  }
  lastProcessedAIHash[type] = hash;

  console.log(`[Request] started | requestId=${requestId} type=${type} sessionId=${sessionId ?? 'none'} hash=${hash} ts=${now}`);
  console.log(`[Throttle] activeRequests=${activeRequests.size}`);

  try {
    const result = await execute(controller.signal);
    console.log(`[Request] completed | requestId=${requestId} type=${type} ts=${Date.now()}`);
    return result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`[Request] aborted | requestId=${requestId} type=${type}`);
      return null;
    }
    console.error(`[Request] failed | requestId=${requestId} type=${type} error=${error.message}`);
    throw error;
  } finally {
    if (activeRequests.get(reqKey)?.hash === hash) {
      activeRequests.delete(reqKey);
    }
    console.log(`[Throttle] activeRequests=${activeRequests.size} (after cleanup)`);
  }
}

/**
 * Resets the global AI Request throttler states.
 */
export function resetThrottler(): void {
  lastAIRequestTimestamp = 0;
  abortAllActiveRequests('reset');
  Object.keys(lastProcessedAIHash).forEach((key) => {
    delete lastProcessedAIHash[key];
  });
}

/**
 * Explicitly enters the shared client-side cooldown period.
 * Call this whenever /api/chat returns 429, so the browser-side throttler
 * also knows to block further requests — even when the 429 came from the
 * server-side OpenRouter call that the browser never sees directly.
 */
export function enterCooldown(durationMs: number = 8000): void {
  cooldownUntil = Date.now() + durationMs;
  console.log(`[Cooldown] AI requests temporarily paused | duration=${durationMs / 1000}s`);
}

/**
 * Returns true if we are currently inside a cooldown window.
 */
export function isInCooldown(): boolean {
  return Date.now() < cooldownUntil;
}
