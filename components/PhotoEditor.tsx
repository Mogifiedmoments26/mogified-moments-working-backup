"use client";

import React, { useState } from "react";

interface PhotoEditorProps {
  photoUrl: string;
  onSave?: (finalUrl: string, watermark: string) => void;
  onClose?: () => void;
}

export default function PhotoEditor({ photoUrl, onSave, onClose }: PhotoEditorProps) {
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState("Mogified Moments • Goa Live");

  const processAndSave = () => {
    if (!onSave) return;

    if (!enableWatermark || !watermarkText) {
      onSave(photoUrl, "");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        onSave(photoUrl, watermarkText);
        return;
      }

      ctx.drawImage(img, 0, 0);

      const fontSize = Math.max(16, Math.floor(canvas.width * 0.03));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = 4;
      ctx.textAlign = "right";

      const padding = fontSize * 1.2;
      ctx.fillText(watermarkText, canvas.width - padding, canvas.height - padding);

      const finalUrl = canvas.toDataURL("image/jpeg", 0.92);
      onSave(finalUrl, watermarkText);
    };

    img.onerror = () => {
      onSave(photoUrl, watermarkText);
    };

    img.src = photoUrl;
  };

  return (
    <div className="photo-editor-modal">
      <div className="editor-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <strong style={{ fontSize: "16px", color: "#292342" }}>✨ Photo Editor &amp; Watermark Stamp</strong>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: "#f0ebff", color: "#7048d8", border: 0, padding: "6px 12px", borderRadius: "8px", fontWeight: 800, cursor: "pointer" }}
            >
              Close
            </button>
          )}
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: "400px",
            margin: "0 auto 16px auto",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            background: "#000",
          }}
        >
          <img
            src={photoUrl}
            alt="Editing Preview"
            style={{ display: "block", width: "100%", height: "auto", objectFit: "cover" }}
          />

          {enableWatermark && watermarkText && (
            <div
              style={{
                position: "absolute",
                bottom: "10px",
                right: "10px",
                background: "rgba(41, 35, 66, 0.75)",
                backdropFilter: "blur(4px)",
                color: "#ffffff",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.05em",
                border: "0.5px solid rgba(255, 255, 255, 0.25)",
                pointerEvents: "none",
                zIndex: 5,
              }}
            >
              {watermarkText}
            </div>
          )}
        </div>

        <div
          style={{
            background: "#f9f6ff",
            padding: "14px",
            borderRadius: "12px",
            border: "1px dashed #7048d8",
            marginBottom: "16px",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              fontWeight: 800,
              color: "#7048d8",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={enableWatermark}
              onChange={(e) => setEnableWatermark(e.target.checked)}
              style={{ accentColor: "#7048d8", width: "16px", height: "16px" }}
            />
            Enable Event Watermark Stamp
          </label>

          {enableWatermark && (
            <div style={{ marginTop: "10px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#756f87", marginBottom: "4px" }}>
                Watermark Tag / Hashtag Text:
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="e.g. #RheaWedsKaran or Birthday 2026"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid #d4b5f0",
                  fontSize: "13px",
                  color: "#292342",
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>

        {onSave && (
          <button
            type="button"
            onClick={processAndSave}
            style={{
              width: "100%",
              background: "#7048d8",
              color: "#fff",
              border: 0,
              padding: "12px",
              borderRadius: "12px",
              fontWeight: 800,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Save &amp; Apply Watermark ✓
          </button>
        )}
      </div>

      <style jsx global>{`
        .photo-editor-modal {
          position: fixed;
          inset: 0;
          background: rgba(30, 25, 45, 0.85);
          backdrop-filter: blur(6px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .editor-card {
          background: #ffffff;
          border-radius: 20px;
          padding: 24px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  );
}