import type { Order } from "./order";

export const ADMIN_WHATSAPP_PHONE = "919529180815";

export function generateAdminWhatsAppUrl(order: Order): string {
  const isParty = Boolean(order.packageId);
  const isDelivery = order.fulfillmentType === "delivery";

  let lines: string[] = [
    `🚨 *NEW MOGIFIED ORDER: ${order.token || order.orderId}*`,
    `👤 *Customer:* ${order.customerName} (${order.phone})`,
    `📦 *Item:* ${order.productName} (Qty: ${order.quantity})`,
    `💰 *Total:* ₹${order.total} | *Status:* ${order.paymentStatus}`,
  ];

  if (isParty) {
    lines.push(
      `🎉 *Event:* ${order.eventName || "Party Celebration"}`,
      `📍 *Venue:* ${order.eventVenue || "TBD"}`,
      `📅 *Date/Time:* ${order.eventDate || ""} ${order.eventTime || ""}`,
      `💵 *Advance Paid:* ₹${order.advancePaidAmount || 0} (Balance Due: ₹${order.balanceDueAmount || 0})`
    );
  }

  if (isDelivery && order.deliveryAddress) {
    const addr = order.deliveryAddress;
    lines.push(
      `🚚 *GOA DELIVERY ADDRESS:*`,
      `${addr.houseFlat}, ${addr.streetArea}`,
      `${addr.cityTown}, Goa - ${addr.pincode}`,
      addr.landmark ? `Landmark: ${addr.landmark}` : ""
    );
  }

  if (order.photoUrl) {
    lines.push(`🖼️ *Print Photo URL:* ${order.photoUrl}`);
  }

  const text = encodeURIComponent(lines.filter(Boolean).join("\n"));
  return `https://wa.me/${ADMIN_WHATSAPP_PHONE}?text=${text}`;
}