"use client";

export default function PacketStickerSheet() {
  const stallUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://mogified-moments.vercel.app";

  const connectUrl = `${stallUrl}/connect`;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    connectUrl
  )}&margin=4`;

  return (
    <div className="sticker-sheet-root">
      <div className="no-print sticker-sheet-toolbar">
        <div>
          <h2>📦 Packet Envelope Seals (24-up A4 Grid)</h2>
          <p>Print on sticky sticker paper or gloss label stock to seal magnet envelopes.</p>
        </div>
        <button
          type="button"
          className="print-btn"
          onClick={() => window.print()}
        >
          🖨️ Print Sticker Sheet
        </button>
      </div>

      <div className="sticker-sheet-page">
        {Array.from({ length: 24 }).map((_, idx) => (
          <div className="sticker-badge" key={idx}>
            <div className="sticker-inner">
              <div className="sticker-header">
                <img src="/logo.png" alt="MM" className="sticker-logo" />
                <div>
                  <span className="brand-name">MOGIFIED MOMENTS</span>
                  <span className="brand-sub">KEEPSAKE PHOTO MAGNETS</span>
                </div>
              </div>

              <div className="token-stamp-box">
                <span className="token-label">TOKEN / ORDER</span>
                <div className="token-dotted-line">#MM — &nbsp; &nbsp; &nbsp; &nbsp;</div>
              </div>

              <div className="sticker-body">
                <div className="qr-column">
                  <img src={qrCodeUrl} alt="Scan to Connect QR" className="qr-thumb" />
                  <span className="qr-caption">SCAN TO CONNECT</span>
                </div>
                <div className="instructions-column">
                  <p>✨ Water-resistant glossy finish</p>
                  <p>🧲 High-grip flexible base</p>
                  <p>📸 Tag <b>@mogifiedmoments</b></p>
                  <span className="discount-pill">Get 10% off next order</span>
                </div>
              </div>

              <div className="sticker-footer">
                <span>Handcrafted with ❤️ in Goa</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        .sticker-sheet-root {
          min-height: 100vh;
          background: #f4f0f9;
          padding: 24px;
          font-family: Nunito, system-ui, sans-serif;
          color: #292342;
        }

        .sticker-sheet-toolbar {
          max-width: 210mm;
          margin: 0 auto 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
          border: 1.5px solid #ecdff5;
          border-radius: 18px;
          padding: 16px 22px;
          box-shadow: 0 4px 14px rgba(112, 72, 216, 0.08);
        }

        .sticker-sheet-toolbar h2 {
          margin: 0 0 4px;
          font-size: 18px;
          color: #292342;
          font-weight: 800;
        }

        .sticker-sheet-toolbar p {
          margin: 0;
          font-size: 12px;
          color: #756f87;
        }

        .print-btn {
          border: 0;
          background: linear-gradient(135deg, #ec3e82 0%, #7048d8 100%);
          color: #ffffff;
          font-weight: 900;
          font-size: 14px;
          padding: 12px 22px;
          border-radius: 12px;
          cursor: pointer;
        }

        .sticker-sheet-page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          background: #ffffff;
          padding: 10mm 8mm;
          display: grid;
          grid-template-columns: repeat(4, 46mm);
          grid-auto-rows: 44mm;
          gap: 3mm 3mm;
          justify-content: center;
          align-content: start;
          box-sizing: border-box;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.07);
        }

        .sticker-badge {
          width: 46mm;
          height: 44mm;
          border: 1.2px dashed #d8b4fe;
          border-radius: 12px;
          padding: 2.5mm;
          box-sizing: border-box;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .sticker-inner {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
        }

        .sticker-header {
          display: flex;
          align-items: center;
          gap: 4px;
          text-align: left;
        }

        .sticker-logo {
          width: 16px;
          height: 16px;
          object-fit: contain;
        }

        .brand-name {
          display: block;
          font-size: 5.5pt;
          font-weight: 900;
          color: #7048d8;
          letter-spacing: 0.04em;
          line-height: 1;
        }

        .brand-sub {
          display: block;
          font-size: 3.8pt;
          font-weight: 800;
          color: #ec3e82;
          letter-spacing: 0.05em;
          line-height: 1.1;
        }

        .token-stamp-box {
          background: #faf7fc;
          border: 0.8px solid #ecdff5;
          border-radius: 4px;
          padding: 1.5px 3px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 1.5mm 0;
        }

        .token-label {
          font-size: 4.5pt;
          font-weight: 900;
          color: #756f87;
          letter-spacing: 0.04em;
        }

        .token-dotted-line {
          font-size: 6.5pt;
          font-weight: 900;
          color: #292342;
          border-bottom: 0.8px dotted #7048d8;
          padding: 0 4px;
        }

        .sticker-body {
          display: grid;
          grid-template-columns: 14mm 1fr;
          gap: 2mm;
          align-items: center;
          text-align: left;
        }

        .qr-column {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }

        .qr-thumb {
          width: 13mm;
          height: 13mm;
          display: block;
        }

        .qr-caption {
          font-size: 3.2pt;
          font-weight: 900;
          color: #7048d8;
          letter-spacing: 0.02em;
          text-align: center;
          white-space: nowrap;
        }

        .instructions-column p {
          margin: 0 0 1px;
          font-size: 4.2pt;
          font-weight: 700;
          color: #4a4459;
          line-height: 1.25;
        }

        .discount-pill {
          display: inline-block;
          background: #fdf2f7;
          border: 0.6px solid #fbcfe8;
          color: #ec3e82;
          font-size: 3.8pt;
          font-weight: 900;
          padding: 0.8px 3px;
          border-radius: 3px;
          margin-top: 1px;
        }

        .sticker-footer {
          border-top: 0.6px dashed #e9e1f0;
          padding-top: 1px;
          margin-top: 1px;
        }

        .sticker-footer span {
          font-size: 4pt;
          font-weight: 800;
          color: #756f87;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .no-print {
            display: none !important;
          }

          .sticker-sheet-root {
            background: #ffffff !important;
            padding: 0 !important;
          }

          .sticker-sheet-page {
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>
    </div>
  );
}