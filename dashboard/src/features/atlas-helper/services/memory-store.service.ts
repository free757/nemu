interface StoredVideoData {
  fileUri: string;
  mimeType: string;
  timestamp: number;
}

class MemoryStoreService {
  private static instance: MemoryStoreService;
  private videoStore: Map<string, StoredVideoData> = new Map();

  private constructor() {}

  public static getInstance(): MemoryStoreService {
    if (!MemoryStoreService.instance) {
      MemoryStoreService.instance = new MemoryStoreService();
    }
    return MemoryStoreService.instance;
  }

  public setVideoFileUri(videoUrl: string, fileUri: string, mimeType: string = "video/mp4"): void {
    this.videoStore.set(videoUrl, {
      fileUri,
      mimeType,
      timestamp: Date.now(),
    });
  }

  public getVideoFileUri(videoUrl: string): StoredVideoData | null {
    const data = this.videoStore.get(videoUrl);
    if (!data) return null;
    return data;
  }

  public hasVideo(videoUrl: string): boolean {
    return this.videoStore.has(videoUrl);
  }

  public getVideoUrlByFileUri(fileUri: string): string | null {
    for (const [url, data] of this.videoStore.entries()) {
      if (data.fileUri === fileUri) return url;
    }
    return null;
  }

  public clear(): void {
    this.videoStore.clear();
  }
}

export const memoryStore = MemoryStoreService.getInstance();
