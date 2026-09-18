import { db } from "./firebase";
import { doc, getDoc, runTransaction } from "firebase/firestore";

export interface CouponValidationResult {
  valid: boolean;
  message: string;
  discountAmount?: number;
  discountType?: "flat" | "percentage";
}

export async function validateCoupon(
  code: string,
  customerPhone: string
): Promise<CouponValidationResult> {
  if (!db) return { valid: false, message: "Database connection unavailable." };

  const cleanCode = code.trim().toUpperCase();
  const cleanPhone = customerPhone.replace(/\D/g, "");
  if (!cleanCode) return { valid: false, message: "Please enter a valid coupon code." };
  if (!cleanPhone) return { valid: false, message: "A valid mobile number is required to redeem coupons." };

  try {
    const snap = await getDoc(doc(db, "coupons", cleanCode));
    if (!snap.exists()) return { valid: false, message: "Invalid coupon code." };
    const data = snap.data();
    if (data.isActive === false) return { valid: false, message: "This coupon is no longer active." };

    const usedPhones: string[] = data.usedByPhones || [];
    const currentUses: number = data.timesUsed ?? 0;
    if (usedPhones.includes(cleanPhone)) {
      return { valid: false, message: "This coupon has already been redeemed by this phone number." };
    }
    if (currentUses >= 1) {
      return { valid: false, message: "This coupon has reached its maximum redemptions." };
    }

    return {
      valid: true,
      message: "Coupon is valid.",
      discountAmount: data.discountAmount ?? 50,
      discountType: data.discountType ?? "flat",
    };
  } catch (err: any) {
    console.error("Coupon validation error:", err);
    return { valid: false, message: err?.message || "Failed to validate coupon." };
  }
}

/** Atomically checks and consumes a coupon. It can never be consumed twice. */
export async function validateAndRedeemCoupon(
  code: string,
  customerPhone: string
): Promise<CouponValidationResult> {
  if (!db) return { valid: false, message: "Database connection unavailable." };

  const cleanCode = code.trim().toUpperCase();
  const cleanPhone = customerPhone.replace(/\D/g, "");
  if (!cleanCode) return { valid: false, message: "Please enter a valid coupon code." };
  if (!cleanPhone) return { valid: false, message: "A valid mobile number is required to redeem coupons." };

  try {
    return await runTransaction(db, async (transaction) => {
      const couponRef = doc(db!, "coupons", cleanCode);
      const snap = await transaction.get(couponRef);
      if (!snap.exists()) return { valid: false, message: "Invalid coupon code." };

      const data = snap.data();
      if (data.isActive === false) return { valid: false, message: "This coupon is no longer active." };

      const usedPhones: string[] = data.usedByPhones || [];
      const currentUses: number = data.timesUsed ?? 0;

      if (usedPhones.includes(cleanPhone)) {
        return { valid: false, message: "This coupon has already been redeemed by this phone number." };
      }
      if (currentUses >= 1) {
        return { valid: false, message: "This coupon has reached its maximum redemptions." };
      }

      transaction.update(couponRef, {
        timesUsed: currentUses + 1,
        usedByPhones: [...usedPhones, cleanPhone],
      });

      return {
        valid: true,
        message: "Coupon applied successfully!",
        discountAmount: data.discountAmount ?? 50,
        discountType: data.discountType ?? "flat",
      };
    });
  } catch (err: any) {
    console.error("Coupon redemption error:", err);
    return { valid: false, message: err?.message || "Failed to redeem coupon." };
  }
}
