import { NextResponse } from "next/server";
import { listOrders } from "../../../lib/orders";

// IMPORTANT:
// Availability must always use the latest order data.
// Do not allow Next.js or any intermediary to cache this route.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventDate = url.searchParams.get("date")?.trim();

    const existingOrders = await listOrders();

    // Only active Party Package orders block event dates.
    const activePackageOrders = existingOrders.filter((o: any) => {
      const isPackage = Boolean(o.packageId);

      const status = String(o.status || "")
        .trim()
        .toLowerCase();

      const isActive =
        status !== "completed" &&
        status !== "cancelled";

      return isPackage && isActive;
    });

    // When no date is supplied, return ALL currently
    // booked Party Package dates.
    if (!eventDate) {
      const bookedDates = [
        ...new Set(
          activePackageOrders
            .map((o: any) => String(o.eventDate || "").trim())
            .filter(Boolean)
        ),
      ];

      return NextResponse.json(
        {
          success: true,
          bookedDates,
        },
        {
          headers: {
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );
    }

    // Single-date availability check.
    const isBooked = activePackageOrders.some((o: any) => {
      const orderDate = String(o.eventDate || "").trim();
      return orderDate === eventDate;
    });

    return NextResponse.json(
      {
        success: true,
        date: eventDate,
        available: !isBooked,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Date availability check error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check availability.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}