export interface RestoredCameraResult {
  photo: {
    dataUrl?: string;
    format?: string;
    [key: string]: unknown;
  } | null;
  intent: string | null;
}

class CameraRestoredStore {
  private photo: unknown | null = null;
  private intent: string | null = null;

  setRestoredData(photo: unknown, intent: string | null) {
    this.photo = photo;
    this.intent = intent;
  }

  consume(): RestoredCameraResult {
    const result: RestoredCameraResult = {
      photo: this.photo as RestoredCameraResult['photo'],
      intent: this.intent,
    };
    // Clear after consuming
    this.photo = null;
    this.intent = null;
    return result;
  }
}

export const cameraRestoredStore = new CameraRestoredStore();
