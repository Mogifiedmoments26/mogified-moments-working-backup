"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface TrackedOrder {
  id: string;
  orderId?: string;
  token: string;
  customerName: string;
  photoUrl: string;
  status: "pending" | "printed" | "collected" | "New" | "Completed" | string;
  quantity: number;
  total: number;
}

function TrackerContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    if (!orderId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/orders?_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const orders: TrackedOrder[] = data.orders || [];

        const foundIdx = orders.findIndex(
          (o) => o.orderId === orderId || o.id === orderId || o.token === orderId
        );

        if (foundIdx !== -1) {
          setOrder(orders[foundIdx]);

          // Count how many orders ahead of this one are pending/uncollected
          const ahead = orders
            .slice(0, foundIdx)
            .filter((o) => o.status === "pending" || o.status === "New").length;
          setQueuePosition(ahead);
        }
      }
    } catch (err) {
      console.error("Status fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, [orderId]);

  if (loading) {
    return (
      <div className="track-card">
        <div className="track-spinner">⏳</div>
        <h2>Looking up your magnets…</h2>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="track-card">
        <img src="/logo.png" alt="Mogified Moments" className="track-logo" />
        <h2>Order Not Found</h2>
        <p>We couldn't locate order #{orderId}. Please check the link or ask our counter team.</p>
        <a href="/" className="track-btn">Back to Shop</a>
      </div>
    );
  }

  const isReady =
    order.status === "printed" ||
    order.status === "collected" ||
    order.status === "Completed" ||
    order.status === "Ready";

  return (
    <div className="track-card">
      <img src="/logo.png" alt="Mogified Moments" className="track-logo" />

      <span className="track-eyebrow">LIVE QUEUE STATUS</span>
      <div className="track-token">{order.token}</div>
      <p className="track-customer">For {order.customerName}</p>

      <div className="track-preview-box">
        <img src={order.photoUrl} alt="Magnet Artwork" />
      </div>

      <div className={`track-status-pill ${isReady ? "ready" : "printing"}`}>
        {isReady ? "✨ READY FOR COLLECTION!" : "🖨️ In Production Queue"}
      </div>

      {!isReady && queuePosition !== null && (
        <div className="track-queue-info">
          {queuePosition === 0 ? (
            <p><b>Your magnet is printing right now!</b> Head over to the stall counter.</p>
          ) : (
            <p>
              <b>{queuePosition}</b> order{queuePosition === 1 ? "" : "s"} ahead of you in line.
            </p>
          )}
        </div>
      )}

      {isReady && (
        <p className="track-ready-note">
          Please show your token <b>{order.token}</b> at the stall counter to pick up your magnet!
        </p>
      )}

      <button className="track-refresh-btn" onClick={fetchStatus}>
        ↻ Refresh Status
      </button>
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <main className="track-page">
      <Suspense fallback={<div className="track-card"><h2>Loading tracking…</h2></div>}>
        <TrackerContent />
      </Suspense>

      <style jsx global>{`
        .track-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: linear-gradient(135deg, #fff5f9 0%, #f7f1ff 50%, #effaf9 100%);
          font-family: Nunito, system-ui, sans-serif;
          color: #292342;
        }

        .track-card {
          background: #ffffff;
          border: 1.5px solid #ecdff5;
          border-radius: 28px;
          padding: 32px 24px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 16px 48px rgba(112, 72, 216, 0.12);
        }

        .track-logo {
          width: 80px;
          height: auto;
          margin: 0 auto 12px;
          display: block;
        }

        .track-eyebrow {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          color: #7048d8;
          display: block;
        }

        .track-token {
          font: 900 48px/1 "Baloo 2", sans-serif;
          color: #ec3e82;
          margin: 6px 0;
        }

        .track-customer {
          font-size: 15px;
          color: #756f87;
          margin-bottom: 16px;
        }

        .track-preview-box {
          width: 140px;
          height: 140px;
          margin: 0 auto 18px;
          border-radius: 16px;
          border: 2px solid #ecdff5;
          overflow: hidden;
          background: #faf7fc;
        }

        .track-preview-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .track-status-pill {
          display: inline-block;
          font-size: 13px;
          font-weight: 800;
          padding: 8px 18px;
          border-radius: 999px;
          margin-bottom: 14px;
        }

        .track-status-pill.printing {
          background: #f2ebff;
          color: #7048d8;
        }

        .track-status-pill.ready {
          background: #e6f9f6;
          color: #0c8a77;
        }

        .track-queue-info {
          background: #faf7fc;
          border-radius: 14px;
          padding: 12px;
          font-size: 13px;
          margin: 8px 0 16px;
        }

        .track-ready-note {
          font-size: 14px;
          color: #0c8a77;
          font-weight: 700;
          margin: 12px 0 18px;
        }

        .track-refresh-btn,
        .track-btn {
          border: 0;
          background: #faf5ff;
          border: 1px solid #d9cbef;
          color: #7048d8;
          font-weight: 800;
          font-size: 13px;
          padding: 10px 18px;
          border-radius: 12px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
      `}</style>
    </main>
  );
}