export enum DraftState {
  IDLE,
  ANALYZING,
  PREPARING_DRAFT,
  READY,
  CANCELLED
}

export interface SemanticResult {
  isComplete: boolean;
  confidence: number;
  reason: string;
}

export interface PreGenParams {
  transcript: string;
  semanticResult: SemanticResult;
  cvText?: string;
  systemPrompt?: string;
  onDraftUpdate: (draft: string) => void;
}

// Module-level state tracking
let currentState: DraftState = DraftState.IDLE;
let currentDraft: string = '';
let currentTranscript: string = '';
let activeAbortController: AbortController | null = null;

// Lightweight topic detector helper
function detectTopic(text: string): string | null {
  const topics = [
    'react',
    'flutter',
    'react native',
    'typescript',
    'javascript',
    'dependency injection',
    'state management',
    'redux',
    'hooks',
    'api',
    'database',
    'testing',
    'ci/cd',
    'deployment',
    'git',
    'css',
    'architecture',
    'clean architecture'
  ];
  const lower = text.toLowerCase();
  for (const topic of topics) {
    if (lower.includes(topic)) return topic;
  }
  return null;
}

/**
 * Starts generating a draft answer in the background while the interviewer is still talking.
 * Overwrites, invalidates, or refines drafts as the transcript evolves naturally.
 */
export async function startDraftPreGeneration({
  transcript,
  semanticResult,
  cvText = '',
  systemPrompt = '',
  onDraftUpdate
}: PreGenParams): Promise<void> {
  const cleanTranscript = transcript.trim();
  const words = cleanTranscript.split(/\s+/).filter(Boolean);

  // --- 1. Smart Triggering Rules ---
  // A. Meaningful length rule (> 8 words)
  if (words.length < 8) {
    return;
  }

  // B. Moderate semantic confidence rule (> 0.60)
  if (semanticResult.confidence <= 0.60) {
    return;
  }

  // --- 2. Invalidation & Overlap Checks ---
  if (currentState !== DraftState.IDLE && currentState !== DraftState.READY) {
    // If the transcript changed significantly (is not a prefix/continuation of the previous one)
    const isNaturalContinuation = cleanTranscript.toLowerCase().startsWith(currentTranscript.toLowerCase());
    
    if (!isNaturalContinuation) {
      cancelDraftGeneration();
      console.log('[Draft] cancelled due to transcript change');
      currentState = DraftState.CANCELLED;
      currentDraft = '';
    }
  }

  // If already generating for this EXACT transcript, skip to avoid duplicate runs
  if (currentState === DraftState.PREPARING_DRAFT && cleanTranscript === currentTranscript) {
    return;
  }

  // Check if this is a refinement of a draft we already generated
  const isContinuation = cleanTranscript.toLowerCase().startsWith(currentTranscript.toLowerCase()) && currentTranscript.length > 0;
  
  // Update state tracking transcript
  currentTranscript = cleanTranscript;

  if (isContinuation && currentState === DraftState.READY) {
    console.log('[Draft] draft refined');
    // We already have a draft, we can optionally refine it or let the cached version stay
  }

  currentState = DraftState.ANALYZING;
  console.log('[Draft] analyzing transcript');

  // Detect likely interview topic early
  const topic = detectTopic(cleanTranscript);
  if (topic) {
    console.log('[Draft] topic detected');
  }

  currentState = DraftState.PREPARING_DRAFT;
  console.log('[Draft] preparing answer');

  // Create abort controller for request invalidation
  activeAbortController = new AbortController();
  const { signal } = activeAbortController;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question: cleanTranscript,
        cvText,
        systemPrompt: systemPrompt || undefined
      }),
      signal
    });

    if (!res.ok) {
      throw new Error(`Chat API status: ${res.status}`);
    }

    const data = await res.json();
    
    if (data.answer) {
      currentDraft = data.answer;
      currentState = DraftState.READY;
      console.log('[Draft] ready for instant response');
      onDraftUpdate(currentDraft);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // Intentionally aborted due to transcript invalidation
      return;
    }
    console.error('[Draft] Failed pre-generating draft answer:', err);
    currentState = DraftState.IDLE;
  }
}

/**
 * Aborts any ongoing background pre-generation fetch requests.
 */
export function cancelDraftGeneration() {
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  currentState = DraftState.IDLE;
}

/**
 * Returns the current active pre-generated draft.
 */
export function getCurrentDraft(): string {
  return currentDraft;
}

/**
 * Resets the draft pre-generator module state.
 */
export function clearDraft() {
  cancelDraftGeneration();
  currentDraft = '';
  currentTranscript = '';
  currentState = DraftState.IDLE;
}
