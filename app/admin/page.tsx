"use client";

import React, { useEffect, useState, useMemo } from "react";
import { FRAMES, type Frame } from "@/lib/frames";

export interface LiveOrder {
  id: string;
  token: string;
  orderId?: string;
  customerName: string;
  phone: string;
  photoUrl: string;
  shape: string;
  frame?: string;
  frameId?: string | null;
  quantity: number;
  total: number;
  paymentMethod: string;
  status: "pending" | "printed" | "collected" | "New" | "Completed";
  timestamp: string;
  eventName?: string;
  fulfillmentType?: string;
  deliveryAddress?: {
    houseFlat: string;
    streetArea: string;
    cityTown: string;
    pincode: string;
    landmark?: string;
  } | null;
}

const DEFAULT_ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "2026";

export default function AdminConsolePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [isQueuePaused, setIsQueuePaused] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>("Goa Live Stall");
  const [eventVenue, setEventVenue] = useState<string>("Main Arena");
  const [isEditingEvent, setIsEditingEvent] = useState<boolean>(false);

  const [viewingAddressOrder, setViewingAddressOrder] = useState<LiveOrder | null>(null);
  const [frameModalOrder, setFrameModalOrder] = useState<LiveOrder | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("mm_admin_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }
      const savedName = localStorage.getItem("mm_admin_event_name");
      const savedVenue = localStorage.getItem("mm_admin_event_venue");
      if (savedName) setEventName(savedName);
      if (savedVenue) setEventVenue(savedVenue);
    }
  }, []);

  const handlePinSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (pinInput === DEFAULT_ADMIN_PIN) {
      setIsAuthenticated(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("mm_admin_auth", "true");
      }
      setPinError("");
      setPinInput("");
    } else {
      setPinError("Incorrect PIN. Please try again.");
      setPinInput("");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("mm_admin_auth");
    }
  };

  const fetchOrders = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setIsQueuePaused(Boolean(data.isQueuePaused));

        if (!isEditingEvent && data.event) {
          const savedName = localStorage.getItem("mm_admin_event_name");
          const savedVenue = localStorage.getItem("mm_admin_event_venue");
          if (!savedName && data.event.name) setEventName(data.event.name);
          if (!savedVenue && data.event.venue) setEventVenue(data.event.venue);
        }
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
      const interval = setInterval(fetchOrders, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isEditingEvent]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.token.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.phone.includes(q) ||
        (o.orderId && o.orderId.toLowerCase().includes(q))
    );
  }, [orders, searchQuery]);

  const toggleQueuePause = async () => {
    const nextState = !isQueuePaused;
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "toggle_queue_pause", paused: nextState }),
      });
      if (res.ok) setIsQueuePaused(nextState);
    } catch (err) {
      alert("Could not toggle queue pause status.");
    }
  };

  const saveEventDetails = async () => {
    try {
      localStorage.setItem("mm_admin_event_name", eventName);
      localStorage.setItem("mm_admin_event_venue", eventVenue);

      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "update_event", name: eventName, venue: eventVenue }),
      });
      setIsEditingEvent(false);
    } catch (err) {
      alert("Could not update event details.");
    }
  };

  const updateOrderFrame = async (orderId: string, frameId: string | null) => {
    const targetId = orderId;
    setOrders((prev) =>
      prev.map((o) => (o.id === targetId || o.orderId === targetId ? { ...o, frameId } : o))
    );
    try {
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "update_frame", orderId: targetId, frameId }),
      });
    } catch (err) {
      console.error("Failed saving order frame:", err);
    }
    setFrameModalOrder(null);
  };

  const clearQueueAndReset = async () => {
    const confirmed = window.confirm(
      "⚠️ Are you sure you want to clear the queue?\n\nThis will remove all current orders."
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/orders", { method: "DELETE" });

      if (!res.ok) {
        await Promise.all(
          orders.map((o: LiveOrder) =>
            fetch("/api/orders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: o.id || o.orderId, status: "Completed" }),
            })
          )
        );
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem("mogified-moments-orders");
        localStorage.removeItem("mm_orders");
        localStorage.removeItem("orders");
        sessionStorage.removeItem("mogified-moments-orders");
      }

      setOrders([]);
      setSelectedOrderIds([]);
      alert("Queue cleared successfully!");
      fetchOrders();
    } catch (err) {
      console.error("Queue clear error:", err);
      setOrders([]);
      setSelectedOrderIds([]);
    }
  };

  const updateStatus = async (id: string, status: "pending" | "printed" | "collected") => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));

    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, status }),
      });
      if (!res.ok) {
        throw new Error("Failed to update status on server");
      }
      fetchOrders();
    } catch (err) {
      console.error(err);
      alert("Could not update status.");
      fetchOrders();
    }
  };

  const handleReprint = async (order: LiveOrder) => {
    const reprintToken = `${order.token}-RP`;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...order,
          id: `rp-${Date.now()}`,
          token: reprintToken,
          status: "pending",
        }),
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (err) {
      alert("Failed to create reprint.");
    }
  };

  const sendWhatsAppPickupNotice = (order: LiveOrder) => {
    const cleanPhone = order.phone.replace(/[^0-9]/g, "");
    const intlPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const isDelivery = order.fulfillmentType === "delivery";

    const message = isDelivery
      ? `Hi ${order.customerName}! ✨ Your Mogified Moments keepsake magnet order (${order.token}) is crafted and getting ready for Goa delivery! 📦`
      : `Hi ${order.customerName}! 📸 Your personalised Mogified Moments magnet is ready! Please show token *${order.token}* at the counter to collect. ❤️`;

    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectNext9Ready = () => {
    const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "New");
    const next9 = pendingOrders.slice(0, 9).map((o) => o.id);
    setSelectedOrderIds(next9);
  };

  const printBatchSheet = () => {
    if (selectedOrderIds.length === 0) return;
    window.print();
  };

  const selectedOrdersForPrint = orders.filter((o) => selectedOrderIds.includes(o.id));

  if (!isAuthenticated) {
    return (
      <div className="mm-pin-overlay">
        <AdminStyles />
        <div className="mm-pin-card">
          <img src="/logo.png" alt="Mogified Moments" className="mm-pin-logo" />
          <h2>Operator Login</h2>
          <p>Enter 4-digit PIN to access the Stall &amp; Manufacturing Console.</p>

          <form onSubmit={handlePinSubmit} className="mm-pin-form">
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              autoFocus
            />

            {pinError && <p className="mm-pin-error">{pinError}</p>}

            <button type="submit" className="mm-btn-login">
              Unlock Console →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mm-admin-root">
      <AdminStyles />

      <div className="mm-print-sheet">
        <div className="mm-print-grid">
          {selectedOrdersForPrint.map((order) => {
            const isCircle = JSON.stringify(order || {}).toLowerCase().includes("circle");
            const activeFrame = FRAMES.find((f) => f.id === order.frameId) || null;

            return (
              <div className="mm-print-tile" key={order.id} style={isCircle ? { borderRadius: "50%" } : {}}>
                <div className="mm-bleed-box" style={isCircle ? { borderRadius: "50%" } : {}}>
                  <img src={order.photoUrl} alt="" className="mm-print-img" style={isCircle ? { borderRadius: "50%" } : {}} />
                  {activeFrame && (
                    <img src={activeFrame.src} alt="" className="mm-print-frame" style={isCircle ? { borderRadius: "50%" } : {}} />
                  )}
                  <div className="mm-trim-guide" style={isCircle ? { borderRadius: "50%" } : {}} />
                  <span className="mm-print-token">{order.token}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mm-screen-content">
        <header className="mm-admin-header">
          <div className="mm-header-left">
            <h1>Stall &amp; Delivery Console</h1>
            <p>Live Magnet Manufacturing &amp; Queue Control</p>
          </div>

          <div className="mm-header-actions">
            <button
              type="button"
              className={`mm-action-btn ${isQueuePaused ? "paused" : "pause"}`}
              onClick={toggleQueuePause}
            >
              {isQueuePaused ? "▶️ Resume Queue" : "⏸️ Pause Queue (10 min)"}
            </button>

            <button
              type="button"
              className="mm-action-btn reset"
              onClick={clearQueueAndReset}
            >
              🗑️ Clear Queue / Reset Event
            </button>

            <button
              type="button"
              className="mm-action-btn lock"
              onClick={handleLogout}
              title="Lock Console"
            >
              🔒 Lock
            </button>
          </div>
        </header>

        <div className="mm-event-bar">
          <div className="mm-event-info">
            {isEditingEvent ? (
              <div className="mm-event-inputs">
                <input
                  value={eventName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventName(e.target.value)}
                  placeholder="Event Name"
                />
                <input
                  value={eventVenue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventVenue(e.target.value)}
                  placeholder="Venue Location"
                />
                <button className="mm-btn-save" onClick={saveEventDetails}>
                  Save
                </button>
                <button
                  className="mm-btn-cancel"
                  onClick={() => {
                    const savedName = localStorage.getItem("mm_admin_event_name");
                    const savedVenue = localStorage.getItem("mm_admin_event_venue");
                    if (savedName) setEventName(savedName);
                    if (savedVenue) setEventVenue(savedVenue);
                    setIsEditingEvent(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div>
                <strong>🎪 Active Event: {eventName}</strong>
                <span>📍 {eventVenue}</span>
              </div>
            )}
          </div>

          {!isEditingEvent && (
            <button className="mm-link-btn" onClick={() => setIsEditingEvent(true)}>
              ✏️ Edit Event Details
            </button>
          )}
        </div>

        <div className="mm-toolbar">
          <div className="mm-search-box">
            🔍
            <input
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search Token (#MM-04), Name, or Phone to Duplicate/Reprint..."
            />
          </div>

          <div className="mm-batch-actions">
            <button type="button" className="mm-btn-batch" onClick={selectNext9Ready}>
              ⚡ Select Next 9 Ready
            </button>

            <button
              type="button"
              className="mm-btn-print-batch"
              disabled={selectedOrderIds.length === 0}
              onClick={printBatchSheet}
            >
              🖨️ Print 9-Up A4 Sheet ({selectedOrderIds.length}/9)
            </button>
          </div>
        </div>

        <div className="mm-table-wrapper">
          <table className="mm-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>Select</th>
                <th>Token</th>
                <th>Customer</th>
                <th>Type / Fulfillment</th>
                <th>Preview</th>
                <th>Qty / Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="mm-empty-row">
                    {loading ? "Loading queue..." : "No orders found in queue."}
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isDelivery = order.fulfillmentType === "delivery";
                  const isPorvorim = order.fulfillmentType === "porvorim_pickup";
                  const isSelected = selectedOrderIds.includes(order.id);
                  const isCircle = JSON.stringify(order || {}).toLowerCase().includes("circle");
                  const activeFrame = FRAMES.find((f) => f.id === order.frameId);

                  return (
                    <tr key={order.id} className={isSelected ? "selected-row" : ""}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(order.id)}
                        />
                      </td>

                      <td>
                        <strong className="mm-token-pill">{order.token}</strong>
                        <small className="mm-timestamp">{order.timestamp}</small>
                      </td>

                      <td>
                        <strong>{order.customerName}</strong>
                        <a href={`tel:${order.phone}`} className="mm-phone-link">
                          {order.phone}
                        </a>
                      </td>

                      <td>
                        <div className="mm-fulfillment-tags">
                          {isDelivery ? (
                            <button
                              type="button"
                              className="mm-badge delivery"
                              onClick={() => setViewingAddressOrder(order)}
                            >
                              📦 Goa Delivery ↗
                            </button>
                          ) : isPorvorim ? (
                            <span className="mm-badge porvorim">📍 Porvorim Workshop</span>
                          ) : (
                            <span className="mm-badge stall">🎪 Stall Pickup</span>
                          )}
                          <small>{order.shape || "Square Magnet"}</small>
                          {activeFrame && (
                            <small style={{ color: "#7048d8", fontWeight: "700" }}>Frame: {activeFrame.name}</small>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className={`mm-thumb-frame ${isCircle ? "circle-thumb" : ""}`}>
                          <img src={order.photoUrl} alt="" />
                          {activeFrame && <img src={activeFrame.src} alt="" className="thumb-overlay" />}
                        </div>
                      </td>

                      <td>
                        <strong>{order.quantity} pcs</strong>
                        <span>₹{order.total}</span>
                        <small className="mm-pay-status">{order.paymentMethod.toUpperCase()}</small>
                      </td>

                      <td>
                        <select
                          className={`mm-status-select ${order.status}`}
                          value={
                            order.status === "New"
                              ? "pending"
                              : order.status === "Completed"
                              ? "collected"
                              : order.status
                          }
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            updateStatus(order.id, e.target.value as any)
                          }
                        >
                          <option value="pending">⏳ Pending Print</option>
                          <option value="printed">🖨️ Printed / Packed</option>
                          <option value="collected">✅ Collected / Delivered</option>
                        </select>
                      </td>

                      <td>
                        <div className="mm-row-actions">
                          <button
                            type="button"
                            className="mm-btn-frame"
                            onClick={() => setFrameModalOrder(order)}
                            title="Choose Custom Frame"
                          >
                            🎨 Frame
                          </button>

                          <button
                            type="button"
                            className="mm-btn-wa"
                            onClick={() => sendWhatsAppPickupNotice(order)}
                          >
                            💬 WhatsApp
                          </button>

                          <button
                            type="button"
                            className="mm-btn-rp"
                            onClick={() => handleReprint(order)}
                          >
                            🔁 +1
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
      </div>

      {viewingAddressOrder && (
        <div className="mm-modal-backdrop" onClick={() => setViewingAddressOrder(null)}>
          <div className="mm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mm-modal-header">
              <h3>📦 Delivery Details: {viewingAddressOrder.token}</h3>
              <button onClick={() => setViewingAddressOrder(null)}>×</button>
            </div>
            <div className="mm-modal-body">
              <p><strong>Customer:</strong> {viewingAddressOrder.customerName}</p>
              <p><strong>Phone:</strong> {viewingAddressOrder.phone}</p>
              {viewingAddressOrder.deliveryAddress ? (
                <div className="mm-addr-card">
                  <p>{viewingAddressOrder.deliveryAddress.houseFlat}</p>
                  <p>{viewingAddressOrder.deliveryAddress.streetArea}</p>
                  <p>{viewingAddressOrder.deliveryAddress.cityTown}, Goa - {viewingAddressOrder.deliveryAddress.pincode}</p>
                  {viewingAddressOrder.deliveryAddress.landmark && (
                    <p><small>Landmark: {viewingAddressOrder.deliveryAddress.landmark}</small></p>
                  )}
                </div>
              ) : (
                <p>No address recorded for this order.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {frameModalOrder && (
        <div className="mm-modal-backdrop" onClick={() => setFrameModalOrder(null)}>
          <div className="mm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mm-modal-header">
              <h3>🎨 Assign Custom Frame</h3>
              <button onClick={() => setFrameModalOrder(null)}>×</button>
            </div>
            <div className="mm-modal-body">
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>
                Select an overlay frame template for order <b>{frameModalOrder.token}</b>:
              </p>
              <div className="frame-options-grid">
                <div
                  className={`frame-option-card ${!frameModalOrder.frameId ? "selected" : ""}`}
                  onClick={() => updateOrderFrame(frameModalOrder.id || frameModalOrder.orderId || "", null)}
                >
                  <div className="no-frame-preview">None</div>
                  <span>No Frame</span>
                </div>
                {FRAMES.map((frm) => (
                  <div
                    key={frm.id}
                    className={`frame-option-card ${frameModalOrder.frameId === frm.id ? "selected" : ""}`}
                    onClick={() => updateOrderFrame(frameModalOrder.id || frameModalOrder.orderId || "", frm.id)}
                  >
                    <img src={frm.src} alt={frm.name} />
                    <span>{frm.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminStyles() {
  return (
    <style jsx global>{`
      .mm-admin-root {
        min-height: 100vh;
        background: #f8fafc;
        color: #1e293b;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .mm-screen-content {
        max-width: 1400px;
        margin: 0 auto;
        padding: 24px;
      }
      .mm-pin-overlay {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #faf5ff 0%, #f1f5f9 100%);
        padding: 20px;
      }
      .mm-pin-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        padding: 40px 32px;
        max-width: 400px;
        width: 100%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.06);
      }
      .mm-pin-logo {
        width: 100px;
        height: auto;
        margin: 0 auto 16px;
        display: block;
      }
      .mm-pin-card h2 {
        font-size: 22px;
        font-weight: 800;
        margin: 0 0 8px;
        color: #0f172a;
      }
      .mm-pin-card p {
        font-size: 13px;
        color: #64748b;
        margin: 0 0 24px;
      }
      .mm-pin-form input {
        width: 100%;
        padding: 14px;
        font-size: 24px;
        letter-spacing: 0.35em;
        text-align: center;
        border: 2px solid #cbd5e1;
        border-radius: 14px;
        outline: none;
        margin-bottom: 14px;
      }
      .mm-pin-form input:focus {
        border-color: #6366f1;
      }
      .mm-btn-login {
        width: 100%;
        background: #0f172a;
        color: #fff;
        border: none;
        padding: 14px;
        border-radius: 14px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }
      .mm-pin-error {
        color: #ef4444;
        font-size: 13px;
        font-weight: 700;
        margin: -6px 0 14px;
      }
      .mm-admin-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .mm-header-left h1 {
        font-size: 26px;
        font-weight: 800;
        margin: 0 0 4px;
        color: #0f172a;
      }
      .mm-header-left p {
        margin: 0;
        color: #64748b;
        font-size: 14px;
      }
      .mm-header-actions {
        display: flex;
        gap: 10px;
      }
      .mm-action-btn {
        border: none;
        border-radius: 12px;
        padding: 10px 18px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
      }
      .mm-action-btn.pause {
        background: #fff;
        border: 1.5px solid #cbd5e1;
        color: #334155;
      }
      .mm-action-btn.paused {
        background: #fee2e2;
        border: 1.5px solid #ef4444;
        color: #b91c1c;
      }
      .mm-action-btn.reset {
        background: #fef2f2;
        border: 1.5px solid #fecaca;
        color: #dc2626;
      }
      .mm-action-btn.lock {
        background: #f1f5f9;
        border: 1.5px solid #cbd5e1;
        color: #475569;
      }
      .mm-event-bar {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 12px 18px;
        margin-bottom: 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .mm-event-info strong {
        font-size: 15px;
        display: inline-block;
        margin-right: 12px;
      }
      .mm-event-info span {
        color: #64748b;
        font-size: 14px;
      }
      .mm-event-inputs {
        display: flex;
        gap: 8px;
      }
      .mm-event-inputs input {
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 13px;
      }
      .mm-btn-save {
        background: #0f172a;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 6px 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .mm-btn-cancel {
        background: #f1f5f9;
        border: none;
        border-radius: 8px;
        padding: 6px 14px;
        cursor: pointer;
      }
      .mm-link-btn {
        background: none;
        border: none;
        color: #6366f1;
        font-weight: 700;
        cursor: pointer;
      }
      .mm-toolbar {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .mm-search-box {
        flex: 1;
        background: #fff;
        border: 1.5px solid #e2e8f0;
        border-radius: 12px;
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .mm-search-box input {
        border: none;
        outline: none;
        width: 100%;
        font-size: 14px;
      }
      .mm-batch-actions {
        display: flex;
        gap: 10px;
      }
      .mm-btn-batch {
        background: #e0e7ff;
        color: #4338ca;
        border: none;
        border-radius: 12px;
        padding: 10px 16px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
      }
      .mm-btn-print-batch {
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 12px;
        padding: 10px 18px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
      }
      .mm-btn-print-batch:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .mm-table-wrapper {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        overflow: hidden;
      }
      .mm-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 13px;
      }
      .mm-table th {
        background: #f8fafc;
        padding: 12px 16px;
        font-weight: 700;
        color: #475569;
        border-bottom: 1px solid #e2e8f0;
      }
      .mm-table td {
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }
      .mm-table tr.selected-row {
        background: #f5f3ff;
      }
      .mm-token-pill {
        font-size: 15px;
        color: #4338ca;
        display: block;
      }
      .mm-timestamp {
        color: #94a3b8;
        font-size: 11px;
      }
      .mm-phone-link {
        display: block;
        color: #64748b;
        font-size: 12px;
        text-decoration: none;
      }
      .mm-fulfillment-tags {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .mm-badge {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 800;
        border: none;
        cursor: default;
        text-align: left;
      }
      .mm-badge.delivery {
        background: #e0f2fe;
        color: #0369a1;
        cursor: pointer;
      }
      .mm-badge.porvorim {
        background: #fef3c7;
        color: #b45309;
      }
      .mm-badge.stall {
        background: #f1f5f9;
        color: #475569;
      }
      .mm-thumb-frame {
        width: 52px;
        height: 52px;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #cbd5e1;
        background: #f1f5f9;
        position: relative;
      }
      .mm-thumb-frame.circle-thumb {
        border-radius: 50%;
      }
      .mm-thumb-frame img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .mm-thumb-frame.circle-thumb img {
        border-radius: 50%;
      }
      .thumb-overlay {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        z-index: 5;
      }
      .mm-status-select {
        border-radius: 8px;
        padding: 6px 10px;
        font-weight: 700;
        font-size: 12px;
        border: 1px solid #cbd5e1;
      }
      .mm-status-select.pending {
        background: #fef9c3;
        color: #854d0e;
      }
      .mm-status-select.printed {
        background: #dbeafe;
        color: #1e40af;
      }
      .mm-status-select.collected {
        background: #dcfce7;
        color: #166534;
      }
      .mm-row-actions {
        display: flex;
        gap: 6px;
      }
      .mm-btn-frame {
        background: #f3e8ff;
        color: #7e22ce;
        border: none;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .mm-btn-wa {
        background: #25d366;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .mm-btn-rp {
        background: #f1f5f9;
        color: #334155;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }
      .mm-empty-row {
        text-align: center;
        padding: 40px !important;
        color: #94a3b8;
      }
      .mm-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 16px;
      }
      .mm-modal {
        background: #fff;
        border-radius: 16px;
        max-width: 480px;
        width: 100%;
        padding: 24px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      }
      .mm-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 12px;
        margin-bottom: 16px;
      }
      .mm-modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: #0f172a;
      }
      .mm-modal-header button {
        border: none;
        background: none;
        font-size: 22px;
        cursor: pointer;
      }
      .mm-addr-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px;
        margin-top: 10px;
      }
      .frame-options-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 10px;
        max-height: 320px;
        overflow-y: auto;
        padding: 4px;
      }
      .frame-option-card {
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        padding: 8px;
        text-align: center;
        cursor: pointer;
        background: #f8fafc;
        transition: all 0.15s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .frame-option-card:hover {
        border-color: #cbd5e1;
      }
      .frame-option-card.selected {
        border-color: #7048d8;
        background: #f0ebff;
      }
      .frame-option-card img {
        width: 50px;
        height: 50px;
        object-fit: contain;
        background: #fff;
        border-radius: 6px;
      }
      .no-frame-preview {
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e2e8f0;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
      }
      .frame-option-card span {
        font-size: 11px;
        font-weight: 700;
        color: #334155;
      }
      .mm-print-sheet {
        display: none;
      }
      @media print {
        body, html {
          background: #fff !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .mm-screen-content,
        .mm-modal-backdrop,
        .mm-pin-overlay {
          display: none !important;
        }
        .mm-print-sheet {
          display: block !important;
          width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 auto !important;
          padding: 12mm 14mm !important;
          box-sizing: border-box !important;
        }
        .mm-print-grid {
          display: grid !important;
          grid-template-columns: repeat(3, 61mm) !important;
          grid-auto-rows: 61mm !important;
          gap: 3mm 3mm !important;
          justify-content: center !important;
          align-content: start !important;
        }
        .mm-print-tile {
          width: 61mm !important;
          height: 61mm !important;
          position: relative !important;
          box-sizing: border-box !important;
          page-break-inside: avoid !important;
          border: 0.35mm solid #000000 !important;
          overflow: hidden !important;
        }
        .mm-bleed-box {
          width: 100% !important;
          height: 100% !important;
          position: relative !important;
          overflow: hidden !important;
          background: #ffffff !important;
        }
        .mm-print-img {
          position: absolute !important;
          left: 4.5mm !important;
          top: 4.5mm !important;
          width: 52mm !important;
          height: 52mm !important;
          object-fit: contain !important;
          display: block !important;
        }
        .mm-print-frame {
          position: absolute !important;
          left: 4.5mm !important;
          top: 4.5mm !important;
          width: 52mm !important;
          height: 52mm !important;
          object-fit: contain !important;
          pointer-events: none !important;
          z-index: 5 !important;
        }
        .mm-trim-guide {
          position: absolute !important;
          left: 4.5mm !important;
          top: 4.5mm !important;
          width: 52mm !important;
          height: 52mm !important;
          border: 0.35mm dotted #666666 !important;
          pointer-events: none !important;
          box-sizing: border-box !important;
          z-index: 10 !important;
        }
        .mm-print-token {
          position: absolute !important;
          bottom: 6.5mm !important;
          right: 6.5mm !important;
          color: #333333 !important;
          font-size: 7pt !important;
          font-weight: 900 !important;
          letter-spacing: 0.05em !important;
          z-index: 15 !important;
        }
      }
    `}</style>
  );
}