"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import {
  calculateCartPrice,
  type ProductId,
} from "../lib/products";
import { FRAMES, type Frame } from "../lib/frames";
import { BACKGROUNDS, type BackgroundId } from "../lib/backgrounds";
import { PARTY_PACKAGES, type PartyPackage } from "../lib/packages";
import {
  makeOrderId,
  type CropState,
  type Order,
  type FulfillmentType,
  type DeliveryAddress,
} from "../lib/order";
import { nextOrderNumber } from "../lib/orders";
import { savePhoto } from "../lib/storage";
import { createFinalMagnetImage } from "./finalMagnet";

const EMPTY_CROP: CropState = { x: 0, y: 0, zoom: 1 };

const GOA_PINCODES: Record<string, string> = {
  "403001": "Panaji",
  "403002": "Fontainhas / Mala",
  "403110": "Santa Cruz",
  "403401": "Ponda",
  "403501": "Bicholim",
  "403504": "Aldona",
  "403507": "Mapusa",
  "403509": "Anjuna",
  "403511": "Siolim",
  "403512": "Morjim / Mandrem",
  "403515": "Candolim",
  "403516": "Calangute",
  "403519": "Vagator",
  "403521": "Porvorim",
  "403601": "Margao",
  "403706": "Vasco da Gama",
  "403708": "Colva",
  "403713": "Benaulim",
};

type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mm-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

type Step = 1 | 2 | 3 | 4;
type OrderMode = "stall" | "party";
type PaymentMethod = "upi" | "cash";

type PaymentDetails = {
  paymentMethod: PaymentMethod;
  paymentStatus: "Paid" | "Pending" | "Advance Paid";
  paymentTransactionId: string | null;
  paymentUpiId: string | null;
  promoCodeUsed: string | null;
};

type CartItem = {
  id: string;
  productId: ProductId | "leather_name_keychain";
  quantity: number;
  photo: string;
  photoBack?: string;
  keychainStrap?: "leather" | "pearl";
  crop: CropState;
  cropPixels?: CropPixels | null;
  cropBack?: CropState;
  cropPixelsBack?: CropPixels | null;
  frameId: string | null;
  customFrameSrc?: string | null;
  customWatermark?: string;
  backgroundId?: BackgroundId | null;
};

type PlacedOrder = Order &
  PaymentDetails & {
    batchId: string;
    token?: string;
    originalPhotoUrl?: string;
  };

const loadRazorpayScript = () => {
  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CustomerApp() {
  const [step, setStep] = useState<Step>(1);
  const [orderMode, setOrderMode] = useState<OrderMode>("stall");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [isQueuePaused, setIsQueuePaused] = useState(false);

  // Promo code states
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    label: string;
    discountPercent: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState("");

  // Product and design states (Including party-exclusive leather_name_keychain)
  const [product, setProduct] = useState<ProductId | "leather_name_keychain">("square");
  const [photoBack, setPhotoBack] = useState("");
  const [keychainStrap, setKeychainStrap] = useState<"leather" | "pearl">("leather");
  const [cropBack, setCropBack] = useState<CropState>(EMPTY_CROP);
  const [cropPixelsBack, setCropPixelsBack] = useState<CropPixels | null>(null);
  const [partyKeychainStrap, setPartyKeychainStrap] = useState<"leather" | "pearl" | "mix">("leather");
  const [quantity, setQuantity] = useState(1);
  const [photo, setPhoto] = useState("");
  const [crop, setCrop] = useState<CropState>(EMPTY_CROP);
  const [cropPixels, setCropPixels] = useState<CropPixels | null>(null);
  const [frameId, setFrameId] = useState<string | null>(null);
  const [frameCategory, setFrameCategory] = useState("All");
  const [backgroundId, setBackgroundId] = useState<BackgroundId | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customWatermark, setCustomWatermark] = useState<string>("");

  // Custom frame upload & Live Camera
  const [customCustomerFrameSrc, setCustomCustomerFrameSrc] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"front" | "back">("front");
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Party Package state
  const [selectedPackage, setSelectedPackage] = useState<PartyPackage | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [eventVenue, setEventVenue] = useState("");
  const [paymentOption, setPaymentOption] = useState<"advance" | "full">("advance");
  const [customFrameRequested, setCustomFrameRequested] = useState(false);
  const [customFrameNotes, setCustomFrameNotes] = useState("");
  const [customBackgroundRequested, setCustomBackgroundRequested] = useState(false);
  const [customBackgroundNotes, setCustomBackgroundNotes] = useState("");

  const [bookedDates, setBookedDates] = useState<string[]>([]);

  const todayString = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [placedOrders, setPlacedOrders] = useState<PlacedOrder[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");

  const fileRef = useRef<HTMLInputElement>(null);
  const fileBackRef = useRef<HTMLInputElement>(null);
  const customFrameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const qId = urlParams.get("orderId") || urlParams.get("token");
      if (qId) {
        sessionStorage.setItem("mm_active_order", qId);
      } else {
        const savedId = sessionStorage.getItem("mm_active_order");
        if (savedId && !window.location.search) {
          window.history.replaceState({}, "", `?orderId=${savedId}`);
        }
      }
    }
  }, []);

  const selectedFrame: Frame | null = useMemo(() => {
    if (customCustomerFrameSrc) {
      return {
        id: "custom-customer-frame",
        name: "Custom Uploaded Frame",
        src: customCustomerFrameSrc,
        shape: product === "circle" ? "circle" : "square",
        category: "Custom",
      };
    }

    return (
      FRAMES.find(
        (item) =>
          item.id === frameId &&
          item.shape === (product === "circle" ? "circle" : "square")
      ) ?? null
    );
  }, [customCustomerFrameSrc, frameId, product]);

  const categories = useMemo(() => {
    const productFrames = FRAMES.filter(
      (f) => f.shape === (product === "circle" ? "circle" : "square")
    );
    return ["All", ...Array.from(new Set(productFrames.map((f) => f.category)))];
  }, [product]);

  const visibleFrames = useMemo(
    () =>
      FRAMES.filter(
        (f) =>
          f.shape === (product === "circle" ? "circle" : "square") &&
          (frameCategory === "All" || f.category === frameCategory)
      ),
    [frameCategory, product]
  );

  const totalCartQuantity = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const pricingResult = useMemo(
    () => calculateCartPrice(totalCartQuantity),
    [totalCartQuantity]
  );

  const rawBaseOrderTotal = useMemo(() => {
    if (selectedPackage) {
      return selectedPackage.packagePrice;
    }
    return pricingResult.finalPrice;
  }, [selectedPackage, pricingResult]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) return 0;
    return Math.round(rawBaseOrderTotal * (appliedDiscount.discountPercent / 100));
  }, [rawBaseOrderTotal, appliedDiscount]);

  const baseOrderTotal = Math.max(0, rawBaseOrderTotal - discountAmount);

  const deliveryFee = 0;
  const giftWrapFee = 0;
  const grossTotal = baseOrderTotal + deliveryFee + giftWrapFee;

  const payableAmountNow = useMemo(() => {
    if (selectedPackage) {
      if (paymentOption === "advance") {
        return Math.round(baseOrderTotal * 0.5);
      }
      return baseOrderTotal;
    }
    return grossTotal;
  }, [selectedPackage, paymentOption, baseOrderTotal, grossTotal]);

  const balanceDueAmount = useMemo(() => {
    if (!selectedPackage) return 0;
    return baseOrderTotal - payableAmountNow;
  }, [selectedPackage, baseOrderTotal, payableAmountNow]);

  async function handleApplyPromo() {
    const code = promoCode.trim().toUpperCase();
    setDiscountError("");
    if (!code) return;

    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone }),
      });
      const result = await res.json();
      if (!res.ok || !result.valid) {
        setAppliedDiscount(null);
        setDiscountError(result.message || "Invalid or already used coupon code.");
        return;
      }

      const discountPercent = result.discountType === "percentage"
        ? Number(result.discountAmount || 0)
        : Math.round(((Number(result.discountAmount || 0)) / Math.max(1, rawBaseOrderTotal)) * 100);
      setAppliedDiscount({
        code,
        label: result.discountType === "percentage"
          ? `${discountPercent}% OFF Voucher`
          : `₹${Number(result.discountAmount || 0)} OFF Voucher`,
        discountPercent,
      });
      setPromoCode("");
    } catch {
      setDiscountError("Unable to validate the coupon. Please try again.");
    }
  }

  useEffect(() => {
    const checkQueueStatus = async () => {
      try {
        const res = await fetch("/api/orders");
        if (res.ok) {
          const data = await res.json();
          if (data.isQueuePaused !== undefined) {
            setIsQueuePaused(data.isQueuePaused);
          }
        }
      } catch {}
    };

    checkQueueStatus();
    const timer = setInterval(checkQueueStatus, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchAvailability() {
      try {
        const res = await fetch("/api/availability");
        if (res.ok) {
          const data = await res.json();
          setBookedDates(data.bookedDates || []);
        }
      } catch (err) {
        console.warn("Could not load availability dates:", err);
      }
    }
    fetchAvailability();
  }, []);

  function resetDesign() {
    setQuantity(1);
    setPhoto("");
    setPhotoBack("");
    setCrop(EMPTY_CROP);
    setCropPixels(null);
    setCropBack(EMPTY_CROP);
    setCropPixelsBack(null);
    setFrameId(null);
    setCustomCustomerFrameSrc(null);
    setCustomFrameRequested(false);
    setCustomFrameNotes("");
    setCustomBackgroundRequested(false);
    setCustomBackgroundNotes("");
    setCustomWatermark("");
    setFrameCategory("All");
    setBackgroundId(null);
    setProduct("square");
    setKeychainStrap("leather");
    setEditingId(null);
  }

  function readPhoto(file: File, target: "front" | "back" = "front") {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      if (target === "back") {
        setPhotoBack(result);
        setCropBack(EMPTY_CROP);
        setCropPixelsBack(null);
      } else {
        setPhoto(result);
        setCrop(EMPTY_CROP);
        setCropPixels(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function readCustomFrame(file: File) {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCustomCustomerFrameSrc(String(reader.result));
      setFrameId("custom-customer-frame");
      setCustomFrameRequested(false);
    };
    reader.readAsDataURL(file);
  }

  async function startCamera(target: "front" | "back" = "front", facing: "user" | "environment" = cameraFacingMode) {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false,
      });
      videoStreamRef.current = stream;
      setCameraTarget(target);
      setCameraFacingMode(facing);
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      alert("Unable to open camera. Please use file upload instead.");
    }
  }

  function switchCamera() {
    const nextFacing = cameraFacingMode === "user" ? "environment" : "user";
    startCamera(cameraTarget, nextFacing);
  }

  function captureCamera() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (cameraFacingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    if (cameraTarget === "back") {
      setPhotoBack(dataUrl);
      setCropBack(EMPTY_CROP);
      setCropPixelsBack(null);
    } else {
      setPhoto(dataUrl);
      setCrop(EMPTY_CROP);
      setCropPixels(null);
    }
    stopCamera();
  }

  function stopCamera() {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    setIsCameraActive(false);
  }

  function addToCart() {
    setError("");

    if ((product as string) !== "leather_name_keychain") {
      if (!photo) {
        setError("Please choose or snap a front photo first.");
        return;
      }
      if (product === "keychain" && !photoBack) {
        setError("Please add a back photo for the keychain.");
        return;
      }
    }

    const item: CartItem = {
      id: editingId ?? createClientId(),
      productId: product,
      quantity,
      photo: (product as string) === "leather_name_keychain" ? "/logo.png" : photo,
      photoBack: product === "keychain" ? photoBack : undefined,
      keychainStrap: product === "keychain" || (product as string) === "leather_name_keychain" ? keychainStrap : undefined,
      crop,
      cropPixels,
      cropBack: product === "keychain" ? cropBack : undefined,
      cropPixelsBack: product === "keychain" ? cropPixelsBack : undefined,
      frameId,
      customFrameSrc: customCustomerFrameSrc,
      customWatermark,
      backgroundId,
    };

    setCart((current) =>
      editingId
        ? current.map((existing) => (existing.id === editingId ? item : existing))
        : [...current, item]
    );

    resetDesign();
    setStep(2);
  }

  function removeCartItem(id: string) {
    setCart((current) => current.filter((item) => item.id !== id));
    if (editingId === id) {
      resetDesign();
    }
  }

  function handleSelectPackage(pkg: PartyPackage) {
    setSelectedPackage(pkg);
    setShowPackageModal(false);
    setOrderMode("party");
    setError("");

    if (!name.trim() || phone.trim().length < 7) {
      setError("Please enter your name and 10-digit mobile number first.");
      return;
    }

    setStep(2);
  }

  function handleEventDateChange(selectedDate: string) {
    setEventDate(selectedDate);
    if (bookedDates.includes(selectedDate)) {
      setError(`⚠️ ${selectedDate} is already booked for another celebration. Please select an available date.`);
    } else {
      setError("");
    }
  }

  function goToPayment() {
    setError("");

    if (selectedPackage) {
      if (!eventName.trim()) {
        setError("Please enter the Event Name (e.g. Maya's 5th Birthday).");
        return;
      }
      if (!eventDate.trim() || !eventVenue.trim()) {
        setError("Please provide the Event Date and Venue.");
        return;
      }
      if (customBackgroundRequested && !customBackgroundNotes.trim()) {
        setError("Please describe the custom background you would like us to create.");
        return;
      }
      if (bookedDates.includes(eventDate)) {
        setError(`⚠️ ${eventDate} is already booked for another celebration. Please select an available date.`);
        return;
      }
    } else if (cart.length === 0) {
      setError("Please add at least one design to your order.");
      return;
    }

    setPaymentMethod("upi");
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function executeOrderPlacement(paymentInfo: PaymentDetails) {
    if (busy) return;
    setBusy(true);

    try {
      if (selectedPackage && bookedDates.includes(eventDate)) {
        setError(`⚠️ ${eventDate} is already booked for another celebration. Please select an available date.`);
        setBusy(false);
        return;
      }

      const batchId = `MMB-${Date.now()}`;
      let sequence = await nextOrderNumber();
      const tokenNumber = String(sequence).padStart(2, "0");
      const assignedToken = `#MM-${tokenNumber}`;
      const created: PlacedOrder[] = [];

      if (selectedPackage) {
        const orderId = makeOrderId(sequence);
        let frameName =
          selectedFrame?.name ??
          (customFrameRequested
            ? `Custom Requested: ${customFrameNotes || "Theme"}`
            : null);
        let originalPhotoUrl = "";
        let finalPhotoUrl = "";

        if ((product as string) === "leather_name_keychain") {
          finalPhotoUrl = "/logo.png";
          originalPhotoUrl = "/logo.png";
        } else if (photo) {
          const finalMagnetImage = await createFinalMagnetImage({
            photo,
            frameSrc: selectedFrame?.src ?? null,
            cropPixels: cropPixels ?? null,
            shape: product === "circle" ? "circle" : "square",
            backgroundId,
          });

          try {
            originalPhotoUrl = await savePhoto(photo, orderId, "original.jpg");
            finalPhotoUrl = await savePhoto(
              finalMagnetImage,
              orderId,
              "final-magnet.png"
            );
          } catch (e) {
            finalPhotoUrl = finalMagnetImage;
            originalPhotoUrl = photo;
          }
        }

        const partyOrder = {
          orderId,
          batchId,
          token: assignedToken,
          customerName: name.trim(),
          phone: phone.trim(),
          productId: product,
          productName:
            (product as string) === "leather_name_keychain"
              ? `${selectedPackage.name} Package - Leather Name Keychains (Letter Beads)`
              : `${selectedPackage.name} Package (${selectedPackage.quantity} pcs)`,
          shape: product === "circle" ? "circle" : "square",
          quantity: selectedPackage.quantity,
          unitPrice: Math.round(baseOrderTotal / selectedPackage.quantity),
          packageId: selectedPackage.id,
          packagePrice: baseOrderTotal,
          advancePaidAmount: payableAmountNow,
          balanceDueAmount: balanceDueAmount,
          eventName: eventName.trim(),
          eventDate,
          eventTime,
          eventVenue: eventVenue.trim(),
          keychainStrap: partyKeychainStrap,
          frameId: customCustomerFrameSrc ? "custom-customer-frame" : frameId,
          frameName,
          photoUrl: finalPhotoUrl,
          originalPhotoUrl,
          appliedFrameId: customCustomerFrameSrc ? "custom-customer-frame" : frameId,
          backgroundId,
          customBackgroundRequested,
          customBackgroundNotes: customBackgroundRequested ? customBackgroundNotes.trim() : "",
          crop,
          total: baseOrderTotal,
          status: "New" as const,
          createdAt: new Date().toISOString(),
          ...paymentInfo,
          paymentStatus:
            paymentInfo.paymentMethod === "cash"
              ? "Pending"
              : paymentOption === "advance"
              ? "Advance Paid"
              : "Paid",
        } as PlacedOrder;

        const partyRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partyOrder),
        });
        if (!partyRes.ok) {
          const errData = await partyRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to record party order.");
        }

        created.push(partyOrder);
      } else {
        const itemUnitPrice =
          totalCartQuantity > 0
            ? Math.round(baseOrderTotal / totalCartQuantity)
            : 150;

        for (let i = 0; i < cart.length; i++) {
          const item = cart[i];
          const frame: Frame | null = item.customFrameSrc
            ? {
                id: "custom-customer-frame",
                name: "Custom Frame",
                src: item.customFrameSrc,
                shape: item.productId === "circle" ? "circle" : "square",
                category: "Custom",
              }
            : FRAMES.find((f) => f.id === item.frameId) ?? null;

          const orderId = makeOrderId(sequence + i);

          const finalProductImage = (item.productId as string) === "leather_name_keychain"
            ? "/logo.png"
            : await createFinalMagnetImage({
                photo: item.photo,
                frameSrc: frame?.src ?? null,
                cropPixels: item.cropPixels ?? null,
                shape: (item.productId as string) === "leather_name_keychain" ? "keychain" : (item.productId as ProductId),
                backgroundId: item.backgroundId ?? null,
              });

          let originalPhotoUrl = item.photo;
          let finalPhotoUrl = finalProductImage;
          let backPhotoUrl = "";
          if (item.productId === "keychain" && item.photoBack) {
            backPhotoUrl = await createFinalMagnetImage({
              photo: item.photoBack,
              frameSrc: null,
              cropPixels: item.cropPixelsBack ?? null,
              shape: "keychain",
            });
          }

          try {
            originalPhotoUrl = await savePhoto(item.photo, orderId, "original.jpg");
            finalPhotoUrl = await savePhoto(
              finalProductImage,
              orderId,
              "final-magnet.png"
            );
          } catch (uploadErr) {
            console.warn("Storage fallback:", uploadErr);
          }

          const itemTotal = itemUnitPrice * item.quantity;

          const newOrder = {
            orderId,
            batchId,
            token: assignedToken,
            customerName: name.trim(),
            phone: phone.trim(),
            productId: item.productId,
            productName:
              item.productId === "circle"
                ? "59mm Circle Magnet"
                : item.productId === "keychain"
                ? "36mm Photo Keychain"
                : (item.productId as string) === "leather_name_keychain"
                ? "Leather Name Keychains (Letter Beads)"
                : `2" Square Magnet`,
            shape: item.productId === "circle" ? "circle" : "square",
            quantity: item.quantity,
            unitPrice: itemUnitPrice,
            fulfillmentType: "stall_pickup",
            deliveryFee: 0,
            deliveryAddress: null,
            isGiftWrap: false,
            frameId: item.customFrameSrc ? "custom-customer-frame" : item.frameId,
            frameName: frame?.name ?? null,
            photoUrl: finalPhotoUrl,
            originalPhotoUrl,
            photoBackUrl: backPhotoUrl || undefined,
            keychainStrap: item.keychainStrap,
            appliedFrameId: item.customFrameSrc ? "custom-customer-frame" : item.frameId,
            backgroundId: item.backgroundId ?? null,
            crop: item.crop,
            total: itemTotal,
            status: "New" as const,
            createdAt: new Date().toISOString(),
            paymentMethod: paymentInfo.paymentMethod,
            paymentStatus: paymentInfo.paymentStatus,
            paymentTransactionId: paymentInfo.paymentTransactionId,
            paymentUpiId: paymentInfo.paymentUpiId,
            promoCodeUsed: i === 0 ? paymentInfo.promoCodeUsed : null,
          } as PlacedOrder;

          try {
            const res = await fetch("/api/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newOrder),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `Item ${i + 1} failed to save.`);
            }
          } catch (apiErr) {
            console.error(`Network error on item ${i + 1}:`, apiErr);
            throw apiErr instanceof Error
              ? apiErr
              : new Error(`Item ${i + 1} failed to save.`);
          }

          created.push(newOrder);
        }
      }

      setPlacedOrders(created);
      sessionStorage.setItem("mm_active_order", created[0]?.orderId || "");
      setCart([]);
      setStep(4);
    } catch (err: any) {
      console.error("Order recording failed:", err);
      setError(err?.message || "We couldn't finalize your order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function placeAllOrders() {
    if (busy) return;
    if (!selectedPackage && cart.length === 0) return;

    setError("");

    if (selectedPackage && bookedDates.includes(eventDate)) {
      setError(`⚠️ ${eventDate} is already booked for another celebration. Please select an available date.`);
      return;
    }

    setBusy(true);

    const promoCodeUsed = appliedDiscount ? appliedDiscount.code : null;

    if (paymentMethod === "cash") {
      await executeOrderPlacement({
        paymentMethod: "cash",
        paymentStatus: "Pending",
        paymentTransactionId: null,
        paymentUpiId: null,
        promoCodeUsed,
      });
      return;
    }

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        setError("Payment gateway failed to load. Please check your internet connection.");
        setBusy(false);
        return;
      }

      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: payableAmountNow,
          receipt: `rcpt_${Date.now()}`,
        }),
      });

      const orderData = await res.json();
      if (!orderData.success || !orderData.orderId) {
        throw new Error(orderData.error || orderData.message || "Failed to initialize payment gateway.");
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Mogified Moments",
        description: selectedPackage
          ? `${selectedPackage.name} Package (${paymentOption === "advance" ? "50% Advance" : "Full Payment"})`
          : `Custom Order (${totalCartQuantity} items)`,
        image: "/logo.png",
        order_id: orderData.orderId,
        prefill: {
          name: name.trim(),
          contact: phone.trim(),
        },
        theme: {
          color: "#7048d8",
        },
        handler: async function (response: any) {
          await executeOrderPlacement({
            paymentMethod: "upi",
            paymentStatus: paymentOption === "advance" ? "Advance Paid" : "Paid",
            paymentTransactionId: response.razorpay_payment_id || null,
            paymentUpiId: response.razorpay_order_id || null,
            promoCodeUsed,
          });
        },
        modal: {
          ondismiss: function () {
            setBusy(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Payment initiation failed:", err);
      setError(err.message || "Payment initiation failed. Please try Cash / Counter booking.");
      setBusy(false);
    }
  }

  function startAnotherOrder() {
    setPlacedOrders([]);
    setSelectedPackage(null);
    setEventName("");
    setEventDate("");
    setEventTime("");
    setEventVenue("");
    setError("");
    setOrderMode("stall");
    setAppliedDiscount(null);
    setPromoCode("");
    resetDesign();
    setStep(1);
  }

  if (isQueuePaused && step !== 4 && orderMode === "stall") {
    return (
      <main className="mm-customer">
        <CustomerStyles />
        <section className="mm-success" style={{ maxWidth: "560px", padding: "40px 24px" }}>
          <img src="/logo.png" alt="Mogified Moments" className="mm-success-logo" />
          <div style={{ fontSize: "50px", margin: "14px 0 6px" }}>⏳</div>
          <p className="mm-eyebrow">Stall at Full Capacity</p>
          <h1 style={{ fontSize: "36px" }}>Taking a quick 10-minute breather!</h1>
          <p className="mm-muted" style={{ fontSize: "14px", lineHeight: "1.6", margin: "12px 0 20px" }}>
            Our printing presses are currently catching up on live stall orders. We will reopen for new uploads shortly!
          </p>
          <button
            className="mm-button mm-primary"
            onClick={() => window.location.reload()}
            style={{ width: "100%", maxWidth: "300px", margin: "0 auto" }}
          >
            Check Status ⟳
          </button>
        </section>
      </main>
    );
  }

  if (step === 4 && placedOrders.length) {
    const mainOrder = placedOrders[0];
    const isPartyOrder = Boolean(mainOrder?.packageId);
    const tokenDisplay = mainOrder.token || `#${mainOrder.orderId.slice(-4)}`;

    const guestLink =
      typeof window !== "undefined"
        ? `${window.location.origin}/guest?orderId=${mainOrder.orderId}`
        : `/guest?orderId=${mainOrder.orderId}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
      guestLink
    )}&margin=8`;

    function handlePrintCard() {
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print QR Table Card</title>
            <style>
              body {
                margin: 0;
                padding: 40px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                font-family: 'Nunito', sans-serif;
                background: #fff;
              }
              .card {
                border: 4px solid #7048d8;
                border-radius: 24px;
                background: #fff;
                padding: 32px 24px;
                text-align: center;
                max-width: 380px;
                width: 100%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              }
              .brand {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                margin-bottom: 14px;
              }
              .brand img {
                width: 42px;
                height: 42px;
                object-fit: contain;
              }
              .brand span {
                font-size: 18px;
                font-weight: 800;
                color: #7048d8;
              }
              h3 {
                font-size: 24px;
                font-weight: 900;
                color: #292342;
                margin: 0 0 6px;
              }
              .date-venue {
                font-size: 13px;
                font-weight: 700;
                color: #64748b;
                margin-bottom: 18px;
              }
              .qr-box {
                width: 220px;
                height: 220px;
                margin: 0 auto 16px;
                padding: 10px;
                border: 2px solid #e2e8f0;
                border-radius: 16px;
              }
              .qr-box img {
                width: 100%;
                height: 100%;
                object-fit: contain;
              }
              .footer-text strong {
                display: block;
                font-size: 16px;
                font-weight: 900;
                color: #ec3e82;
                letter-spacing: 0.05em;
                margin-bottom: 6px;
              }
              .footer-text p {
                font-size: 12px;
                color: #475569;
                margin: 0;
                line-height: 1.4;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="brand">
                <img src="/logo.png" alt="Mogified Moments" />
                <span>Mogified Moments</span>
              </div>
              <h3>${mainOrder.eventName || `${mainOrder.customerName}'s Celebration`}</h3>
              ${
                mainOrder.eventDate
                  ? `<div class="date-venue">📅 ${mainOrder.eventDate} ${
                      mainOrder.eventTime ? `· ⏰ ${mainOrder.eventTime}` : ""
                    }${
                      mainOrder.eventVenue ? `<br/>📍 ${mainOrder.eventVenue}` : ""
                    }</div>`
                  : ""
              }
              <div class="qr-box">
                <img src="${qrCodeUrl}" alt="QR Code" />
              </div>
              <div class="footer-text">
                <strong>SCAN TO UPLOAD PHOTOS</strong>
                <p>Scan with your phone camera to instantly share photos to this party's live screen &amp; print queue!</p>
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }

    return (
      <main className="mm-customer">
        <CustomerStyles />

        <section className="mm-success">
          <img src="/logo.png" alt="Mogified Moments" className="mm-success-logo" />

          <div className="mm-token-hero">
            <span className="mm-token-eyebrow">YOUR PICKUP TOKEN</span>
            <div className="mm-token-tag">{tokenDisplay}</div>
            <small>
              {isPartyOrder
                ? "Your celebration package has been booked."
                : "Show this token number at the stall counter for pickup."}
            </small>
          </div>

          <div className="mm-success-icon">🎉</div>

          <p className="mm-eyebrow">
            {isPartyOrder ? "Party Package Confirmed" : "Printing in Progress"}
          </p>

          <h1 style={{ fontSize: "28px", margin: "8px 0" }}>
            {isPartyOrder ? "Party Package Booked!" : "Printing your moments right now!"}
          </h1>

          <p className="mm-muted" style={{ fontSize: "14px", lineHeight: "1.5" }}>
            {isPartyOrder
              ? `Your package for ${mainOrder.eventName || "your celebration"} is confirmed! Share the QR code with your guests.`
              : "Your magnets take about 2 minutes to print. Collect at the stall counter."}
          </p>

          <div className="mm-live-tracker-card">
            <div className="tracker-status-row">
              <span className="live-dot" />
              <strong>Live Printing Queue Status:</strong>
              <span className="tracker-badge">{mainOrder.status}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666" }}>
              Keep this screen open or check token <b>{tokenDisplay}</b> at the counter.
            </p>
          </div>

          {isPartyOrder && (
            <div className="mm-qr-table-card-container">
              <div className="mm-qr-table-border-box">
                <div className="mm-qr-table-brand">
                  <img src="/logo.png" alt="Mogified Moments" />
                  <span>Mogified Moments</span>
                </div>

                <div className="mm-qr-table-header">
                  <h3>{mainOrder.eventName || `${mainOrder.customerName}'s Celebration`}</h3>
                  {mainOrder.eventDate && (
                    <p className="mm-qr-table-date-venue">
                      📅 {mainOrder.eventDate} {mainOrder.eventTime ? `· ⏰ ${mainOrder.eventTime}` : ""}
                      {mainOrder.eventVenue ? `<br />📍 ${mainOrder.eventVenue}` : ""}
                    </p>
                  )}
                </div>

                <div className="mm-qr-table-image-box">
                  <img src={qrCodeUrl} alt="Guest Upload QR Code" />
                </div>

                <div className="mm-qr-table-footer-text">
                  <strong>SCAN TO UPLOAD PHOTOS</strong>
                  <p>Scan with your phone camera to instantly share photos to this party's live screen &amp; print queue!</p>
                </div>
              </div>

              <div className="mm-qr-actions" style={{ marginTop: "14px" }}>
                <button
                  type="button"
                  className="mm-button mm-primary"
                  onClick={handlePrintCard}
                >
                  🖨️ Print QR Table Card
                </button>

                <button
                  type="button"
                  className="mm-button mm-secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(guestLink);
                    alert("Guest upload link copied to clipboard!");
                  }}
                >
                  Copy Link
                </button>
              </div>
            </div>
          )}

          <div className="mm-order-list">
            {placedOrders.map((order) => (
              <div
                className="mm-order-line"
                key={order.orderId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "14px",
                  padding: "10px 14px",
                  background: "#faf7fc",
                  borderRadius: "14px",
                  margin: "8px 0",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <strong style={{ display: "block", fontSize: "16px", color: "#292342", marginBottom: "2px" }}>
                    {order.token || order.orderId}
                  </strong>
                  <span style={{ color: "#756f87", fontSize: "13px" }}>
                    {order.productName} · {order.quantity} {order.quantity === 1 ? "piece" : "pieces"}
                  </span>
                </div>
                <span className={`mm-status ${order.status.toLowerCase()}`}>
                  {order.status}
                </span>
              </div>
            ))}
          </div>

          <div className="mm-success-total">
            <span>Total Value</span>
            <strong>
              ₹
              {placedOrders
                .reduce((sum, order) => sum + order.total, 0)
                .toLocaleString("en-IN")}
            </strong>
          </div>

          {isPartyOrder && balanceDueAmount > 0 && (
            <div className="mm-balance-due-box">
              <span>Advance Paid: <b>₹{payableAmountNow.toLocaleString("en-IN")}</b></span>
              <span style={{ display: "block", marginTop: "4px" }}>Balance Due at Event: <b>₹{balanceDueAmount.toLocaleString("en-IN")}</b></span>
            </div>
          )}

          <button className="mm-button mm-primary" onClick={startAnotherOrder} style={{ marginTop: "18px" }}>
            Place Another Order
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="mm-customer">
      <CustomerStyles />

      {step !== 1 && (
        <header className="mm-header">
          <div className="mm-brand">
            <img src="/logo.png" alt="Mogified Moments" />
            <div>
              <strong>Mogified Moments</strong>
            </div>
          </div>

          {!selectedPackage && cart.length > 0 && (
            <button className="mm-cart-button" onClick={() => setStep(2)}>
              🛒 {cart.length} design{cart.length === 1 ? "" : "s"} · ₹
              {grossTotal.toLocaleString("en-IN")}
            </button>
          )}

          {selectedPackage && (
            <div className="mm-package-badge">
              🎉 {selectedPackage.name} Package ({selectedPackage.quantity} pcs)
            </div>
          )}
        </header>
      )}

      <section className="mm-card">
        {step === 1 && (
          <div className="mm-landing-container">
            <div className="mm-center-brand">
              <img src="/logo.png" alt="Mogified Moments" className="mm-hero-logo" />
            </div>

            <div className="mm-form" style={{ marginTop: "12px" }}>
              <label className="mm-form-field">
                <span>Your Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                />
              </label>

              <label className="mm-form-field">
                <span>WhatsApp / Mobile Number</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="10-digit mobile number"
                />
              </label>
            </div>

            {error && <p className="mm-error">{error}</p>}

            <div className="mm-landing-buttons">
              <button
                className="mm-button mm-btn-gradient mm-btn-create"
                disabled={!name.trim() || phone.trim().length < 7}
                onClick={() => {
                  setOrderMode("stall");
                  setSelectedPackage(null);
                  setStep(2);
                }}
              >
                🎪 Live Stall Order
              </button>

              <button
                type="button"
                className="mm-button mm-btn-gradient mm-btn-party"
                onClick={() => {
                  if (!name.trim() || phone.trim().length < 7) {
                    setError("Please enter your name and phone number above to select a package.");
                    return;
                  }
                  setError("");
                  setShowPackageModal(true);
                }}
              >
                🎉 Party Packages
              </button>
            </div>
          </div>
        )}

        {showPackageModal && (
          <div className="mm-modal-overlay" onClick={() => setShowPackageModal(false)}>
            <div className="mm-package-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="mm-modal-close"
                onClick={() => setShowPackageModal(false)}
              >
                ×
              </button>

              <div className="mm-package-header">
                <span className="mm-eyebrow">Celebration &amp; Event Packages</span>
                <h2>Choose a Party Package</h2>
                <p>Personalised pieces for birthdays, weddings, and celebrations with live guest QR photo uploads.</p>
              </div>

              <div className="mm-packages-grid">
                {PARTY_PACKAGES.map((pkg) => {
                  const savings = pkg.regularPrice - pkg.packagePrice;
                  return (
                    <div className="mm-pkg-card" key={pkg.id}>
                      <div className="mm-pkg-top">
                        <h3>{pkg.name}</h3>
                        <span className="mm-pkg-qty">{pkg.quantity} Pieces</span>
                      </div>

                      <p className="mm-pkg-desc">{pkg.description}</p>

                      <div className="mm-pkg-pricing">
                        <span className="mm-pkg-regular">₹{pkg.regularPrice.toLocaleString("en-IN")}</span>
                        <strong className="mm-pkg-deal">₹{pkg.packagePrice.toLocaleString("en-IN")}</strong>
                        {savings > 0 && (
                          <span className="mm-pkg-savings">
                            Save ₹{savings.toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="mm-button mm-primary mm-select-pkg-btn"
                        onClick={() => handleSelectPackage(pkg)}
                      >
                        Select {pkg.name} Package →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <>
            <div className="mm-stepbar">
              <div>
                <span>Customer</span>
                <strong>{name || "Your details"}</strong>
              </div>

              <div className="mm-step-active">
                <span>{selectedPackage ? "Party Setup" : "Designs"}</span>
                <strong>
                  {selectedPackage
                    ? `${selectedPackage.name} (${selectedPackage.quantity} pcs)`
                    : `${cart.length} added`}
                </strong>
              </div>

              <div>
                <span>Checkout</span>
                <strong>Review &amp; pay</strong>
              </div>
            </div>

            {selectedPackage && (
              <div className="mm-event-details-card">
                <span className="mm-eyebrow">Party Details</span>
                <h3>Tell us about your celebration</h3>
                <p className="mm-muted" style={{ fontSize: "13px", marginBottom: "16px" }}>
                  These details will appear on your guest photo upload page and print station.
                </p>

                <div className="mm-event-grid">
                  <label className="mm-form-field">
                    <span>Event Name / Occasion *</span>
                    <input
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="e.g. Maya's 5th Birthday, John &amp; Sarah's Wedding"
                    />
                  </label>

                  <label className="mm-form-field">
                    <span>Venue / Location *</span>
                    <input
                      value={eventVenue}
                      onChange={(e) => setEventVenue(e.target.value)}
                      placeholder="e.g. Baga Ground, Merces Hall"
                    />
                  </label>

                  <label className="mm-form-field">
                    <span>Event Date *</span>
                    <input
                      type="date"
                      min={todayString}
                      value={eventDate}
                      onChange={(e) => handleEventDateChange(e.target.value)}
                    />
                    {eventDate && bookedDates.includes(eventDate) && (
                      <small style={{ color: "#ec3e82", fontWeight: 700, marginTop: "4px", display: "block" }}>
                        ⚠️ This date is already booked for another celebration. Please select an available date.
                      </small>
                    )}
                  </label>

                  <label className="mm-form-field">
                    <span>Event Time / Starting Hour</span>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* PRODUCT SELECTION FOR BOTH STALL & PARTY PACKAGES (INCLUDING LEATHER NAME KEYCHAIN FOR PARTY ONLY) */}
            <div style={{ margin: "16px 0", padding: "16px", background: "#f8fafc", borderRadius: "16px", border: "1.5px solid #e2e8f0" }}>
              <p className="mm-eyebrow">Choose product type</p>
              <div style={{ display: "grid", gridTemplateColumns: selectedPackage ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: "10px", marginTop: "8px" }}>
                {([
                  ["square", "Square Magnet", "52 × 52mm"],
                  ["circle", "Circle Magnet", "59mm diameter"],
                  ["keychain", "Photo Keychain", "36mm front + back"],
                  ...(selectedPackage ? [["leather_name_keychain", "Leather Name Keychain", "Party Package Exclusive"]] : []),
                ] as const).map(([id, title, detail]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setProduct(id as any);
                      setPhoto("");
                      setPhotoBack("");
                      setCrop(EMPTY_CROP);
                      setCropPixels(null);
                      setFrameId(null);
                      setBackgroundId(null);
                       setCustomBackgroundRequested(false);
                       setCustomBackgroundNotes("");
                    }}
                    className={`mm-frame-card ${product === id ? "selected" : ""}`}
                    style={{ padding: "12px", textAlign: "left" }}
                  >
                    <strong>{title}</strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{detail}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedPackage && product === "keychain" && (
              <div style={{ margin: "16px 0", padding: "16px", background: "#fffaf5", borderRadius: "16px", border: "1.5px solid #f1dfc8" }}>
                <p className="mm-eyebrow">Party Package Keychain Straps</p>
                <strong style={{ fontSize: "14px", color: "#292342" }}>Choose strap option for package keychains</strong>
                <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                  {(["leather", "pearl", "mix"] as const).map((strap) => (
                    <button
                      key={strap}
                      type="button"
                      onClick={() => setPartyKeychainStrap(strap)}
                      className={`mm-button ${partyKeychainStrap === strap ? "mm-primary" : "mm-secondary"}`}
                    >
                      {strap === "leather" ? "Leather" : strap === "pearl" ? "Pearl" : "Mix of both"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mm-square-banner">
              <div className={`mm-shape ${product === "circle" ? "circle" : "square"}`}>
                <span>{product === "circle" ? "59mm" : product === "keychain" || (product as string) === "leather_name_keychain" ? "36mm" : '2"'}</span>
              </div>
              <div>
                <strong>
                  {product === "circle"
                    ? "59mm Circle Magnet"
                    : product === "keychain"
                    ? "36mm Photo Keychain"
                    : (product as string) === "leather_name_keychain"
                    ? "Leather Name Keychains (Letter Beads)"
                    : "Classic 52mm × 52mm Square Magnet"}
                </strong>
                <p>
                  {product === "circle"
                    ? "59mm finished size · 6mm bleed · 71mm total"
                    : product === "keychain"
                    ? "36mm photo area · front + back · choose strap"
                    : (product as string) === "leather_name_keychain"
                    ? "Letter beads names & strap colors handled physically at your event"
                    : "52 × 52mm finished size · 4.5mm bleed · 61mm total"}
                </p>
              </div>
            </div>

            {/* LEATHER NAME KEYCHAIN PHYSICAL NOTICE INSTEAD OF INPUT BOX */}
            {(product as string) === "leather_name_keychain" ? (
              <div style={{ margin: "20px 0", padding: "24px", background: "#fffaf5", borderRadius: "16px", border: "1.5px solid #f1dfc8", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>🪡</div>
                <strong style={{ fontSize: "16px", color: "#292342", display: "block", marginBottom: "6px" }}>
                  Leather Name Keychains Package
                </strong>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0, lineHeight: "1.5" }}>
                  Strap colors, letter beads, and guest names will be managed physically at your event. You can proceed directly to book your package!
                </p>
              </div>
            ) : (
              <>
                <div style={{ margin: "16px 0", padding: "16px", background: "#f8fafc", borderRadius: "16px", border: "1.5px solid #e2e8f0" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#334155", marginBottom: "6px" }}>
                    ✍️ Custom Event Watermark / Text Overlay (Optional)
                  </label>
                  <input
                    type="text"
                    value={customWatermark}
                    onChange={(e) => setCustomWatermark(e.target.value)}
                    placeholder="e.g. Cecilia's Birthday 2026"
                    maxLength={35}
                    style={{ width: "100%", padding: "12px", border: "1.5px solid #cbd5e1", borderRadius: "12px", fontSize: "14px", outline: "none", background: "#fff" }}
                  />
                </div>

                {!selectedPackage && (
                  <div style={{ margin: "16px 0", padding: "16px", background: "#faf7fc", borderRadius: "16px", border: "1.5px solid #ecdff5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <strong style={{ fontSize: "14px", color: "#292342", display: "block" }}>Quantity (this design)</strong>
                      <small style={{ fontSize: "11px", color: "#756f87" }}>Print multiple copies of this design</small>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <button
                        type="button"
                        className="mm-button mm-secondary"
                        style={{ width: "38px", height: "38px", minHeight: "38px", padding: 0, fontSize: "18px", fontWeight: 900 }}
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      >
                        −
                      </button>
                      <span style={{ fontSize: "18px", fontWeight: 900, minWidth: "28px", textAlign: "center", color: "#7048d8" }}>
                        {quantity}
                      </span>
                      <button
                        type="button"
                        className="mm-button mm-secondary"
                        style={{ width: "38px", height: "38px", minHeight: "38px", padding: 0, fontSize: "18px", fontWeight: 900 }}
                        onClick={() => setQuantity((q) => q + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* FRONT PHOTO OR CAMERA SECTION */}
                {isCameraActive && cameraTarget === "front" ? (
                  <div className="mm-camera-container">
                    <div className="mm-camera-view square">
                      <video
                        ref={videoRef}
                        playsInline
                        autoPlay
                        muted
                        style={{ transform: cameraFacingMode === "user" ? "scaleX(-1)" : "none" }}
                      />
                    </div>
                    <div className="mm-camera-controls">
                      <button type="button" className="mm-button mm-secondary" onClick={stopCamera}>
                        Cancel
                      </button>
                      <button type="button" className="mm-button mm-secondary" onClick={switchCamera}>
                        🔄 Flip ({cameraFacingMode === "user" ? "Back" : "Front"})
                      </button>
                      <button type="button" className="mm-button mm-primary" onClick={captureCamera}>
                        📸 Take Front Photo
                      </button>
                    </div>
                  </div>
                ) : !photo ? (
                  <div className="mm-upload-options">
                    <label className="mm-upload">
                      <span>📁</span>
                      <strong>Choose front photo</strong>
                      <small>Pick any picture from your gallery</small>
                      <input
                        ref={fileRef}
                        hidden
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0], "front")}
                      />
                    </label>

                    <button type="button" className="mm-camera-snap-btn" onClick={() => startCamera("front", "user")}>
                      <span>📷</span>
                      <strong>Take Front Photo / Selfie</strong>
                      <small>Snap directly with your camera</small>
                    </button>
                  </div>
                ) : (
                  <div className="mm-design-grid">
                    <div>
                      <p className="mm-eyebrow">Front Photo Crop</p>
                      <div className="mm-cropper square">
                        <MagnetCropper
                          photo={photo}
                          crop={crop}
                          setCrop={setCrop}
                          setCropPixels={setCropPixels}
                          frame={selectedFrame}
                          product={product}
                        />
                      </div>

                      <div className="mm-editor-actions" style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                        <button
                          className="mm-button mm-secondary"
                          onClick={() => fileRef.current?.click()}
                        >
                          Change photo
                        </button>

                        <button
                          className="mm-button mm-secondary"
                          onClick={() => startCamera("front", "user")}
                        >
                          📷 Retake
                        </button>

                        <div className="mm-zoom-container" style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "200px" }}>
                          <button
                            type="button"
                            className="mm-button mm-secondary"
                            style={{ padding: "4px 10px", fontSize: "16px", minHeight: "36px", lineHeight: "1" }}
                            onClick={() =>
                              setCrop((current) => ({
                                ...current,
                                zoom: Math.max(0.3, Number((current.zoom - 0.15).toFixed(2))),
                              }))
                            }
                            title="Zoom Out"
                          >
                            −
                          </button>

                          <label className="mm-zoom" style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, margin: 0 }}>
                            <span style={{ fontSize: "13px", fontWeight: 800 }}>Zoom</span>
                            <input
                              type="range"
                              min="0.3"
                              max="3.5"
                              step="0.02"
                              value={crop.zoom}
                              onChange={(e) =>
                                setCrop((current) => ({
                                  ...current,
                                  zoom: Number(e.target.value),
                                }))
                              }
                              style={{ flex: 1 }}
                            />
                          </label>

                          <button
                            type="button"
                            className="mm-button mm-secondary"
                            style={{ padding: "4px 10px", fontSize: "16px", minHeight: "36px", lineHeight: "1" }}
                            onClick={() =>
                              setCrop((current) => ({
                                ...current,
                                zoom: Math.min(3.5, Number((current.zoom + 0.15).toFixed(2))),
                              }))
                            }
                            title="Zoom In"
                          >
                            +
                          </button>
                        </div>

                        <input
                          ref={fileRef}
                          hidden
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0], "front")}
                        />
                      </div>
                    </div>

                    <div className="mm-preview-card">
                      <p className="mm-eyebrow">Live Preview</p>
                      <MagnetPreviewInline
                        photo={photo}
                        frame={selectedFrame}
                        crop={crop}
                        cropPixels={cropPixels}
                        customWatermark={customWatermark}
                        product={product}
                        backgroundId={backgroundId}
                      />
                      <strong>
                        {product === "circle"
                          ? "59mm Circle Magnet"
                          : product === "keychain"
                          ? "36mm Photo Keychain"
                          : "52mm × 52mm Square Magnet"}
                      </strong>
                      <span>
                        {selectedFrame ? `Frame: ${selectedFrame.name}` : "Full-Bleed Borderless Photo"}
                      </span>
                    </div>
                  </div>
                )}

                {/* BACK PHOTO SECTION FOR KEYCHAIN */}
                {product === "keychain" && (
                  <div style={{ margin: "20px 0", padding: "16px", background: "#fffaf5", borderRadius: "16px", border: "1.5px solid #f1dfc8" }}>
                    <p className="mm-eyebrow">Keychain Back Photo &amp; Strap</p>
                    <strong style={{ fontSize: "15px", color: "#292342", display: "block", marginBottom: "10px" }}>
                      Independent Back Photo
                    </strong>

                    {isCameraActive && cameraTarget === "back" ? (
                      <div className="mm-camera-container">
                        <div className="mm-camera-view square">
                          <video
                            ref={videoRef}
                            playsInline
                            autoPlay
                            muted
                            style={{ transform: cameraFacingMode === "user" ? "scaleX(-1)" : "none" }}
                          />
                        </div>
                        <div className="mm-camera-controls">
                          <button type="button" className="mm-button mm-secondary" onClick={stopCamera}>
                            Cancel
                          </button>
                          <button type="button" className="mm-button mm-secondary" onClick={switchCamera}>
                            🔄 Flip ({cameraFacingMode === "user" ? "Back" : "Front"})
                          </button>
                          <button type="button" className="mm-button mm-primary" onClick={captureCamera}>
                            📸 Take Back Photo
                          </button>
                        </div>
                      </div>
                    ) : !photoBack ? (
                      <div className="mm-upload-options">
                        <label className="mm-upload">
                          <span>📁</span>
                          <strong>Upload back photo</strong>
                          <small>Select picture for reverse side</small>
                          <input
                            ref={fileBackRef}
                            hidden
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0], "back")}
                          />
                        </label>

                        <button type="button" className="mm-camera-snap-btn" onClick={() => startCamera("back", "user")}>
                          <span>📷</span>
                          <strong>Take Back Photo / Selfie</strong>
                          <small>Snap reverse side with camera</small>
                        </button>
                      </div>
                    ) : (
                      <div className="mm-design-grid">
                        <div>
                          <p className="mm-eyebrow">Back Photo Crop</p>
                          <div className="mm-cropper square">
                            <MagnetCropper
                              photo={photoBack}
                              crop={cropBack}
                              setCrop={setCropBack}
                              setCropPixels={setCropPixelsBack}
                              frame={null}
                              product="keychain"
                            />
                          </div>

                          <div className="mm-editor-actions" style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="mm-button mm-secondary"
                              onClick={() => fileBackRef.current?.click()}
                            >
                              Change back photo
                            </button>
                            <button
                              type="button"
                              className="mm-button mm-secondary"
                              onClick={() => startCamera("back", "user")}
                            >
                              📷 Retake Back
                            </button>

                            <div className="mm-zoom-container" style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "200px" }}>
                              <button
                                type="button"
                                className="mm-button mm-secondary"
                                style={{ padding: "4px 10px", fontSize: "16px", minHeight: "36px", lineHeight: "1" }}
                                onClick={() =>
                                  setCropBack((current) => ({
                                    ...current,
                                    zoom: Math.max(0.3, Number((current.zoom - 0.15).toFixed(2))),
                                  }))
                                }
                                title="Zoom Out"
                              >
                                −
                              </button>

                              <label className="mm-zoom" style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, margin: 0 }}>
                                <span style={{ fontSize: "13px", fontWeight: 800 }}>Zoom Back</span>
                                <input
                                  type="range"
                                  min="0.3"
                                  max="3.5"
                                  step="0.02"
                                  value={cropBack.zoom}
                                  onChange={(e) =>
                                    setCropBack((current) => ({
                                      ...current,
                                      zoom: Number(e.target.value),
                                    }))
                                  }
                                  style={{ flex: 1 }}
                                />
                              </label>

                              <button
                                type="button"
                                className="mm-button mm-secondary"
                                style={{ padding: "4px 10px", fontSize: "16px", minHeight: "36px", lineHeight: "1" }}
                                onClick={() =>
                                  setCropBack((current) => ({
                                    ...current,
                                    zoom: Math.min(3.5, Number((current.zoom + 0.15).toFixed(2))),
                                  }))
                                }
                                title="Zoom In"
                              >
                                +
                              </button>
                            </div>

                            <input
                              ref={fileBackRef}
                              hidden
                              type="file"
                              accept="image/*"
                              onChange={(e) => e.target.files?.[0] && readPhoto(e.target.files[0], "back")}
                            />
                          </div>
                        </div>

                        <div className="mm-preview-card">
                          <p className="mm-eyebrow">Back Live Preview</p>
                          <MagnetPreviewInline
                            photo={photoBack}
                            frame={null}
                            crop={cropBack}
                            cropPixels={cropPixelsBack}
                            product="keychain"
                          />
                          <strong>36mm Keychain (Back)</strong>
                          <span>Circular Finished Face</span>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: "14px" }}>
                      <strong style={{ fontSize: "13px" }}>Select Keychain Strap</strong>
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        {(["leather", "pearl"] as const).map((strap) => (
                          <button
                            key={strap}
                            type="button"
                            onClick={() => setKeychainStrap(strap)}
                            className={`mm-button ${keychainStrap === strap ? "mm-primary" : "mm-secondary"}`}
                          >
                            {strap === "leather" ? "Leather Strap" : "Pearl Strap"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {(product === "square" || product === "circle" || selectedPackage) && (product as string) !== "leather_name_keychain" && (
              <div className="mm-background-section">
                <div className="mm-frame-title">
                  <div>
                    <p className="mm-eyebrow">Themed Backdrop</p>
                    <h3>Choose a background for your photo</h3>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#756f87" }}>
                      Choose one of our themes, keep the original photo, or request a fully customised background.
                    </p>
                  </div>
                  {(backgroundId || customBackgroundRequested) && (
                    <button
                      type="button"
                      className="mm-link"
                      onClick={() => {
                        setBackgroundId(null);
                        setCustomBackgroundRequested(false);
                        setCustomBackgroundNotes("");
                      }}
                    >
                      Remove background
                    </button>
                  )}
                </div>

                <div className="mm-background-grid">
                  <button
                    type="button"
                    className={`mm-background-card ${!backgroundId && !customBackgroundRequested ? "selected" : ""}`}
                    onClick={() => {
                      setBackgroundId(null);
                      setCustomBackgroundRequested(false);
                      setCustomBackgroundNotes("");
                    }}
                  >
                    <div className="mm-background-thumb mm-background-none"><span>Original</span></div>
                    <strong>No backdrop</strong>
                    <span>Keep original photo</span>
                  </button>

                  {BACKGROUNDS.map((background) => (
                    <button
                      type="button"
                      key={background.id}
                      className={`mm-background-card ${backgroundId === background.id ? "selected" : ""}`}
                      onClick={() => {
                        setBackgroundId(background.id);
                        setCustomBackgroundRequested(false);
                        setCustomBackgroundNotes("");
                      }}
                    >
                      <div className="mm-background-thumb">
                        <img
                          src={product === "circle" ? background.circleSrc : background.squareSrc}
                          alt=""
                          loading="lazy"
                        />
                        <span>{background.name}</span>
                      </div>
                      <strong>{background.name}</strong>
                      <span>{background.description}</span>
                    </button>
                  ))}

                  {selectedPackage && (
                    <button
                      type="button"
                      className={`mm-background-card mm-background-custom-card ${customBackgroundRequested ? "selected" : ""}`}
                      onClick={() => {
                        setCustomBackgroundRequested((current) => {
                          const next = !current;
                          if (next) {
                            setBackgroundId(null);
                            setCustomBackgroundNotes("");
                          }
                          return next;
                        });
                      }}
                    >
                      <div className="mm-background-thumb mm-background-custom">
                        <div className="mm-background-custom-icon">✨</div>
                        <span>Custom</span>
                      </div>
                      <strong>Request Custom Background</strong>
                      <span>We'll create a personalised backdrop for your celebration.</span>
                    </button>
                  )}
                </div>

                {customBackgroundRequested && selectedPackage && (
                  <div className="mm-custom-background-request-box">
                    <strong>✨ Custom Background Request</strong>
                    <p>
                      Tell us what you want for the entire background/theme. This is separate from your frame request.
                    </p>
                    <textarea
                      value={customBackgroundNotes}
                      onChange={(e) => setCustomBackgroundNotes(e.target.value)}
                      placeholder="e.g. Cecilia's 3rd Birthday — icy crystals, snow and a magical winter theme"
                      rows={3}
                    />
                  </div>
                )}

                {backgroundId && !customBackgroundRequested && (
                  <div className="mm-background-notice">
                    ✨ <strong>{BACKGROUNDS.find((item) => item.id === backgroundId)?.name}</strong> backdrop selected.
                    Your photo will be automatically cut out and placed over this backdrop when the final magnet image is created.
                  </div>
                )}

                {customBackgroundRequested && (
                  <div className="mm-background-notice mm-background-custom-notice">
                    ✨ <strong>Custom background requested.</strong> Your description will be sent with the Party Package order for the customised backdrop.
                  </div>
                )}
              </div>
            )}

            {(product === "square" || product === "circle" || selectedPackage) && (product as string) !== "leather_name_keychain" && (
              <div className="mm-frame-section">
                <div className="mm-frame-title">
                  <div>
                    <p className="mm-eyebrow">
                      {selectedPackage ? "Party Frame Theme" : "Add a frame"}
                    </p>
                    <h3>Choose or upload a frame for this piece</h3>
                  </div>

                  {(frameId || customCustomerFrameSrc || customFrameRequested) && (
                    <button
                      className="mm-link"
                      onClick={() => {
                        setFrameId(null);
                        setCustomCustomerFrameSrc(null);
                        setCustomFrameRequested(false);
                        setCustomFrameNotes("");
                      }}
                    >
                      Remove frame (Full-Bleed Photo)
                    </button>
                  )}
                </div>

                <div className="mm-host-frame-options">
                  <div className={`mm-host-frame-card ${customCustomerFrameSrc ? "selected" : ""}`}>
                    <div className="mm-host-frame-icon">🎨</div>
                    <div style={{ flex: 1 }}>
                      <strong>Upload Transparent PNG Frame</strong>
                      <p>Have your own logo or border graphic? Upload a 1:1 PNG.</p>
                    </div>
                    <button
                      type="button"
                      className={`mm-button ${customCustomerFrameSrc ? "mm-primary" : "mm-secondary"}`}
                      style={{ fontSize: "12px", padding: "8px 14px", minHeight: "40px" }}
                      onClick={() => customFrameInputRef.current?.click()}
                    >
                      {customCustomerFrameSrc ? "✓ Custom Frame Attached" : "Upload PNG Frame"}
                    </button>
                    <input
                      ref={customFrameInputRef}
                      hidden
                      type="file"
                      accept="image/png"
                      onChange={(e) =>
                        e.target.files?.[0] && readCustomFrame(e.target.files[0])
                      }
                    />
                  </div>

                  {selectedPackage && (
                    <div
                      className={`mm-host-frame-card ${customFrameRequested ? "selected" : ""}`}
                      onClick={() => {
                        setCustomFrameRequested(!customFrameRequested);
                        if (!customFrameRequested) {
                          setCustomCustomerFrameSrc(null);
                          setFrameId(null);
                        }
                      }}
                    >
                      <div className="mm-host-frame-icon">✨</div>
                      <div style={{ flex: 1 }}>
                        <strong>Request Custom Event Frame from Us</strong>
                        <p>We'll design a personalized frame matching your party theme, name &amp; date.</p>
                        {customFrameRequested && (
                          <div className="mm-custom-notes-box" onClick={(e) => e.stopPropagation()}>
                            <input
                              value={customFrameNotes}
                              onChange={(e) => setCustomFrameNotes(e.target.value)}
                              placeholder="e.g. Maya's 5th Birthday, Tropical Beach Theme"
                            />
                          </div>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={customFrameRequested}
                        onChange={() => {}}
                        style={{ width: "20px", height: "20px", accentColor: "#7048d8" }}
                      />
                    </div>
                  )}
                </div>

                <div className="mm-chips">
                  {categories.map((category) => (
                    <button
                      key={category}
                      className={frameCategory === category ? "active" : ""}
                      onClick={() => setFrameCategory(category)}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="mm-frame-grid">
                  <button
                    className={`mm-frame-card ${
                      frameId === null && !customCustomerFrameSrc && !customFrameRequested ? "selected" : ""
                    }`}
                    onClick={() => {
                      setFrameId(null);
                      setCustomCustomerFrameSrc(null);
                      setCustomFrameRequested(false);
                    }}
                  >
                    <div className="mm-frame-thumb empty">None</div>
                    <span>Full Bleed (No frame)</span>
                  </button>

                  {visibleFrames.map((frame) => (
                    <button
                      key={frame.id}
                      className={`mm-frame-card ${
                        frameId === frame.id && !customCustomerFrameSrc && !customFrameRequested ? "selected" : ""
                      }`}
                      onClick={() => {
                        setFrameId(frame.id);
                        setCustomCustomerFrameSrc(null);
                        setCustomFrameRequested(false);
                      }}
                    >
                      <div className="mm-frame-thumb">
                        <img src={frame.src} alt={frame.name} />
                      </div>
                      <span>{frame.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="mm-error">{error}</p>}

            <div className="mm-bottom-actions">
              <button className="mm-button mm-secondary" onClick={() => setStep(1)}>
                Back
              </button>

              {selectedPackage ? (
                <button
                  className="mm-button mm-primary"
                  onClick={goToPayment}
                >
                  Proceed to Payment →
                </button>
              ) : (
                (photo || (product as string) === "leather_name_keychain") && (
                  <button className="mm-button mm-primary" onClick={addToCart}>
                    {editingId
                      ? "Update Product"
                      : product === "keychain" || (product as string) === "leather_name_keychain"
                      ? "Add Keychain to Order"
                      : product === "circle"
                      ? "Add Circle Magnet to Order"
                      : "Add Magnet to Order"}
                  </button>
                )
              )}
            </div>

            {!selectedPackage && cart.length > 0 && (
              <section className="mm-cart-panel">
                <div className="mm-cart-heading">
                  <div>
                    <p className="mm-eyebrow">Your order</p>
                    <h3>
                      {cart.length} design{cart.length === 1 ? "" : "s"} ({totalCartQuantity} pcs)
                    </h3>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <strong>₹{baseOrderTotal.toLocaleString("en-IN")}</strong>
                  </div>
                </div>

                <div className="mm-cart-list">
                  {cart.map((item, index) => (
                    <div className="mm-cart-item" key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <MagnetPreviewInline
                          photo={item.photo}
                          frame={FRAMES.find((f) => f.id === item.frameId) ?? null}
                          crop={item.crop}
                          cropPixels={item.cropPixels ?? null}
                          customWatermark={item.customWatermark}
                          product={(item.productId as string) === "leather_name_keychain" ? "keychain" : item.productId}
                          backgroundId={item.backgroundId ?? null}
                          small
                        />
                        <div>
                          <strong style={{ fontSize: "13px" }}>Design {index + 1}</strong>
                          <span style={{ display: "block", fontSize: "11px", color: "#64748b" }}>
                            {item.productId === "circle"
                              ? "59mm Circle"
                              : (item.productId as string) === "leather_name_keychain"
                              ? "Leather Name Keychains (Letter Beads)"
                              : item.productId === "keychain"
                              ? `36mm Keychain (${item.keychainStrap})`
                              : "52mm Square"} · Qty {item.quantity}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        style={{ background: "#fee2e2", color: "#dc2626", border: 0, padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mm-checkout-row" style={{ marginTop: "14px" }}>
                  <span>{totalCartQuantity} total items</span>
                  <button className="mm-button mm-primary" onClick={goToPayment}>
                    CHECKOUT &amp; PAY →
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className="mm-stepbar">
              <div>
                <span>Customer</span>
                <strong>{name}</strong>
              </div>

              <div>
                <span>{selectedPackage ? "Package" : "Items"}</span>
                <strong>
                  {selectedPackage
                    ? `${selectedPackage.name}`
                    : `${cart.length} designs`}
                </strong>
              </div>

              <div className="mm-step-active">
                <span>Payment &amp; Delivery</span>
                <strong>Secure checkout</strong>
              </div>
            </div>

            <div className="mm-payment-page">
              <p className="mm-eyebrow">Final step</p>
              <h2>Complete your order</h2>

              {selectedPackage && (
                <div className="mm-party-split-toggle">
                  <p className="mm-eyebrow" style={{ textAlign: "center" }}>Advance Deposit Option</p>
                  <div className="mm-split-options">
                    <button
                      type="button"
                      className={`mm-split-btn ${paymentOption === "advance" ? "active" : ""}`}
                      onClick={() => setPaymentOption("advance")}
                    >
                      <strong>Pay 50% Advance (Deposit)</strong>
                      <span>Pay ₹{Math.round(baseOrderTotal * 0.5).toLocaleString("en-IN")} now, balance at event</span>
                    </button>

                    <button
                      type="button"
                      className={`mm-split-btn ${paymentOption === "full" ? "active" : ""}`}
                      onClick={() => setPaymentOption("full")}
                    >
                      <strong>Pay 100% Full Amount</strong>
                      <span>Pay ₹{baseOrderTotal.toLocaleString("en-IN")} full payment now</span>
                    </button>
                  </div>
                </div>
              )}

              <div style={{ margin: "16px 0", padding: "14px", background: "#fdfbff", borderRadius: "16px", border: "2px dashed #d9cbe6", textAlign: "left" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 900, color: "#7048d8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  🎟️ HAVE A DISCOUNT COUPON?
                </label>
                
                {!appliedDiscount ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder="E.G. MOGI1OFF"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      style={{ flex: 1, padding: "10px 14px", borderRadius: "12px", border: "1.5px solid #d9cbe6", fontSize: "14px", textTransform: "uppercase", outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      style={{ background: "#7048d8", color: "#fff", border: "0", padding: "10px 16px", borderRadius: "12px", fontWeight: 900, cursor: "pointer", fontSize: "13px" }}
                    >
                      Apply
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#eef9f7", padding: "10px 14px", borderRadius: "12px", border: "1.5px solid #0c8a77" }}>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: 900, color: "#0c8a77", display: "block" }}>✓ Code Applied: {appliedDiscount.code}</span>
                      <span style={{ fontSize: "12px", color: "#292342", fontWeight: 700 }}>{appliedDiscount.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAppliedDiscount(null)}
                      style={{ background: "transparent", border: "0", color: "#ec3e82", fontWeight: 900, fontSize: "12px", cursor: "pointer" }}
                    >
                      Remove
                    </button>
                  </div>
                )}

                {discountError && (
                  <div style={{ fontSize: "12px", color: "#ec3e82", fontWeight: 800, marginTop: "6px" }}>
                    {discountError}
                  </div>
                )}
              </div>

              <div className="mm-payment-summary">
                <div>
                  <span>Package / Magnets Total</span>
                  <strong>₹{rawBaseOrderTotal.toLocaleString("en-IN")}</strong>
                </div>

                {appliedDiscount && (
                  <div>
                    <span>Coupon Discount</span>
                    <strong style={{ color: "#0c8a77" }}>-₹{discountAmount}</strong>
                  </div>
                )}

                <div style={{ background: "#f2ebff" }}>
                  <span>Payable Now</span>
                  <strong style={{ color: "#7048d8" }}>₹{payableAmountNow.toLocaleString("en-IN")}</strong>
                </div>
              </div>

              {selectedPackage && balanceDueAmount > 0 && (
                <div className="mm-balance-due-box">
                  <span>Balance Due at Event: <b>₹{balanceDueAmount.toLocaleString("en-IN")}</b></span>
                </div>
              )}

              <div className="mm-payment-methods">
                <button
                  className={`mm-payment-method ${paymentMethod === "upi" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod("upi")}
                >
                  <span className="mm-payment-icon">📱</span>
                  <span>
                    <strong>UPI &amp; Online Payment</strong>
                    <small>Pay instantly via GPay, PhonePe, Paytm or UPI QR</small>
                  </span>
                  <b>{paymentMethod === "upi" ? "✓" : ""}</b>
                </button>

                {(orderMode === "stall" || selectedPackage) && (
                  <button
                    className={`mm-payment-method ${paymentMethod === "cash" ? "selected" : ""}`}
                    onClick={() => setPaymentMethod("cash")}
                  >
                    <span className="mm-payment-icon">💵</span>
                    <span>
                      <strong>Cash / Counter Booking</strong>
                      <small>Confirm booking without online card/UPI payment</small>
                    </span>
                    <b>{paymentMethod === "cash" ? "✓" : ""}</b>
                  </button>
                )}
              </div>

              {error && <p className="mm-error">{error}</p>}

              <div className="mm-payment-actions">
                <button
                  className="mm-button mm-secondary"
                  onClick={() => setStep(2)}
                  disabled={busy}
                >
                  ← Back
                </button>

                <button
                  className="mm-button mm-primary"
                  onClick={placeAllOrders}
                  disabled={busy}
                >
                  {busy ? "Processing…" : `PROCEED TO PAY ₹${payableAmountNow.toLocaleString("en-IN")}`}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function MagnetCropper({
  photo,
  crop,
  setCrop,
  setCropPixels,
  frame,
  product,
}: {
  photo: string;
  crop: CropState;
  setCrop: React.Dispatch<React.SetStateAction<CropState>>;
  setCropPixels: React.Dispatch<React.SetStateAction<CropPixels | null>>;
  frame: Frame | null;
  product: ProductId | "leather_name_keychain";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState(240);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height || rect.width);
      if (size > 0) setContainerSize(size);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const cropSize =
    product === "circle"
      ? Math.round(containerSize * (59 / 71))
      : product === "keychain" || (product as string) === "leather_name_keychain"
      ? containerSize
      : Math.round(containerSize * (52 / 61));

  const offset = Math.round((containerSize - cropSize) / 2);

  return (
    <div ref={containerRef} className={`mm-cropper-inner ${product === "circle" ? "circle" : "square"}`}>
      <Cropper
        image={photo}
        crop={{ x: crop.x, y: crop.y }}
        zoom={crop.zoom}
        aspect={1}
        cropSize={{ width: cropSize, height: cropSize }}
        cropShape={product === "circle" || product === "keychain" || (product as string) === "leather_name_keychain" ? "round" : "rect"}
        showGrid={false}
        restrictPosition={false}
        minZoom={0.3}
        maxZoom={4}
        zoomSpeed={0.6}
        onCropChange={(point) => setCrop((current) => ({ ...current, x: point.x, y: point.y }))}
        onCropComplete={(_, areaPixels) => setCropPixels(areaPixels)}
        onZoomChange={(zoom) => setCrop((current) => ({ ...current, zoom }))}
        objectFit="contain"
      />

      {frame && (
        <img
          src={frame.src}
          alt=""
          style={{
            position: "absolute",
            left: `${offset}px`,
            top: `${offset}px`,
            width: `${cropSize}px`,
            height: `${cropSize}px`,
            objectFit: "contain",
            zIndex: 5,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        className={`mm-crop-guide ${
          product === "circle" || product === "keychain" || (product as string) === "leather_name_keychain" ? "circle" : "square"
        }`}
      />
    </div>
  );
}

function MagnetPreviewInline({
  photo,
  frame,
  crop,
  cropPixels,
  customWatermark,
  backgroundId = null,
  small = false,
  product = "square",
}: {
  photo?: string;
  frame: Frame | null;
  crop: CropState;
  cropPixels?: CropPixels | null;
  customWatermark?: string;
  backgroundId?: BackgroundId | null;
  small?: boolean;
  product?: ProductId | "leather_name_keychain";
}) {
  const isCircle = product === "circle" || product === "keychain" || (product as string) === "leather_name_keychain";
  const [themedPreviewSrc, setThemedPreviewSrc] = useState<string | null>(null);
  const [isCreatingThemedPreview, setIsCreatingThemedPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!photo || !backgroundId) {
      setThemedPreviewSrc(null);
      setIsCreatingThemedPreview(false);
      return () => {
        cancelled = true;
      };
    }

    /*
     * Background removal is the expensive part of the preview.
     * Do not run it on every crop/zoom update. Wait until the user
     * has stopped moving the crop for a short moment, then generate
     * one fresh themed preview.
     */
    const timer = window.setTimeout(() => {
      if (cancelled) return;

      setIsCreatingThemedPreview(true);

      createFinalMagnetImage({
        photo,
        frameSrc: frame?.src ?? null,
        cropPixels: cropPixels ?? null,
        shape: isCircle ? "circle" : "square",
        backgroundId,
      })
        .then((src) => {
          if (!cancelled) {
            setThemedPreviewSrc(src);
          }
        })
        .catch((error) => {
          console.error("Themed live preview failed:", error);
          if (!cancelled) {
            setThemedPreviewSrc(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsCreatingThemedPreview(false);
          }
        });
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [photo, backgroundId, frame?.src, cropPixels, isCircle]);

  const showThemedPreview = Boolean(backgroundId && themedPreviewSrc);

  return (
    <div className={`mm-preview ${isCircle ? "circle" : "square"} ${small ? "small" : ""}`}>
      <div className="mm-preview-inner">
        {showThemedPreview ? (
          <img
            src={themedPreviewSrc || ""}
            alt=""
            className={`mm-preview-photo ${isCircle ? "circle" : "square"} full-bleed`}
          />
        ) : (
          <>
            {photo && (
              <CroppedPreviewPhoto
                photo={photo}
                cropPixels={cropPixels}
                crop={crop}
                shape={isCircle ? "circle" : "square"}
              />
            )}
            {frame && <img src={frame.src} alt="" className="mm-preview-frame" />}
          </>
        )}

        {customWatermark && (
          <div
            style={{
              position: "absolute",
              bottom: "4px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.65)",
              color: "#fff",
              fontSize: "8px",
              fontWeight: 800,
              padding: "2px 4px",
              borderRadius: "3px",
              zIndex: 5,
              whiteSpace: "nowrap",
            }}
          >
            {customWatermark}
          </div>
        )}
      </div>
    </div>
  );
}

function CroppedPreviewPhoto({
  photo,
  cropPixels,
  crop,
  shape = "square",
}: {
  photo: string;
  cropPixels?: CropPixels | null;
  crop: CropState;
  shape?: "square" | "circle";
}) {
  const [croppedSrc, setCroppedSrc] = useState(photo);

  useEffect(() => {
    let cancelled = false;

    if (!cropPixels) {
      setCroppedSrc(photo);
      return () => {
        cancelled = true;
      };
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;

      try {
        const width = Math.max(1, Math.round(cropPixels.width));
        const height = Math.max(1, Math.round(cropPixels.height));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          setCroppedSrc(photo);
          return;
        }

        context.drawImage(
          image,
          Math.round(cropPixels.x),
          Math.round(cropPixels.y),
          width,
          height,
          0,
          0,
          width,
          height
        );

        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setCroppedSrc(dataUrl);
      } catch (err) {
        setCroppedSrc(photo);
      }
    };

    image.onerror = () => {
      if (!cancelled) setCroppedSrc(photo);
    };

    image.src = photo;
    return () => {
      cancelled = true;
    };
  }, [photo, cropPixels, crop]);

  return (
    <img
      src={croppedSrc || photo}
      alt=""
      className={`mm-preview-photo ${shape} full-bleed`}
      onError={() => {
        if (croppedSrc !== photo) setCroppedSrc(photo);
      }}
    />
  );
}

function CustomerStyles() {
  return (
    <style jsx global>{`
      .mm-customer {
        min-height: 100vh;
        padding: 8px 6px 50px;
        background: linear-gradient(135deg, #fff5f9 0%, #f7f1ff 50%, #effaf9 100%);
        color: #292342;
        font-family: Nunito, sans-serif;
        overflow-x: hidden;
      }
      .mm-customer * {
        box-sizing: border-box;
      }
      .mm-customer button,
      .mm-customer input {
        font: inherit;
      }
      .mm-customer button {
        cursor: pointer;
      }
      .mm-customer button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .mm-card {
        max-width: 540px;
        margin: 6px auto 0;
        background: #fff;
        border: 1px solid #e9e1f0;
        border-radius: 18px;
        padding: 12px 10px;
        box-shadow: 0 10px 25px #5d367d12;
      }
      @media (min-width: 768px) {
        .mm-card {
          padding: 26px;
          border-radius: 24px;
        }
      }
      .mm-design-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 10px;
      }
      @media (min-width: 768px) {
        .mm-design-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) 220px;
          gap: 16px;
          align-items: start;
        }
      }
      .mm-cropper {
        width: 100%;
        max-width: 100%;
        aspect-ratio: 1;
        margin: 0 auto;
        position: relative;
        background: #111;
        border-radius: 14px;
        overflow: hidden;
      }
      .mm-cropper-inner {
        position: absolute;
        inset: 0;
      }
      .mm-crop-guide.square {
        position: absolute;
        z-index: 6;
        pointer-events: none;
        border: 2px solid rgba(255, 255, 255, 0.85);
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.22);
        left: 6.2%;
        top: 6.2%;
        width: 87.6%;
        height: 87.6%;
        border-radius: 4px;
      }
      .mm-preview-card {
        background: #faf7fc;
        border-radius: 14px;
        padding: 10px;
        text-align: center;
      }
      .mm-preview {
        width: 130px;
        aspect-ratio: 1;
        margin: 6px auto;
        position: relative;
      }
      @media (min-width: 768px) {
        .mm-preview {
          width: 160px;
        }
      }
      .mm-preview.small {
        width: 48px;
        min-width: 48px;
        margin: 0;
      }
      .mm-preview-inner {
        position: absolute;
        inset: 0;
        border: 2px solid #292342;
        background: #fff;
        overflow: hidden;
        border-radius: 6px;
      }
      .mm-preview-photo.full-bleed {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: 1;
      }
      .mm-preview.circle,
      .mm-preview.circle .mm-preview-inner {
        border-radius: 50%;
        overflow: hidden;
      }
      .mm-preview-photo.circle {
        border-radius: 50%;
      }
      .mm-crop-guide.circle {
        position: absolute;
        inset: 0;
        border: 2px dashed rgba(112, 72, 216, 0.65);
        border-radius: 50%;
        pointer-events: none;
        z-index: 8;
      }
      .mm-preview-frame {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        z-index: 2;
        pointer-events: none;
      }
      .mm-frame-section {
        margin-top: 14px;
        border-top: 1px dashed #ddd2e7;
        padding-top: 12px;
      }
      .mm-chips {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        margin: 6px 0;
      }
      .mm-chips button {
        border: 1px solid #ded5e7;
        background: #fff;
        border-radius: 999px;
        padding: 4px 8px;
        font-weight: 800;
        font-size: 10px;
      }
      .mm-chips button.active {
        background: #7048d8;
        color: #fff;
      }
      .mm-frame-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
      }
      @media (min-width: 640px) {
        .mm-frame-grid {
          grid-template-columns: repeat(6, 1fr);
        }
      }
      .mm-frame-card {
        border: 1px solid #e9e1f0;
        background: #fff;
        border-radius: 8px;
        padding: 3px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      .mm-frame-card.selected {
        border: 2px solid #ec3e82;
      }
      .mm-frame-thumb {
        width: 100%;
        aspect-ratio: 1;
        position: relative;
        overflow: hidden;
        border-radius: 6px;
        background: #f5eff8;
      }
      .mm-frame-thumb img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .mm-frame-thumb.empty {
        display: grid;
        place-items: center;
        color: #756f87;
        font-size: 8px;
      }
      .mm-header {
        max-width: 540px;
        margin: auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .mm-brand {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .mm-brand img {
        width: 50px;
        height: 38px;
        object-fit: contain;
      }
      .mm-brand strong {
        display: block;
        font: 800 16px/1 "Baloo 2";
      }
      .mm-eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #ec3e82;
        font-size: 9px;
        font-weight: 900;
        margin: 0 0 2px;
      }
      .mm-button {
        border: 0;
        border-radius: 12px;
        padding: 10px 16px;
        min-height: 44px;
        font-weight: 900;
        font-size: 14px;
        transition: transform 0.15s ease;
      }
      .mm-primary {
        color: #fff;
        background: linear-gradient(135deg, #ec3e82, #7048d8);
        box-shadow: 0 6px 18px rgba(236, 62, 130, 0.35);
      }
      .mm-secondary {
        background: #fff;
        border: 1.5px solid #ded5e7;
        color: #292342;
      }
      .mm-error {
        max-width: 100%;
        width: 100%;
        margin: 8px auto 0;
        padding: 6px 10px;
        border-radius: 8px;
        background: #fff0f4;
        border: 1px solid #ffd3e1;
        color: #c52b67;
        font-size: 10px;
        font-weight: 800;
        text-align: center;
      }
      .mm-upload-options {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        max-width: 100%;
        margin: 10px auto;
      }
      @media (min-width: 640px) {
        .mm-upload-options {
          grid-template-columns: 1fr 1fr;
        }
      }
      .mm-upload,
      .mm-camera-snap-btn {
        min-height: 100px;
        border: 2px dashed #d9cbe6;
        background: #fff8fc;
        border-radius: 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 10px;
        text-align: center;
      }
      .mm-upload span,
      .mm-camera-snap-btn span {
        font-size: 24px;
        margin-bottom: 3px;
      }
      .mm-form {
        width: 100%;
        max-width: 100%;
        margin: 8px auto 12px auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        text-align: left;
      }
      .mm-form input {
        width: 100%;
        padding: 9px 11px;
        border: 2px solid #ecdff5;
        border-radius: 8px;
        outline: 0;
        background: #fffcfd;
        font-size: 12px;
      }
      .mm-landing-buttons {
        display: flex;
        gap: 6px;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 12px;
        width: 100%;
      }
      .mm-btn-gradient {
        color: #fff;
        flex: 1;
        min-width: 100%;
      }
      @media (min-width: 640px) {
        .mm-btn-gradient {
          min-width: 140px;
        }
      }
      .mm-btn-create {
        background: linear-gradient(135deg, #ec3e82 0%, #7048d8 100%);
      }
      .mm-btn-party {
        background: linear-gradient(135deg, #7048d8 0%, #ec3e82 100%);
      }
      .mm-background-section { margin: 16px 0; padding: 16px; background: #fff; border: 1.5px solid #ecdff5; border-radius: 16px; }
      .mm-background-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
      @media (min-width: 640px) { .mm-background-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
      .mm-background-card { border: 1.5px solid #e4dced; background: #fff; border-radius: 14px; padding: 8px; text-align: left; cursor: pointer; min-width: 0; }
      .mm-background-card.selected { border-color: #7048d8; box-shadow: 0 0 0 2px rgba(112, 72, 216, 0.12); }
      .mm-background-thumb { width: 100%; aspect-ratio: 1.35; border-radius: 10px; display: flex; align-items: flex-end; justify-content: center; padding: 7px; overflow: hidden; margin-bottom: 7px; position: relative; background: #f5f1f8; }
      .mm-background-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
      .mm-background-thumb span { position: relative; z-index: 1; color: #292342; background: rgba(255,255,255,0.82); padding: 3px 7px; border-radius: 999px; font-size: 10px; font-weight: 900; }
      .mm-background-card strong { display: block; color: #292342; font-size: 12px; margin-bottom: 2px; }
      .mm-background-card > span { display: block; color: #756f87; font-size: 10px; line-height: 1.35; }
      .mm-background-notice { margin-top: 12px; padding: 9px 11px; border-radius: 10px; background: #f4efff; color: #5b43a8; font-size: 11px; line-height: 1.45; }
    .mm-background-custom-card {
      border-color: #f0c36a;
      background: #fffaf0;
    }

    .mm-background-custom-card.selected {
      border-color: #d58a00;
      box-shadow: 0 0 0 2px rgba(213, 138, 0, 0.14);
    }

    .mm-background-custom {
      background: linear-gradient(135deg, #fff4d6, #f9d9ff, #dff4ff);
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: #7048d8;
      font-weight: 900;
    }

    .mm-background-custom-icon {
      font-size: 30px;
      line-height: 1;
      margin-bottom: 4px;
    }

    .mm-custom-background-request-box {
      margin-top: 12px;
      padding: 14px;
      border: 1.5px solid #f0d59b;
      border-radius: 14px;
      background: #fffaf0;
    }

    .mm-custom-background-request-box strong {
      display: block;
      color: #7c4a00;
      font-size: 13px;
    }

    .mm-custom-background-request-box p {
      margin: 5px 0 9px;
      color: #756f87;
      font-size: 12px;
      line-height: 1.45;
    }

    .mm-custom-background-request-box textarea {
      width: 100%;
      min-height: 78px;
      box-sizing: border-box;
      border: 1px solid #e5d3ad;
      border-radius: 10px;
      padding: 10px 11px;
      resize: vertical;
      font: inherit;
      font-size: 13px;
      color: #292342;
      background: #fff;
      outline: none;
    }

    .mm-custom-background-request-box textarea:focus {
      border-color: #d58a00;
      box-shadow: 0 0 0 2px rgba(213, 138, 0, 0.10);
    }

    .mm-background-custom-notice {
      background: #fffaf0;
      border-color: #f0d59b;
      color: #7c4a00;
    }

      .mm-square-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #faf7fc;
        border: 2px solid #ecdff5;
        border-radius: 12px;
        padding: 8px 12px;
        margin: 8px auto;
      }
      .mm-shape.square {
        width: 30px;
        height: 30px;
        background: #7048d8;
        color: #fff;
        border-radius: 5px;
        display: grid;
        place-items: center;
        font-weight: 900;
        flex-shrink: 0;
      }
      .mm-shape.circle {
        width: 30px;
        height: 30px;
        background: #ec3e82;
        color: #fff;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 900;
        flex-shrink: 0;
      }
      .mm-shape.square span,
      .mm-shape.circle span {
        font-size: 10px;
      }
      .mm-square-banner p {
        margin: 2px 0 0;
        font-size: 10px;
        color: #756f87;
      }
      .mm-stepbar {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 3px;
        text-align: center;
        margin-bottom: 10px;
        font-size: 9px;
      }
      .mm-stepbar > div {
        background: #faf7fc;
        padding: 5px 3px;
        border-radius: 6px;
        border: 1.5px solid #e9e1f0;
      }
      .mm-stepbar .mm-step-active {
        background: #f2ebff;
        border-color: #7048d8;
        color: #7048d8;
      }
      .mm-stepbar span {
        display: block;
        color: #756f87;
      }
      .mm-stepbar strong {
        display: block;
        font-size: 10px;
        color: #292342;
      }
      .mm-center-brand {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin: 0 auto 10px;
        text-align: center;
      }
      .mm-hero-logo {
        width: 90px !important;
        max-height: 65px !important;
        object-fit: contain;
        margin: 0 auto;
        display: block;
      }
      .mm-success-logo {
        width: 36px !important;
        height: auto;
        object-fit: contain;
        margin: 0 auto 4px;
        display: block;
      }
      .mm-camera-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        margin: 0 auto 16px auto;
      }
      .mm-camera-view.square {
        width: 100%;
        max-width: 300px;
        aspect-ratio: 1;
        border-radius: 18px;
        overflow: hidden;
        background: #111;
        position: relative;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
      }
      .mm-camera-view.square video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .mm-camera-controls {
        margin-top: 12px;
        display: flex;
        justify-content: center;
        gap: 10px;
        width: 100%;
      }
      .mm-pkg-card {
        border: 1.5px solid #ded5e7;
        background: #faf7fc;
        border-radius: 18px;
        padding: 18px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .mm-pkg-pricing {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin: 6px 0;
        padding: 8px 12px;
        background: #fff;
        border-radius: 12px;
        border: 1.5px solid #ebdff5;
      }
      .mm-pkg-regular {
        text-decoration: line-through;
        color: #756f87;
        font-size: 13px;
      }
      .mm-pkg-deal {
        color: #7048d8;
        font-size: 18px;
        font-weight: 900;
      }
      .mm-pkg-savings {
        background: #eef9f7;
        color: #0c8a77;
        font-size: 11px;
        font-weight: 800;
        padding: 3px 8px;
        border-radius: 999px;
      }
      .mm-event-details-card {
        background: #faf7fc;
        border: 2px solid #ecdff5;
        border-radius: 16px;
        padding: 16px;
        margin-bottom: 18px;
      }
      .mm-event-details-card h3 {
        font: 800 20px "Baloo 2";
        margin: 2px 0 4px;
        color: #292342;
      }
      .mm-event-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 12px;
      }
      .mm-form-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
      }
      .mm-form-field span {
        display: block;
        font-size: 11px;
        font-weight: 800;
        color: #292342;
      }
      .mm-form-field input {
        width: 100%;
        padding: 10px 12px;
        border: 1.5px solid #d9cbe6;
        border-radius: 10px;
        background: #fff;
        font-size: 13px;
        outline: none;
      }
    `}</style>
  );
}