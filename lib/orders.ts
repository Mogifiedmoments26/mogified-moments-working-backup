import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { type Order, type OrderStatus } from "./order";

const KEY = "mogified-moments-orders";
const COUNTER_KEY = "mogified-moments-counter";

function cleanUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

function makeLightweightOrder(order: any): Order {
  const {
    photoData: _photoData,
    guestPhotoData: _guestPhotoData,
    ...rest
  } = order;

  return cleanUndefinedFields({
    ...rest,
    token: order.token || "",
    packageId: order.packageId || null,
    packagePrice: order.packagePrice ?? null,
    fulfillmentType: order.fulfillmentType || "stall_pickup",
    deliveryAddress: order.deliveryAddress ?? null,
    eventName: order.eventName || "",
    eventDate: order.eventDate || "",
    eventTime: order.eventTime || "",
    eventVenue: order.eventVenue || "",
    advancePaidAmount: order.advancePaidAmount ?? null,
    balanceDueAmount: order.balanceDueAmount ?? null,
    photoUrl: order.photoUrl || "",
    paymentStatus: order.paymentStatus || "Pending",
    paymentMethod: order.paymentMethod || "upi",
    paymentTransactionId: order.paymentTransactionId ?? null,
    paymentUpiId: order.paymentUpiId ?? null,
    isBoosted: order.isBoosted ?? false,
    guestPhotoUrls: (order.guestPhotoUrls || []).filter((url: any) => Boolean(url)),
  }) as unknown as Order;
}

export async function listOrders(): Promise<Order[]> {
  try {
    if (db) {
      const ordersCol = collection(db, "orders");
      const snapshot = await getDocs(ordersCol);
      const orders = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          orderId: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt || new Date().toISOString(),
        } as unknown as Order;
      });

      orders.sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      return orders;
    }
  } catch (err) {
    console.warn("Firestore listOrders failed, checking local backup:", err);
  }

  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getOrder(orderId: string): Promise<Order | null> {
  try {
    if (db) {
      const docRef = doc(db, "orders", orderId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();

        return {
          orderId: snap.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt || new Date().toISOString(),
        } as unknown as Order;
      }
    }
  } catch (err) {
    console.warn("Firestore getOrder fallback:", err);
  }

  const all = await listOrders();
  return all.find((o) => o.orderId === orderId) || null;
}

export async function saveOrder(order: Order): Promise<void> {
  const lightweight = makeLightweightOrder(order);

  try {
    if (db) {
      const docRef = doc(db, "orders", order.orderId);

      await setDoc(docRef, {
        ...lightweight,
        createdAt: lightweight.createdAt || new Date().toISOString(),
        timestamp: serverTimestamp(),
      });

      return;
    }
  } catch (err) {
    console.warn("Firestore saveOrder failed:", err);
  }

  if (typeof window !== "undefined") {
    const existing = await listOrders();

    const updated = [
      lightweight,
      ...existing.filter((o) => o.orderId !== order.orderId),
    ];

    localStorage.setItem(KEY, JSON.stringify(updated));
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  /*
   * Studio runs in the browser.
   *
   * Use the server-side /api/orders PATCH endpoint for status changes
   * instead of attempting a direct browser-side Firestore update.
   *
   * This keeps Studio consistent with the Admin page and prevents the
   * 4-second automatic refresh from restoring the old Firestore status.
   */
  if (typeof window !== "undefined") {
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId,
        status,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));

      throw new Error(
        errorData?.error || "Failed to update order status."
      );
    }

    return;
  }

  /*
   * Preserve direct Firestore behaviour if this helper is ever called
   * from a server-side context.
   */
  try {
    if (db) {
      const docRef = doc(db, "orders", orderId);
      await updateDoc(docRef, { status });
      return;
    }
  } catch (err) {
    console.warn("Firestore updateOrderStatus failed:", err);
    throw err;
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  try {
    if (db) {
      const docRef = doc(db, "orders", orderId);
      await deleteDoc(docRef);
      return;
    }
  } catch (err) {
    console.warn("Firestore deleteOrder failed:", err);
  }

  if (typeof window !== "undefined") {
    const existing = await listOrders();
    const updated = existing.filter((o) => o.orderId !== orderId);
    localStorage.setItem(KEY, JSON.stringify(updated));
  }
}

export async function clearAllOrders(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
  }
}

export async function nextOrderNumber(): Promise<number> {
  try {
    if (db) {
      const counterRef = doc(db, "meta", "orderCounter");

      const nextVal = await runTransaction(db, async (txn) => {
        const snap = await txn.get(counterRef);

        let count = 1;

        if (snap.exists()) {
          count = (snap.data().lastNumber || 0) + 1;
        }

        txn.set(
          counterRef,
          { lastNumber: count },
          { merge: true }
        );

        return count;
      });

      return nextVal;
    }
  } catch (err) {
    console.warn(
      "Firestore order counter failed, using timestamp count:",
      err
    );
  }

  if (typeof window === "undefined") {
    return Date.now() % 10000;
  }

  const current =
    Number(localStorage.getItem(COUNTER_KEY) || "0") + 1;

  localStorage.setItem(
    COUNTER_KEY,
    String(current)
  );

  return current;
}