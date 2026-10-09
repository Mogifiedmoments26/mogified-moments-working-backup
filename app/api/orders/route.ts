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
    // BUSINESS CASH-FLOW TRANSACTIONS
    // Stored separately from orders so Clear Queue cannot erase finances.
    // =========================================================
    if (url.searchParams.get("finance") === "1") {
      const transactionsCol = collection(firestore, "businessTransactions");
      const ordersSnapshot = await getDocs(collection(firestore, "orders"));

      // Backfill orders already in the live queue into the separate finance ledger.
      // Stable transaction IDs prevent duplicate entries on repeated refreshes.
      for (const orderDoc of ordersSnapshot.docs) {
        const order = orderDoc.data();
        const token = String(order.token || order.orderId || orderDoc.id);
        const paymentStatus = String(order.paymentStatus || order.payment_state || "").toLowerCase();
        const orderStatus = String(order.status || "").toLowerCase();
        // In this app, paymentStatus may remain "Pending" even after a stall
        // order is paid; "collected" is the actual completed-sale signal.
        const isCollectedSale = ["collected", "completed"].includes(orderStatus);
        const isReprint =
          token.toLowerCase().endsWith("-rp") ||
          String(order.id || "").toLowerCase().startsWith("rp-") ||
          Boolean(order.isReprint);
        const amount = Number(order.total ?? order.totalAmount ?? order.amount ?? 0);

        if (
          isReprint ||
          !Number.isFinite(amount) ||
          amount <= 0 ||
          order.isPaid === false ||
          (["unpaid", "pending", "failed", "cancelled", "canceled"].includes(paymentStatus) &&
            !isCollectedSale)
        ) {
          continue;
        }

        const rawDate = order.createdAt || order.timestamp || order.date || new Date().toISOString();
        const orderDate = rawDate?.toDate
          ? rawDate.toDate().toISOString().slice(0, 10)
          : String(rawDate).slice(0, 10);

        await setDoc(
          doc(firestore, "businessTransactions", `order-${orderDoc.id}`),
          {
            transactionType: "income",
            description: `Order sales — ${token}`,
            category: order.packageId || order.isPartyPackage ? "Party Package" : "Event Sales",
            amount: Math.round(amount * 100) / 100,
            paymentMethod: String(order.paymentMethod || order.paymentType || "Other").trim(),
            eventName: String(order.eventName || order.event || ""),
            date: orderDate,
            source: "order",
            orderDocId: orderDoc.id,
            orderId: String(order.orderId || order.id || orderDoc.id),
            token,
            createdAt: serverTimestamp(),
            createdAtISO: new Date().toISOString(),
            transactionVersion: 1,
          },
          { merge: true }
        );
      }

      const transactionsSnapshot = await getDocs(transactionsCol);
      const transactions = transactionsSnapshot.docs.map((transactionDoc) => {
        const data = transactionDoc.data();
        const createdAt = data.createdAt?.toDate
          ? data.createdAt.toDate().toISOString()
          : typeof data.createdAt === "string"
            ? data.createdAt
            : data.createdAtISO || null;

        return { ...data, id: transactionDoc.id, createdAt };
      });

      transactions.sort((a: any, b: any) => {
        const timeA = new Date(a.date || a.createdAt || 0).getTime();
        const timeB = new Date(b.date || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      return NextResponse.json({ success: true, transactions });
    }

    // =========================================================
    // SAVED EVENT REPORTS
    // Stored separately so clearing the live orders collection
    // cannot remove historical event reports.
    // =========================================================
    if (url.searchParams.get("reports") === "1") {
      const reportsSnapshot = await getDocs(
        collection(firestore, "eventReports")
      );

      const reports = reportsSnapshot.docs.map((reportDoc) => {
        const data = reportDoc.data();
        const savedAt = data.savedAt?.toDate
          ? data.savedAt.toDate().toISOString()
          : typeof data.savedAt === "string"
            ? data.savedAt
            : data.savedAtISO || null;

        return { ...data, id: reportDoc.id, savedAt };
      });

      reports.sort((a: any, b: any) => {
        const timeA = new Date(a.savedAt || a.eventDate || 0).getTime();
        const timeB = new Date(b.savedAt || b.eventDate || 0).getTime();
        return timeB - timeA;
      });

      return NextResponse.json({ success: true, reports });
    }




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
    // SAVE BUSINESS CASH-FLOW TRANSACTION
    // ---------------------------------------------------------
    if (body.type === "save_finance_transaction") {
      const transaction = body.transaction;

      if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
        return NextResponse.json(
          { success: false, error: "A valid financial transaction is required." },
          { status: 400 }
        );
      }

      const transactionType = String(transaction.transactionType || "").trim().toLowerCase();
      const description = String(transaction.description || "").trim();
      const category = String(transaction.category || "").trim();
      const date = String(transaction.date || "").trim();
      const amount = Number(transaction.amount);

      if (!["income", "expense"].includes(transactionType)) {
        return NextResponse.json(
          { success: false, error: "Transaction type must be income or expense." },
          { status: 400 }
        );
      }
      if (!description || !category || !date || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { success: false, error: "Description, category, date and a positive amount are required." },
          { status: 400 }
        );
      }

      const transactionRef = await addDoc(collection(firestore, "businessTransactions"), {
        transactionType,
        description,
        category,
        date,
        amount: Math.round(amount * 100) / 100,
        paymentMethod: String(transaction.paymentMethod || "Other").trim(),
        eventName: String(transaction.eventName || "").trim(),
        notes: String(transaction.notes || "").trim(),
        createdAt: serverTimestamp(),
        createdAtISO: new Date().toISOString(),
        transactionVersion: 1,
      });

      return NextResponse.json({ success: true, transactionId: transactionRef.id });
    }


    // ---------------------------------------------------------
    // SAVE EVENT REPORT
    // ---------------------------------------------------------
    if (body.type === "save_event_report") {
      const report = body.report;

      if (!report || typeof report !== "object" || Array.isArray(report)) {
        return NextResponse.json(
          { success: false, error: "A valid event report is required." },
          { status: 400 }
        );
      }

      const eventName = String(report.eventName || "").trim();
      const venue = String(report.venue || "").trim();
      if (!eventName || !venue) {
        return NextResponse.json(
          { success: false, error: "Event name and venue are required." },
          { status: 400 }
        );
      }

      const reportRef = await addDoc(collection(firestore, "eventReports"), {
        ...report,
        eventName,
        venue,
        reportVersion: 1,
        savedAt: serverTimestamp(),
        savedAtISO: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, reportId: reportRef.id });
    }




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