"use client";

import { useEffect, useState } from "react";
import { type Frame } from "../lib/frames";
import { type CropState } from "../lib/order";
import { type ProductId } from "../lib/products";

type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface MagnetPreviewProps {
  photo?: string;
  frame?: Frame | null;
  crop?: CropState;
  cropPixels?: CropPixels | null;
  product?: ProductId;
  customWatermark?: string;
  small?: boolean;
}

export default function MagnetPreview({
  photo,
  frame,
  crop,
  cropPixels,
  customWatermark,
  small = false,
  product = "square",
}: MagnetPreviewProps) {
  const [croppedSrc, setCroppedSrc] = useState(photo);
  const isCircle = product === "circle" || product === "keychain";

  useEffect(() => {
    let cancelled = false;

    if (!photo || !cropPixels) {
      setCroppedSrc(photo);
      return () => {
        cancelled = true;
      };
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;

      try {
        const width = Math.max(1, Math.round(cropPixels.width));
        const height = Math.max(1, Math.round(cropPixels.height));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          setCroppedSrc(photo);
          return;
        }

        context.drawImage(
          image,
          Math.round(cropPixels.x),
          Math.round(cropPixels.y),
          width,
          height,
          0,
          0,
          width,
          height
        );

        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setCroppedSrc(dataUrl);
      } catch {
        setCroppedSrc(photo);
      }
    };

    image.onerror = () => {
      if (!cancelled) setCroppedSrc(photo);
    };

    image.src = photo;
    return () => {
      cancelled = true;
    };
  }, [photo, cropPixels, crop]);

  return (
    <div className={`mm-preview ${isCircle ? "circle" : "square"} ${small ? "small" : ""}`}>
      <div className="mm-preview-inner">
        {photo && (
          <img
            src={croppedSrc || photo}
            alt="Magnet Preview"
            className={`mm-preview-photo ${isCircle ? "circle" : "square"} full-bleed`}
            onError={() => {
              if (croppedSrc !== photo) setCroppedSrc(photo);
            }}
          />
        )}
        {frame && (
          <img
            src={frame.src}
            alt={frame.name || "Frame"}
            className="mm-preview-frame"
          />
        )}
        {customWatermark && (
          <div className="mm-preview-watermark">
            {customWatermark}
          </div>
        )}
      </div>

      <style jsx>{`
        .mm-preview {
          width: 140px;
          aspect-ratio: 1;
          margin: 6px auto;
          position: relative;
        }
        .mm-preview.small {
          width: 48px;
          min-width: 48px;
          margin: 0;
        }
        .mm-preview-inner {
          position: absolute;
          inset: 0;
          border: 2px solid #292342;
          background: #fff;
          overflow: hidden;
          border-radius: 6px;
        }
        .mm-preview.circle .mm-preview-inner {
          border-radius: 50%;
        }
        .mm-preview-photo.full-bleed {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 1;
        }
        .mm-preview-photo.circle {
          border-radius: 50%;
        }
        .mm-preview-frame {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          z-index: 2;
          pointer-events: none;
        }
        .mm-preview.circle .mm-preview-frame {
          border-radius: 50%;
        }
        .mm-preview-watermark {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.65);
          color: #fff;
          font-size: 8px;
          font-weight: 800;
          padding: 2px 4px;
          border-radius: 3px;
          z-index: 3;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}