declare module 'scanic' {
  export interface ScanDocumentOptions {
    mode?: 'detect' | 'extract';
    output?: 'canvas' | 'imagedata' | 'dataurl';
    debug?: boolean;
    maxProcessingDimension?: number;
    lowThreshold?: number;
    highThreshold?: number;
    dilationKernelSize?: number;
    dilationIterations?: number;
    minArea?: number;
    epsilon?: number;
  }

  export interface ScanDocumentResult {
    success: boolean;
    message?: string;
    corners?: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
    };
    contour?: Array<{ x: number; y: number }>;
    output?: HTMLCanvasElement | ImageData | string | null;
    debug?: unknown;
  }

  export function scanDocument(
    image: HTMLImageElement | HTMLCanvasElement | ImageData,
    options?: ScanDocumentOptions
  ): Promise<ScanDocumentResult>;

  export function extractDocument(
    image: HTMLImageElement | HTMLCanvasElement | ImageData,
    corners: {
      topLeft: { x: number; y: number };
      topRight: { x: number; y: number };
      bottomRight: { x: number; y: number };
      bottomLeft: { x: number; y: number };
    }
  ): Promise<ScanDocumentResult>;
}


