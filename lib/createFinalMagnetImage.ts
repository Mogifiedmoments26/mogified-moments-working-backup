import type { ProductId } from "./products";

type FinalMagnetOptions = {
  photo: string;
  frameSrc: string | null;
  shape?: ProductId;
  cropPixels?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = src;
  });
}

/** Creates the print-ready image for the selected product. */
export async function createFinalMagnetImage({
  photo,
  frameSrc,
  shape = "square",
  cropPixels,
}: FinalMagnetOptions): Promise<string> {
  const isSquare = shape === "square";
  const isCircle = shape === "circle";
  const fullSize = isSquare ? 1200 : isCircle ? 1397 : 708;
  const faceSize = isSquare
    ? Math.round(fullSize * (52 / 61))
    : isCircle
    ? Math.round(fullSize * (59 / 71))
    : fullSize;
  const offset = Math.round((fullSize - faceSize) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = fullSize;
  canvas.height = fullSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas 2D rendering context.");

  const drawPhoto = async () => {
    if (!photo) return;
    const photoImg = await loadImage(photo);
    if (cropPixels && cropPixels.width > 0 && cropPixels.height > 0) {
      ctx.drawImage(
        photoImg,
        Math.round(cropPixels.x), Math.round(cropPixels.y),
        Math.round(cropPixels.width), Math.round(cropPixels.height),
        offset, offset, faceSize, faceSize
      );
    } else {
      const scale = Math.max(faceSize / photoImg.width, faceSize / photoImg.height);
      const w = photoImg.width * scale;
      const h = photoImg.height * scale;
      ctx.drawImage(photoImg, offset + (faceSize - w) / 2, offset + (faceSize - h) / 2, w, h);
    }
  };

  if (isCircle) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(offset + faceSize / 2, offset + faceSize / 2, faceSize / 2, 0, Math.PI * 2);
    ctx.clip();
    await drawPhoto();
    if (frameSrc) {
      try { ctx.drawImage(await loadImage(frameSrc), offset, offset, faceSize, faceSize); } catch {}
    }
    ctx.restore();
  } else {
    await drawPhoto();
    if (frameSrc) {
      try { ctx.drawImage(await loadImage(frameSrc), offset, offset, faceSize, faceSize); } catch {}
    }
  }

  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  if (isCircle) {
    ctx.beginPath();
    ctx.arc(offset + faceSize / 2, offset + faceSize / 2, faceSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeRect(offset, offset, faceSize, faceSize);
  }
  if (isSquare || isCircle) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.setLineDash([6, 6]);
    if (isCircle) {
      ctx.beginPath();
      ctx.arc(fullSize / 2, fullSize / 2, fullSize / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(1, 1, fullSize - 2, fullSize - 2);
    }
  }
  ctx.restore();

  // Export compressed JPEG data URL to safely stay under Firestore's 1MB document property limit
  return canvas.toDataURL("image/jpeg", 0.85);
}