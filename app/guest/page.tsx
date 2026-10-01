"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Cropper from "react-easy-crop";
import { FRAMES, type Frame } from "@/lib/frames";
import { type CropState, type Order } from "@/lib/order";
import { createFinalMagnetImage } from "@/components/finalMagnet";
import { savePhoto } from "@/lib/storage";

type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const EMPTY_CROP: CropState = {
  x: 0,
  y: 0,
  zoom: 1,
};

function GuestUploadContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";

  const [partyOrder, setPartyOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [photo, setPhoto] = useState("");
  const [crop, setCrop] = useState<CropState>(EMPTY_CROP);
  const [cropPixels, setCropPixels] =
    useState<CropPixels | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  async function loadParty() {
    if (!orderId) {
      setLoading(false);
      setError("No party order was specified.");
      return;
    }

    try {
      const res = await fetch("/api/orders", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(
          "Could not load the celebration details."
        );
      }

      const data = await res.json();

      const target = (data.orders || []).find(
        (o: Order) => o.orderId === orderId
      );

      if (target) {
        setPartyOrder(target);

        if (
          target.frameId ||
          target.appliedFrameId
        ) {
          setError("");
        }
      } else {
        setError(
          "Party order could not be found."
        );
      }
    } catch (err) {
      console.error(
        "Failed to load party order details:",
        err
      );

      setPartyOrder((current) => current);

      if (!partyOrder) {
        setError(
          "Could not load the celebration details."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParty();

    const interval = setInterval(() => {
      loadParty();
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId]);

  const frameValue =
    (partyOrder as any)?.frameId ||
    (partyOrder as any)?.appliedFrameId ||
    "";

  const activeFrame: Frame | null = (() => {
    if (!frameValue) {
      return null;
    }

    const frameId = String(frameValue);

    const builtInFrame = FRAMES.find(
      (f) => f.id === frameId
    );

    if (builtInFrame) {
      return builtInFrame;
    }

    if (
      frameId.startsWith("https://") ||
      frameId.startsWith("http://") ||
      frameId.startsWith("data:image/")
    ) {
      return {
        id: "custom-uploaded-frame",
        name: "Custom Uploaded Frame",
        src: frameId,
      } as Frame;
    }

    return null;
  })();

  /*
   * Party Hub can save a custom background as a
   * Firebase Storage URL. Keep this completely
   * independent from the built-in backgroundId.
   */
  const customBackgroundSrc =
    String(
      (partyOrder as any)?.customBackgroundUrl ||
        ""
    ).trim() || null;

  const productValue = String(
    (partyOrder as any)?.productType ||
      (partyOrder as any)?.product ||
      (partyOrder as any)?.productId ||
      (partyOrder as any)?.shape ||
      ""
  ).toLowerCase();

  const isKeychain =
    productValue.includes("keychain");

  const isCircle =
    !isKeychain &&
    productValue.includes("circle");

  const keychainBackMode = String(
    (partyOrder as any)?.keychainBackMode ||
      (partyOrder as any)?.partyKeychainBackMode ||
      (partyOrder as any)?.sharedKeychainBackMode ||
      ""
  ).toLowerCase();

  const sharedKeychainBackUrl = String(
    (partyOrder as any)?.sharedKeychainBackUrl ||
      (partyOrder as any)?.sharedKeychainBackPhotoUrl ||
      (partyOrder as any)?.keychainBackUrl ||
      (partyOrder as any)?.keychainBackPhotoUrl ||
      ""
  ).trim();

  const sharedKeychainBackRequested =
    isKeychain &&
    (
      keychainBackMode === "shared" ||
      Boolean(
        (partyOrder as any)?.keychainBackRequested ||
        (partyOrder as any)?.keychainBackRequest ||
        (partyOrder as any)?.keychainBackNotes ||
        (partyOrder as any)?.sharedKeychainBackRequest ||
        (partyOrder as any)?.sharedKeychainBackNotes
      ) ||
      sharedKeychainBackUrl !== ""
    );

  /*
   * PRODUCT ARTWORK / FINISHED AREA RATIO
   *
   * Square:
   * Complete artwork = 61 mm
   * Finished magnet = 52 mm
   *
   * Circle:
   * Complete artwork = 66 mm
   * Finished magnet = 58 mm
   *
   * Square values are locked and must not change.
   */
  const finishedAreaRatio = isKeychain
    ? 1
    : isCircle
    ? 58 / 66
    : 52 / 61;

  function readPhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      setError(
        "Please select an image file."
      );
      return;
    }

    setError("");

    const reader = new FileReader();

    reader.onload = () => {
      setPhoto(String(reader.result));
      setCrop(EMPTY_CROP);
      setCropPixels(null);
    };

    reader.onerror = () => {
      setError(
        "Could not read the selected photo."
      );
    };

    reader.readAsDataURL(file);
  }

  async function handleGuestSubmit() {
    if (!photo) {
      setError(
        "Please select a photo to upload."
      );
      return;
    }

    if (!guestName.trim()) {
      setError(
        "Please enter your name so the host knows whose picture this is!"
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      /*
       * Create the final print-ready magnet image.
       *
       * A Party Hub uploaded custom background is
       * passed through when available. Otherwise the
       * generator behaves exactly as before.
       */
      const finalMagnetImage =
        await createFinalMagnetImage({
          photo,
          frameSrc:
            isKeychain
              ? null
              : activeFrame?.src || null,
          cropPixels,
          customBackgroundSrc:
            isKeychain
              ? null
              : customBackgroundSrc,
          shape: isKeychain
            ? "keychain"
            : isCircle
            ? "circle"
            : "square",
        });

      /*
       * Upload the actual image files to Firebase Storage.
       *
       * Firestore receives only the resulting URLs.
       */
      const guestStorageId =
        `GUEST-${Date.now()}`;

      const originalPhotoUrl =
        await savePhoto(
          photo,
          guestStorageId,
          "original.jpg"
        );

      const finalPhotoUrl =
        await savePhoto(
          finalMagnetImage,
          guestStorageId,
          "final-magnet.png"
        );

      /*
       * Send only Storage URLs to the API.
       */
      const res = await fetch(
        "/api/guest-upload",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            partyOrderId: orderId,
            guestName:
              guestName.trim(),
            photoData:
              finalPhotoUrl,
            rawPhotoData:
              originalPhotoUrl,
          }),
        }
      );

      if (!res.ok) {
        let message =
          "Could not send photo to printing queue.";

        try {
          const data =
            await res.json();

          if (data?.error) {
            message = data.error;
          }
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }

      setSuccess(true);
    } catch (err: unknown) {
      console.error(
        "Guest upload failed:",
        err
      );

      const message =
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="guest-container">
        <div className="guest-card loading-card">
          <p>
            Loading celebration station...
          </p>
        </div>
      </div>
    );
  }

  /*
   * PHOTO RECEIVED PAGE
   */
  if (success) {
    return (
      <div className="guest-container">
        <div className="guest-card success-card">

          <img
            src="/logo.png"
            alt="Mogified Moments"
            className="success-logo"
          />

          <div className="success-icon">
            📸 ✨
          </div>

          <h2>
            Photo Received!
          </h2>

          <p>
            Thank you,{" "}
            <b>{guestName}</b>! Your
            photo is now in the queue
            and will be printed on a
            keepsake magnet.
          </p>

          <button
            type="button"
            className="guest-btn"
            onClick={() => {
              setPhoto("");
              setCrop(EMPTY_CROP);
              setCropPixels(null);
              setError("");
              setSuccess(false);
            }}
          >
            Upload Another Photo
          </button>

        </div>
      </div>
    );
  }

  return (
    <div className="guest-container">
      <div className="guest-card">

        <div className="guest-header">

          <img
            src="/logo.png"
            alt="Mogified Moments"
            className="guest-logo"
          />

          <span className="party-badge">
            🎉 Live Celebration Station
          </span>

          <h1>
            {partyOrder?.eventName ||
              "Celebration Magnet Station"}
          </h1>

          <p className="event-subtitle">
            {isKeychain
              ? sharedKeychainBackRequested
                ? "Upload your photo for the front of your event keychain. The host has prepared the back for everyone."
                : "Upload your photo for your event keychain."
              : "Upload your photo to get printed live on a keepsake magnet!"}
          </p>

        </div>

        <div className="guest-body">

          <label className="guest-field">

            <span>
              Your Name *
            </span>

            <input
              type="text"
              value={guestName}
              onChange={(e) =>
                setGuestName(
                  e.target.value
                )
              }
              placeholder="e.g. Rahul, Priya, Uncle Sam"
            />

          </label>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {

              const file =
                e.target.files?.[0];

              if (file) {
                readPhoto(file);
              }

              e.target.value = "";

            }}
          />

          {!photo ? (

            <div
              className="upload-box"
              onClick={() =>
                fileRef.current?.click()
              }
            >

              <span className="camera-icon">
                📷
              </span>

              <strong>
                Tap to Select or Snap Photo
              </strong>

              <small>
                Choose from gallery or
                take a selfie
              </small>

            </div>

          ) : (

            <div className="crop-workspace">

              <div
                className={`cropper-frame ${
                  isCircle || isKeychain
                    ? "circle-product"
                    : ""
                }`}
              >

                <Cropper
                  image={photo}
                  crop={{
                    x: crop.x,
                    y: crop.y,
                  }}
                  zoom={crop.zoom}
                  minZoom={0.5}
                  maxZoom={3}
                  aspect={1}
                  cropSize={{
                    width:
                      Math.round(
                        320 *
                          finishedAreaRatio
                      ),
                    height:
                      Math.round(
                        320 *
                          finishedAreaRatio
                      ),
                  }}
                  cropShape={
                    isCircle || isKeychain
                      ? "round"
                      : "rect"
                  }
                  showGrid={false}
                  objectFit="cover"
                  restrictPosition={true}
                  onCropChange={(c) =>
                    setCrop(
                      (prev) => ({
                        ...prev,
                        ...c,
                      })
                    )
                  }
                  onZoomChange={(zoom) =>
                    setCrop(
                      (prev) => ({
                        ...prev,
                        zoom,
                      })
                    )
                  }
                  onCropComplete={(
                    _,
                    areaPixels
                  ) =>
                    setCropPixels(
                      areaPixels
                    )
                  }
                />

                {!isKeychain && activeFrame?.src && (
                  <img
                    src={activeFrame.src}
                    alt=""
                    className="cropper-frame-overlay"
                    draggable={false}
                    onError={() => {
                      console.error(
                        "Could not load party frame:",
                        activeFrame.src
                      );
                    }}
                  />
                )}

                <div
                  className={`artwork-guide ${
                    isCircle || isKeychain
                      ? "circle-guide"
                      : ""
                  }`}
                />

              </div>

              {isKeychain ? (
                <div className="keychain-front-notice">
                  🔑 <strong>36mm Keychain · Front Photo</strong>
                  <span>
                    {sharedKeychainBackRequested
                      ? "The host will use the same back design for every guest."
                      : "Your front photo will be printed on your keychain."}
                  </span>
                </div>
              ) : activeFrame ? (
                <div className="frame-active-notice">
                  🎨 Event frame applied
                </div>
              ) : (
                <div className="frame-waiting-notice">
                  The host has not selected
                  a frame yet.
                </div>
              )}

              <div className="zoom-bar">

                <span>
                  Zoom
                </span>

                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={crop.zoom}
                  onChange={(e) =>
                    setCrop(
                      (prev) => ({
                        ...prev,
                        zoom: Number(
                          e.target.value
                        ),
                      })
                    )
                  }
                />

              </div>

              <div className="zoom-hint">
                Slide left to make the
                photo smaller · Slide
                right to enlarge
              </div>

              <button
                type="button"
                className="change-photo-btn"
                onClick={() =>
                  fileRef.current?.click()
                }
              >
                Choose a different photo
              </button>

            </div>
          )}

          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <button
            type="button"
            className="guest-btn submit-btn"
            disabled={
              !photo || submitting
            }
            onClick={
              handleGuestSubmit
            }
          >
            {submitting
              ? "Sending to Printer..."
              : "Send Photo to Magnet Printer 🚀"}
          </button>

        </div>
      </div>

      <style jsx>{`

        .guest-container {
          min-height: 100vh;
          background: linear-gradient(
            135deg,
            #fce7f3 0%,
            #ede9fe 50%,
            #e0f2fe 100%
          );
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          font-family: system-ui,
            -apple-system, sans-serif;
          box-sizing: border-box;
        }

        .guest-card {
          background: #ffffff;
          border-radius: 20px;
          box-shadow:
            0 10px 25px
            rgba(0, 0, 0, 0.08);
          max-width: 440px;
          width: 100%;
          padding: 24px 20px;
          text-align: center;
          box-sizing: border-box;
        }

        .loading-card {
          text-align: center;
        }

        .guest-logo {
          width: 52px;
          height: auto;
          margin-bottom: 8px;
        }

        /*
         * PHOTO RECEIVED PAGE LOGO
         *
         * Keep the complete logo visible while
         * preserving its natural aspect ratio.
         */
        .success-logo {
          display: block !important;
          width: 180px !important;
          max-width: 180px !important;
          height: auto !important;
          max-height: none !important;
          object-fit: contain !important;
          margin: 0 auto 12px !important;
        }

        .party-badge {
          display: inline-block;
          background: #fdf2f8;
          color: #db2777;
          border: 1px solid #fbcfe8;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .guest-header h1 {
          font-size: 22px;
          font-weight: 900;
          color: #1e1b4b;
          margin: 0 0 4px;
        }

        .event-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 0 0 18px;
        }

        .guest-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
          text-align: left;
        }

        .guest-field span {
          display: block;
          font-size: 12px;
          font-weight: 800;
          color: #334155;
          margin-bottom: 4px;
        }

        .guest-field input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
        }

        .guest-field input:focus {
          border-color: #7048d8;
          box-shadow:
            0 0 0 3px
            rgba(112, 72, 216, 0.1);
        }

        .upload-box {
          border: 2px dashed #c084fc;
          background: #faf5ff;
          border-radius: 14px;
          padding: 24px 16px;
          text-align: center;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .upload-box:hover {
          background: #f5edff;
        }

        .camera-icon {
          font-size: 32px;
          margin-bottom: 4px;
        }

        .upload-box strong {
          font-size: 15px;
          color: #7048d8;
        }

        .upload-box small {
          font-size: 12px;
          color: #64748b;
        }

        .crop-workspace {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          width: 100%;
        }

        .cropper-frame {
          width: 320px;
          height: 320px;
          margin: 0 auto;
          position: relative;
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .cropper-frame
          :global(.reactEasyCrop_Container) {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }

        .cropper-frame.circle-product {
          border-radius: 50% !important;
        }

        .cropper-frame.circle-product
          :global(.reactEasyCrop_Container) {
          border-radius: 50% !important;
          overflow: hidden;
        }

        .cropper-frame-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          z-index: 20;
          user-select: none;
        }

        .artwork-guide {
          position: absolute;
          left: 5%;
          top: 5%;
          width: 90%;
          height: 90%;
          border: 1.5px dashed
            rgba(255, 255, 255, 0.75);
          pointer-events: none;
          z-index: 21;
          box-sizing: border-box;
        }

        .artwork-guide.circle-guide {
          border-radius: 50%;
        }

        .frame-active-notice {
          width: 100%;
          box-sizing: border-box;
          background: #f0ebff;
          color: #7048d8;
          border: 1px solid #ddd2ff;
          border-radius: 9px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 800;
          text-align: center;
        }

        .frame-waiting-notice {
          width: 100%;
          box-sizing: border-box;
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 700;
          text-align: center;
        }

        .keychain-front-notice {
          width: 100%;
          box-sizing: border-box;
          background: #fff7ed;
          color: #9a3412;
          border: 1px solid #fed7aa;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .keychain-front-notice span {
          font-size: 10px;
          font-weight: 600;
          color: #c2410c;
          line-height: 1.4;
        }

        .zoom-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .zoom-bar span {
          font-size: 12px;
          font-weight: 800;
          color: #475569;
        }

        .zoom-bar input {
          flex: 1;
        }

        .zoom-hint {
          width: 100%;
          text-align: center;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.4;
        }

        .change-photo-btn {
          background: none;
          border: none;
          color: #7048d8;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          text-decoration: underline;
        }

        .error-box {
          background: #fef2f2;
          color: #dc2626;
          font-size: 12px;
          font-weight: 700;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #fecaca;
          text-align: center;
        }

        .guest-btn {
          background: linear-gradient(
            135deg,
            #ec3e82 0%,
            #7048d8 100%
          );
          color: #ffffff;
          border: none;
          padding: 13px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 900;
          cursor: pointer;
          box-shadow:
            0 4px 14px
            rgba(236, 62, 130, 0.35);
          width: 100%;
        }

        .guest-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .success-card {
          padding: 36px 20px;
        }

        .success-icon {
          font-size: 48px;
          margin: 12px 0 8px;
        }

        .success-card h2 {
          margin: 0 0 8px;
          color: #1e1b4b;
        }

        .success-card p {
          margin: 0 0 20px;
          color: #64748b;
          font-size: 14px;
          line-height: 1.6;
        }

        @media (max-width: 380px) {

          .guest-card {
            padding: 20px 14px;
          }

          .cropper-frame {
            width: min(
              320px,
              88vw
            );
            height: min(
              320px,
              88vw
            );
          }

          .success-logo {
            width: 160px !important;
            max-width: 160px !important;
          }

        }

      `}</style>
    </div>
  );
}

export default function GuestPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: "40px",
            textAlign: "center",
          }}
        >
          Loading station...
        </div>
      }
    >
      <GuestUploadContent />
    </Suspense>
  );
}
