import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req: Request) {
  if (!db) {
    return NextResponse.json({ success: false, error: "Database not connected" }, { status: 500 });
  }

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const coupons = body.coupons || [];

    if (!Array.isArray(coupons) || coupons.length === 0) {
      return NextResponse.json({ success: false, error: "No coupons provided" }, { status: 400 });
    }

    for (const item of coupons) {
      const code = String(item.code).trim().toUpperCase();
      const ref = doc(db, "coupons", code);

      // Parse percentage vs flat discount
      const isPercent = String(item.title).includes("%");
      const numMatch = String(item.title).match(/\d+/);
      const discountVal = numMatch ? parseInt(numMatch[0], 10) : 50;

      await setDoc(
        ref,
        {
          code,
          discountAmount: discountVal,
          discountType: isPercent ? "percentage" : "flat",
          maxUses: 1,
          timesUsed: 0,
          usedByPhones: [],
          isActive: true,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    return NextResponse.json({ success: true, count: coupons.length });
  } catch (err: any) {
    console.error("Coupon sync error:", err);
    return NextResponse.json({ success: false, error: err?.message || String(err) }, { status: 500 });
  }
}