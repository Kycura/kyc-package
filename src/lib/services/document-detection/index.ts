import { scanDocument } from 'scanic';

export interface DocumentDetectionResult {
  detected: boolean;
  corners: {
    topLeft: { x: number; y: number };
    topRight: { x: number; y: number };
    bottomRight: { x: number; y: number };
    bottomLeft: { x: number; y: number };
  } | null;
  confidence: boolean; // true if document fills enough of the frame
}

/**
 * Convert a video element to a canvas for processing.
 * Scanic works best with canvas/image elements.
 */
const videoToCanvas = (video: HTMLVideoElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(video, 0, 0);
  }
  return canvas;
};

/**
 * Detect a document in the video/canvas/image element.
 * Uses Scanic library for edge detection and document boundary finding.
 */
export const detectDocument = async (
  source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
): Promise<DocumentDetectionResult> => {
  try {
    // For video elements, we need to convert to canvas first
    let processableSource: HTMLCanvasElement | HTMLImageElement = source as HTMLCanvasElement | HTMLImageElement;
    
    if (source instanceof HTMLVideoElement) {
      if (source.readyState !== 4) {
        return { detected: false, corners: null, confidence: false };
      }
      processableSource = videoToCanvas(source);
    }

    const result = await scanDocument(processableSource, {
      mode: 'detect',
      maxProcessingDimension: 800, // Balance speed vs accuracy
      lowThreshold: 50,
      highThreshold: 150,
      minArea: 1000,
    });

    if (!result.success || !result.corners) {
      return { detected: false, corners: null, confidence: false };
    }

    // Check if document fills a reasonable portion of the frame
    const sourceWidth = 'videoWidth' in source ? source.videoWidth : source.width;
    const sourceHeight = 'videoHeight' in source ? source.videoHeight : source.height;

    const { topLeft, topRight, bottomLeft, bottomRight } = result.corners;

    // Calculate document dimensions using corner points
    const docWidth = Math.max(
      Math.abs(topRight.x - topLeft.x),
      Math.abs(bottomRight.x - bottomLeft.x),
    );
    const docHeight = Math.max(
      Math.abs(bottomLeft.y - topLeft.y),
      Math.abs(bottomRight.y - topRight.y),
    );

    const docArea = docWidth * docHeight;
    const frameArea = sourceWidth * sourceHeight;

    // Document should fill at least 15% of frame for confidence
    const confidence = docArea / frameArea > 0.15;

    return {
      detected: true,
      corners: result.corners,
      confidence,
    };
  } catch (error) {
    console.warn('Document detection error:', error);
    return { detected: false, corners: null, confidence: false };
  }
};

/**
 * Validate a base64 image to check if it contains a document.
 * Useful for post-capture validation.
 */
export const validateDocumentImage = async (
  base64Image: string,
): Promise<DocumentDetectionResult> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const result = await detectDocument(img);
      resolve(result);
    };
    img.onerror = () => {
      resolve({ detected: false, corners: null, confidence: false });
    };
    img.src = base64Image;
  });
};

/**
 * Create a document detection loop that runs at a specified interval.
 * Returns a cleanup function to stop the loop.
 */
export const createDocumentDetectionLoop = (
  video: HTMLVideoElement,
  onResult: (result: DocumentDetectionResult) => void,
  intervalMs = 500, // Slightly slower than face detection since document detection is heavier
): (() => void) => {
  let isRunning = true;
  let timeoutId: ReturnType<typeof setTimeout>;

  const runDetection = async () => {
    if (!isRunning) return;

    const result = await detectDocument(video);
    if (isRunning) {
      onResult(result);
      timeoutId = setTimeout(runDetection, intervalMs);
    }
  };

  // Start the loop
  runDetection();

  // Return cleanup function
  return () => {
    isRunning = false;
    if (timeoutId) clearTimeout(timeoutId);
  };
};


