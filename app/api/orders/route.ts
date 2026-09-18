import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { validateAndRedeemCoupon } from "../../../lib/coupons";

export const dynamic = "force-dynamic";

/**
 * Resolve an order reference safely.
 *
 * Supported values:
 * 1. Actual Firestore document ID
 * 2. Stored application orderId
 * 3. Visible token, e.g. MM-0033
 */
async function resolveOrderRef(
  firestore: any,
  suppliedOrderId: string
) {
  const cleanId = String(
    suppliedOrderId || ""
  ).trim();

  if (!cleanId) {
    throw new Error(
      "No order ID was provided."
    );
  }

  const ordersCol = collection(
    firestore,
    "orders"
  );

  // ---------------------------------------------------------
  // 1. Try actual Firestore document ID
  // ---------------------------------------------------------
  const directRef = doc(
    firestore,
    "orders",
    cleanId
  );

  const directSnap = await getDoc(
    directRef
  );

  if (directSnap.exists()) {
    return directRef;
  }

  // ---------------------------------------------------------
  // 2. Try stored orderId field
  // ---------------------------------------------------------
  try {
    const orderIdQuery = query(
      ordersCol,
      where("orderId", "==", cleanId)
    );

    const orderIdSnapshot =
      await getDocs(orderIdQuery);

    if (!orderIdSnapshot.empty) {
      return orderIdSnapshot.docs[0].ref;
    }
  } catch (err) {
    console.warn(
      "Could not query orders by orderId field:",
      err
    );
  }

  // ---------------------------------------------------------
  // 3. Try visible token
  // ---------------------------------------------------------
  try {
    const tokenQuery = query(
      ordersCol,
      where("token", "==", cleanId)
    );

    const tokenSnapshot =
      await getDocs(tokenQuery);

    if (!tokenSnapshot.empty) {
      return tokenSnapshot.docs[0].ref;
    }
  } catch (err) {
    console.warn(
      "Could not query orders by token field:",
      err
    );
  }

  throw new Error(
    `Order "${cleanId}" could not be found in Firestore.`
  );
}

/**
 * Convert Firestore timestamps into JSON-safe strings.
 */
function serializeOrder(
  docSnap: any
) {
  const data =
    docSnap.data();

  let createdAtStr =
    new Date().toISOString();

  if (
    data.createdAt?.toDate
  ) {
    createdAtStr =
      data.createdAt
        .toDate()
        .toISOString();
  } else if (
    typeof data.createdAt ===
    "string"
  ) {
    createdAtStr =
      data.createdAt;
  } else if (
    data.timestamp?.toDate
  ) {
    createdAtStr =
      data.timestamp
        .toDate()
        .toISOString();
  }

  return {
    ...data,

    /*
     * IMPORTANT:
     *
     * Preserve the application's own orderId.
     * Do NOT overwrite it with the Firestore ID.
     */
    orderId:
      data.orderId ||
      docSnap.id,

    // Actual Firestore document ID
    id: docSnap.id,

    // Explicit Firestore ID for clarity
    firestoreId: docSnap.id,

    createdAt:
      createdAtStr,

    timestamp:
      createdAtStr,
  };
}

export async function GET(
  req: Request
) {
  try {
    if (!db) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Database not connected",
        },
        { status: 500 }
      );
    }

    const firestore = db;

    const url =
      new URL(req.url);

    const requestedOrderId =
      url.searchParams
        .get("orderId")
        ?.trim() || "";

    // =========================================================
    // SPECIFIC ORDER REQUEST
    //
    // Used by the Guest page.
    //
    // This prevents the Guest page from downloading every
    // order in Firestore.
    // =========================================================
    if (requestedOrderId) {
      const orderRef =
        await resolveOrderRef(
          firestore,
          requestedOrderId
        );

      const orderSnap =
        await getDoc(orderRef);

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
        serializeOrder(
          orderSnap
        );

      return NextResponse.json({
        success: true,
        order,
      });
    }

    // =========================================================
    // NORMAL ALL-ORDERS REQUEST
    //
    // Used by Studio/Admin.
    // =========================================================
    const ordersCol =
      collection(
        firestore,
        "orders"
      );

    const snapshot =
      await getDocs(
        ordersCol
      );

    const orders =
      snapshot.docs.map(
        (docSnap) =>
          serializeOrder(
            docSnap
          )
      );

    orders.sort(
      (a: any, b: any) => {
        const timeA =
          new Date(
            a.createdAt || 0
          ).getTime();

        const timeB =
          new Date(
            b.createdAt || 0
          ).getTime();

        return timeB - timeA;
      }
    );

    // ---------------------------------------------------------
    // QUEUE / EVENT CONFIG
    // ---------------------------------------------------------
    let isQueuePaused =
      false;

    let event = {
      name: "Goa Live Stall",
      venue: "Main Arena",
    };

    try {
      const configRef =
        doc(
          firestore,
          "appConfig",
          "main"
        );

      const configSnap =
        await getDoc(
          configRef
        );

      if (
        configSnap.exists()
      ) {
        const config =
          configSnap.data();

        if (
          typeof config.queuePausedUntil ===
          "number"
        ) {
          isQueuePaused =
            config.queuePausedUntil >
            Date.now();
        }

        if (config.event) {
          event = {
            name:
              config.event.name ||
              event.name,

            venue:
              config.event.venue ||
              event.venue,
          };
        }
      }
    } catch (configError) {
      console.error(
        "Could not load app configuration:",
        configError
      );
    }

    return NextResponse.json({
      success: true,
      orders,
      isQueuePaused,
      event,
    });
  } catch (err: any) {
    console.error(
      "Fetch orders error:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err?.message ||
          "Failed to fetch orders",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request
) {
  try {
    if (!db) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Database not connected",
        },
        { status: 500 }
      );
    }

    const firestore = db;

    const body =
      await req.json();

    // ---------------------------------------------------------
    // COUPON VALIDATION
    // ---------------------------------------------------------
    if (body.promoCodeUsed) {
      const cleanCoupon =
        String(
          body.promoCodeUsed
        )
          .trim()
          .toUpperCase();

      const couponResult =
        await validateAndRedeemCoupon(
          cleanCoupon,
          body.phone || ""
        );

      if (!couponResult.valid) {
        return NextResponse.json(
          {
            success: false,
            error:
              couponResult.message,
          },
          { status: 409 }
        );
      }
    }

    const ordersCol =
      collection(
        firestore,
        "orders"
      );

    const docRef =
      await addDoc(
        ordersCol,
        {
          ...body,

          createdAt:
            body.createdAt ||
            new Date().toISOString(),

          timestamp:
            serverTimestamp(),
        }
      );

    return NextResponse.json({
      success: true,
      orderId: docRef.id,
      id: docRef.id,
    });
  } catch (err: any) {
    console.error(
      "Order creation error:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err?.message ||
          "Failed to create order",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request
) {
  try {
    if (!db) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Database not connected",
        },
        { status: 500 }
      );
    }

    const firestore = db;

    const body =
      await req.json();

    // ---------------------------------------------------------
    // QUEUE PAUSE
    // ---------------------------------------------------------
    if (
      body.type ===
      "toggle_queue_pause"
    ) {
      const paused =
        Boolean(body.paused);

      const configRef =
        doc(
          firestore,
          "appConfig",
          "main"
        );

      await setDoc(
        configRef,
        {
          queuePausedUntil:
            paused
              ? Date.now() +
                10 * 60 * 1000
              : null,
        },
        {
          merge: true,
        }
      );

      return NextResponse.json({
        success: true,
        isQueuePaused:
          paused,
      });
    }

    // ---------------------------------------------------------
    // EVENT DETAILS
    // ---------------------------------------------------------
    if (
      body.type ===
      "update_event"
    ) {
      const configRef =
        doc(
          firestore,
          "appConfig",
          "main"
        );

      await setDoc(
        configRef,
        {
          event: {
            name: String(
              body.name ||
                "Goa Live Stall"
            ),

            venue: String(
              body.venue ||
                "Main Arena"
            ),
          },
        },
        {
          merge: true,
        }
      );

      return NextResponse.json({
        success: true,

        event: {
          name: String(
            body.name ||
              "Goa Live Stall"
          ),

          venue: String(
            body.venue ||
              "Main Arena"
          ),
        },
      });
    }

    // ---------------------------------------------------------
    // UPDATE PARTY FRAME
    // ---------------------------------------------------------
    if (
      body.type ===
        "update_frame" &&
      body.orderId
    ) {
      const orderRef =
        await resolveOrderRef(
          firestore,
          String(
            body.orderId
          )
        );

      const frameId =
        body.frameId !==
        undefined
          ? body.frameId
          : null;

      await updateDoc(
        orderRef,
        {
          frameId,
        }
      );

      return NextResponse.json({
        success: true,
        orderId:
          body.orderId,
        frameId,
      });
    }

    // ---------------------------------------------------------
    // UPDATE PHOTO COMPLETION
    // ---------------------------------------------------------
    if (
      body.type ===
        "update_photo_completion" &&
      body.orderId
    ) {
      const orderRef =
        await resolveOrderRef(
          firestore,
          String(
            body.orderId
          )
        );

      const completedPhotoIndices =
        body.completedPhotoIndices ||
        [];

      await updateDoc(
        orderRef,
        {
          completedPhotoIndices,
        }
      );

      return NextResponse.json({
        success: true,

        orderId:
          body.orderId,

        completedPhotoIndices,
      });
    }

    // ---------------------------------------------------------
    // UPDATE ORDER STATUS
    // ---------------------------------------------------------
    if (
      body.orderId &&
      body.status
    ) {
      const orderRef =
        await resolveOrderRef(
          firestore,
          String(
            body.orderId
          )
        );

      await updateDoc(
        orderRef,
        {
          status:
            body.status,
        }
      );

      return NextResponse.json({
        success: true,

        orderId:
          body.orderId,

        status:
          body.status,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid PATCH request",
      },
      { status: 400 }
    );
  } catch (err: any) {
    console.error(
      "PATCH orders error:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err?.message ||
          "Failed to update orders",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request
) {
  try {
    if (!db) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Database not connected",
        },
        { status: 500 }
      );
    }

    const firestore = db;

    const url =
      new URL(req.url);

    const orderId =
      url.searchParams.get(
        "orderId"
      );

    if (orderId) {
      const orderRef =
        await resolveOrderRef(
          firestore,
          orderId
        );

      await deleteDoc(
        orderRef
      );

      return NextResponse.json({
        success: true,
        deleted:
          orderId,
      });
    }

    const ordersCol =
      collection(
        firestore,
        "orders"
      );

    const snapshot =
      await getDocs(
        ordersCol
      );

    const deletePromises =
      snapshot.docs.map(
        (docSnap) =>
          deleteDoc(
            doc(
              firestore,
              "orders",
              docSnap.id
            )
          )
      );

    await Promise.all(
      deletePromises
    );

    return NextResponse.json({
      success: true,
      clearedCount:
        snapshot.docs.length,
    });
  } catch (err: any) {
    console.error(
      "Delete orders error:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err?.message ||
          "Failed to delete",
      },
      { status: 500 }
    );
  }
}