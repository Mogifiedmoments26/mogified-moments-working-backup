import { NextResponse } from "next/server";
import { validateCoupon } from "../../../../lib/coupons";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await validateCoupon(String(body.code || ""), String(body.phone || ""));
    return NextResponse.json(result, { status: result.valid ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { valid: false, message: err?.message || "Failed to validate coupon." },
      { status: 500 }
    );
  }
}
