"use client";

import React, { useMemo, useState } from "react";

interface CouponSheetProps {
  onClose: () => void;
}

interface CouponItem {
  code: string;
  discountText: string;
}

const COUPONS_PER_PAGE = 8;

function generateAll50Coupons(): CouponItem[] {
  const list: CouponItem[] = [];

  for (let i = 1; i <= 25; i++) {
    const discountText = i % 2 === 0 ? "10% OFF" : "15% OFF";
    list.push({
      code: `MOGI${i}OFF`,
      discountText,
    });
  }

  for (let i = 26; i <= 50; i++) {
    const discountText = i % 2 === 0 ? "₹20 OFF" : "₹50 OFF";
    list.push({
      code: `SAVE${i}DEAL`,
      discountText,
    });
  }

  return list;
}

export default function CouponSheet({ onClose }: CouponSheetProps) {
  const [currentPage, setCurrentPage] = useState<number>(0);
  const allCoupons = useMemo(() => generateAll50Coupons(), []);

  const pages = useMemo(() => {
    const chunks: CouponItem[][] = [];
    for (let i = 0; i < allCoupons.length; i += COUPONS_PER_PAGE) {
      chunks.push(allCoupons.slice(i, i + COUPONS_PER_PAGE));
    }
    return chunks;
  }, [allCoupons]);

  const totalPages = pages.length;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const pagesHtml = pages
      .map(
        (pageCoupons) => `
        <div class="coupon-a4-page">
          <div class="coupon-sheet-grid">
            ${pageCoupons
              .map(
                (coupon) => `
              <div class="coupon-card">
                <div class="coupon-inner">
                  <div class="coupon-left">
                    <img src="/logo.png" alt="Mogified Moments" class="coupon-logo" />
                    <span class="coupon-brand-name">Mogified Moments</span>
                  </div>
                  <div class="coupon-right">
                    <span class="coupon-badge">SPECIAL OFFER</span>
                    <h4 class="coupon-discount">${coupon.discountText}</h4>
                    <p class="coupon-subtext">Valid on custom keepsake photo magnets & celebration packs.</p>
                    <div class="coupon-code-pill">
                      Code: <strong>${coupon.code}</strong>
                    </div>
                  </div>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mogified Moments - Coupons</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: system-ui, -apple-system, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .coupon-a4-page {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              padding: 12mm 14mm;
              box-sizing: border-box;
              page-break-after: always;
              break-after: page;
            }
            .coupon-sheet-grid {
              display: grid;
              grid-template-columns: repeat(2, 88mm);
              grid-auto-rows: 62mm;
              gap: 5mm 6mm;
              justify-content: center;
              align-content: start;
            }
            .coupon-card {
              border: 0.35mm dashed #333333;
              border-radius: 3mm;
              padding: 4mm 5mm;
              background: #faf5ff;
              box-sizing: border-box;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .coupon-inner {
              display: flex;
              align-items: center;
              gap: 4mm;
              height: 100%;
            }
            .coupon-left {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border-right: 0.3mm dashed #666666;
              padding-right: 3.5mm;
              min-width: 22mm;
            }
            .coupon-logo {
              width: 16mm;
              height: 12mm;
              object-fit: contain;
            }
            .coupon-brand-name {
              font-size: 7pt;
              font-weight: 800;
              color: #7048d8;
              text-align: center;
              margin-top: 2mm;
            }
            .coupon-right {
              flex: 1;
            }
            .coupon-badge {
              font-size: 7pt;
              font-weight: 900;
              color: #ec3e82;
              letter-spacing: 0.08em;
            }
            .coupon-discount {
              font-size: 15pt;
              font-weight: 900;
              color: #1e1b4b;
              margin: 1mm 0;
            }
            .coupon-subtext {
              font-size: 7.5pt;
              color: #333333;
              margin: 0 0 2mm;
              line-height: 1.3;
            }
            .coupon-code-pill {
              display: inline-block;
              border: 0.3mm solid #7048d8;
              background: #ffffff;
              border-radius: 2mm;
              padding: 1mm 2.5mm;
              font-size: 8pt;
              color: #581c87;
            }
          </style>
        </head>
        <body>
          ${pagesHtml}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="coupon-modal-backdrop" onClick={onClose}>
      <div className="coupon-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="coupon-modal-header no-print">
          <div>
            <h3>🎟️ Stall Promo Vouchers (50 Coupons · 8 / A4)</h3>
            <p>Cut along the dashed borders. Multi-page layout prints all 50 vouchers.</p>
          </div>
          <div className="coupon-actions">
            <div className="pagination-pill">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              >
                ◀
              </button>
              <span>
                Page {currentPage + 1} of {Math.max(1, totalPages)}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                ▶
              </button>
            </div>
            <button type="button" className="btn-print" onClick={handlePrint}>
              🖨️ Print All Sheets (50 Vouchers)
            </button>
            <button type="button" className="btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="coupon-sheet-container">
          <div className="coupon-sheet-pages-wrapper">
            {pages.map((pageCoupons, pageIndex) => (
              <div
                className={`coupon-a4-page ${pageIndex === currentPage ? "active-screen-page" : "hidden-screen-page"}`}
                key={`page-${pageIndex}`}
              >
                <div className="coupon-sheet-grid">
                  {pageCoupons.map((coupon) => (
                    <div className="coupon-card" key={coupon.code}>
                      <div className="coupon-inner">
                        <div className="coupon-left">
                          <img src="/logo.png" alt="Mogified Moments" className="coupon-logo" />
                          <span className="coupon-brand-name">Mogified Moments</span>
                        </div>

                        <div className="coupon-right">
                          <span className="coupon-badge">SPECIAL OFFER</span>
                          <h4 className="coupon-discount">{coupon.discountText}</h4>
                          <p className="coupon-subtext">
                            Valid on custom keepsake photo magnets &amp; celebration packs.
                          </p>
                          <div className="coupon-code-pill">
                            Code: <strong>{coupon.code}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .coupon-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .coupon-modal-card {
          background: #ffffff;
          border-radius: 20px;
          max-width: 920px;
          width: 100%;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }
        .coupon-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-bottom: 1.5px solid #e2e8f0;
          background: #f8fafc;
        }
        .coupon-modal-header h3 {
          margin: 0 0 2px;
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
        }
        .coupon-modal-header p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
        }
        .coupon-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pagination-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #e2e8f0;
          border-radius: 8px;
          padding: 3px 8px;
          font-size: 12px;
          font-weight: 700;
        }
        .pagination-pill button {
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 11px;
          padding: 2px 4px;
        }
        .pagination-pill button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .btn-print {
          background: #7048d8;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 8px 16px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-close {
          background: #e2e8f0;
          color: #334155;
          border: none;
          border-radius: 10px;
          width: 34px;
          height: 34px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }
        .coupon-sheet-container {
          padding: 16px;
          overflow-y: auto;
          background: #f1f5f9;
        }
        .active-screen-page {
          display: block;
        }
        .hidden-screen-page {
          display: none;
        }
        .coupon-sheet-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          background: #ffffff;
          padding: 18px;
          border-radius: 14px;
          border: 1px solid #cbd5e1;
        }
        .coupon-card {
          border: 1.5px dashed #7048d8;
          border-radius: 12px;
          padding: 12px 14px;
          background: #faf5ff;
          position: relative;
        }
        .coupon-inner {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .coupon-left {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-right: 1.5px dashed #cbd5e1;
          padding-right: 12px;
          min-width: 85px;
        }
        .coupon-logo {
          width: 46px;
          height: 36px;
          object-fit: contain;
        }
        .coupon-brand-name {
          font-size: 9px;
          font-weight: 800;
          color: #7048d8;
          text-align: center;
          margin-top: 4px;
        }
        .coupon-right {
          flex: 1;
        }
        .coupon-badge {
          font-size: 9px;
          font-weight: 900;
          color: #ec3e82;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .coupon-discount {
          font-size: 19px;
          font-weight: 900;
          color: #1e1b4b;
          margin: 2px 0;
        }
        .coupon-subtext {
          font-size: 11px;
          color: #64748b;
          margin: 0 0 6px;
          line-height: 1.3;
        }
        .coupon-code-pill {
          display: inline-block;
          background: #ffffff;
          border: 1px solid #d8b4fe;
          border-radius: 6px;
          padding: 2px 8px;
          font-size: 11px;
          color: #581c87;
        }
        .coupon-code-pill strong {
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}