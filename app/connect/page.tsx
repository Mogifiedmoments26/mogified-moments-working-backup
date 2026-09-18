"use client";

import React from "react";
import { Brand } from "../../components/Brand";

export default function ConnectPage() {
  const instagramUrl = "https://www.instagram.com/mogified_moments?stkn=NHRwOHZxdzE1MXNs";
  const whatsappNumber = "9529180815";
  const appUrl = "https://mogified-moments.vercel.app";

  return (
    <main className="connect-page-root">
      <header className="connect-header">
        <Brand compact />
      </header>

      <div className="connect-card">
        <h1>Connect with Mogified Moments</h1>
        <p>Explore our links, chat on WhatsApp, or visit our live app instantly!</p>

        <div className="social-links-grid">
          <a
            href={`https://wa.me/91${whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-pill whatsapp"
          >
            💬 WhatsApp: +91 {whatsappNumber}
          </a>

          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="social-pill instagram"
          >
            📸 Instagram: @mogified_moments
          </a>

          <a
            href={appUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="social-pill app-link"
          >
            🌐 Open Live App
          </a>
        </div>
      </div>

      <style jsx>{`
        .connect-page-root {
          min-height: 100vh;
          background: linear-gradient(135deg, #faf5ff 0%, #f1f5f9 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .connect-header {
          width: 100%;
          max-width: 440px;
          margin-bottom: 20px;
          text-align: center;
        }
        .connect-card {
          background: #fff;
          border-radius: 28px;
          padding: 36px 24px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08);
          border: 1px solid #e2e8f0;
        }
        .connect-card h1 {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 8px;
        }
        .connect-card p {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 28px;
        }
        .social-links-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .social-pill {
          display: block;
          text-align: center;
          padding: 16px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .social-pill:hover {
          transform: translateY(-2px);
        }
        .social-pill.whatsapp {
          color: #15803d;
          background: #f0fdf4;
          border-color: #bbf7d0;
        }
        .social-pill.instagram {
          color: #db2777;
          background: #fdf2f8;
          border-color: #fbcfe8;
        }
        .social-pill.app-link {
          color: #7c3aed;
          background: #f5f3ff;
          border-color: #ddd6fe;
        }
      `}</style>
    </main>
  );
}