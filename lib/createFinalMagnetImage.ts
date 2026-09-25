import type { ProductId } from "./products";
import {
  getBackground,
  getBackgroundSrc,
  type BackgroundId,
} from "./backgrounds";

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
  backgroundId?: BackgroundId | null;
  customBackgroundSrc?: string | null;
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

function loadBlobAsImage(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);

  return loadImage(objectUrl).finally(() => {
    URL.revokeObjectURL(objectUrl);
  });
}

async function drawThemedBackground(
  ctx: CanvasRenderingContext2D,
  backgroundSrc: string,
  x: number,
  y: number,
  size: number,
  isCircle: boolean
): Promise<void> {
  const backgroundImg = await loadImage(backgroundSrc);

  ctx.save();

  if (isCircle) {
    ctx.beginPath();
    ctx.arc(
      x + size / 2,
      y + size / 2,
      size / 2,
      0,
      Math.PI * 2
    );
    ctx.clip();
  }

  /*
   * Draw the actual themed PNG supplied by /public/backgrounds.
   * The asset is scaled to exactly the artwork area so the
   * existing magnet dimensions and positioning are unchanged.
   */
  ctx.drawImage(
    backgroundImg,
    x,
    y,
    size,
    size
  );

  ctx.restore();
}

async function removePhotoBackground(photo: string): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("Automatic background removal is only available in the browser.");
  }

  const { removeBackground } = await import("@imgly/background-removal");

  return removeBackground(photo, {
    model: "isnet_fp16",
    output: {
      format: "image/png",
      quality: 1,
    },
  });
}

/** Creates the print-ready image for the selected product. */
export async function createFinalMagnetImage({
  photo,
  frameSrc,
  shape = "square",
  cropPixels,
  backgroundId = null,
  customBackgroundSrc = null,
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

  /*
   * Explicitly use the standard sRGB colour space for the
   * print-ready canvas so the browser does not choose a
   * different/wider colour space during compositing.
   */
  const ctx = canvas.getContext("2d", {
    colorSpace: "srgb",
  });

  if (!ctx) {
    throw new Error("Could not create canvas 2D rendering context.");
  }

  const photoImg = photo ? await loadImage(photo) : null;

  const selectedBackground = getBackground(backgroundId);
  const builtInBackgroundSrc = selectedBackground
    ? getBackgroundSrc(
        selectedBackground,
        isCircle ? "circle" : "square"
      )
    : null;

  /*
   * A Party Package custom background takes priority over a
   * built-in background. If no custom background was supplied,
   * the existing backgroundId behaviour remains unchanged.
   */
  const backgroundSrc =
    customBackgroundSrc?.trim() || builtInBackgroundSrc;

  let foregroundImg: HTMLImageElement | null = null;

  /*
   * Automatic cutout is needed for both built-in and custom
   * backgrounds so the uploaded photo can sit naturally over
   * the selected backdrop.
   */
  if (photo && backgroundSrc) {
    try {
      const foregroundBlob = await removePhotoBackground(photo);
      foregroundImg = await loadBlobAsImage(foregroundBlob);
    } catch (error) {
      console.error(
        "Automatic background removal failed. Using the original photo instead.",
        error
      );
    }
  }

  const drawPhoto = async () => {
    if (!photoImg) return;

    const imageToDraw = foregroundImg || photoImg;

    if (
      cropPixels &&
      cropPixels.width > 0 &&
      cropPixels.height > 0
    ) {
      ctx.drawImage(
        imageToDraw,
        Math.round(cropPixels.x),
        Math.round(cropPixels.y),
        Math.round(cropPixels.width),
        Math.round(cropPixels.height),
        offset,
        offset,
        faceSize,
        faceSize
      );
    } else {
      const scale = Math.max(
        faceSize / imageToDraw.width,
        faceSize / imageToDraw.height
      );

      const w = imageToDraw.width * scale;
      const h = imageToDraw.height * scale;

      ctx.drawImage(
        imageToDraw,
        offset + (faceSize - w) / 2,
        offset + (faceSize - h) / 2,
        w,
        h
      );
    }
  };

  if (isCircle) {
    ctx.save();

    ctx.beginPath();

    ctx.arc(
      offset + faceSize / 2,
      offset + faceSize / 2,
      faceSize / 2,
      0,
      Math.PI * 2
    );

    ctx.clip();

    if (backgroundSrc) {
      await drawThemedBackground(
        ctx,
        backgroundSrc,
        offset,
        offset,
        faceSize,
        true
      );
    }

    await drawPhoto();

    if (frameSrc) {
      try {
        ctx.drawImage(
          await loadImage(frameSrc),
          offset,
          offset,
          faceSize,
          faceSize
        );
      } catch {}
    }

    ctx.restore();
  } else {
    if (backgroundSrc) {
      await drawThemedBackground(
        ctx,
        backgroundSrc,
        offset,
        offset,
        faceSize,
        false
      );
    }

    await drawPhoto();

    if (frameSrc) {
      try {
        ctx.drawImage(
          await loadImage(frameSrc),
          offset,
          offset,
          faceSize,
          faceSize
        );
      } catch {}
    }
  }

  ctx.save();

  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;

  if (isCircle) {
    ctx.beginPath();

    ctx.arc(
      offset + faceSize / 2,
      offset + faceSize / 2,
      faceSize / 2,
      0,
      Math.PI * 2
    );

    ctx.stroke();
  } else {
    ctx.strokeRect(
      offset,
      offset,
      faceSize,
      faceSize
    );
  }

  if (isSquare || isCircle) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    ctx.setLineDash([6, 6]);

    if (isCircle) {
      ctx.beginPath();

      ctx.arc(
        fullSize / 2,
        fullSize / 2,
        fullSize / 2 - 1,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    } else {
      ctx.strokeRect(
        1,
        1,
        fullSize - 2,
        fullSize - 2
      );
    }
  }

  ctx.restore();

  /*
   * Export as PNG instead of JPEG.
   *
   * This deliberately removes JPEG compression from the
   * colour path for this test and preserves the canvas RGB
   * values without JPEG quality loss.
   */
  return canvas.toDataURL("image/png");
}
