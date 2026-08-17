export interface SegmentItem {
  id: string;
  startTime: string;
  endTime: string;
  currentLabel: string;
  correctedLabel?: string;
  visualEvidence?: string;
  analysisMode?: "visual" | "rubric";
  usedModel?: string;
  status?: "idle" | "loading" | "success" | "error";
  error?: string;
}

export interface UploadVideoRequest {
  videoUrl: string;
}

export interface UploadVideoResponse {
  fileUri: string;
  mimeType: string;
  expirationTime?: string;
}

export interface CorrectLabelsRequest {
  fileUri: string;
  segments: {
    id: string;
    startTime: string;
    endTime: string;
    currentLabel: string;
  }[];
  customPrompt?: string;
}

export interface CorrectedSegmentResult {
  id: string;
  correctedLabel: string;
  visualEvidence?: string;
  analysisMode?: "visual" | "rubric";
  usedModel?: string;
  explanation?: string;
}

export interface CorrectLabelsResponse {
  segments: CorrectedSegmentResult[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
