import { type ProductId } from "./products";

export type FulfillmentType = "stall_pickup" | "delivery" | "porvorim_pickup";

export type OrderStatus = "New" | "Processing" | "Ready" | "Completed";

export interface DeliveryAddress {
  houseFlat: string;
  streetArea: string;
  cityTown: string;
  pincode: string;
  landmark?: string;
  state: string;
}

export interface CropState {
  x: number;
  y: number;
  zoom: number;
}

export interface Order {
  orderId: string;
  batchId?: string;
  token?: string;
  customerName: string;
  phone: string;
  productId: ProductId;
  productName: string;
  shape: "square" | "circle" | "keychain";
  quantity: number;
  unitPrice: number;
  total: number;
  status: OrderStatus;
  createdAt: string;

  // Photo & Frame properties
  photoUrl: string;
  originalPhotoUrl?: string;
  frameId?: string | null;
  frameName?: string | null;
  appliedFrameId?: string | null;
  crop?: CropState;
  photoData?: string;
  guestPhotoData?: string | string[] | any[];
  guestPhotoUrls?: string[];
  photoBackUrl?: string;
  keychainStrap?: "leather" | "pearl" | "mix";
  customWatermark?: string;
  isBoosted?: boolean;

  // Fulfillment details
  fulfillmentType?: FulfillmentType;
  deliveryFee?: number;
  deliveryAddress?: DeliveryAddress | null;
  isGiftWrap?: boolean;

  // Payment details
  paymentMethod?: "upi" | "cash";
  paymentStatus?: "Paid" | "Pending" | "Advance Paid";
  paymentTransactionId?: string | null;
  paymentUpiId?: string | null;
  promoCodeUsed?: string | null;

  // Celebration & Party Package details
  packageId?: string | null;
  packagePrice?: number;
  advancePaidAmount?: number | null;
  balanceDueAmount?: number | null;
  eventName?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  eventVenue?: string | null;
}

export function makeOrderId(sequenceNumber: number): string {
  const padded = String(sequenceNumber).padStart(4, "0");
  return `MM-${padded}`;
}

export const PRODUCT_SPECS = {
  square: {
    name: '2" Square Magnet',
    visibleSize: "52mm x 52mm",
    wrapSize: "61mm x 61mm",
    aspectRatio: 1,
  },
  circle: {
    name: "59mm Circle Magnet",
    visibleSize: "59mm diameter",
    wrapSize: "71mm diameter",
    aspectRatio: 1,
  },
  keychain: {
    name: "36mm Photo Keychain",
    visibleSize: "36mm x 36mm",
    wrapSize: "36mm x 36mm",
    aspectRatio: 1,
  },
};