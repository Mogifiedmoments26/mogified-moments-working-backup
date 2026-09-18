export type ProductId = "square" | "circle" | "keychain";

export interface ProductSpec {
  id: ProductId;
  name: string;
  shape: "square" | "circle" | "keychain";
  dimensions: string;
  visibleArea: string;
  bleedArea: string;
  description: string;
}

export const PRODUCTS: Record<ProductId, ProductSpec> = {
  square: {
    id: "square",
    name: '2" Square Magnet',
    shape: "square",
    dimensions: "52mm x 52mm",
    visibleArea: "52mm x 52mm",
    bleedArea: "61mm x 61mm",
    description: "Classic 52mm x 52mm square keepsake magnet with 4.5mm bleed on all sides.",
  },
  circle: {
    id: "circle",
    name: "59mm Circle Magnet",
    shape: "circle",
    dimensions: "59mm diameter",
    visibleArea: "59mm diameter",
    bleedArea: "71mm diameter",
    description: "59mm round keepsake magnet with 6mm bleed on all sides.",
  },
  keychain: {
    id: "keychain",
    name: "36mm Photo Keychain",
    shape: "keychain",
    dimensions: "36mm x 36mm",
    visibleArea: "36mm x 36mm",
    bleedArea: "36mm x 36mm",
    description: "36mm photo keychain with separate front and back photos.",
  },
};

export function calculateCartPrice(totalQty: number): {
  basePrice: number;
  unitPrice: number;
  finalPrice: number;
  discount: number;
} {
  if (totalQty <= 0) {
    return { basePrice: 0, unitPrice: 150, finalPrice: 0, discount: 0 };
  }

  let unitPrice = 150;
  if (totalQty >= 10) {
    unitPrice = 125;
  } else if (totalQty >= 5) {
    unitPrice = 135;
  } else if (totalQty >= 3) {
    unitPrice = 145;
  }

  const finalPrice = unitPrice * totalQty;
  const basePrice = 150 * totalQty;
  const discount = basePrice - finalPrice;

  return {
    basePrice,
    unitPrice,
    finalPrice,
    discount,
  };
}

export function isGoaPincode(pincode: string): boolean {
  const clean = pincode.replace(/\D/g, "");
  return /^403\d{3}$/.test(clean);
}
