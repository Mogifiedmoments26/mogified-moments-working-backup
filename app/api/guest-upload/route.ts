import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

export const dynamic = "force-dynamic";

type GuestUploadBody = {
  partyOrderId?: string;
  guestName?: string;
  photoData?: string;
  rawPhotoData?: string;
};

/*
 * Resolve the party order using:
 *
 * 1. Firestore document ID
 * 2. Stored orderId
 * 3. Token
 */
async function resolveOrderRef(
  suppliedOrderId: string
) {
  if (!db) {
    throw new Error("Database not connected.");
  }

  const cleanId = String(
    suppliedOrderId || ""
  ).trim();

  if (!cleanId) {
    throw new Error(
      "No party order ID was provided."
    );
  }

  const ordersCol = collection(db, "orders");

  /*
   * 1. Try the Firestore document ID directly.
   */
  const directRef = doc(
    db,
    "orders",
    cleanId
  );

  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    return directRef;
  }

  /*
   * 2. Try the stored orderId field.
   */
  const orderIdSnapshot = await getDocs(
    query(
      ordersCol,
      where("orderId", "==", cleanId)
    )
  );

  if (!orderIdSnapshot.empty) {
    return orderIdSnapshot.docs[0].ref;
  }

  /*
   * 3. Try token for compatibility with
   * existing party orders.
   */
  const tokenSnapshot = await getDocs(
    query(
      ordersCol,
      where("token", "==", cleanId)
    )
  );

  if (!tokenSnapshot.empty) {
    return tokenSnapshot.docs[0].ref;
  }

  throw new Error(
    `Party order "${cleanId}" could not be found.`
  );
}

export async function POST(req: Request) {
  try {
    if (!db) {
      return NextResponse.json(
        {
          success: false,
          error: "Database not connected.",
        },
        { status: 500 }
      );
    }

    let body: GuestUploadBody;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data.",
        },
        { status: 400 }
      );
    }

    const partyOrderId = String(
      body.partyOrderId || ""
    ).trim();

    const guestName = String(
      body.guestName || ""
    ).trim();

    const photoData = String(
      body.photoData || ""
    ).trim();

    const rawPhotoData = String(
      body.rawPhotoData || ""
    ).trim();

    if (!partyOrderId) {
      return NextResponse.json(
        {
          success: false,
          error: "Party order ID is missing.",
        },
        { status: 400 }
      );
    }

    if (!guestName) {
      return NextResponse.json(
        {
          success: false,
          error: "Guest name is required.",
        },
        { status: 400 }
      );
    }

    if (!photoData) {
      return NextResponse.json(
        {
          success: false,
          error: "Photo data is missing.",
        },
        { status: 400 }
      );
    }

    /*
     * IMPORTANT:
     *
     * photoData and rawPhotoData must now be Firebase
     * Storage URLs.
     *
     * We deliberately do NOT store base64 image data
     * in Firestore because Firestore documents have
     * a maximum size of 1 MiB.
     */
    if (
      photoData.startsWith("data:image/")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The photo was sent in the wrong format. Please upload again.",
        },
        { status: 400 }
      );
    }

    if (
      rawPhotoData &&
      rawPhotoData.startsWith("data:image/")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The original photo was sent in the wrong format. Please upload again.",
        },
        { status: 400 }
      );
    }

    const orderRef =
      await resolveOrderRef(partyOrderId);

    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Party order could not be found.",
        },
        { status: 404 }
      );
    }

    const order =
      orderSnap.data() as Record<string, any>;

    /*
     * Existing guest photo URLs.
     *
     * These are URLs only — not image data.
     */
    const existingGuestPhotoUrls =
      Array.isArray(order.guestPhotoUrls)
        ? order.guestPhotoUrls
        : [];

    const existingGuestPhotoNames =
      Array.isArray(order.guestPhotoNames)
        ? order.guestPhotoNames
        : [];

    const updatedGuestPhotoUrls = [
      ...existingGuestPhotoUrls,
      photoData,
    ];

    const updatedGuestPhotoNames = [
      ...existingGuestPhotoNames,
      guestName,
    ];

    const updateData: Record<
      string,
      any
    > = {
      guestPhotoUrls:
        updatedGuestPhotoUrls,

      guestPhotoNames:
        updatedGuestPhotoNames,

      guestPhotoCount:
        updatedGuestPhotoUrls.length,

      updatedAt:
        new Date().toISOString(),
    };

    /*
     * Store the original-photo Storage URL
     * separately when provided.
     */
    if (rawPhotoData) {
      const existingRawPhotoUrls =
        Array.isArray(
          order.guestRawPhotoUrls
        )
          ? order.guestRawPhotoUrls
          : [];

      updateData.guestRawPhotoUrls = [
        ...existingRawPhotoUrls,
        rawPhotoData,
      ];
    }

    /*
     * Only small URL strings and guest information
     * are written to Firestore.
     */
    await updateDoc(
      orderRef,
      updateData
    );

    return NextResponse.json({
      success: true,
      partyOrderId,
      guestName,
      guestPhotoCount:
        updatedGuestPhotoUrls.length,
    });
  } catch (err: any) {
    console.error(
      "Guest upload error:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err?.message ||
          "Could not add the guest photo to the printing queue.",
      },
      { status: 500 }
    );
  }
}