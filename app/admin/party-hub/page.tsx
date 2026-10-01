"use client";

import React, { useEffect, useRef, useState } from "react";
import { Brand } from "../../../components/Brand";
import { listOrders } from "../../../lib/orders";
import { db, firebaseConfigured } from "../../../lib/firebase";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { savePhoto } from "../../../lib/storage";

const loadRazorpayScript = () => {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
};

type PaymentMethod = "cash" | "upi";

export default function PartyHubPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [
    selectedPhotoMap,
    setSelectedPhotoMap,
  ] = useState<{
    [orderId: string]: number[];
  }>({});

  const [
    brightnessAdjustments,
    setBrightnessAdjustments,
  ] = useState<{
    [photoKey: string]: number;
  }>({});

  function getPhotoBrightness(
    orderId: string,
    photoIndex: number
  ) {
    return (
      brightnessAdjustments[
        `${orderId}-${photoIndex}`
      ] ?? 100
    );
  }

  function setPhotoBrightness(
    orderId: string,
    photoIndex: number,
    value: number
  ) {
    const nextValue = Math.max(
      70,
      Math.min(130, Math.round(value))
    );

    setBrightnessAdjustments(
      (current) => ({
        ...current,
        [`${orderId}-${photoIndex}`]:
          nextValue,
      })
    );
  }

  const [
    frameUploading,
    setFrameUploading,
  ] = useState<string | null>(null);

  const [
    backgroundUploading,
    setBackgroundUploading,
  ] = useState<string | null>(null);

  const [
    keychainBackUploading,
    setKeychainBackUploading,
  ] = useState<string | null>(null);

  const [
    paymentOrder,
    setPaymentOrder,
  ] = useState<any | null>(null);

  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    useState<PaymentMethod>("cash");

  const [
    paymentBusy,
    setPaymentBusy,
  ] = useState(false);

  const [
    photoDownloadBusy,
    setPhotoDownloadBusy,
  ] = useState<string | null>(null);

  const [
    printBusyOrderId,
    setPrintBusyOrderId,
  ] = useState<string | null>(null);

  const frameInputRefs =
    useRef<{
      [orderId: string]: HTMLInputElement | null;
    }>({});

  const backgroundInputRefs =
    useRef<{
      [orderId: string]: HTMLInputElement | null;
    }>({});

  const keychainBackInputRefs =
    useRef<{
      [orderId: string]: HTMLInputElement | null;
    }>({});

  const [
    editedPhotoUploading,
    setEditedPhotoUploading,
  ] = useState<string | null>(null);

  const editedPhotoInputRefs =
    useRef<{
      [orderId: string]: HTMLInputElement | null;
    }>({});

  async function fetchPartyOrders() {
    try {
      const allOrders = await listOrders();

      const parties = allOrders.filter(
        (o: any) => Boolean(o.packageId)
      );

      setOrders(parties);
    } catch (err) {
      console.error(
        "Failed loading party packages:",
        err
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPartyOrders();

    const interval = setInterval(
      fetchPartyOrders,
      6000
    );

    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------
  // PHOTO COMPLETION
  // ---------------------------------------------------------

  async function togglePhotoDone(
    orderId: string,
    photoIndex: number
  ) {
    const targetOrder = orders.find(
      (o) => o.orderId === orderId
    );

    if (!targetOrder) return;

    const currentDone =
      Array.isArray(
        targetOrder.completedPhotoIndices
      )
        ? targetOrder.completedPhotoIndices
        : [];

    const updatedDone =
      currentDone.includes(photoIndex)
        ? currentDone.filter(
            (idx: number) =>
              idx !== photoIndex
          )
        : [
            ...currentDone,
            photoIndex,
          ];

    setOrders((prev) =>
      prev.map((o) =>
        o.orderId === orderId
          ? {
              ...o,
              completedPhotoIndices:
                updatedDone,
            }
          : o
      )
    );

    try {
      const res = await fetch(
        "/api/orders",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            type:
              "update_photo_completion",
            orderId,
            completedPhotoIndices:
              updatedDone,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          "Could not save photo status."
        );
      }
    } catch (err) {
      console.error(
        "Failed saving photo completion status:",
        err
      );

      fetchPartyOrders();
    }
  }

  function toggleSelectPhoto(
    orderId: string,
    photoIndex: number
  ) {
    setSelectedPhotoMap((prev) => {
      const currentSelected =
        prev[orderId] || [];

      const updated =
        currentSelected.includes(
          photoIndex
        )
          ? currentSelected.filter(
              (i) => i !== photoIndex
            )
          : [
              ...currentSelected,
              photoIndex,
            ];

      return {
        ...prev,
        [orderId]: updated,
      };
    });
  }

  // ---------------------------------------------------------
  // PRINT HOST QR
  // ---------------------------------------------------------

  function handlePrintHostQR(order: any) {
    const printWindow = window.open("", "_blank", "width=800,height=900");

    if (!printWindow) {
      alert("Please allow popups to open the host QR card.");
      return;
    }

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://mogifiedmoments.com";

    const guestLink = `${origin}/guest?orderId=${encodeURIComponent(
      order.orderId || ""
    )}`;

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
      guestLink
    )}&margin=8`;

    const eventName = order.eventName || "Your Celebration";
    const hostName = order.customerName || "Host";
    const packageName = order.packageId
      ? `${String(order.packageId).toUpperCase()} Package`
      : "Party Package";
    const token = order.token || `#${String(order.orderId || "").slice(-4)}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Host QR - ${eventName}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .card {
              width: 150mm;
              border: 1px solid #d9d3e8;
              border-radius: 18px;
              padding: 10mm 12mm;
              text-align: center;
              background: #fff;
            }
            .logo {
              width: 24mm;
              height: auto;
              display: block;
              margin: 0 auto 3mm;
            }
            .tag {
              display: inline-block;
              font-size: 7pt;
              font-weight: 900;
              color: #7048d8;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              margin-bottom: 2mm;
            }
            h1 {
              margin: 0 0 2mm;
              color: #1e1b4b;
              font-size: 18pt;
              font-weight: 900;
            }
            .host {
              margin: 0 0 1mm;
              color: #334155;
              font-size: 11pt;
              font-weight: 800;
            }
            .event-meta {
              margin: 0 0 5mm;
              color: #64748b;
              font-size: 8.5pt;
              line-height: 1.5;
            }
            .qr-section {
              width: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
            }
            .qr-box {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 68mm;
              height: 68mm;
              background: #fff;
              padding: 4mm;
              border: 1px solid #cbd5e1;
              border-radius: 14px;
              margin: 0 auto 4mm;
            }
            .qr-box img {
              width: 60mm;
              height: 60mm;
              display: block;
            }
            .scan {
              display: block;
              width: fit-content;
              background: #7048d8;
              color: #fff;
              border-radius: 999px;
              padding: 2mm 7mm;
              font-size: 8pt;
              font-weight: 900;
              letter-spacing: 0.04em;
              margin: 0 auto 4mm;
            }
            .instruction {
              margin: 0 auto;
              max-width: 105mm;
              color: #64748b;
              font-size: 8.5pt;
              line-height: 1.5;
            }
            .token {
              margin-top: 4mm;
              color: #94a3b8;
              font-size: 7pt;
              font-weight: 800;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="/logo.png" alt="Mogified Moments" class="logo" />
            <div class="tag">Party Host QR</div>
            <h1>${eventName}</h1>
            <p class="host">Hosted by ${hostName}</p>
            <p class="event-meta">
              ${packageName}
              ${order.eventDate ? ` · ${order.eventDate}` : ""}
              ${order.eventTime ? ` · ${order.eventTime}` : ""}
              ${order.eventVenue ? ` · ${order.eventVenue}` : ""}
            </p>
            <div class="qr-section">
              <div class="qr-box">
                <img src="${qrCodeUrl}" alt="Party guest upload QR code" />
              </div>
              <div class="scan">SCAN TO UPLOAD PHOTOS</div>
            </div>
            <p class="instruction">
              Share this QR code with your guests. They can scan it with their
              phone camera and upload photos directly to this party's live
              photo stream and print queue.
            </p>
            <div class="token">Party token: ${token}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 350);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  // ---------------------------------------------------------
  // MARK PARTY ORDER READY
  // ---------------------------------------------------------

  async function handleMarkPartyReady(order: any) {
    if (String(order.status || "").trim().toLowerCase() !== "processing") {
      return;
    }

    try {
      const statusRes = await fetch(
        "/api/orders",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId: order.orderId,
            status: "Ready",
          }),
        }
      );

      if (!statusRes.ok) {
        throw new Error("Could not update party order status to Ready.");
      }

      setOrders((current) =>
        current.map((item) =>
          item.orderId === order.orderId
            ? { ...item, status: "Ready" }
            : item
        )
      );
    } catch (error) {
      console.error("Failed updating party order to Ready:", error);
      alert("Could not mark this party order as Ready. Please try again.");
    }
  }

  // ---------------------------------------------------------
  // PRINT PARTY PHOTOS
  // ---------------------------------------------------------

  async function handleBatchPrintPartyPhotos(
    order: any
  ) {
    if (printBusyOrderId === order.orderId) {
      return;
    }

    setPrintBusyOrderId(order.orderId);

    const selectedIndices =
      selectedPhotoMap[
        order.orderId
      ] || [];

    const photos =
      Array.isArray(
        order.guestPhotoUrls
      )
        ? order.guestPhotoUrls
        : Array.isArray(
            order.guestPhotoData
          )
        ? order.guestPhotoData
        : [];

    const isSamePhotoPartyOrder =
      String(order.partyFulfillmentMode || "") ===
      "same-photo";

    const samePhotoSource =
      String(order.photoUrl || "").trim();

    const packageQuantity = Math.max(
      1,
      Number(order.quantity) || 1
    );

    const rawProductId = String(
      order.productId ||
        order.productType ||
        ""
    ).toLowerCase();

    const orderProductName = String(
      order.productName || ""
    ).toLowerCase();

    const isKeychainOrder =
      rawProductId.includes("keychain") ||
      orderProductName.includes("keychain");

    const isCircleOrder =
      rawProductId.includes("circle") ||
      orderProductName.includes("circle");

    /*
     * KEYCHAIN PRINTING
     *
     * Each guest supplies an individual FRONT photo.
     * When the party has a shared back, the same host/studio
     * supplied back is printed for every guest.
     *
     * Layout:
     * - 2 complete keychains per row
     * - each keychain = FRONT + BACK
     * - therefore 4 circular photos per row
     * - each circular photo = 36mm diameter
     *
     * Do not send keychains through the square magnet 61mm cell.
     */
    if (isKeychainOrder) {
      const targetPhotos =
        selectedIndices.length > 0
          ? selectedIndices
              .map((i) => ({
                src: photos[i],
                index: i,
              }))
              .filter(
                (item) => Boolean(item.src)
              )
          : photos.map(
              (src: string, index: number) => ({
                src,
                index,
              })
            );

      if (targetPhotos.length === 0) {
        alert(
          "No guest front photos are available to print."
        );
        setPrintBusyOrderId(null);
        return;
      }

      const keychainBackMode = String(
        order.keychainBackMode ||
          order.partyKeychainBackMode ||
          order.sharedKeychainBackMode ||
          ""
      ).toLowerCase();

      const sharedKeychainBackUrl = String(
        order.sharedKeychainBackUrl ||
          order.sharedKeychainBackPhotoUrl ||
          order.keychainBackUrl ||
          order.keychainBackPhotoUrl ||
          order.partyKeychainBackUrl ||
          order.customKeychainBackUrl ||
          ""
      ).trim();

      const sharedBackRequested =
        keychainBackMode === "shared" ||
        order.keychainBackRequested === true ||
        String(
          order.keychainBackRequested || ""
        ).toLowerCase() === "true" ||
        Boolean(
          order.keychainBackRequest ||
            order.keychainBackNotes ||
            order.sharedKeychainBackRequest ||
            order.sharedKeychainBackNotes
        ) ||
        Boolean(sharedKeychainBackUrl);

      if (
        sharedBackRequested &&
        !sharedKeychainBackUrl
      ) {
        alert(
          "This keychain party requires one shared back photo/design, but the back photo has not been uploaded yet. Please upload it in the Shared Keychain Back section before printing."
        );
        setPrintBusyOrderId(null);
        return;
      }

      if (!sharedKeychainBackUrl) {
        alert(
          "No shared keychain back photo is available for this party. Please upload the back photo before printing."
        );
        setPrintBusyOrderId(null);
        return;
      }

      const printWin =
        window.open(
          "",
          "_blank",
          "width=900,height=950"
        );

      if (!printWin) {
        setPrintBusyOrderId(null);
        alert(
          "Please allow popups to open the keychain print sheet."
        );
        return;
      }

      window.setTimeout(() => {
        setPrintBusyOrderId((current) =>
          current === order.orderId
            ? null
            : current
        );
      }, 3000);

      try {
        const statusRes = await fetch(
          "/api/orders",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              orderId:
                order.orderId,
              status: "Processing",
            }),
          }
        );

        if (!statusRes.ok) {
          console.error(
            "Could not automatically update keychain party order status to Processing."
          );
        } else {
          setOrders((current) =>
            current.map((item) =>
              item.orderId ===
              order.orderId
                ? {
                    ...item,
                    status:
                      "Processing",
                  }
                : item
            )
          );
        }
      } catch (statusError) {
        console.error(
          "Automatic Processing status update failed:",
          statusError
        );
      }

      const tokenLabel =
        order.token ||
        `#${String(
          order.orderId || ""
        ).slice(-4)}`;

      const keychainItemsHtml =
        targetPhotos
          .map(
            (item: {
              src: string;
              index: number;
            }) => {
              const brightness =
                getPhotoBrightness(
                  order.orderId,
                  item.index
                );

              return `
                <div class="keychain-item">
                  <div class="keychain-pair">

                    <div class="keychain-side">
                      <div class="keychain-circle">
                        <img
                          src="${item.src}"
                          alt="Front"
                          style="filter: brightness(${brightness}%);"
                        />
                      </div>
                      <span class="side-label">FRONT</span>
                    </div>

                    <div class="keychain-side">
                      <div class="keychain-circle">
                        <img
                          src="${sharedKeychainBackUrl}"
                          alt="Back"
                        />
                      </div>
                      <span class="side-label">BACK</span>
                    </div>

                  </div>

                  <span class="keychain-token">
                    ${tokenLabel}
                  </span>
                </div>
              `;
            }
          )
          .join("");

      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>
              Keychain Batch Print - ${
                order.eventName ||
                order.customerName ||
                "Party"
              }
            </title>

            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }

              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                padding: 10mm 12mm;
                background: #fff;
                font-family: system-ui, -apple-system, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              .keychain-grid {
                display: grid;
                grid-template-columns: repeat(2, 80mm);
                grid-auto-rows: 45mm;
                column-gap: 8mm;
                row-gap: 7mm;
                justify-content: center;
                align-content: start;
              }

              /*
               * One complete keychain occupies one 80mm-wide
               * item. It contains two 36mm circles:
               * FRONT + BACK.
               */
              .keychain-item {
                width: 80mm;
                min-width: 80mm;
                height: 45mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                page-break-inside: avoid;
                break-inside: avoid;
              }

              .keychain-pair {
                width: 80mm;
                height: 38mm;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                gap: 8mm;
              }

              .keychain-side {
                width: 36mm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
              }

              .keychain-circle {
                width: 36mm !important;
                height: 36mm !important;
                min-width: 36mm !important;
                min-height: 36mm !important;
                max-width: 36mm !important;
                max-height: 36mm !important;
                border-radius: 50% !important;
                overflow: hidden;
                position: relative;
                background: #fff;
                box-sizing: border-box;
                flex: 0 0 36mm;
              }

              .keychain-circle img {
                display: block;
                width: 36mm !important;
                height: 36mm !important;
                min-width: 36mm !important;
                min-height: 36mm !important;
                max-width: 36mm !important;
                max-height: 36mm !important;
                border-radius: 50% !important;
                object-fit: cover !important;
                object-position: center;
              }

              .side-label {
                margin-top: 1mm;
                font-size: 6pt;
                line-height: 1;
                font-weight: 800;
                color: #555;
                text-align: center;
              }

              /*
               * The labels are intentionally small and can be
               * trimmed away during production if necessary.
               */
              .keychain-token {
                margin-top: 1mm;
                font-size: 5.5pt;
                line-height: 1;
                color: #888;
                text-align: center;
              }
            </style>
          </head>

          <body>
            <div class="keychain-grid">
              ${keychainItemsHtml}
            </div>

            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);

      printWin.document.close();
      return;
    }

    /*
     * MAGNET PRINTING
     *
     * Keep the existing square/circle party-package printing
     * behaviour unchanged.
     */
    const targetPhotos =
      isSamePhotoPartyOrder
        ? samePhotoSource
          ? Array.from(
              {
                length:
                  packageQuantity,
              },
              () => ({
                src:
                  samePhotoSource,
                index: 0,
              })
            )
          : []
        : selectedIndices.length > 0
        ? selectedIndices
            .map((i) => ({
              src: photos[i],
              index: i,
            }))
            .filter(
              (item) => Boolean(item.src)
            )
        : photos.map(
            (
              src: string,
              index: number
            ) => ({
              src,
              index,
            })
          );

    if (
      targetPhotos.length === 0
    ) {
      alert(
        isSamePhotoPartyOrder
          ? "No prepared package photo is available to print."
          : "No photos selected or available to print."
      );
      setPrintBusyOrderId(null);
      return;
    }

    const printWin =
      window.open(
        "",
        "_blank",
        "width=900,height=950"
      );

    if (!printWin) {
      setPrintBusyOrderId(null);
      window.print();
      return;
    }

    window.setTimeout(() => {
      setPrintBusyOrderId((current) =>
        current === order.orderId
          ? null
          : current
      );
    }, 3000);

    try {
      const statusRes = await fetch(
        "/api/orders",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            orderId:
              order.orderId,
            status:
              "Processing",
          }),
        }
      );

      if (!statusRes.ok) {
        console.error(
          "Could not automatically update party order status to Processing."
        );
      } else {
        setOrders((current) =>
          current.map((item) =>
            item.orderId ===
            order.orderId
              ? {
                  ...item,
                  status:
                    "Processing",
                }
              : item
          )
        );
      }
    } catch (statusError) {
      console.error(
        "Automatic Processing status update failed:",
        statusError
      );
    }

    const tokenLabel =
      order.token ||
      `#${String(
        order.orderId || ""
      ).slice(-4)}`;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>
            Batch Print - ${
              order.eventName ||
              order.customerName ||
              "Party"
            }
          </title>

          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }

            body {
              font-family: sans-serif;
              margin: 0;
              padding: 12mm 14mm;
              background: #fff;
            }

            .grid {
              display: grid;
              grid-template-columns: ${
                isCircleOrder
                  ? "repeat(2, 66mm)"
                  : "repeat(3, 61mm)"
              };
              grid-auto-rows: ${
                isCircleOrder
                  ? "66mm"
                  : "61mm"
              };
              gap: 3mm;
              justify-content: center;
            }

            .cell {
              width: ${
                isCircleOrder
                  ? "66mm"
                  : "61mm"
              };
              height: ${
                isCircleOrder
                  ? "66mm"
                  : "61mm"
              };
              position: relative;
              background: #fff;
              overflow: ${
                isCircleOrder
                  ? "visible"
                  : "hidden"
              };
              page-break-inside: avoid;
              box-sizing: border-box;
              ${
                isCircleOrder
                  ? "border: 0.3mm solid #000; border-radius: 50%;"
                  : "border: 0.3mm solid #000; border-radius: 5.5mm;"
              }
            }

            .cell img {
              position: absolute;
              left: 0;
              top: 0;
              width: ${
                isCircleOrder
                  ? "66mm"
                  : "61mm"
              };
              height: ${
                isCircleOrder
                  ? "66mm"
                  : "61mm"
              };
              object-fit: ${
                isCircleOrder
                  ? "cover"
                  : "contain"
              };
              display: block;
              ${
                isCircleOrder
                  ? "border-radius: 50%;"
                  : ""
              }
            }

            .guide {
              position: absolute;
              ${
                isCircleOrder
                  ? "left: 3.5mm; top: 3.5mm; width: 59mm; height: 59mm; border-radius: 50%;"
                  : "left: 4.5mm; top: 4.5mm; width: 52mm; height: 52mm;"
              }
              border:
                0.3mm dashed
                rgba(0,0,0,0.4);
              pointer-events: none;
              box-sizing: border-box;
              z-index: 10;
            }

            .token {
              position: absolute;
              ${
                isCircleOrder
                  ? "bottom: 2mm; right: 0; left: 0; text-align: center;"
                  : "bottom: 6mm; right: 6mm;"
              }
              color: #333;
              font-size: 7pt;
              font-weight: 900;
              z-index: 15;
            }
          </style>
        </head>

        <body>
          <div class="grid">
            ${targetPhotos
              .map(
                (
                  item: {
                    src: string;
                    index: number;
                  }
                ) => `
                  <div class="cell">
                    <img
                      src="${item.src}"
                      alt=""
                      style="filter: brightness(${getPhotoBrightness(
                        order.orderId,
                        item.index
                      )}%);"
                    />

                    <div
                      class="guide"
                    ></div>

                    <span
                      class="token"
                    >
                      ${tokenLabel}
                    </span>
                  </div>
                `
              )
              .join("")}
          </div>

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 350);
            };
          </script>
        </body>
      </html>
    `);

    printWin.document.close();
  }

  // ---------------------------------------------------------
  // PARTY-WIDE CUSTOM FRAME
  // ---------------------------------------------------------

  async function handleFrameUpload(
    order: any,
    file: File
  ) {
    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      alert(
        "Please select a PNG or image file."
      );
      return;
    }

    setFrameUploading(
      order.orderId
    );

    try {
      const reader =
        new FileReader();

      const dataUrl =
        await new Promise<string>(
          (resolve, reject) => {
            reader.onload = () =>
              resolve(
                String(
                  reader.result
                )
              );

            reader.onerror = () =>
              reject(
                new Error(
                  "Could not read the frame file."
                )
              );

            reader.readAsDataURL(
              file
            );
          }
        );

      /*
       * Upload the actual frame to Firebase
       * Storage instead of storing the image
       * itself in Firestore.
       */
      const storageUrl =
        await savePhoto(
          dataUrl,
          order.orderId,
          "party-custom-frame.png"
        );

      const res =
        await fetch(
          "/api/orders",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              type:
                "update_frame",
              orderId:
                order.orderId,
              frameId:
                storageUrl,
            }),
          }
        );

      const data =
        await res
          .json()
          .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Could not save the party frame."
        );
      }

      /*
       * Update the visible order immediately.
       * This keeps the frame visible while the
       * normal polling refreshes the page.
       */
      setOrders((prev) =>
        prev.map((o) =>
          o.orderId ===
          order.orderId
            ? {
                ...o,
                frameId:
                  storageUrl,
                appliedFrameId:
                  storageUrl,
              }
            : o
        )
      );

      alert(
        "Party frame saved. All guests will now see this frame."
      );
    } catch (err: any) {
      console.error(
        "Party frame upload error:",
        err
      );

      alert(
        err?.message ||
          "Could not upload the party frame."
      );
    } finally {
      setFrameUploading(null);
    }
  }

  function triggerFramePicker(
    orderId: string
  ) {
    frameInputRefs.current[
      orderId
    ]?.click();
  }

  // ---------------------------------------------------------
  // PARTY-WIDE CUSTOM BACKGROUND
  // ---------------------------------------------------------

  async function handleBackgroundUpload(
    order: any,
    file: File
  ) {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file for the party background.");
      return;
    }

    setBackgroundUploading(order.orderId);

    try {
      const reader = new FileReader();

      const dataUrl = await new Promise<string>(
        (resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () =>
            reject(new Error("Could not read the background file."));
          reader.readAsDataURL(file);
        }
      );

      const storageUrl = await savePhoto(
        dataUrl,
        order.orderId,
        "party-custom-background.png"
      );

      if (!firebaseConfigured || !db) {
        throw new Error(
          "Firebase is not connected, so the party background could not be saved."
        );
      }

      const ordersCol = collection(db, "orders");
      const snapshot = await getDocs(
        query(ordersCol, where("orderId", "==", order.orderId))
      );

      if (snapshot.empty) {
        throw new Error("Could not find the party order in Firestore.");
      }

      const orderRef = doc(db, "orders", snapshot.docs[0].id);

      await updateDoc(orderRef, {
        customBackgroundRequested: true,
        customBackgroundNotes:
          order.customBackgroundNotes ||
          "Custom background uploaded by studio.",
        customBackgroundUrl: storageUrl,
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === order.orderId
            ? {
                ...o,
                customBackgroundRequested: true,
                customBackgroundUrl: storageUrl,
                customBackgroundNotes:
                  o.customBackgroundNotes ||
                  "Custom background uploaded by studio.",
              }
            : o
        )
      );

      alert(
        "Party background saved. This custom background is now attached to the whole party order."
      );
    } catch (err: any) {
      console.error("Party background upload error:", err);
      alert(err?.message || "Could not upload the party background.");
    } finally {
      setBackgroundUploading(null);
    }
  }

  function triggerBackgroundPicker(orderId: string) {
    backgroundInputRefs.current[orderId]?.click();
  }

  // ---------------------------------------------------------
  // PARTY-WIDE SHARED KEYCHAIN BACK
  // ---------------------------------------------------------

  async function handleKeychainBackUpload(order: any, file: File) {
    const orderId = String(order.orderId || "").trim();

    if (!orderId) {
      alert("This party order does not have a valid order ID.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file for the shared keychain back.");
      return;
    }

    setKeychainBackUploading(orderId);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () =>
          reject(new Error("Could not read the selected image."));

        reader.readAsDataURL(file);
      });

      const storageUrl = await savePhoto(
        dataUrl,
        orderId,
        "party-shared-keychain-back.png"
      );

      if (!firebaseConfigured || !db) {
        throw new Error(
          "Firebase is not connected, so the shared keychain back could not be saved."
        );
      }

      const ordersCol = collection(db, "orders");
      const snapshot = await getDocs(
        query(ordersCol, where("orderId", "==", orderId))
      );

      if (snapshot.empty) {
        throw new Error("Could not find the party order in Firestore.");
      }

      const orderRef = doc(db, "orders", snapshot.docs[0].id);

      const uploadedAt = new Date().toISOString();

      await updateDoc(orderRef, {
        keychainBackMode: "shared",
        sharedKeychainBackUrl: storageUrl,
        sharedKeychainBackUploadedAt: uploadedAt,
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId
            ? {
                ...o,
                keychainBackMode: "shared",
                sharedKeychainBackUrl: storageUrl,
                sharedKeychainBackUploadedAt: uploadedAt,
              }
            : o
        )
      );

      alert(
        "Shared keychain back saved. This back design is now attached to all guest keychains in this party."
      );
    } catch (err: any) {
      console.error("Shared keychain back upload error:", err);
      alert(
        err?.message || "Could not upload the shared keychain back."
      );
    } finally {
      setKeychainBackUploading(null);
    }
  }

  function triggerKeychainBackPicker(orderId: string) {
    keychainBackInputRefs.current[orderId]?.click();
  }

  // ---------------------------------------------------------
  // CUSTOMER PHOTO DOWNLOAD / EDITED PHOTO REPLACEMENT
  // ---------------------------------------------------------

  async function handleDownloadCustomerPhoto(order: any) {
    const orderId = String(order.orderId || "").trim();
    const photoUrl = String(
      order.originalPhotoUrl || order.photoUrl || ""
    ).trim();

    if (!orderId) {
      alert("This party order does not have a valid order ID.");
      return;
    }

    if (!photoUrl) {
      alert("No customer-uploaded photo is available for this order.");
      return;
    }

    if (photoDownloadBusy) {
      return;
    }

    setPhotoDownloadBusy(orderId);

    try {
      const response = await fetch(photoUrl);
      if (!response.ok) {
        throw new Error(
          `The customer photo could not be downloaded (HTTP ${response.status}).`
        );
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = `Mogified-Moments_${orderId}_Customer-Photo.${getPhotoExtension(
        photoUrl,
        blob.type
      )}`;
      anchor.style.display = "none";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
    } catch (err: any) {
      console.error("Customer photo download error:", err);
      alert(
        err?.message ||
          "Could not download the customer photo. Please check the Storage URL or network connection."
      );
    } finally {
      setPhotoDownloadBusy(null);
    }
  }

  async function handleEditedPhotoUpload(
    order: any,
    file: File
  ) {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file for the edited customer design.");
      return;
    }

    setEditedPhotoUploading(order.orderId);

    try {
      const reader = new FileReader();

      const dataUrl = await new Promise<string>(
        (resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () =>
            reject(new Error("Could not read the edited photo file."));
          reader.readAsDataURL(file);
        }
      );

      const storageUrl = await savePhoto(
        dataUrl,
        order.orderId,
        "studio-edited-magnet.png"
      );

      if (!firebaseConfigured || !db) {
        throw new Error(
          "Firebase is not connected, so the edited customer design could not be saved."
        );
      }

      const ordersCol = collection(db, "orders");
      const snapshot = await getDocs(
        query(ordersCol, where("orderId", "==", order.orderId))
      );

      if (snapshot.empty) {
        throw new Error("Could not find the party order in Firestore.");
      }

      const orderRef = doc(ordersCol, snapshot.docs[0].id);

      await updateDoc(orderRef, {
        photoUrl: storageUrl,
        studioEditedPhotoUrl: storageUrl,
        studioEditedAt: new Date().toISOString(),
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.orderId === order.orderId
            ? {
                ...o,
                photoUrl: storageUrl,
                studioEditedPhotoUrl: storageUrl,
                studioEditedAt: new Date().toISOString(),
              }
            : o
        )
      );

      alert(
        "Edited customer design uploaded and attached to this order. The original customer photo has been preserved."
      );
    } catch (err: any) {
      console.error("Edited customer photo upload error:", err);
      alert(
        err?.message ||
          "Could not upload the edited customer design."
      );
    } finally {
      setEditedPhotoUploading(null);
    }
  }

  function triggerEditedPhotoPicker(orderId: string) {
    editedPhotoInputRefs.current[orderId]?.click();
  }

  // ---------------------------------------------------------
  // DOWNLOAD EVENT PHOTOS
  // ---------------------------------------------------------

  function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;

    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];

      for (let bit = 0; bit < 8; bit++) {
        crc =
          (crc >>> 1) ^
          (0xedb88320 & -(crc & 1));
      }
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeUint16(value: number) {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, value, true);
    return bytes;
  }

  function writeUint32(value: number) {
    const bytes = new Uint8Array(4);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, value >>> 0, true);
    return bytes;
  }

  function concatBytes(...parts: Uint8Array[]) {
    const totalLength = parts.reduce(
      (total, part) => total + part.length,
      0
    );

    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }

  function createStoredZip(
    files: { name: string; data: Uint8Array }[]
  ) {
    const encoder = new TextEncoder();
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);

      const localHeader = concatBytes(
        writeUint32(0x04034b50),
        writeUint16(20),
        writeUint16(0x0800),
        writeUint16(0),
        writeUint16(0),
        writeUint16(0),
        writeUint32(crc),
        writeUint32(data.length),
        writeUint32(data.length),
        writeUint16(nameBytes.length),
        writeUint16(0),
        nameBytes
      );

      localParts.push(localHeader, data);

      const centralHeader = concatBytes(
        writeUint32(0x02014b50),
        writeUint16(20),
        writeUint16(20),
        writeUint16(0x0800),
        writeUint16(0),
        writeUint16(0),
        writeUint16(0),
        writeUint32(crc),
        writeUint32(data.length),
        writeUint32(data.length),
        writeUint16(nameBytes.length),
        writeUint16(0),
        writeUint16(0),
        writeUint16(0),
        writeUint16(0),
        writeUint32(0),
        writeUint32(offset),
        nameBytes
      );

      centralParts.push(centralHeader);
      offset += localHeader.length + data.length;
    }

    const centralDirectory = concatBytes(...centralParts);
    const localData = concatBytes(...localParts);

    const endRecord = concatBytes(
      writeUint32(0x06054b50),
      writeUint16(0),
      writeUint16(0),
      writeUint16(files.length),
      writeUint16(files.length),
      writeUint32(centralDirectory.length),
      writeUint32(localData.length),
      writeUint16(0)
    );

    return new Blob(
      [localData, centralDirectory, endRecord],
      { type: "application/zip" }
    );
  }

  function getPhotoExtension(
    url: string,
    contentType: string
  ) {
    const normalizedType = String(
      contentType || ""
    ).toLowerCase();

    const typeMap: { [key: string]: string } = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/heic": "heic",
      "image/heif": "heif",
    };

    if (typeMap[normalizedType]) {
      return typeMap[normalizedType];
    }

    const cleanUrl = url.split("?")[0].split("#")[0];
    const match = cleanUrl.match(/\.([a-z0-9]+)$/i);

    if (match?.[1]) {
      const extension = match[1].toLowerCase();

      if (
        [
          "jpg",
          "jpeg",
          "png",
          "webp",
          "gif",
          "heic",
          "heif",
        ].includes(extension)
      ) {
        return extension === "jpeg" ? "jpg" : extension;
      }
    }

    return "jpg";
  }

  async function handleDownloadEventPhotos(
    order: any
  ) {
    const orderId = String(order.orderId || "").trim();
    const photos =
      Array.isArray(order.guestPhotoUrls)
        ? order.guestPhotoUrls
        : Array.isArray(order.guestPhotoData)
        ? order.guestPhotoData
        : [];

    if (!orderId) {
      alert("This party order does not have a valid order ID.");
      return;
    }

    if (photos.length === 0) {
      alert("No guest photos have been uploaded for this event yet.");
      return;
    }

    if (photoDownloadBusy) {
      return;
    }

    setPhotoDownloadBusy(orderId);

    try {
      const zipFiles: { name: string; data: Uint8Array }[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photoUrl = String(photos[i] || "").trim();

        if (!photoUrl) {
          throw new Error(
            `Photo ${i + 1} does not contain a valid Storage URL.`
          );
        }

        let response: Response;

        try {
          response = await fetch(photoUrl);
        } catch (error) {
          throw new Error(
            `Photo ${i + 1} could not be downloaded. Please check the Storage URL or network connection.`
          );
        }

        if (!response.ok) {
          throw new Error(
            `Photo ${i + 1} could not be downloaded (HTTP ${response.status}).`
          );
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        zipFiles.push({
          name: `Event Photos/${String(i + 1).padStart(3, "0")}.${getPhotoExtension(
            photoUrl,
            blob.type
          )}`,
          data: new Uint8Array(arrayBuffer),
        });
      }

      const zipBlob = createStoredZip(zipFiles);
      const downloadUrl = URL.createObjectURL(zipBlob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = `Mogified-Moments_${orderId}_Event-Photos.zip`;
      anchor.style.display = "none";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
    } catch (err: any) {
      console.error(
        "Event photo ZIP download error:",
        err
      );

      alert(
        err?.message ||
          "Could not prepare the event photo ZIP. No incomplete ZIP was downloaded."
      );
    } finally {
      setPhotoDownloadBusy(null);
    }
  }

  // ---------------------------------------------------------
  // FINAL PARTY PAYMENT
  // ---------------------------------------------------------

  const ADDITIONAL_MAGNET_PRICE = 120;

  function getPhotosReceived(order: any) {
    if (Array.isArray(order.guestPhotoUrls)) {
      return order.guestPhotoUrls.length;
    }

    if (Array.isArray(order.guestPhotoData)) {
      return order.guestPhotoData.length;
    }

    return Math.max(
      0,
      Math.round(Number(order.photosReceived || 0))
    );
  }

  function getMagnetsIncluded(order: any) {
    return Math.max(
      0,
      Math.round(
        Number(
          order.packageQuantity ??
            order.quantity ??
            0
        )
      )
    );
  }

  function getAdditionalMagnets(order: any) {
    /*
     * Once the final payment is recorded, use the exact quantity
     * that was charged at that time. This prevents a refresh from
     * recalculating the same already-paid additional magnets and
     * charging them again.
     */
    if (order.finalPaymentRecorded) {
      return Math.max(
        0,
        Math.round(
          Number(
            order.additionalMagnetsCharged ??
              order.additionalMagnets ??
              0
          )
        )
      );
    }

    return Math.max(
      0,
      getPhotosReceived(order) -
        getMagnetsIncluded(order)
    );
  }

  function getAdditionalMagnetCharge(order: any) {
    if (order.finalPaymentRecorded) {
      return Math.max(
        0,
        Math.round(
          Number(
            order.additionalMagnetChargeAmount ??
              order.additionalCharge ??
              0
          )
        )
      );
    }

    return (
      getAdditionalMagnets(order) *
      ADDITIONAL_MAGNET_PRICE
    );
  }

  function getPackageTotal(order: any) {
    return Math.max(
      0,
      Math.round(
        Number(
          order.packagePrice ||
            order.total ||
            0
        )
      )
    );
  }

  function getAdvancePaid(order: any) {
    return Math.max(
      0,
      Math.round(
        Number(
          order.advancePaidAmount ||
            0
        )
      )
    );
  }

  function getPackageBalanceDue(order: any) {
    return Math.max(
      0,
      Math.round(
        Number(order.balanceDueAmount || 0)
      )
    );
  }

  function getTotalDueAtEvent(order: any) {
    if (order.finalPaymentRecorded) {
      return 0;
    }

    return (
      getPackageBalanceDue(order) +
      getAdditionalMagnetCharge(order)
    );
  }

  function hasFinalPaymentRecorded(order: any) {
    return Boolean(
      order.finalPaymentRecorded ||
        order.finalPaymentAmountPaid > 0 ||
        order.finalPaymentStatus === "Paid" ||
        order.paymentStatus === "Paid in Full"
    );
  }

  function openPaymentModal(order: any) {
    if (
      hasFinalPaymentRecorded(order) ||
      getTotalDueAtEvent(order) <= 0
    ) {
      return;
    }

    setPaymentMethod("cash");
    setPaymentOrder(order);
  }

  async function recordCashFinalPayment(order: any) {
    if (
      hasFinalPaymentRecorded(order)
    ) {
      setPaymentOrder(null);
      return;
    }

    const totalDueAtEvent =
      getTotalDueAtEvent(order);

    const additionalMagnets =
      getAdditionalMagnets(order);

    const additionalMagnetCharge =
      getAdditionalMagnetCharge(order);

    if (totalDueAtEvent <= 0) {
      return;
    }

    setPaymentBusy(true);

    try {
      const res = await fetch(
        "/api/orders",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            type:
              "update_party_payment",

            orderId:
              order.orderId,

            amount:
              totalDueAtEvent,

            paymentMethod:
              "cash",

            finalPayment: true,
            finalPaymentRecorded: true,
            finalPaymentAmountPaid:
              totalDueAtEvent,
            finalPaymentAt:
              new Date().toISOString(),

            additionalMagnetsCharged:
              additionalMagnets,
            additionalMagnetChargeAmount:
              additionalMagnetCharge,
            additionalMagnetUnitPrice:
              ADDITIONAL_MAGNET_PRICE,
            photosReceivedAtPayment:
              getPhotosReceived(order),
            magnetsIncludedAtPayment:
              getMagnetsIncluded(order),
          }),
        }
      );

      const data = await res
        .json()
        .catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Could not record the final payment."
        );
      }

      setPaymentOrder(null);

      await fetchPartyOrders();

      alert(
        `₹${totalDueAtEvent.toLocaleString(
          "en-IN"
        )} final payment recorded as paid in cash.`
      );
    } catch (err: any) {
      console.error(
        "Cash final payment error:",
        err
      );

      alert(
        err?.message ||
          "Could not record cash final payment."
      );
    } finally {
      setPaymentBusy(false);
    }
  }

  async function startUpiFinalPayment(order: any) {
    if (
      hasFinalPaymentRecorded(order)
    ) {
      setPaymentOrder(null);
      return;
    }

    const totalDueAtEvent =
      getTotalDueAtEvent(order);

    const additionalMagnets =
      getAdditionalMagnets(order);

    const additionalMagnetCharge =
      getAdditionalMagnetCharge(order);

    if (totalDueAtEvent <= 0) {
      return;
    }

    setPaymentBusy(true);

    try {
      const loaded =
        await loadRazorpayScript();

      if (!loaded) {
        throw new Error(
          "Payment gateway failed to load. Please check your internet connection."
        );
      }

      /*
       * Create a Razorpay order for the COMPLETE final amount:
       * outstanding package balance + additional magnets.
       */
      const createRes =
        await fetch(
          "/api/razorpay/create-order",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              amount:
                totalDueAtEvent,
              receipt:
                `party_final_${order.orderId}_${Date.now()}`,
            }),
          }
        );

      const orderData =
        await createRes
          .json()
          .catch(() => ({}));

      if (
        !createRes.ok ||
        !orderData.success ||
        !orderData.orderId
      ) {
        throw new Error(
          orderData.error ||
            orderData.message ||
            "Could not create the final payment."
        );
      }

      const razorpay =
        new (
          window as any
        ).Razorpay({
          key:
            process.env
              .NEXT_PUBLIC_RAZORPAY_KEY_ID ||
            "",

          amount:
            orderData.amount,

          currency:
            orderData.currency ||
            "INR",

          name:
            "Mogified Moments",

          description:
            `Final payment - ${
              order.packageId
                ? String(
                    order.packageId
                  ).toUpperCase()
                : "Party Package"
            } Package`,

          order_id:
            orderData.orderId,

          prefill: {
            name:
              order.customerName ||
              "",

            contact:
              order.phone || "",
          },

          theme: {
            color:
              "#7048d8",
          },

          handler:
            async (
              response: any
            ) => {
              try {
                const saveRes =
                  await fetch(
                    "/api/orders",
                    {
                      method:
                        "PATCH",

                      headers: {
                        "Content-Type":
                          "application/json",
                      },

                      body: JSON.stringify({
                        type:
                          "update_party_payment",

                        orderId:
                          order.orderId,

                        amount:
                          totalDueAtEvent,

                        paymentMethod:
                          "upi",

                        finalPayment: true,
                        finalPaymentRecorded: true,
                        finalPaymentAmountPaid:
                          totalDueAtEvent,
                        finalPaymentAt:
                          new Date().toISOString(),

                        additionalMagnetsCharged:
                          additionalMagnets,
                        additionalMagnetChargeAmount:
                          additionalMagnetCharge,
                        additionalMagnetUnitPrice:
                          ADDITIONAL_MAGNET_PRICE,
                        photosReceivedAtPayment:
                          getPhotosReceived(order),
                        magnetsIncludedAtPayment:
                          getMagnetsIncluded(order),

                        transactionId:
                          response
                            .razorpay_payment_id ||
                          null,

                        razorpayOrderId:
                          response
                            .razorpay_order_id ||
                          orderData.orderId,
                      }),
                    }
                  );

                const saveData =
                  await saveRes
                    .json()
                    .catch(
                      () => ({})
                    );

                if (!saveRes.ok) {
                  throw new Error(
                    saveData?.error ||
                      "Payment succeeded but could not update the party order."
                  );
                }

                setPaymentOrder(null);

                await fetchPartyOrders();

                alert(
                  `₹${totalDueAtEvent.toLocaleString(
                    "en-IN"
                  )} final payment received successfully.`
                );
              } catch (err: any) {
                console.error(
                  "Saving UPI final payment failed:",
                  err
                );

                alert(
                  err?.message ||
                    "Payment was received, but the order could not be updated. Please check the order before taking another payment."
                );

                await fetchPartyOrders();
              } finally {
                setPaymentBusy(false);
              }
            },

          modal: {
            ondismiss:
              () => {
                setPaymentBusy(false);
              },
          },
        });

      razorpay.open();
    } catch (err: any) {
      console.error(
        "UPI final payment error:",
        err
      );

      alert(
        err?.message ||
          "Could not start the UPI final payment."
      );

      setPaymentBusy(false);
    }
  }

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------

  function formatMoney(
    value: number
  ) {
    return `₹${Math.round(
      value || 0
    ).toLocaleString("en-IN")}`;
  }

  function hasPaidInFull(order: any) {
    return hasFinalPaymentRecorded(order);
  }

  if (loading) {
    return (
      <div
        style={{
          textAlign:
            "center",
          padding: "60px",
          fontWeight:
            "bold",
        }}
      >
        Loading Party Packages Hub...
      </div>
    );
  }

  return (
    <main className="party-hub-root">
      <header className="party-hub-header">
        <Brand compact />

        <div className="header-title">
          <h1>
            🎉 Party Packages Hub
          </h1>

          <p>
            Guest uploads,
            custom event frame,
            printing &amp;
            payment tracking
          </p>
        </div>

        <a
          href="/admin"
          className="button secondary"
          style={{
            textDecoration:
              "none",
            fontSize:
              "13px",
          }}
        >
          ← Back to Studio
        </a>
      </header>

      <div className="party-hub-content">
        {orders.length === 0 ? (
          <div className="empty-state">
            No active party
            packages found.
          </div>
        ) : (
          orders.map(
            (order) => {
              const photos =
                Array.isArray(
                  order.guestPhotoUrls
                )
                  ? order.guestPhotoUrls
                  : Array.isArray(
                      order.guestPhotoData
                    )
                  ? order.guestPhotoData
                  : [];

              const completedIndices =
                Array.isArray(
                  order.completedPhotoIndices
                )
                  ? order.completedPhotoIndices
                  : [];

              const selectedIndices =
                selectedPhotoMap[
                  order.orderId
                ] || [];

              const packageTotal =
                getPackageTotal(
                  order
                );

              const advancePaid =
                getAdvancePaid(
                  order
                );

              const balanceDue =
                getPackageBalanceDue(
                  order
                );

              const paidInFull =
                hasPaidInFull(
                  order
                );

              const photosReceived =
                getPhotosReceived(order);

              const magnetsIncluded =
                getMagnetsIncluded(order);

              const additionalMagnets =
                getAdditionalMagnets(order);

              const additionalMagnetCharge =
                getAdditionalMagnetCharge(order);

              const totalDueAtEvent =
                getTotalDueAtEvent(order);

              const frameValue =
                order.frameId ||
                order.appliedFrameId ||
                "";

              const frameIsCustom =
                typeof frameValue ===
                  "string" &&
                (
                  frameValue.startsWith(
                    "http://"
                  ) ||
                  frameValue.startsWith(
                    "https://"
                  ) ||
                  frameValue.startsWith(
                    "data:image/"
                  )
                );

              /*
               * A guest-requested custom frame is different from a
               * frame that was uploaded/applied later by the studio.
               * Older orders may store the request inside frameName,
               * so support both the explicit fields and that format.
               */
              const customFrameRequested =
                order.customFrameRequested === true ||
                String(order.customFrameRequested || "").toLowerCase() === "true" ||
                Boolean(
                  order.customFrameNotes ||
                    order.customFrameDescription ||
                    order.customFrameRequestDescription
                ) ||
                String(order.frameName || "")
                  .toLowerCase()
                  .startsWith("custom requested:");

              const customFrameDescription =
                String(
                  order.customFrameNotes ||
                    order.customFrameDescription ||
                    order.customFrameRequestDescription ||
                    (String(order.frameName || "").toLowerCase().startsWith("custom requested:")
                      ? String(order.frameName).replace(/^custom requested:\s*/i, "")
                      : "")
                ).trim();

              const customBackgroundRequested =
                order.customBackgroundRequested === true ||
                String(order.customBackgroundRequested || "").toLowerCase() === "true" ||
                Boolean(
                  order.customBackgroundNotes ||
                    order.customBackgroundDescription ||
                    order.customBackgroundRequestDescription
                );

              const customBackgroundDescription =
                String(
                  order.customBackgroundNotes ||
                    order.customBackgroundDescription ||
                    order.customBackgroundRequestDescription ||
                    ""
                ).trim();

              const customBackgroundUrl =
                String(order.customBackgroundUrl || "").trim();

              const productId = String(
                order.productId ||
                  order.productType ||
                  order.shape ||
                  "square"
              ).toLowerCase();

              const productName =
                productId.includes("keychain")
                  ? "36mm Photo Keychain"
                  : productId.includes("circle")
                  ? "Circle Magnet"
                  : "Square Magnet";

              const isKeychainProduct = productId.includes("keychain");

              const sharedKeychainBackUrl = String(
                order.sharedKeychainBackUrl || ""
              ).trim();

              const keychainBackMode = String(
                order.keychainBackMode || ""
              )
                .trim()
                .toLowerCase();

              const sharedKeychainBackRequested =
                keychainBackMode === "shared" ||
                Boolean(
                  order.sharedKeychainBackRequest ||
                    order.keychainBackRequest ||
                    order.customKeychainBackRequested
                ) ||
                sharedKeychainBackUrl !== "";

              const productDetails =
                String(order.productName || "").trim();

              return (
                <div
                  key={
                    order.orderId
                  }
                  className="party-card"
                >
                  {/* --------------------------------------- */}
                  {/* PARTY HEADER */}
                  {/* --------------------------------------- */}

                  <div className="party-card-header">
                    <div>
                      <span className="badge-tier">
                        {String(
                          order.packageId ||
                            "PARTY"
                        ).toUpperCase()}{" "}
                        PACKAGE
                      </span>

                      <h2>
                        {order.eventName ||
                          `${order.customerName}'s Celebration`}
                      </h2>

                      <p>
                        Host:{" "}
                        {order.customerName ||
                          "—"}{" "}
                        (
                        {order.phone ||
                          "—"}
                        )
                        {" · "}
                        🗓️{" "}
                        {order.eventDate ||
                          "Today"}

                        {order.eventTime
                          ? ` · ⏰ ${order.eventTime}`
                          : ""}
                      </p>

                      {order.eventVenue && (
                        <p>
                          📍{" "}
                          {
                            order.eventVenue
                          }
                        </p>
                      )}

                      <div
                        style={{
                          marginTop: "8px",
                          padding: "10px 12px",
                          borderRadius: "12px",
                          background: customFrameRequested || frameIsCustom
                            ? "#f0fdf4"
                            : "#f8fafc",
                          border: customFrameRequested || frameIsCustom
                            ? "1px solid #bbf7d0"
                            : "1px solid #e2e8f0",
                          fontSize: "12px",
                          lineHeight: 1.6,
                        }}
                      >
                        <div>
                          <strong>Product:</strong>{" "}
                          {productName}
                          {order.quantity
                            ? ` · ${order.quantity} pcs`
                            : ""}
                        </div>

                        {productDetails && (
                          <div
                            style={{
                              color: "#475569",
                              marginTop: "2px",
                            }}
                          >
                            <strong>Package Product:</strong>{" "}
                            {productDetails}
                          </div>
                        )}

                        <div>
                          <strong>Frame:</strong>{" "}
                          {frameIsCustom
                            ? "Custom Frame"
                            : frameValue
                            ? String(frameValue)
                            : customFrameRequested
                            ? "Custom Frame Requested"
                            : "No custom frame"}
                        </div>

                        <div>
                          <strong>Custom Frame Requested:</strong>{" "}
                          {customFrameRequested ? "Yes" : "No"}
                        </div>

                        {customFrameRequested && (
                          <div
                            style={{
                              color: "#166534",
                              marginTop: "2px",
                            }}
                          >
                            <strong>Custom Frame Description:</strong>{" "}
                            {customFrameDescription || "No description provided"}
                          </div>
                        )}

                        {frameIsCustom && !customFrameRequested && (
                          <div
                            style={{
                              wordBreak: "break-all",
                              color: "#166534",
                            }}
                          >
                            <strong>Applied Custom Frame:</strong>{" "}
                            {String(frameValue)}
                          </div>
                        )}

                        <div>
                          <strong>Custom Background Requested:</strong>{" "}
                          {customBackgroundRequested ? "Yes" : "No"}
                        </div>

                        {customBackgroundRequested && (
                          <div
                            style={{
                              color: "#166534",
                              marginTop: "2px",
                            }}
                          >
                            <strong>Custom Background Description:</strong>{" "}
                            {customBackgroundDescription || "No description provided"}
                          </div>
                        )}

                        {customBackgroundUrl && (
                          <div
                            style={{
                              wordBreak: "break-all",
                              color: "#166534",
                            }}
                          >
                            <strong>Applied Custom Background:</strong>{" "}
                            {String(customBackgroundUrl)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="party-actions">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          handlePrintHostQR(order)
                        }
                      >
                        🔲 Print Host QR
                      </button>

                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          handleDownloadEventPhotos(order)
                        }
                        disabled={
                          photos.length === 0 ||
                          photoDownloadBusy !== null
                        }
                      >
                        {photoDownloadBusy === order.orderId
                          ? "Preparing ZIP..."
                          : "📦 Download Event Photos"}
                      </button>

                      <button
                        type="button"
                        className="button primary"
                        onClick={() =>
                          handleBatchPrintPartyPhotos(
                            order
                          )
                        }
                        disabled={
                          (String(order.partyFulfillmentMode || "") === "same-photo"
                            ? !String(order.photoUrl || "").trim()
                            : photos.length === 0) ||
                          printBusyOrderId === order.orderId
                        }
                      >
                        {printBusyOrderId === order.orderId
                          ? "⏳ Printing..."
                          : String(order.partyFulfillmentMode || "") === "same-photo"
                          ? `🖨️ Print All (${Math.max(1, Number(order.quantity) || 1)})`
                          : `🖨️ Print Selected (${
                              selectedIndices.length > 0
                                ? selectedIndices.length
                                : photos.length
                            })`}
                      </button>

                      {String(order.status || "").trim().toLowerCase() === "processing" && (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() =>
                            handleMarkPartyReady(order)
                          }
                        >
                          ✓ Mark Ready
                        </button>
                      )}
                    </div>
                  </div>

                  {/* --------------------------------------- */}
                  {/* PAYMENT SUMMARY */}
                  {/* --------------------------------------- */}

                  <div className="payment-summary">
                    <div className="payment-box">
                      <span>PACKAGE TOTAL</span>
                      <strong>
                        {formatMoney(packageTotal)}
                      </strong>
                    </div>

                    <div className="payment-box advance-box">
                      <span>ADVANCE PAID</span>
                      <strong>
                        {formatMoney(advancePaid)}
                      </strong>
                    </div>

                    <div className="payment-box">
                      <span>PHOTOS RECEIVED</span>
                      <strong>
                        {photosReceived}
                      </strong>
                    </div>

                    <div className="payment-box">
                      <span>MAGNETS INCLUDED</span>
                      <strong>
                        {magnetsIncluded}
                      </strong>
                    </div>

                    <div className="payment-box additional-box">
                      <span>ADDITIONAL MAGNETS</span>
                      <strong>
                        {additionalMagnets}
                      </strong>
                      <small>
                        {additionalMagnets > 0
                          ? `${formatMoney(ADDITIONAL_MAGNET_PRICE)} each`
                          : "No additional magnets"}
                      </small>
                    </div>

                    <div className="payment-box additional-charge-box">
                      <span>ADDITIONAL CHARGE</span>
                      <strong>
                        {formatMoney(
                          additionalMagnetCharge
                        )}
                      </strong>
                      <small>
                        {additionalMagnets} × {formatMoney(ADDITIONAL_MAGNET_PRICE)}
                      </small>
                    </div>

                    <div
                      className={`payment-box ${
                        paidInFull
                          ? "paid-box"
                          : "balance-box"
                      }`}
                    >
                      <span>
                        {paidInFull
                          ? "PAYMENT STATUS"
                          : "TOTAL DUE AT EVENT"}
                      </span>

                      <strong>
                        {paidInFull
                          ? "✓ PAID IN FULL"
                          : formatMoney(
                              totalDueAtEvent
                            )}
                      </strong>
                    </div>

                    {!paidInFull && (
                      <button
                        type="button"
                        className="balance-button"
                        onClick={() =>
                          openPaymentModal(order)
                        }
                      >
                        💳 Collect Final Payment
                        <small>
                          {formatMoney(
                            totalDueAtEvent
                          )}
                        </small>
                      </button>
                    )}

                    {paidInFull && (
                      <div className="paid-full-badge">
                        ✓ Final Payment Complete
                      </div>
                    )}
                  </div>

                  {/* --------------------------------------- */}
                  {/* PARTY FRAME */}
                  {/* --------------------------------------- */}

                  <div className="frame-section">
                    <div className="frame-section-header">
                      <div>
                        <h3>
                          🎨 Party-Wide
                          Frame
                        </h3>

                        <p>
                          Upload or replace
                          the frame once.
                          All guests use
                          this frame.
                        </p>
                      </div>

                      <div>
                        <input
                          ref={(el) => {
                            frameInputRefs.current[
                              order.orderId
                            ] = el;
                          }}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(
                            e
                          ) => {
                            const file =
                              e.target
                                .files?.[0];

                            if (file) {
                              handleFrameUpload(
                                order,
                                file
                              );
                            }

                            e.target.value =
                              "";
                          }}
                        />

                        <button
                          type="button"
                          className="button primary"
                          onClick={() =>
                            triggerFramePicker(
                              order.orderId
                            )
                          }
                          disabled={
                            frameUploading ===
                            order.orderId
                          }
                        >
                          {frameUploading ===
                          order.orderId
                            ? "Uploading..."
                            : frameIsCustom
                            ? "🔄 Replace Frame"
                            : "🎨 Upload Custom Frame"}
                        </button>
                      </div>
                    </div>

                    {frameIsCustom ? (
                      <div className="frame-preview-row">
                        <div className="frame-preview">
                          <img
                            src={
                              frameValue
                            }
                            alt="Party custom frame"
                          />
                        </div>

                        <div className="frame-status">
                          <strong>
                            ✓ Custom frame
                            active
                          </strong>

                          <span>
                            This frame is
                            attached to
                            the whole party
                            order and
                            will appear
                            automatically
                            for guests.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="frame-empty">
                        No custom party
                        frame uploaded yet.
                      </div>
                    )}
                  </div>

                  {/* --------------------------------------- */}
                  {/* PARTY BACKGROUND */}
                  {/* --------------------------------------- */}

                  <div className="background-section">
                    <div className="background-section-header">
                      <div>
                        <h3>🌄 Party-Wide Background</h3>
                        <p>
                          Upload or replace the custom background when the customer has requested one.
                          The background is attached to the whole party order.
                        </p>
                      </div>

                      <div>
                        <input
                          ref={(el) => {
                            backgroundInputRefs.current[order.orderId] = el;
                          }}
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleBackgroundUpload(order, file);
                            }
                            e.target.value = "";
                          }}
                        />

                        <button
                          type="button"
                          className="button primary"
                          onClick={() => triggerBackgroundPicker(order.orderId)}
                          disabled={backgroundUploading === order.orderId}
                        >
                          {backgroundUploading === order.orderId
                            ? "Uploading..."
                            : customBackgroundUrl
                            ? "🔄 Replace Background"
                            : "🌄 Upload Custom Background"}
                        </button>
                      </div>
                    </div>

                    {customBackgroundUrl ? (
                      <div className="background-preview-row">
                        <div className="background-preview">
                          <img
                            src={customBackgroundUrl}
                            alt="Party custom background"
                          />
                        </div>

                        <div className="background-status">
                          <strong>✓ Custom background active</strong>
                          <span>
                            This background is attached to the whole party order.
                          </span>
                          {customBackgroundDescription && (
                            <span>
                              <strong>Request:</strong>{" "}
                              {customBackgroundDescription}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="background-empty">
                        {customBackgroundRequested ? (
                          <>
                            <strong>Custom background requested.</strong>{" "}
                            Upload the finished background above.
                            {customBackgroundDescription
                              ? ` Request: ${customBackgroundDescription}`
                              : ""}
                          </>
                        ) : (
                          "No custom party background uploaded yet."
                        )}
                      </div>
                    )}
                  </div>

                  {isKeychainProduct && sharedKeychainBackRequested && (
                    <div
                      className="background-section"
                      style={{
                        marginTop: "14px",
                        border: "1px solid #eadcf8",
                        background: "#fcfaff",
                      }}
                    >
                      <div className="background-section-header">
                        <div>
                          <h3>🔑 Shared Keychain Back</h3>
                          <p>
                            The customer requested one custom back photo/design
                            for all guest keychains in this party.
                          </p>

                          {(order.sharedKeychainBackRequest ||
                            order.keychainBackRequest) && (
                            <p
                              style={{
                                marginTop: "5px",
                                color: "#6b21a8",
                                fontWeight: 700,
                              }}
                            >
                              Request:{" "}
                              {String(
                                order.sharedKeychainBackRequest ||
                                  order.keychainBackRequest
                              )}
                            </p>
                          )}
                        </div>

                        <div>
                          <input
                            ref={(el) => {
                              keychainBackInputRefs.current[order.orderId] = el;
                            }}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) => {
                              const file = e.target.files?.[0];

                              if (file) {
                                handleKeychainBackUpload(order, file);
                              }

                              e.target.value = "";
                            }}
                          />

                          <button
                            type="button"
                            className="button primary"
                            onClick={() =>
                              triggerKeychainBackPicker(order.orderId)
                            }
                            disabled={
                              keychainBackUploading === order.orderId
                            }
                          >
                            {keychainBackUploading === order.orderId
                              ? "Uploading..."
                              : sharedKeychainBackUrl
                              ? "🔄 Replace Back Photo"
                              : "📷 Upload Custom Back Photo"}
                          </button>
                        </div>
                      </div>

                      {sharedKeychainBackUrl ? (
                        <div className="background-preview-row">
                          <div className="background-preview">
                            <img
                              src={sharedKeychainBackUrl}
                              alt="Shared keychain back"
                              style={{
                                width: "120px",
                                height: "120px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "2px solid #d8c8ee",
                              }}
                            />
                          </div>

                          <div className="background-status">
                            <strong>✓ Shared back photo active</strong>
                            <span>
                              This back design will be used for every guest
                              keychain in this party.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="background-empty">
                          <strong>Custom back requested.</strong>{" "}
                          Upload the finished back photo/design above.
                        </div>
                      )}
                    </div>
                  )}

                  {/* --------------------------------------- */}
                  {/* GUEST PHOTOS */}
                  {/* --------------------------------------- */}

                  <div className="party-photos-stream">
                    {String(order.partyFulfillmentMode || "") === "same-photo" ? (
                      <>
                        <h3>
                          Bulk Photo Package · {Math.max(1, Number(order.quantity) || 1)} magnets
                        </h3>

                        <p
                          style={{
                            margin: "0 0 10px",
                            fontSize: "11px",
                            color: "#64748b",
                          }}
                        >
                          One customer-uploaded design will be printed on every magnet in this package.
                          Adjust brightness once here; the same setting is used for all copies.
                        </p>

                        <div
                          style={{
                            margin: "0 0 12px",
                            padding: "10px 12px",
                            borderRadius: "12px",
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <strong
                            style={{
                              display: "block",
                              fontSize: "11px",
                              color: "#292342",
                              marginBottom: "4px",
                            }}
                          >
                            ✏️ Customisation workflow
                          </strong>
                          <span
                            style={{
                              display: "block",
                              fontSize: "10px",
                              color: "#64748b",
                              lineHeight: 1.5,
                            }}
                          >
                            Download the original customer photo, edit it according to their custom frame/background request, then upload the finished design back to this order. The original customer photo stays preserved.
                          </span>

                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                              marginTop: "9px",
                            }}
                          >
                            <button
                              type="button"
                              className="button secondary"
                              onClick={() => handleDownloadCustomerPhoto(order)}
                              disabled={photoDownloadBusy === order.orderId}
                            >
                              {photoDownloadBusy === order.orderId
                                ? "Downloading..."
                                : "⬇️ Download Customer Photo"}
                            </button>

                            <input
                              ref={(el) => {
                                editedPhotoInputRefs.current[order.orderId] = el;
                              }}
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleEditedPhotoUpload(order, file);
                                }
                                e.target.value = "";
                              }}
                            />

                            <button
                              type="button"
                              className="button primary"
                              onClick={() => triggerEditedPhotoPicker(order.orderId)}
                              disabled={editedPhotoUploading === order.orderId}
                            >
                              {editedPhotoUploading === order.orderId
                                ? "Uploading..."
                                : "⬆️ Upload Edited Design"}
                            </button>
                          </div>

                          {String(order.studioEditedPhotoUrl || "").trim() && (
                            <span
                              style={{
                                display: "block",
                                marginTop: "7px",
                                fontSize: "10px",
                                color: "#168a4b",
                                fontWeight: 800,
                              }}
                            >
                              ✓ Studio-edited design is currently attached to this order.
                            </span>
                          )}
                        </div>

                        {String(order.photoUrl || "").trim() ? (
                          <div className="photo-lines-list">
                            <div className="photo-line-item new-item">
                              <div
                                className="thumb-box"
                                style={{ position: "relative" }}
                              >
                                <img
                                  src={String(order.photoUrl).trim()}
                                  alt="Bulk package magnet design"
                                  style={{
                                    filter: `brightness(${getPhotoBrightness(order.orderId, 0)}%)`,
                                  }}
                                />
                              </div>

                              <div className="photo-info">
                                <strong>
                                  Same design × {Math.max(1, Number(order.quantity) || 1)}
                                </strong>

                                <span className="status-pill new">
                                  🖼️ One Photo • Print All
                                </span>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    marginTop: "7px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      color: "#64748b",
                                    }}
                                  >
                                    Brightness {getPhotoBrightness(order.orderId, 0)}%
                                  </span>

                                  <input
                                    type="range"
                                    min="70"
                                    max="130"
                                    step="1"
                                    value={getPhotoBrightness(order.orderId, 0)}
                                    onChange={(event) =>
                                      setPhotoBrightness(
                                        order.orderId,
                                        0,
                                        Number(event.target.value)
                                      )
                                    }
                                    aria-label="Brightness for bulk package photo"
                                    style={{
                                      width: "105px",
                                      accentColor: "#7048d8",
                                    }}
                                  />

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPhotoBrightness(order.orderId, 0, 100)
                                    }
                                    style={{
                                      border: "1px solid #d8c8ee",
                                      background: "#faf7ff",
                                      color: "#7048d8",
                                      borderRadius: "8px",
                                      padding: "4px 8px",
                                      fontSize: "10px",
                                      fontWeight: 900,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="no-photos">
                            No prepared package photo is available.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h3>
                          Guest Uploads Stream ({photosReceived} received / {magnetsIncluded} included)
                        </h3>

                        <p
                          style={{
                            margin: "0 0 10px",
                            fontSize: "11px",
                            color: "#64748b",
                          }}
                        >
                          Adjust brightness for individual photos before batch printing. These adjustments are for this Party Hub session only.
                        </p>

                        {photos.length === 0 ? (
                          <p className="no-photos">
                            Awaiting guest uploads via QR code...
                          </p>
                        ) : (
                          <div className="photo-lines-list">
                            {photos.map((imgSrc: string, i: number) => {
                              const isDone = completedIndices.includes(i);
                              const isSelected = selectedIndices.includes(i);

                              return (
                                <div
                                  key={i}
                                  className={`photo-line-item ${isDone ? "done-item" : "new-item"}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectPhoto(order.orderId, i)}
                                    aria-label={`Select photo ${i + 1}`}
                                  />

                                  <div className="thumb-box" style={{ position: "relative" }}>
                                    <img
                                      src={imgSrc}
                                      alt={`Upload ${i + 1}`}
                                      style={{ filter: `brightness(${getPhotoBrightness(order.orderId, i)}%)` }}
                                    />
                                  </div>

                                  <div className="photo-info">
                                    <strong>Photo #{i + 1}</strong>

                                    <span className={`status-pill ${isDone ? "done" : "new"}`}>
                                      {isDone ? "✓ Done (Printed)" : "✨ New Upload"}
                                    </span>

                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        marginTop: "7px",
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          fontWeight: 800,
                                          color: "#64748b",
                                        }}
                                      >
                                        Brightness {getPhotoBrightness(order.orderId, i)}%
                                      </span>

                                      <input
                                        type="range"
                                        min="70"
                                        max="130"
                                        step="1"
                                        value={getPhotoBrightness(order.orderId, i)}
                                        onChange={(event) =>
                                          setPhotoBrightness(
                                            order.orderId,
                                            i,
                                            Number(event.target.value)
                                          )
                                        }
                                        aria-label={`Brightness for photo ${i + 1}`}
                                        style={{ width: "105px", accentColor: "#7048d8" }}
                                      />

                                      <button
                                        type="button"
                                        onClick={() => setPhotoBrightness(order.orderId, i, 100)}
                                        style={{
                                          border: "1px solid #d8c8ee",
                                          background: "#faf7ff",
                                          color: "#7048d8",
                                          borderRadius: "8px",
                                          padding: "4px 8px",
                                          fontSize: "10px",
                                          fontWeight: 900,
                                          cursor: "pointer",
                                        }}
                                      >
                                        Reset
                                      </button>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className={`button ${isDone ? "secondary" : "primary"}`}
                                    style={{ fontSize: "12px", padding: "6px 14px", minHeight: "34px" }}
                                    onClick={() => togglePhotoDone(order.orderId, i)}
                                  >
                                    {isDone ? "Mark New" : "Mark Done ✓"}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            }
          )
        )}
      </div>

      {/* FINAL PAYMENT MODAL */}
      {/* ===================================================== */}

      {paymentOrder && (
        <div
          className="payment-modal-overlay"
          onClick={() => {
            if (!paymentBusy) {
              setPaymentOrder(
                null
              );
            }
          }}
        >
          <div
            className="payment-modal"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                if (!paymentBusy) {
                  setPaymentOrder(
                    null
                  );
                }
              }}
              disabled={
                paymentBusy
              }
            >
              ×
            </button>

            <div className="payment-modal-icon">
              💳
            </div>

            <h2>
              Collect Final Payment
            </h2>

            <p className="payment-customer">
              {paymentOrder.customerName}
              {" · "}
              {paymentOrder.packageId
                ?.toUpperCase()}{" "}
              Package
            </p>

            <div className="modal-payment-total">
              <span>
                Total Due at Event
              </span>

              <strong>
                {formatMoney(
                  getTotalDueAtEvent(
                    paymentOrder
                  )
                )}
              </strong>

              <div className="modal-payment-breakdown">
                <span>
                  Package balance: {formatMoney(getPackageBalanceDue(paymentOrder))}
                </span>
                <span>
                  Additional magnets: {getAdditionalMagnets(paymentOrder)} × {formatMoney(ADDITIONAL_MAGNET_PRICE)} = {formatMoney(getAdditionalMagnetCharge(paymentOrder))}
                </span>
              </div>
            </div>

            <div className="payment-method-title">
              Choose payment method
            </div>

            <div className="payment-method-grid">
              <button
                type="button"
                className={`payment-method-card ${
                  paymentMethod ===
                  "cash"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setPaymentMethod(
                    "cash"
                  )
                }
                disabled={
                  paymentBusy
                }
              >
                <span className="payment-method-icon">
                  💵
                </span>

                <strong>
                  Cash
                </strong>

                <small>
                  Record cash received
                </small>
              </button>

              <button
                type="button"
                className={`payment-method-card ${
                  paymentMethod ===
                  "upi"
                    ? "selected"
                    : ""
                }`}
                onClick={() =>
                  setPaymentMethod(
                    "upi"
                  )
                }
                disabled={
                  paymentBusy
                }
              >
                <span className="payment-method-icon">
                  📱
                </span>

                <strong>
                  UPI / Razorpay
                </strong>

                <small>
                  Pay securely online
                </small>
              </button>
            </div>

            {paymentMethod ===
              "cash" && (
              <button
                type="button"
                className="confirm-payment-button"
                disabled={
                  paymentBusy
                }
                onClick={() =>
                  recordCashFinalPayment(
                    paymentOrder
                  )
                }
              >
                {paymentBusy
                  ? "Recording..."
                  : `✓ Confirm Final Payment · ${formatMoney(
                      getTotalDueAtEvent(
                        paymentOrder
                      )
                    )}`}
              </button>
            )}

            {paymentMethod ===
              "upi" && (
              <button
                type="button"
                className="confirm-payment-button"
                disabled={
                  paymentBusy
                }
                onClick={() =>
                  startUpiFinalPayment(
                    paymentOrder
                  )
                }
              >
                {paymentBusy
                  ? "Opening Payment..."
                  : `📱 Pay Final Amount · ${formatMoney(
                      getTotalDueAtEvent(
                        paymentOrder
                      )
                    )}`}
              </button>
            )}

            <p className="payment-note">
              The original advance payment remains recorded separately.
              The final payment includes the package balance and every
              magnet above the included package quantity at ₹120 each.
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .party-hub-root {
          min-height: 100vh;
          background: #f8fafc;
          padding: 24px;
          font-family: system-ui, sans-serif;
          box-sizing: border-box;
        }

        .party-hub-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          background: #fff;
          padding: 18px 24px;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          margin-bottom: 24px;
          box-shadow:
            0 4px 12px
            rgba(0, 0, 0, 0.04);
        }

        .header-title {
          flex: 1;
        }

        .header-title h1 {
          margin: 0;
          font-size: 22px;
          color: #0f172a;
        }

        .header-title p {
          margin: 2px 0 0;
          font-size: 13px;
          color: #64748b;
        }

        .party-hub-content {
          display: grid;
          gap: 20px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .empty-state {
          text-align: center;
          padding: 60px;
          background: #fff;
          border-radius: 20px;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .party-card {
          background: #fff;
          border-radius: 22px;
          padding: 24px;
          border: 1px solid #e2e8f0;
          box-shadow:
            0 10px 30px
            rgba(0, 0, 0, 0.04);
        }

        .party-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 16px;
          margin-bottom: 16px;
          gap: 12px;
          flex-wrap: wrap;
        }

        .badge-tier {
          display: inline-block;
          background: #f0ebff;
          color: #7048d8;
          font-size: 10px;
          font-weight: 900;
          padding: 3px 10px;
          border-radius: 999px;
          margin-bottom: 6px;
        }

        .party-card-header h2 {
          margin: 0 0 4px;
          font-size: 20px;
          color: #0f172a;
        }

        .party-card-header p {
          margin: 3px 0 0;
          font-size: 13px;
          color: #64748b;
        }

        .party-actions {
          display: flex;
          gap: 8px;
        }

        .button {
          border: none;
          border-radius: 10px;
          padding: 9px 15px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            opacity 0.15s ease;
        }

        .button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .button.primary {
          background: #7048d8;
          color: #fff;
        }

        .button.secondary {
          background: #f1f5f9;
          color: #334155;
        }

        /* ----------------------------------------------- */
        /* PAYMENT SUMMARY */
        /* ----------------------------------------------- */

        .payment-summary {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }

        .payment-box {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 12px 14px;
          background: #f8fafc;
        }

        .payment-box span {
          display: block;
          font-size: 9px;
          font-weight: 900;
          color: #64748b;
          margin-bottom: 5px;
          letter-spacing: 0.05em;
        }

        .payment-box strong {
          font-size: 17px;
          color: #0f172a;
        }

        .advance-box {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .payment-box small {
          display: block;
          margin-top: 4px;
          font-size: 10px;
          color: #64748b;
          line-height: 1.35;
        }

        .additional-box {
          background: #f8f5ff;
          border-color: #ddd6fe;
        }

        .additional-box strong {
          color: #6d28d9;
        }

        .additional-charge-box {
          background: #fff7ed;
          border-color: #fed7aa;
        }

        .additional-charge-box strong {
          color: #c2410c;
        }

        .advance-box strong {
          color: #166534;
        }

        .balance-box {
          background: #fff7ed;
          border-color: #fed7aa;
        }

        .balance-box strong {
          color: #c2410c;
        }

        .paid-box {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .paid-box strong {
          color: #15803d;
          font-size: 14px;
        }

        .balance-button {
          border: none;
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #ec3e82,
            #7048d8
          );
          color: #fff;
          padding: 10px 16px;
          min-width: 150px;
          cursor: pointer;
          font-weight: 900;
          font-size: 13px;
          box-shadow:
            0 5px 15px
            rgba(112, 72, 216, 0.22);
        }

        .balance-button small {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          opacity: 0.9;
        }

        .paid-full-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 150px;
          padding: 10px 14px;
          border-radius: 14px;
          background: #dcfce7;
          color: #166534;
          border: 1px solid #bbf7d0;
          font-size: 12px;
          font-weight: 900;
        }

        /* ----------------------------------------------- */
        /* FRAME */
        /* ----------------------------------------------- */

        /* ----------------------------------------------- */
        /* CUSTOM BACKGROUND PREVIEW */
        /* ----------------------------------------------- */

        .background-preview-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
        }

        .background-preview {
          width: 180px;
          height: 120px;
          max-width: 180px;
          max-height: 120px;
          border-radius: 12px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex: 0 0 180px;
        }

        .background-preview img {
          display: block;
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        /* ----------------------------------------------- */
        /* FRAME */
        /* ----------------------------------------------- */

        .frame-section {
          border: 1px solid #e2e8f0;
          background: #fafafa;
          border-radius: 16px;
          padding: 15px;
          margin-bottom: 18px;
        }

        .frame-section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 12px;
        }

        .frame-section-header h3 {
          margin: 0;
          font-size: 14px;
          color: #334155;
        }

        .frame-section-header p {
          margin: 3px 0 0;
          font-size: 11px;
          color: #94a3b8;
        }

        .frame-preview-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
        }

        .frame-preview {
          width: 90px;
          height: 90px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .frame-preview img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .frame-status {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .frame-status strong {
          font-size: 13px;
          color: #15803d;
        }

        .frame-status span {
          font-size: 11px;
          color: #64748b;
          line-height: 1.5;
        }

        .frame-empty {
          padding: 12px;
          border-radius: 10px;
          background: #fff;
          border: 1px dashed #cbd5e1;
          color: #94a3b8;
          font-size: 12px;
          text-align: center;
        }

        /* ----------------------------------------------- */
        /* PHOTOS */
        /* ----------------------------------------------- */

        .party-photos-stream h3 {
          font-size: 14px;
          color: #334155;
          margin: 0 0 12px;
          font-weight: 800;
        }

        .no-photos {
          font-size: 13px;
          color: #94a3b8;
          font-style: italic;
          margin: 0;
        }

        .photo-lines-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 420px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .photo-line-item {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #fff;
          border: 1.5px solid #e2e8f0;
          border-radius: 14px;
          padding: 10px 14px;
          transition: all 0.15s ease;
        }

        .photo-line-item.done-item {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .photo-line-item.new-item {
          background: #fff;
          border-color: #e2e8f0;
        }

        .thumb-box {
          width: 50px;
          height: 50px;
          border-radius: 10px;
          overflow: hidden;
          background: #f1f5f9;
          flex-shrink: 0;
          border: 1px solid #cbd5e1;
        }

        .thumb-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .photo-info {
          flex: 1;
        }

        .photo-info strong {
          display: block;
          font-size: 13px;
          color: #0f172a;
          margin-bottom: 3px;
        }

        .status-pill {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 6px;
        }

        .status-pill.new {
          background: #fef3c7;
          color: #b45309;
        }

        .status-pill.done {
          background: #dcfce7;
          color: #166534;
        }

        /* ----------------------------------------------- */
        /* PAYMENT MODAL */
        /* ----------------------------------------------- */

        .payment-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(
            15,
            23,
            42,
            0.58
          );
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
        }

        .payment-modal {
          position: relative;
          width: 100%;
          max-width: 480px;
          background: #fff;
          border-radius: 24px;
          padding: 28px;
          box-sizing: border-box;
          box-shadow:
            0 25px 70px
            rgba(0, 0, 0, 0.22);
        }

        .modal-close {
          position: absolute;
          top: 12px;
          right: 14px;
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 50%;
          background: #f1f5f9;
          color: #475569;
          font-size: 22px;
          cursor: pointer;
        }

        .modal-close:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .payment-modal-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: #f0ebff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 30px;
          margin-bottom: 12px;
        }

        .modal-payment-breakdown {
          margin-top: 10px;
          display: grid;
          gap: 4px;
        }

        .modal-payment-breakdown span {
          display: block;
          color: #9a3412;
          font-size: 10px;
          font-weight: 700;
        }

        .payment-modal h2 {
          margin: 0;
          font-size: 24px;
          color: #0f172a;
        }

        .payment-customer {
          margin: 4px 0 20px;
          color: #64748b;
          font-size: 13px;
        }

        .modal-payment-total {
          background: #fff7ed;
          border: 1px solid #fed7aa;
          border-radius: 16px;
          padding: 15px;
          text-align: center;
          margin-bottom: 20px;
        }

        .modal-payment-total span {
          display: block;
          color: #9a3412;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 3px;
        }

        .modal-payment-total strong {
          display: block;
          color: #c2410c;
          font-size: 30px;
        }

        .payment-method-title {
          font-size: 12px;
          font-weight: 900;
          color: #334155;
          margin-bottom: 8px;
        }

        .payment-method-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 18px;
        }

        .payment-method-card {
          border: 2px solid #e2e8f0;
          background: #fff;
          border-radius: 14px;
          padding: 14px 10px;
          cursor: pointer;
          text-align: center;
        }

        .payment-method-card.selected {
          border-color: #7048d8;
          background: #f8f5ff;
        }

        .payment-method-card:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .payment-method-icon {
          display: block;
          font-size: 26px;
          margin-bottom: 5px;
        }

        .payment-method-card strong {
          display: block;
          color: #0f172a;
          font-size: 13px;
        }

        .payment-method-card small {
          display: block;
          color: #64748b;
          font-size: 10px;
          margin-top: 3px;
        }

        .confirm-payment-button {
          width: 100%;
          border: none;
          border-radius: 13px;
          padding: 14px;
          background: linear-gradient(
            135deg,
            #ec3e82,
            #7048d8
          );
          color: #fff;
          font-size: 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .confirm-payment-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .payment-note {
          margin: 12px 0 0;
          text-align: center;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.5;
        }

        @media (max-width: 760px) {
          .party-hub-root {
            padding: 12px;
          }

          .party-hub-header {
            flex-wrap: wrap;
            padding: 16px;
          }

          .payment-summary {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .balance-button,
          .paid-full-badge {
            grid-column: 1 / -1;
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .party-card {
            padding: 16px;
          }

          .payment-summary {
            grid-template-columns: 1fr;
          }

          .frame-section-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .frame-section-header .button {
            width: 100%;
          }

          .photo-line-item {
            gap: 8px;
            padding: 8px;
          }

          .photo-line-item .button {
            padding: 6px 8px !important;
            font-size: 10px !important;
          }

          .payment-method-grid {
            grid-template-columns: 1fr;
          }

          .payment-modal {
            padding: 22px;
          }
        }
      `}</style>
    </main>
  );
}