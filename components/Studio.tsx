"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { type Order, type OrderStatus } from "../lib/order";
import { updateOrderStatus } from "../lib/orders";
import CouponSheet from "./CouponSheet";
import ThankYouStickerSheet from "./ThankYouStickerSheet";
import BackStickerSheet from "./BackStickerSheet";

interface StudioProps {
  onLogout?: () => void;
}

export default function Studio({ onLogout }: StudioProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showCoupons, setShowCoupons] = useState<boolean>(false);
  const [showThankYouStickers, setShowThankYouStickers] = useState<boolean>(false);
  const [showBackStickers, setShowBackStickers] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

    // Admin controls moved into Studio
  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>("Goa Live Stall");
  const [eventVenue, setEventVenue] = useState<string>("Main Arena");
  const [isEditingEvent, setIsEditingEvent] = useState<boolean>(false);

  // Active Inspect Order Modal
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [brightnessAdjustments, setBrightnessAdjustments] = useState<Record<string, number>>({});

  // Inventory / Consumables tracking
  const [blankBases, setBlankBases] = useState<number>(100);
  const [glossPaper, setGlossPaper] = useState<number>(50);
  const [sleeves, setSleeves] = useState<number>(200);

  const prevOrderCount = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  function playChimeSound() {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn("Audio chime play error:", e);
    }
  }

  async function forceHardRefresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/orders?_t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          const regularOnly = data.orders.filter((o: any) => !o.packageId);

          if (prevOrderCount.current > 0 && regularOnly.length > prevOrderCount.current && soundEnabled) {
            playChimeSound();
          }

          setOrders(regularOnly);
          prevOrderCount.current = regularOnly.length;
        }
      }
    } catch (error) {
      console.warn("Could not refresh orders temporarily. Retrying automatically:", error);
    } finally {
      setIsRefreshing(false);
    }
  }

    useEffect(() => {
  forceHardRefresh();

  const interval = setInterval(() => {
    forceHardRefresh();
  }, 4000);

  return () => clearInterval(interval);
}, [soundEnabled]);

useEffect(() => {
  fetchAdminSettings();
}, []);

    async function fetchAdminSettings() {
  try {
    const res = await fetch(`/api/orders?_t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!res.ok) return;

    const data = await res.json();

    setIsQueuePaused(Boolean(data.isQueuePaused));

    // Do not overwrite fields while the user is editing them.
    if (!isEditingEvent && data.event) {
      setEventName(data.event.name || "Goa Live Stall");
      setEventVenue(data.event.venue || "Main Arena");
    }
  } catch (error) {
    console.error("Could not load admin settings:", error);
  }
}

  async function toggleQueuePause() {
    const nextState = !isQueuePaused;

    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "toggle_queue_pause",
          paused: nextState,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update queue pause state");
      }

      setIsQueuePaused(nextState);
    } catch (error) {
      console.error("Queue pause update failed:", error);
      alert("Could not update queue pause status.");
    }
  }

  async function saveEventDetails() {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "update_event",
          name: eventName,
          venue: eventVenue,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update event details");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem("mm_admin_event_name", eventName);
        localStorage.setItem("mm_admin_event_venue", eventVenue);
      }

      setIsEditingEvent(false);
    } catch (error) {
      console.error("Event update failed:", error);
      alert("Could not update event details.");
    }
  }

  async function clearQueueAndReset() {
    const confirmed = window.confirm(
      "⚠️ Are you sure you want to clear the queue?\n\nThis will remove all current orders."
    );

    if (!confirmed) return;

    try {
      const res = await fetch("/api/orders", {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to clear queue");
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem("mogified-moments-orders");
        localStorage.removeItem("mm_orders");
        localStorage.removeItem("orders");
        sessionStorage.removeItem("mogified-moments-orders");
      }

      setOrders([]);
      setSelectedIds([]);

      alert("Queue cleared successfully!");

      await forceHardRefresh();
    } catch (error) {
      console.error("Queue clear error:", error);
      alert("Could not clear the queue.");
    }
  }

  function selectNext9Ready() {
    const readyOrders = orders.filter(
      (order) =>
        order.status === "New" ||
        order.status === "Processing"
    );

    const next9 = readyOrders.slice(0, 9).map((order) => order.orderId);

    setSelectedIds(next9);
  }

  async function handleReprint(order: Order) {
    const reprintToken = `${order.token || order.orderId}-RP`;

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...order,
          id: `rp-${Date.now()}`,
          orderId: undefined,
          token: reprintToken,
          status: "New",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create reprint");
      }

      await forceHardRefresh();
    } catch (error) {
      console.error("Reprint failed:", error);
      alert("Failed to create reprint.");
    }
  }

  async function handleStatusChange(orderId: string, nextStatus: OrderStatus) {
    try {
      await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((ord) => (ord.orderId === orderId ? { ...ord, status: nextStatus } : ord))
      );
      if (viewingOrder?.orderId === orderId) {
        setViewingOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  }

  function sendWhatsAppUpdate(order: Order) {
    const rawPhone = (order.phone || "").replace(/\D/g, "");
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    if (!cleanPhone) {
      alert("No phone number available for this customer.");
      return;
    }

    const tokenText = order.token || `#${order.orderId.slice(-4)}`;
    let message = "";

    if (order.status === "Ready") {
      message = `Hi ${order.customerName}! 🎉 Your keepsake photo magnet (${tokenText}) is ready for pickup at Mogified Moments! Show this message or your token at the stall counter.`;
    } else if (order.status === "Completed") {
      message = `Thank you ${order.customerName} for visiting Mogified Moments! ❤️ We hope you love your magnet keepsake. Have a wonderful time!`;
    } else {
      message = `Hi ${order.customerName}! We have received your order (${tokenText}) at Mogified Moments and it is currently being crafted. We will notify you once ready!`;
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  // Print Live Stall QR Code Table Standee Sheet
  function handlePrintStallQR() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to open QR sheet.");
      return;
    }

    const currentUrl = typeof window !== "undefined" ? window.location.origin : "https://mogifiedmoments.com";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mogified Moments - Live Stall QR Standee</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
            }
            .standee-card {
              width: 145mm;
              border: 2.5px solid #a855f7;
              border-radius: 20px;
              padding: 10mm 12mm;
              text-align: center;
              background: #ffffff;
              box-shadow: 0 4px 20px rgba(0,0,0,0.06);
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .logo-img {
              width: 22mm;
              height: auto;
              margin-bottom: 2mm;
            }
            .subtitle-tag {
              font-size: 7pt;
              font-weight: 800;
              color: #ec4899;
              letter-spacing: 0.1em;
              text-transform: uppercase;
              margin-bottom: 1mm;
            }
            h1 {
              color: #0f172a;
              font-size: 16pt;
              font-weight: 900;
              margin: 0 0 1mm;
            }
            .sub-instruction {
              color: #64748b;
              font-size: 8.5pt;
              font-weight: 700;
              margin-bottom: 5mm;
            }
            .qr-box {
              background: #fff;
              padding: 4mm;
              border-radius: 12px;
              border: 1.5px solid #e2e8f0;
              display: inline-block;
              margin-bottom: 4mm;
            }
            .qr-box img {
              width: 55mm;
              height: 55mm;
              display: block;
            }
            .scan-pill {
              background: #7048d8;
              color: #ffffff;
              font-size: 7.5pt;
              font-weight: 800;
              padding: 2mm 6mm;
              border-radius: 999px;
              letter-spacing: 0.05em;
              margin-bottom: 6mm;
            }
            .steps-row {
              display: flex;
              justify-content: space-between;
              width: 100%;
              border-top: 1px dashed #cbd5e1;
              padding-top: 5mm;
              gap: 4mm;
            }
            .step-col {
              flex: 1;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
            }
            .step-badge {
              width: 5mm;
              height: 5mm;
              background: #ec4899;
              color: #fff;
              border-radius: 50%;
              font-size: 6pt;
              font-weight: 900;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 1.5mm;
            }
            .step-title {
              font-size: 7pt;
              font-weight: 800;
              color: #1e293b;
              margin-bottom: 0.5mm;
            }
            .step-desc {
              font-size: 5.5pt;
              font-weight: 700;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="standee-card">
            <img src="/logo.png" alt="Logo" class="logo-img" />
            <span class="subtitle-tag">Photo Magnet Stall</span>
            <h1>Turn your moments into magnets!</h1>
            <p class="sub-instruction">Create and order directly on your mobile</p>
            
            <div class="qr-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentUrl)}" alt="Live Stall QR" />
            </div>

            <div class="scan-pill">SCAN WITH ANY PHONE CAMERA</div>

            <div class="steps-row">
              <div class="step-col">
                <div class="step-badge">1</div>
                <span class="step-title">Scan QR Code</span>
                <span class="step-desc">Instant 2-minute printing</span>
              </div>
              <div class="step-col">
                <div class="step-badge">2</div>
                <span class="step-title">Pick Photo &amp; Frame</span>
                <span class="step-desc">Classic 2" Square Magnets</span>
              </div>
              <div class="step-col">
                <div class="step-badge">3</div>
                <span class="step-title">Collect Magnet Here!</span>
                <span class="step-desc">Ready at stall counter</span>
              </div>
            </div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  function getBrightness(orderId: string) {
    return brightnessAdjustments[orderId] ?? 100;
  }

  function setOrderBrightness(orderId: string, value: number) {
    const nextValue = Math.max(70, Math.min(130, Math.round(value)));
    setBrightnessAdjustments((prev) => ({
      ...prev,
      [orderId]: nextValue,
    }));
  }

  async function handlePrintBatch() {
    if (selectedIds.length === 0) {
      alert("Please select at least 1 order to print.");
      return;
    }

    const printItems = orders.filter((o) => selectedIds.includes(o.orderId));
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to open print sheets.");
      return;
    }

    // The browser cannot detect when the physical printer has finished.
    // Mark the selected orders as Processing once the print window is successfully opened.
    try {
      const statusResults = await Promise.all(
        printItems.map(async (item) => {
          const res = await fetch("/api/orders", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              orderId: item.orderId,
              status: "Processing",
            }),
          });

          if (!res.ok) {
            throw new Error(`Could not update ${item.orderId} to Processing.`);
          }

          return item.orderId;
        })
      );

      if (statusResults.length > 0) {
        setOrders((current) =>
          current.map((item) =>
            statusResults.includes(item.orderId)
              ? { ...item, status: "Processing" }
              : item
          )
        );

        setViewingOrder((current) =>
          current && statusResults.includes(current.orderId)
            ? { ...current, status: "Processing" }
            : current
        );
      }
    } catch (statusError) {
      console.error("Automatic Processing status update failed:", statusError);
    }

    const squareMagnetItems = printItems.filter(
      (item) => item.productId !== "keychain" && item.productId !== "circle"
    );
    const circleMagnetItems = printItems.filter((item) => item.productId === "circle");
    const keychainItems = printItems.filter((item) => item.productId === "keychain");

    const squareMagnetItemsHtml = squareMagnetItems
      .map(
        (item) => `
        <div class="print-item square-magnet-print-grid-item">
          <div class="cut-box-61mm">
            <div class="crop-mark top-left"></div>
            <div class="crop-mark top-right"></div>
            <div class="crop-mark bottom-left"></div>
            <div class="crop-mark bottom-right"></div>
            <div class="magnet-image-61mm">
              <img
                src="${item.photoUrl || item.originalPhotoUrl || "/logo.png"}"
                alt="${item.orderId}"
                style="filter: brightness(${getBrightness(item.orderId)}%);"
              />
            </div>
          </div>
          <span class="token-label">${item.token || item.orderId} (52mm finished / 61mm artwork)</span>
        </div>
      `
      )
      .join("");

    const circleMagnetItemsHtml = circleMagnetItems
      .map(
        (item) => `
        <div class="print-item circle-magnet-print-grid-item">
          <div class="circle-magnet-bleed-box">
            <div class="circle-magnet-artwork">
              <img
                src="${item.photoUrl || item.originalPhotoUrl || "/logo.png"}"
                alt="${item.orderId}"
                style="filter: brightness(${getBrightness(item.orderId)}%);"
              />
            </div>
            <div class="circle-bleed-guide"></div>
          </div>
          <span class="token-label">${item.token || item.orderId} (59mm artwork / 7mm bleed)</span>
        </div>
      `
      )
      .join("");

    const keychainItemsHtml = keychainItems
      .map(
        (item) => `
        <div class="keychain-print-item">
          <div class="keychain-print-pair">
            <div class="keychain-print-side">
              <div class="keychain-print-circle">
                <img
                  src="${item.photoUrl || item.originalPhotoUrl || "/logo.png"}"
                  alt="${item.orderId} front"
                  style="filter: brightness(${getBrightness(item.orderId)}%);"
                />
              </div>
              <span>FRONT</span>
            </div>
            <div class="keychain-print-side">
              <div class="keychain-print-circle">
                <img
                  src="${item.photoBackUrl || "/logo.png"}"
                  alt="${item.orderId} back"
                  style="filter: brightness(${getBrightness(item.orderId)}%);"
                />
              </div>
              <span>BACK</span>
            </div>
          </div>
          <span class="token-label">${item.token || item.orderId} (36mm round keychain · front + back)</span>
        </div>
      `
      )
      .join("");

    const squareMagnetGridHtml = squareMagnetItems.length > 0
      ? `<div class="print-grid square-magnet-print-grid">${squareMagnetItemsHtml}</div>`
      : "";

    const circleMagnetGridHtml = circleMagnetItems.length > 0
      ? `<div class="print-grid circle-magnet-print-grid">${circleMagnetItemsHtml}</div>`
      : "";

    const keychainGridHtml = keychainItems.length > 0
      ? `<div class="print-grid keychain-print-grid">${keychainItemsHtml}</div>`
      : "";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mogified Moments - Production Print Sheet</title>
          <style>
            @page { size: A4 portrait; margin: 8mm 6mm; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; background: #fff; font-family: system-ui, -apple-system, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-grid {
              display: grid;
              justify-content: center;
              align-content: start;
              page-break-inside: auto;
            }
            .square-magnet-print-grid {
              grid-template-columns: repeat(3, 61mm);
              grid-auto-rows: 68mm;
              column-gap: 5mm;
              row-gap: 5mm;
            }
            .circle-magnet-print-grid {
              grid-template-columns: repeat(3, 66mm);
              grid-auto-rows: 72mm;
              column-gap: 5mm;
              row-gap: 5mm;
              margin-top: 2mm;
            }
            .keychain-print-grid {
              grid-template-columns: repeat(2, 80mm);
              grid-auto-rows: 48mm;
              column-gap: 10mm;
              row-gap: 7mm;
              margin-top: 2mm;
            }
            .print-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              page-break-inside: avoid;
              break-inside: avoid;
              min-width: 0;
            }
            .square-magnet-print-grid-item {
              width: 61mm;
              min-width: 61mm;
            }
            .circle-magnet-print-grid-item {
              width: 66mm;
              min-width: 66mm;
              height: 72mm;
            }
            .circle-magnet-bleed-box {
              width: 66mm;
              height: 66mm;
              position: relative;
              flex: 0 0 66mm;
            }
            .circle-magnet-artwork {
              position: absolute;
              width: 59mm;
              height: 59mm;
              left: 3.5mm;
              top: 3.5mm;
              border-radius: 50%;
              overflow: hidden;
              background: #fff;
            }
            .circle-magnet-artwork img {
              width: 59mm;
              height: 59mm;
              display: block;
              object-fit: cover;
              border-radius: 50%;
            }
            .circle-bleed-guide {
              position: absolute;
              inset: 0;
              width: 66mm;
              height: 66mm;
              border: 0.3mm solid #111;
              border-radius: 50%;
              pointer-events: none;
            }
            .keychain-print-item {
              width: 80mm;
              min-width: 80mm;
              height: 48mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .keychain-print-pair {
              width: 80mm;
              height: 36mm;
              display: flex;
              flex: 0 0 36mm;
              align-items: flex-start;
              justify-content: center;
              gap: 8mm;
            }
            .keychain-print-side {
              width: 36mm;
              min-width: 36mm;
              height: 42mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              gap: 1.5mm;
            }
            .keychain-print-circle {
              width: 36mm !important;
              min-width: 36mm !important;
              max-width: 36mm !important;
              height: 36mm !important;
              min-height: 36mm !important;
              max-height: 36mm !important;
              aspect-ratio: 1 / 1;
              border-radius: 50% !important;
              overflow: hidden;
              background: #fff;
              display: flex;
              flex: 0 0 36mm;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
            }
            .keychain-print-circle img {
              width: 36mm !important;
              min-width: 36mm !important;
              max-width: 36mm !important;
              height: 36mm !important;
              min-height: 36mm !important;
              max-height: 36mm !important;
              aspect-ratio: 1 / 1;
              border-radius: 50% !important;
              object-fit: cover;
              display: block;
              flex: 0 0 36mm;
            }
            .keychain-print-side span {
              font-size: 6pt;
              font-weight: 900;
              color: #222;
              line-height: 1;
            }
            .cut-box-61mm { width:61mm; height: 61mm; position: relative; box-sizing: border-box; background: #fff; border: 0.3mm solid #111; border-radius: 5.5mm; overflow: visible; }
            .crop-mark { position: absolute; width: 3.5mm; height: 3.5mm; }
            .crop-mark.top-left { top: -1px; left: -1px; border-top: 0.4mm solid #111; border-left: 0.4mm solid #111; }
            .crop-mark.top-right { top: -1px; right: -1px; border-top: 0.4mm solid #111; border-right: 0.4mm solid #111; }
            .crop-mark.bottom-left { bottom: -1px; left: -1px; border-bottom: 0.4mm solid #111; border-left: 0.4mm solid #111; }
            .crop-mark.bottom-right { bottom: -1px; right: -1px; border-bottom: 0.4mm solid #111; border-right: 0.4mm solid #111; }
            .magnet-image-61mm {
  width: 61mm;
  height: 61mm;
  position: relative;
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border-radius: 5.5mm;
}

.magnet-image-61mm img {
  width: 61mm;
  height: 61mm;
  object-fit: fill;
  display: block;
}
            .token-label { font-size: 8pt; font-weight: 800; color: #222; margin-top: 1.5mm; text-align: center; }
          </style>
        </head>
        <body>
          ${squareMagnetGridHtml}${circleMagnetGridHtml}${keychainGridHtml}
          <script>window.onload = function() { window.print(); window.close(); };</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const matchStatus = statusFilter === "All" || ord.status === statusFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        ord.orderId.toLowerCase().includes(query) ||
        (ord.token && ord.token.toLowerCase().includes(query)) ||
        ord.customerName.toLowerCase().includes(query) ||
        ord.phone.includes(query) ||
        (ord.paymentMethod && ord.paymentMethod.toLowerCase().includes(query));
      return matchStatus && matchSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    let gross = 0;
    let cash = 0;
    let upi = 0;
    let magnets = 0;

    orders.forEach((ord) => {
      gross += ord.total || 0;
      if (ord.paymentMethod === "cash") {
        cash += ord.total || 0;
      } else {
        upi += ord.total || 0;
      }
      magnets += ord.quantity || 1;
    });

    return { gross, cash, upi, magnets };
  }, [orders]);

  const countByStatus = useMemo(() => {
    return {
      New: orders.filter((o) => o.status === "New").length,
      Processing: orders.filter((o) => o.status === "Processing").length,
      Ready: orders.filter((o) => o.status === "Ready").length,
      Completed: orders.filter((o) => o.status === "Completed").length,
    };
  }, [orders]);

  return (
    <div className="studio-container">
      <header className="studio-header">
        <div className="brand-section">
          <img src="/logo.png" alt="Mogified Moments" className="logo" />
          <div>
            <h2>Mogified Moments Studio</h2>
            <p>Regular Stall Orders, Accounting &amp; Inventory Hub</p>
          </div>
        </div>

        <div className="header-actions">
                   <button
            type="button"
            className={`action-btn ${isQueuePaused ? "queue-paused-btn" : "queue-pause-btn"}`}
            onClick={toggleQueuePause}
          >
            {isQueuePaused
              ? "▶️ Resume Queue"
              : "⏸️ Pause Queue (10 min)"}
          </button>

          <button
            type="button"
            className="action-btn reset-event-btn"
            onClick={clearQueueAndReset}
          >
            🗑️ Clear Queue / Reset Event
          </button>

          <button
            type="button"
            className={`action-btn ${soundEnabled ? "active" : ""}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? "🔔 Chime ON" : "🔕 Chime OFF"}
          </button>

          <Link href="/admin/party-hub" className="action-btn party-btn">
            🎉 Party Packages Hub
          </Link>

          <button
            type="button"
            className="action-btn qr-action-btn"
            onClick={handlePrintStallQR}
          >
            🔲 Stall QR Standee
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={() => setShowThankYouStickers(true)}
          >
            🏷️ Thank You Stickers
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={() => setShowBackStickers(true)}
          >
            🏷️ Back Stickers
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={() => setShowCoupons(true)}
          >
            🎟️ Coupons (8/A4)
          </button>

          <button
            type="button"
            className="action-btn"
            onClick={forceHardRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "⟳ Refreshing..." : "🔄 Refresh"}
          </button>

          {onLogout && (
            <button type="button" className="action-btn logout-btn" onClick={onLogout}>
              🔒 Logout
            </button>
          )}
        </div>
      </header>

            <section className="studio-event-bar">
        <div className="studio-event-info">
          {isEditingEvent ? (
            <div className="studio-event-edit">
              <input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Event Name"
              />

              <input
                value={eventVenue}
                onChange={(e) => setEventVenue(e.target.value)}
                placeholder="Venue"
              />

              <button
                type="button"
                className="event-save-btn"
                onClick={saveEventDetails}
              >
                Save
              </button>

              <button
                type="button"
                className="event-cancel-btn"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    const savedName = localStorage.getItem(
                      "mm_admin_event_name"
                    );
                    const savedVenue = localStorage.getItem(
                      "mm_admin_event_venue"
                    );

                    if (savedName) setEventName(savedName);
                    if (savedVenue) setEventVenue(savedVenue);
                  }

                  setIsEditingEvent(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <strong>🎪 Active Event: {eventName}</strong>
              <span>📍 {eventVenue}</span>
            </>
          )}
        </div>

        {!isEditingEvent && (
          <button
            type="button"
            className="edit-event-btn"
            onClick={() => setIsEditingEvent(true)}
          >
            ✏️ Edit Event Details
          </button>
        )}
      </section>

      <section className="stats-row">
        <div className="stat-card">
          <span>GROSS INTAKE</span>
          <strong>₹{metrics.gross.toLocaleString("en-IN")}</strong>
        </div>
        <div className="stat-card">
          <span>💵 CASH IN POUCH</span>
          <strong style={{ color: "#0c8a77" }}>₹{metrics.cash.toLocaleString("en-IN")}</strong>
        </div>
        <div className="stat-card">
          <span>📱 UPI RECEIVED</span>
          <strong style={{ color: "#7048d8" }}>₹{metrics.upi.toLocaleString("en-IN")}</strong>
        </div>
        <div className="stat-card">
          <span>MAGNETS SOLD</span>
          <strong>{metrics.magnets} pcs</strong>
        </div>
        <div className="stat-card buffer-card">
          <span>🖨️ A4 GRID BUFFER</span>
          <strong>{selectedIds.length} / 9 (Building sheet)</strong>
        </div>
        <div className="stat-card inv-card">
          <span>BLANK BASES (52mm)</span>
          <input
            type="number"
            value={blankBases}
            onChange={(e) => setBlankBases(Number(e.target.value))}
          />
        </div>
        <div className="stat-card inv-card">
          <span>GLOSS PAPER</span>
          <input
            type="number"
            value={glossPaper}
            onChange={(e) => setGlossPaper(Number(e.target.value))}
          />
        </div>
        <div className="stat-card inv-card">
          <span>SLEEVES</span>
          <input
            type="number"
            value={sleeves}
            onChange={(e) => setSleeves(Number(e.target.value))}
          />
        </div>
      </section>

      <div className="controls-bar">
        <input
          type="text"
          placeholder="Search by token, order ID, customer name, phone, or UPI/Cash..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />

        <div className="filter-chips">
          {["All", "New", "Processing", "Ready", "Completed"].map((status) => (
            <button
              key={status}
              type="button"
              className={`chip ${statusFilter === status ? "active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status}
              {status !== "All" && (
                <span className="count-tag">
                  {countByStatus[status as keyof typeof countByStatus] || 0}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="batch-actions-bar">
          <span>
            <b>{selectedIds.length}</b> magnet{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
                        <button
              type="button"
              className="btn-select-next"
              onClick={selectNext9Ready}
            >
              ⚡ Select Next 9 Ready
            </button>
            <button type="button" className="btn-batch-print" onClick={handlePrintBatch}>
              🖨️ Print 9-Up A4 Sheet ({selectedIds.length})
            </button>
            <button type="button" className="btn-clear-select" onClick={() => setSelectedIds([])}>
              Clear Selection
            </button>
          </div>
        </div>
      )}

      <div className="table-wrapper">
        <table className="orders-table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  checked={
                    filteredOrders.length > 0 &&
                    selectedIds.length === filteredOrders.length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(filteredOrders.map((o) => o.orderId));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </th>
              <th>TOKEN / ORDER</th>
              <th>CUSTOMER</th>
              <th>PREVIEW</th>
              <th>PRODUCT</th>
              <th>QUANTITY</th>
              <th>PAYMENT &amp; TOTAL</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="empty-row">
                  No orders found in queue.
                </td>
              </tr>
            ) : (
              filteredOrders.map((ord) => {
                const isChecked = selectedIds.includes(ord.orderId);
                return (
                  <tr key={ord.orderId} className={isChecked ? "selected-row" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, ord.orderId]);
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== ord.orderId));
                          }
                        }}
                      />
                    </td>
                    <td>
                      <div className="token-badge">{ord.token || "#MM-??"}</div>
                      <small className="order-sub-id">{ord.orderId.slice(-6)}</small>
                    </td>
                    <td>
                      <strong
                        style={{ cursor: "pointer", color: "#7048d8" }}
                        onClick={() => setViewingOrder(ord)}
                        title="Click to inspect order"
                      >
                        {ord.customerName} 🔍
                      </strong>
                      <div className="phone-line">{ord.phone}</div>
                    </td>
                    <td>
                      <div
                        className={`thumb-container ${ord.productId === "keychain" ? "keychain-thumb" : ""}`}
                        onClick={() => setViewingOrder(ord)}
                        style={{ cursor: "pointer" }}
                        title="Click to view full design"
                      >
                        <img
                          src={ord.photoUrl || ord.originalPhotoUrl || "/logo.png"}
                          alt="preview"
                        />
                      </div>
                    </td>
                    <td>
                      <span className="product-name">{ord.productName || "52mm Square Magnet"}</span>
                      <small className="frame-name">
                        {ord.productId === "circle"
                          ? "59mm face · 71mm bleed"
                          : ord.productId === "keychain"
                          ? `36mm · ${ord.keychainStrap === "mix" ? "Mixed straps" : ord.keychainStrap === "pearl" ? "Pearl strap" : "Leather strap"}`
                          : ord.frameName ? `Frame: ${ord.frameName}` : "52mm face · 61mm total"}
                      </small>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 800 }}>
                      {ord.quantity || 1}
                    </td>
                    <td>
                      <strong className="order-total">
                        ₹{(ord.total || 0).toLocaleString("en-IN")}
                      </strong>
                      <span className={`payment-pill ${ord.paymentMethod}`}>
                        {ord.paymentMethod === "cash" ? "💵 Cash" : "📱 UPI"}
                      </span>
                    </td>
                    <td>
                      <select
                        value={ord.status}
                        className={`status-select ${ord.status.toLowerCase()}`}
                        onChange={(e) => handleStatusChange(ord.orderId, e.target.value as OrderStatus)}
                      >
                        <option value="New">New</option>
                        <option value="Processing">Processing</option>
                        <option value="Ready">Ready</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="quick-action-btn inspect-btn"
                          title="View Details"
                          onClick={() => setViewingOrder(ord)}
                        >
                          👁️
                        </button>
                        <button
                          type="button"
                          className="quick-action-btn wa-btn"
                          title="Send WhatsApp Update"
                          onClick={() => sendWhatsAppUpdate(ord)}
                        >
                          💬
                        </button>
                        <button
                          type="button"
                          className="quick-action-btn print-btn"
                          title="Print Magnet"
                          onClick={() => {
                            setSelectedIds([ord.orderId]);
                            setTimeout(handlePrintBatch, 50);
                          }}
                        >
                          🖨️
                        </button>

                                                <button
                          type="button"
                          className="quick-action-btn reprint-btn"
                          title="Create Reprint"
                          onClick={() => handleReprint(ord)}
                        >
                          🔁
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {viewingOrder && (
        <div className="modal-overlay" onClick={() => setViewingOrder(null)}>
          <div className="order-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-token">{viewingOrder.token || viewingOrder.orderId}</span>
                <h3>{viewingOrder.customerName}</h3>
                <p className="phone-line">{viewingOrder.phone}</p>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setViewingOrder(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="modal-preview-box">
                <img
                  src={viewingOrder.photoUrl || viewingOrder.originalPhotoUrl || "/logo.png"}
                  alt="Product preview"
                  className={`modal-preview-img ${viewingOrder.productId === "keychain" ? "keychain-preview-img" : ""}`}
                  style={{ filter: `brightness(${getBrightness(viewingOrder.orderId)}%)` }}
                />
                {viewingOrder.productId === "keychain" && viewingOrder.photoBackUrl && (
                  <img
                    src={viewingOrder.photoBackUrl}
                    alt="Keychain back"
                    className="modal-preview-img keychain-preview-img"
                    style={{ marginTop: "10px", filter: `brightness(${getBrightness(viewingOrder.orderId)}%)` }}
                  />
                )}
                <div className="brightness-control">
                  <div className="brightness-control-header">
                    <label htmlFor="studio-brightness">☀️ Print Brightness</label>
                    <strong>{getBrightness(viewingOrder.orderId)}%</strong>
                  </div>
                  <input
                    id="studio-brightness"
                    type="range"
                    min="70"
                    max="130"
                    step="1"
                    value={getBrightness(viewingOrder.orderId)}
                    onChange={(e) =>
                      setOrderBrightness(viewingOrder.orderId, Number(e.target.value))
                    }
                    style={{
                      filter: `brightness(${getBrightness(viewingOrder.orderId)}%)`,
                    }}
                  />
                  <button
                    type="button"
                    className="brightness-reset-btn"
                    onClick={() => setOrderBrightness(viewingOrder.orderId, 100)}
                  >
                    Reset to 100%
                  </button>
                  <p className="brightness-help">
                    This adjustment is used for printing only. The customer's original photo is not changed.
                  </p>
                </div>

                <div className="modal-img-meta">
                  <span>{viewingOrder.productId === "circle" ? "59mm face · 71mm total" : viewingOrder.productId === "keychain" ? "36mm keychain · front + back" : "52mm × 52mm face · 61mm total"}</span>
                  {viewingOrder.productId === "keychain" && viewingOrder.keychainStrap && (
                    <span>Strap: {viewingOrder.keychainStrap === "mix" ? "Mix of leather + pearl" : viewingOrder.keychainStrap === "pearl" ? "Pearl" : "Leather"}</span>
                  )}
                  {viewingOrder.frameName && <span>Frame: {viewingOrder.frameName}</span>}
                </div>
              </div>

              <div className="modal-details-grid">
                <div className="detail-item">
                  <label>Order ID</label>
                  <span>{viewingOrder.orderId}</span>
                </div>
                <div className="detail-item">
                  <label>Status</label>
                  <select
                    value={viewingOrder.status}
                    className={`status-select ${viewingOrder.status.toLowerCase()}`}
                    onChange={(e) => handleStatusChange(viewingOrder.orderId, e.target.value as OrderStatus)}
                  >
                    <option value="New">New</option>
                    <option value="Processing">Processing</option>
                    <option value="Ready">Ready</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
                <div className="detail-item">
                  <label>Quantity</label>
                  <span>{viewingOrder.quantity} {viewingOrder.productId === "keychain" ? "Keychain(s)" : viewingOrder.productId === "circle" ? "Circle Magnet(s)" : "Square Magnet(s)"}</span>
                </div>
                <div className="detail-item">
                  <label>Total Price</label>
                  <strong>₹{viewingOrder.total?.toLocaleString("en-IN")} ({viewingOrder.paymentMethod === "cash" ? "Cash" : "UPI"})</strong>
                </div>
                <div className="detail-item">
                  <label>Created At</label>
                  <span>{new Date(viewingOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {viewingOrder.customWatermark && (
                  <div className="detail-item full-width">
                    <label>Watermark Text</label>
                    <span style={{ color: "#7048d8", fontWeight: 800 }}>{viewingOrder.customWatermark}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer-actions">
              <button
                type="button"
                className="action-btn wa-btn-modal"
                onClick={() => sendWhatsAppUpdate(viewingOrder)}
              >
                💬 WhatsApp Customer
              </button>

              <button
                type="button"
                className="action-btn single-print-btn"
                onClick={() => {
                  setSelectedIds([viewingOrder.orderId]);
                  setViewingOrder(null);
                  setTimeout(handlePrintBatch, 50);
                }}
              >
                🖨️ Print This Magnet
              </button>

              <a
                href={viewingOrder.photoUrl || viewingOrder.originalPhotoUrl}
                download={`${viewingOrder.token || viewingOrder.orderId}-magnet.png`}
                className="action-btn download-btn"
                target="_blank"
                rel="noreferrer"
              >
                ⬇️ Download High-Res
              </a>
            </div>
          </div>
        </div>
      )}

      {showCoupons && <CouponSheet onClose={() => setShowCoupons(false)} />}
      {showThankYouStickers && <ThankYouStickerSheet onClose={() => setShowThankYouStickers(false)} />}
      {showBackStickers && <BackStickerSheet onClose={() => setShowBackStickers(false)} />}

      <style jsx>{`
        .studio-container {
          min-height: 100vh;
          background: #f8fafc;
          padding: 16px 24px 60px;
          color: #1e293b;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .studio-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
          padding: 14px 20px;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          margin-bottom: 16px;
        }
        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 44px;
          height: 44px;
          object-fit: contain;
        }
        .brand-section h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 900;
          color: #7048d8;
        }
        .brand-section p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .action-btn {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
          padding: 8px 14px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }
                  .queue-pause-btn {
          background: #fff;
          border-color: #cbd5e1;
          color: #334155;
        }

        .queue-paused-btn {
          background: #fee2e2;
          border-color: #ef4444;
          color: #b91c1c;
        }

        .reset-event-btn {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }

        .studio-event-bar {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 12px 18px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .studio-event-info {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .studio-event-info strong {
          font-size: 14px;
          color: #1e293b;
        }

        .studio-event-info span {
          color: #64748b;
          font-size: 13px;
        }

        .studio-event-edit {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .studio-event-edit input {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 13px;
          outline: none;
        }

        .event-save-btn,
        .event-cancel-btn,
        .edit-event-btn {
          border: none;
          border-radius: 8px;
          padding: 7px 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .event-save-btn {
          background: #0f172a;
          color: #ffffff;
        }

        .event-cancel-btn {
          background: #f1f5f9;
          color: #334155;
        }

        .edit-event-btn {
          background: #ede9fe;
          color: #6366f1;
        }

        .btn-select-next {
          background: #e0e7ff;
          color: #4338ca;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }

        .reprint-btn:hover {
          background: #fef3c7;
        }
        .action-btn.active {
          background: #fdf2f8;
          border-color: #f472b6;
          color: #db2777;
        }
        .party-btn {
          background: #7048d8;
          color: #ffffff;
          border-color: #7048d8;
        }
        .qr-action-btn {
          background: #f0fdf4;
          border-color: #86efac;
          color: #16a34a;
        }
        .logout-btn {
          background: #fef2f2;
          border-color: #fecaca;
          color: #dc2626;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        .stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-card span {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.05em;
        }
        .stat-card strong {
          font-size: 18px;
          font-weight: 900;
          color: #0f172a;
        }
        .buffer-card {
          background: #faf5ff;
          border-color: #d8b4fe;
        }
        .inv-card input {
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 2px 6px;
          font-weight: 800;
          font-size: 14px;
        }
        .controls-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }
        .search-input {
          flex: 1;
          min-width: 280px;
          padding: 10px 14px;
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          font-size: 13px;
          outline: none;
        }
        .filter-chips {
          display: flex;
          gap: 6px;
        }
        .chip {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .chip.active {
          background: #7048d8;
          color: #ffffff;
          border-color: #7048d8;
        }
        .count-tag {
          background: rgba(0, 0, 0, 0.08);
          border-radius: 999px;
          padding: 1px 6px;
          font-size: 10px;
        }
        .batch-actions-bar {
          position: sticky;
          top: 10px;
          z-index: 50;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #1e1b4b;
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 12px;
          margin-bottom: 14px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        .btn-batch-print {
          background: #ec3e82;
          color: #ffffff;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }
        .btn-clear-select {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }
        .table-wrapper {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .orders-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .orders-table th {
          background: #f8fafc;
          padding: 12px 14px;
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          letter-spacing: 0.05em;
          border-bottom: 1.5px solid #e2e8f0;
        }
        .orders-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          vertical-align: middle;
        }
        .selected-row {
          background: #faf5ff;
        }
        .token-badge {
          font-size: 14px;
          font-weight: 900;
          color: #7048d8;
        }
        .order-sub-id {
          font-size: 10px;
          color: #94a3b8;
        }
        .phone-line {
          font-size: 11px;
          color: #64748b;
        }
        .thumb-container {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          overflow: hidden;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .thumb-container img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .thumb-container.keychain-thumb {
          border-radius: 50%;
        }
        .product-name {
          display: block;
          font-weight: 700;
          color: #1e293b;
        }
        .frame-name {
          display: block;
          font-size: 11px;
          color: #64748b;
        }
        .order-total {
          display: block;
          color: #0f172a;
        }
        .payment-pill {
          display: inline-block;
          font-size: 10px;
          font-weight: 800;
          border-radius: 4px;
          padding: 1px 6px;
          margin-top: 2px;
        }
        .payment-pill.cash {
          background: #eef9f7;
          color: #0c8a77;
        }
        .payment-pill.upi {
          background: #faf5ff;
          color: #7048d8;
        }
        .status-select {
          border: 1.5px solid #cbd5e1;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 800;
          background: #ffffff;
          outline: none;
          cursor: pointer;
        }
        .status-select.new {
          border-color: #f43f5e;
          color: #e11d48;
        }
        .status-select.processing {
          border-color: #f59e0b;
          color: #d97706;
        }
        .status-select.ready {
          border-color: #06b6d4;
          color: #0891b2;
        }
        .status-select.completed {
          border-color: #10b981;
          color: #059669;
        }
        .quick-action-btn {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          border-radius: 8px;
          padding: 6px 9px;
          cursor: pointer;
          font-size: 12px;
        }
        .inspect-btn:hover { background: #ede9fe; }
        .wa-btn:hover { background: #dcfce7; }
        .print-btn:hover { background: #fce7f3; }
        .empty-row {
          text-align: center;
          padding: 40px !important;
          color: #94a3b8;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 16px;
        }
        .order-modal-card {
          background: #ffffff;
          border-radius: 20px;
          max-width: 520px;
          width: 100%;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 18px 24px;
          border-bottom: 1px solid #e2e8f0;
          background: #faf5ff;
        }
        .modal-token {
          display: inline-block;
          font-size: 12px;
          font-weight: 900;
          color: #7048d8;
          background: #ede9fe;
          padding: 2px 8px;
          border-radius: 6px;
          margin-bottom: 4px;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: #1e1b4b;
        }
        .close-modal-btn {
          border: none;
          background: transparent;
          font-size: 20px;
          font-weight: 800;
          color: #64748b;
          cursor: pointer;
        }
        .modal-content {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .modal-preview-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          border: 1.5px dashed #cbd5e1;
          border-radius: 14px;
          padding: 14px;
        }
        .modal-preview-img {
          width: 180px;
          height: 180px;
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .modal-preview-img.keychain-preview-img {
          border-radius: 50%;
        }
        .keychain-print-item {
          width: 80mm;
          height: 42mm;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          box-sizing: border-box;
          page-break-inside: avoid;
          flex: 0 0 80mm;
        }
        .keychain-print-pair {
          width: 80mm;
          min-width: 80mm;
          height: 42mm;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 8mm;
          box-sizing: border-box;
        }
        .keychain-print-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5mm;
        }
        .keychain-print-circle {
          width: 36mm !important;
          min-width: 36mm !important;
          max-width: 36mm !important;
          height: 36mm !important;
          min-height: 36mm !important;
          max-height: 36mm !important;
          border-radius: 50%;
          overflow: hidden;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }
        .keychain-print-circle img {
          width: 36mm !important;
          height: 36mm !important;
          min-width: 36mm !important;
          min-height: 36mm !important;
          max-width: 36mm !important;
          max-height: 36mm !important;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }
        .keychain-print-side span {
          font-size: 6pt;
          font-weight: 900;
          color: #222;
          letter-spacing: 0.04em;
        }
        .brightness-control {
          width: 100%;
          margin-top: 14px;
          padding: 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
        }
        .brightness-control-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .brightness-control-header label {
          font-size: 12px;
          font-weight: 900;
          color: #334155;
        }
        .brightness-control-header strong {
          font-size: 12px;
          font-weight: 900;
          color: #7048d8;
          min-width: 42px;
          text-align: right;
        }
        .brightness-control input[type="range"] {
          width: 100%;
          accent-color: #7048d8;
          cursor: pointer;
        }
        .brightness-reset-btn {
          margin-top: 7px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #334155;
          border-radius: 7px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }
        .brightness-help {
          margin: 7px 0 0;
          font-size: 10px;
          line-height: 1.35;
          color: #64748b;
        }
        .modal-img-meta {
          margin-top: 8px;
          font-size: 11px;
          font-weight: 800;
          color: #64748b;
          display: flex;
          gap: 10px;
        }
        .modal-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .detail-item.full-width {
          grid-column: span 2;
        }
        .detail-item label {
          font-size: 10px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
        }
        .detail-item span {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
        }
        .modal-footer-actions {
          display: flex;
          gap: 10px;
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          flex-wrap: wrap;
        }
        .wa-btn-modal {
          background: #25d366;
          color: #fff;
          border-color: #25d366;
          flex: 1;
          justify-content: center;
        }
        .single-print-btn {
          background: #7048d8;
          color: #fff;
          border-color: #7048d8;
          flex: 1;
          justify-content: center;
        }
        .download-btn {
          background: #fff;
          border-color: #cbd5e1;
          color: #334155;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}