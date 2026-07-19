/**
 * Client-side image compression using the Canvas API.
 * Resizes an image to a max dimension and re-encodes it at a target quality,
 * reducing upload size and storage/bandwidth costs before uploading to Firebase Storage.
 */

interface CompressImageOptions {
  maxDimension?: number; // Max width or height in pixels
  quality?: number; // 0-1, JPEG/WebP quality
  mimeType?: 'image/jpeg' | 'image/webp';
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const { maxDimension = 1600, quality = 0.8, mimeType = 'image/jpeg' } = options;

  // Skip compression for very small files or non-standard image types (e.g. SVG, GIF)
  // where resizing/re-encoding could break transparency or animation.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(objectUrl);

    let { width, height } = img;
    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height / width) * maxDimension);
        width = maxDimension;
      } else {
        width = Math.round((width / height) * maxDimension);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Canvas unsupported in this environment — fall back to original file rather than failing the upload
      return file;
    }
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), mimeType, quality);
    });

    if (!blob) {
      return file;
    }

    const newFileName = file.name.replace(/\.[^/.]+$/, mimeType === 'image/webp' ? '.webp' : '.jpg');
    return new File([blob], newFileName, { type: mimeType, lastModified: Date.now() });
  } catch (error) {
    console.error('[imageCompression] Failed to compress image, uploading original:', error);
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
