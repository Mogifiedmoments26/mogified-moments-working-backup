"use client";

import React from "react";

interface ThankYouStickerSheetProps {
  onClose: () => void;
  count?: number; // 39 stickers per A4 sheet (3 cols x 13 rows)
}

export default function ThankYouStickerSheet({
  onClose,
  count = 39,
}: ThankYouStickerSheetProps) {
  const stickers = Array.from({ length: count }, (_, i) => i + 1);

  function handleDirectPrint() {
    const sheetElement = document.getElementById(
      "a4-thank-you-print-area"
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
          <title>Mogified Moments - Thank You Stickers</title>
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

            .a4-thank-you-page {
              width: 210mm;
              min-height: 297mm;
              padding: 9mm 6mm;
              margin: 0 auto;
              background: #ffffff;
            }

            .thank-you-grid {
              display: grid;
              grid-template-columns: repeat(3, 62mm);
              grid-auto-rows: 20mm;
              gap: 1.8mm 2.5mm;
              justify-content: center;
            }

            .thank-you-sticker {
              width: 62mm;
              height: 20mm;
              padding: 1.8mm 2.2mm;
              background: linear-gradient(
                135deg,
                #fff7fb 0%,
                #faf3ff 50%,
                #effaf8 100%
              );
              border: 0.25mm dashed #d4b5f0;
              border-radius: 0;
              text-align: center;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }

            .ty-header {
              font-size: 6.8pt;
              font-weight: 900;
              color: #ec3e82;
              letter-spacing: 0.03em;
              line-height: 1.1;
              margin-bottom: 0.4mm;
            }

            .ty-subhead {
              font-size: 5.2pt;
              font-weight: 800;
              color: #7048d8;
              margin-bottom: 0.5mm;
            }

            .ty-body {
              font-size: 4.6pt;
              color: #433d59;
              font-weight: 700;
              line-height: 1.25;
              margin-bottom: 0.6mm;
            }

            .ty-footer {
              font-size: 4.4pt;
              font-weight: 800;
              color: #ec3e82;
              letter-spacing: 0.04em;
            }

            .ty-brand {
              color: #7048d8;
              font-weight: 900;
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
    <div className="thank-you-modal">
      <div className="no-print ty-actions-bar">
        <div>
          <strong>
            💖 "Thank You" Bottom Strip Stickers
          </strong>

          <p>
            Prints 39 stickers per A4 sheet (61 × 20 mm).
            Aligns flush below your Backer QR sticker.
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
            🖨️ Print Sheet (A4)
          </button>
        </div>
      </div>

      <div className="ty-sheet-canvas">
        <div
          id="a4-thank-you-print-area"
          className="a4-thank-you-page"
        >
          <div className="thank-you-grid">
            {stickers.map((num) => (
              <div
                key={num}
                className="thank-you-sticker"
              >
                <div className="ty-header">
                  💖 WITH SINCERE THANKS 💖
                </div>

                <div className="ty-subhead">
                  From Our Hands to Yours
                </div>

                <div className="ty-body">
                  Thank you for supporting our dream!
                  Every custom product helps our small
                  business grow &amp; keeps your sweetest
                  moments alive.
                </div>

                <div className="ty-footer">
                  ✨ Made in minutes, treasured for a
                  lifetime ✨ •{" "}
                  <span className="ty-brand">
                    Mogified Moments
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .thank-you-modal {
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

        .ty-actions-bar {
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

        .ty-actions-bar strong {
          font-size: 16px;
          color: #292342;
          display: block;
        }

        .ty-actions-bar p {
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
          background: #ec3e82;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(236, 62, 130, 0.35);
        }

        .action-btn.secondary {
          background: #f0ebff;
          color: #7048d8;
        }

        .a4-thank-you-page {
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          padding: 9mm 6mm;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
          box-sizing: border-box;
          margin: 0 auto;
        }

        .thank-you-grid {
          display: grid;
          grid-template-columns: repeat(3, 62mm);
          grid-auto-rows: 20mm;
          gap: 1.8mm 2.5mm;
          justify-content: center;
        }

        .thank-you-sticker {
          width: 62mm;
          height: 20mm;
          padding: 1.8mm 2.2mm;
          background: linear-gradient(
            135deg,
            #fff7fb 0%,
            #faf3ff 50%,
            #effaf8 100%
          );
          border: 0.25mm dashed #d4b5f0;
          border-radius: 0;
          text-align: center;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .ty-header {
          font-size: 6.8pt;
          font-weight: 900;
          color: #ec3e82;
          letter-spacing: 0.03em;
          line-height: 1.1;
          margin-bottom: 0.4mm;
        }

        .ty-subhead {
          font-size: 5.2pt;
          font-weight: 800;
          color: #7048d8;
          margin-bottom: 0.5mm;
        }

        .ty-body {
          font-size: 4.6pt;
          color: #433d59;
          font-weight: 700;
          line-height: 1.25;
          margin-bottom: 0.6mm;
        }

        .ty-footer {
          font-size: 4.4pt;
          font-weight: 800;
          color: #ec3e82;
          letter-spacing: 0.04em;
        }

        .ty-brand {
          color: #7048d8;
          font-weight: 900;
        }
      `}</style>
    </div>
  );
}