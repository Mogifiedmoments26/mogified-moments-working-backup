"use client";

import React from "react";

interface BackStickerSheetProps {
  onClose: () => void;
  qrUrl?: string;
  count?: number; // 24 stickers per A4
}

export default function BackStickerSheet({
  onClose,
  qrUrl = "https://mogified-moments.vercel.app",
  count = 24,
}: BackStickerSheetProps) {
  const stickers = Array.from(
    { length: count },
    (_, i) => i + 1
  );

  // Generates QR pointing to /connect
  const connectUrl = qrUrl.endsWith("/connect")
    ? qrUrl
    : `${qrUrl.replace(/\/$/, "")}/connect`;

  const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    connectUrl
  )}&margin=4`;

  function handleDirectPrint() {
    const sheetElement = document.getElementById(
      "a4-sticker-print-area"
    );

    if (!sheetElement) return;

    const printWin = window.open(
      "",
      "_blank",
      "width=900,height=1000"
    );

    if (!printWin) {
      window.print();
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mogified Moments - Back Stickers</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              font-family: system-ui, -apple-system, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .a4-sticker-page {
              width: 210mm;
              min-height: 297mm;
              padding: 10mm 10mm;
              margin: 0 auto;
              background: #ffffff;
            }

            .sticker-grid-24 {
              display: grid;
              grid-template-columns: repeat(3, 61mm);
              grid-auto-rows: 33.5mm;
              gap: 2mm 3.5mm;
              justify-content: center;
            }

            .magnet-back-sticker {
              width: 61mm;
              height: 33.5mm;
              border: 0.3mm dashed #b39ddb;
              border-radius: 0;
              padding: 2mm 2.5mm;
              background: #ffffff;
            }

            .sticker-content {
              width: 100%;
              height: 100%;
              display: grid;
              grid-template-columns: 20mm 1fr;
              gap: 2mm;
              align-items: center;
            }

            .sticker-col-qr {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
            }

            .sticker-qr-img {
              width: 19mm;
              height: 19mm;
              display: block;
              border: 0.2mm solid #e2d9f3;
              border-radius: 0;
            }

            .sticker-scan-label {
              font-size: 4.8pt;
              font-weight: 900;
              color: #7048d8;
              margin-top: 1mm;
              letter-spacing: 0.02em;
            }

            .sticker-col-info {
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: 100%;
            }

            .sticker-header {
              display: flex;
              align-items: center;
              gap: 1.5mm;
            }

            .sticker-logo {
              width: 6mm;
              height: 6mm;
              object-fit: contain;
            }

            .sticker-title strong {
              font-size: 6.5pt;
              font-weight: 900;
              color: #292342;
              display: block;
              line-height: 1;
            }

            .sticker-title span {
              font-size: 4.8pt;
              color: #ec3e82;
              font-weight: 800;
              display: block;
            }

            .sticker-token-box {
              border: 0.35mm solid #7048d8;
              border-radius: 0;
              background: #faf8ff;
              padding: 1mm 1.5mm;
              margin: 0.8mm 0;
            }

            .token-label {
              font-size: 4.5pt;
              font-weight: 900;
              color: #7048d8;
              display: block;
              letter-spacing: 0.05em;
            }

            .token-write-area {
              display: flex;
              align-items: flex-end;
              height: 5.5mm;
            }

            .token-prefix {
              font-size: 8pt;
              font-weight: 900;
              color: #292342;
              line-height: 1;
            }

            .token-blank-line {
              flex: 1;
              border-bottom: 0.4mm solid #292342;
              height: 1mm;
              margin-left: 1mm;
            }

            .sticker-footer {
              font-size: 4.6pt;
              color: #555;
              font-weight: 700;
            }
          </style>
        </head>

        <body>
          ${sheetElement.outerHTML}

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 350);
            };
          </script>
        </body>
      </html>
    `);

    printWin.document.close();
  }

  return (
    <div className="back-stickers-modal">
      <div className="no-print sticker-actions-bar">
        <div>
          <strong>
            🏷️ Magnet Backer / Order Identifier Stickers
          </strong>

          <p>
            Prints 24 stickers per A4 sheet with connect
            QR and handwritten token box.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
          }}
        >
          <button
            type="button"
            className="action-btn secondary"
            onClick={onClose}
          >
            Close Preview
          </button>

          <button
            type="button"
            className="action-btn primary"
            onClick={handleDirectPrint}
          >
            🖨️ Print Sticker Sheet (A4)
          </button>
        </div>
      </div>

      <div className="sticker-sheet-canvas">
        <div
          id="a4-sticker-print-area"
          className="a4-sticker-page"
        >
          <div className="sticker-grid-24">
            {stickers.map((num) => (
              <div
                key={num}
                className="magnet-back-sticker"
              >
                <div className="sticker-content">
                  <div className="sticker-col-qr">
                    <img
                      src={qrCodeImage}
                      alt="Connect QR"
                      className="sticker-qr-img"
                    />

                    <span className="sticker-scan-label">
                      SCAN TO CONNECT
                    </span>
                  </div>

                  <div className="sticker-col-info">
                    <div className="sticker-header">
                      <img
                        src="/logo.png"
                        alt="Logo"
                        className="sticker-logo"
                      />

                      <div className="sticker-title">
                        <strong>
                          MOGIFIED MOMENTS
                        </strong>

                        <span>
                          Handcrafted Photo Magnets
                        </span>
                      </div>
                    </div>

                    <div className="sticker-token-box">
                      <span className="token-label">
                        ORDER TOKEN
                      </span>

                      <div className="token-write-area">
                        <span className="token-prefix">
                          #MM-
                        </span>

                        <div className="token-blank-line" />
                      </div>
                    </div>

                    <div className="sticker-footer">
                      <span>
                        Handcrafted with ❤️ in Goa
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .back-stickers-modal {
          position: fixed;
          inset: 0;
          background: rgba(30, 25, 45, 0.85);
          backdrop-filter: blur(6px);
          z-index: 9999;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .sticker-actions-bar {
          background: #ffffff;
          border-radius: 16px;
          padding: 14px 22px;
          max-width: 210mm;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
          margin-bottom: 20px;
        }

        .sticker-actions-bar strong {
          font-size: 16px;
          color: #292342;
          display: block;
        }

        .sticker-actions-bar p {
          font-size: 12px;
          color: #756f87;
          margin: 2px 0 0;
        }

        .action-btn {
          border: 0;
          padding: 10px 18px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }

        .action-btn.primary {
          background: #7048d8;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(112, 72, 216, 0.35);
        }

        .action-btn.secondary {
          background: #f0ebff;
          color: #7048d8;
        }

        .a4-sticker-page {
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          padding: 10mm 10mm;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
          box-sizing: border-box;
          margin: 0 auto;
        }

        .sticker-grid-24 {
          display: grid;
          grid-template-columns: repeat(3, 61mm);
          grid-auto-rows: 33.5mm;
          gap: 2mm 3.5mm;
          justify-content: center;
        }

        .magnet-back-sticker {
          width: 61mm;
          height: 33.5mm;
          border: 0.3mm dashed #b39ddb;
          border-radius: 0;
          padding: 2mm 2.5mm;
          box-sizing: border-box;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sticker-content {
          width: 100%;
          height: 100%;
          display: grid;
          grid-template-columns: 20mm 1fr;
          gap: 2mm;
          align-items: center;
        }

        .sticker-col-qr {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .sticker-qr-img {
          width: 19mm;
          height: 19mm;
          display: block;
          border: 0.2mm solid #e2d9f3;
          border-radius: 0;
        }

        .sticker-scan-label {
          font-size: 4.8pt;
          font-weight: 900;
          color: #7048d8;
          margin-top: 1mm;
          letter-spacing: 0.02em;
          text-align: center;
          white-space: nowrap;
        }

        .sticker-col-info {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }

        .sticker-header {
          display: flex;
          align-items: center;
          gap: 1.5mm;
        }

        .sticker-logo {
          width: 6mm;
          height: 6mm;
          object-fit: contain;
        }

        .sticker-title strong {
          font-size: 6.5pt;
          font-weight: 900;
          color: #292342;
          display: block;
          line-height: 1;
        }

        .sticker-title span {
          font-size: 4.8pt;
          color: #ec3e82;
          font-weight: 800;
          display: block;
        }

        .sticker-token-box {
          border: 0.35mm solid #7048d8;
          border-radius: 0;
          background: #faf8ff;
          padding: 1mm 1.5mm;
          margin: 0.8mm 0;
        }

        .token-label {
          font-size: 4.5pt;
          font-weight: 900;
          color: #7048d8;
          display: block;
          letter-spacing: 0.05em;
        }

        .token-write-area {
          display: flex;
          align-items: flex-end;
          height: 5.5mm;
        }

        .token-prefix {
          font-size: 8pt;
          font-weight: 900;
          color: #292342;
          line-height: 1;
        }

        .token-blank-line {
          flex: 1;
          border-bottom: 0.4mm solid #292342;
          height: 1mm;
          margin-left: 1mm;
        }

        .sticker-footer {
          font-size: 4.6pt;
          color: #555;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}