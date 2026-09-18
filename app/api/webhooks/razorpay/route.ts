import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(bodyText)
        .digest("hex");

      if (expectedSignature !== signature) {
        return NextResponse.json(
          { success: false, error: "Invalid Razorpay webhook signature." },
          { status: 400 }
        );
      }
    }

    const event = JSON.parse(bodyText);

    if (event.event === "payment.captured") {
      const paymentEntity = event.payload.payment.entity;
      console.log(`Payment captured successfully: ${paymentEntity.id} for amount ${paymentEntity.amount}`);
      // Additional fulfillment or order confirmation updates can be placed here if needed.
    }

    return NextResponse.json({ success: true, status: "received" });
  } catch (error: any) {
    console.error("Razorpay webhook error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Webhook handling failed." },
      { status: 500 }
    );
  }
}