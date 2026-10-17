// Vercel rejects request bodies over 4.5 MB (docs/deployment.md), and phone photos are often
// bigger. Shrink large images before upload; leave small ones untouched so OCR sees the original.

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stay safely under Vercel's 4.5 MB limit
const MAX_SIDE = 1600; // px on the long side; plenty for OCR (docs/deployment.md)

export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    // "from-image" applies EXIF rotation, so phone photos aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "This image is over 4 MB and your browser can't shrink this format. Try a JPEG or PNG.",
    );
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob || blob.size > MAX_UPLOAD_BYTES) {
    throw new Error("Couldn't shrink this image under 4 MB. Try a smaller photo.");
  }
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
