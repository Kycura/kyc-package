import * as faceapi from 'face-api.js';

export interface FaceDetectionResult {
  detected: boolean;
  centered: boolean;
  frontal: boolean;
  properSize: boolean;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

let modelsLoaded = false;
let modelsLoading = false;

// CDN URL for face-api.js models - works in any consuming application
const MODELS_CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

/**
 * Load TinyFaceDetector and FaceLandmark models from CDN (or custom path).
 * This should be called once when the selfie page mounts.
 * @param modelsPath - Optional custom path to models. Defaults to CDN.
 */
export const loadFaceDetectionModels = async (modelsPath = MODELS_CDN_URL): Promise<boolean> => {
  if (modelsLoaded) return true;
  if (modelsLoading) {
    // Wait for existing load to complete
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (modelsLoaded || !modelsLoading) {
          clearInterval(checkInterval);
          resolve(modelsLoaded);
        }
      }, 100);
    });
  }

  modelsLoading = true;

  try {
    // Load both face detector and landmark models
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelsPath),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelsPath),
    ]);
    modelsLoaded = true;
    console.log('Face detection models loaded successfully');
    return true;
  } catch (error) {
    console.warn('Failed to load face detection models:', error);
    modelsLoaded = false;
    return false;
  } finally {
    modelsLoading = false;
  }
};

/**
 * Check if face detection models are loaded and ready.
 */
export const areModelsLoaded = (): boolean => modelsLoaded;

/**
 * Check if the face is frontal (looking at camera) based on landmark positions.
 * Analyzes the symmetry of facial features to determine if face is turned.
 */
const isFaceFrontal = (landmarks: faceapi.FaceLandmarks68, tolerance = 0.15): boolean => {
  const positions = landmarks.positions;

  // Get key landmark points
  // Left eye: points 36-41, Right eye: points 42-47
  // Nose tip: point 30, Nose bridge: point 27
  // Left face contour: point 0, Right face contour: point 16

  const leftEyeCenter = {
    x: (positions[36].x + positions[39].x) / 2,
    y: (positions[36].y + positions[39].y) / 2,
  };

  const rightEyeCenter = {
    x: (positions[42].x + positions[45].x) / 2,
    y: (positions[42].y + positions[45].y) / 2,
  };

  const noseTip = positions[30];

  // Calculate the midpoint between the eyes
  const eyeMidpointX = (leftEyeCenter.x + rightEyeCenter.x) / 2;

  // Check if nose is centered between the eyes
  const eyeDistance = Math.abs(rightEyeCenter.x - leftEyeCenter.x);
  const noseOffsetFromCenter = Math.abs(noseTip.x - eyeMidpointX);
  const noseRatio = noseOffsetFromCenter / eyeDistance;

  // Check face contour symmetry (left edge vs right edge relative to nose)
  const leftContour = positions[0];
  const rightContour = positions[16];
  const leftDistance = Math.abs(noseTip.x - leftContour.x);
  const rightDistance = Math.abs(rightContour.x - noseTip.x);
  const contourRatio = Math.abs(leftDistance - rightDistance) / (leftDistance + rightDistance);

  // Face is frontal if:
  // 1. Nose is roughly centered between the eyes
  // 2. Face contours are roughly symmetric
  const isCentered = noseRatio < tolerance;
  const isSymmetric = contourRatio < tolerance;

  return isCentered && isSymmetric;
};

/**
 * Detect a face in the video element and check if it's centered, frontal, and properly sized.
 * @param video - The video element to analyze
 * @param centerTolerance - How close to center the face must be (0-1, default 0.08 = 8%)
 */
export const detectFace = async (
  video: HTMLVideoElement,
  centerTolerance = 0.08,
): Promise<FaceDetectionResult> => {
  if (!modelsLoaded) {
    return { detected: false, centered: false, frontal: false, properSize: false, box: null };
  }

  if (video.readyState !== 4) {
    return { detected: false, centered: false, frontal: false, properSize: false, box: null };
  }

  try {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5,
        }),
      )
      .withFaceLandmarks(true); // Use tiny landmarks model

    if (!detection) {
      return { detected: false, centered: false, frontal: false, properSize: false, box: null };
    }

    const { x, y, width, height } = detection.detection.box;
    const box = { x, y, width, height };

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    // Calculate the overlay circle dimensions
    // The overlay is 80% width with aspect-ratio 3/4, centered in the video
    const overlayWidth = videoWidth * 0.8;
    const overlayHeight = overlayWidth * (4 / 3); // aspect-ratio 3/4 means height = width * 4/3
    const overlayCenterX = videoWidth / 2;
    const overlayCenterY = videoHeight / 2;

    // Calculate face center
    const faceCenterX = x + width / 2;
    const faceCenterY = y + height / 2;

    // Check if face center is within the overlay circle
    // Use tighter tolerance for precise positioning
    const xOffset = Math.abs(faceCenterX - overlayCenterX) / overlayWidth;
    const yOffset = Math.abs(faceCenterY - overlayCenterY) / overlayHeight;
    const centered = xOffset < centerTolerance && yOffset < centerTolerance;

    // Check if face is frontal (looking at camera)
    const frontal = isFaceFrontal(detection.landmarks);

    // Check if face size is appropriate for the overlay
    // Face should fill approximately 40-85% of the overlay width
    const faceToOverlayRatio = width / overlayWidth;
    const minRatio = 0.35;
    const maxRatio = 0.85;
    const properSize = faceToOverlayRatio >= minRatio && faceToOverlayRatio <= maxRatio;

    return { detected: true, centered, frontal, properSize, box };
  } catch (error) {
    console.warn('Face detection error:', error);
    return { detected: false, centered: false, frontal: false, properSize: false, box: null };
  }
};

/**
 * Create a face detection loop that runs at a specified interval.
 * Returns a cleanup function to stop the loop.
 */
export const createFaceDetectionLoop = (
  video: HTMLVideoElement,
  onResult: (result: FaceDetectionResult) => void,
  intervalMs = 250,
): (() => void) => {
  let isRunning = true;
  let timeoutId: ReturnType<typeof setTimeout>;

  const runDetection = async () => {
    if (!isRunning) return;

    const result = await detectFace(video);
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
