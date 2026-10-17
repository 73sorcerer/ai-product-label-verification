// Client-side image prep: downscale/compress uploads so they stay under 4 MB
// (Vercel request limit). Files already under the limit pass through untouched.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export interface PreparedImage {
  file: File;
  compressed: boolean;
  originalBytes: number;
  finalBytes: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image file."));
    img.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image."))),
      "image/jpeg",
      quality
    );
  });
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const originalBytes = file.size;
  if (originalBytes <= MAX_UPLOAD_BYTES) {
    return {
      file,
      compressed: false,
      originalBytes,
      finalBytes: originalBytes,
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let width = img.width;
    let height = img.height;
    let quality = 0.85;
    let blob: Blob | null = null;
    for (let i = 0; i < 6; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not supported in this browser.");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      blob = await canvasToBlob(canvas, quality);
      if (blob.size <= MAX_UPLOAD_BYTES) break;
      width *= 0.75;
      height *= 0.75;
      quality = Math.max(0.6, quality - 0.1);
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) {
      throw new Error("Could not compress the image below 4 MB.");
    }
    const out = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
    return {
      file: out,
      compressed: true,
      originalBytes,
      finalBytes: out.size,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(n / 1024)} KB`;
}
