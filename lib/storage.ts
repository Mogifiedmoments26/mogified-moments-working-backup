import {
  getDownloadURL,
  ref,
  uploadString,
} from "firebase/storage";

import {
  firebaseConfigured,
  storage,
} from "./firebase";

export async function savePhoto(
  dataUrl: string,
  orderId: string,
  filename = "original.jpg"
): Promise<string> {
  if (!dataUrl) {
    throw new Error("No photo data was provided.");
  }

  if (!firebaseConfigured || !storage) {
    throw new Error("Firebase Storage is not configured.");
  }

  // Generate unique suffix to prevent duplicate filenames or collisions
  const uniqueKey = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Split name and extension (e.g., "final-magnet.png" -> "final-magnet-1725...png")
  const dotIndex = filename.lastIndexOf(".");
  const name = dotIndex !== -1 ? filename.slice(0, dotIndex) : filename;
  const ext = dotIndex !== -1 ? filename.slice(dotIndex) : ".jpg";
  const uniqueFilename = `${name}-${uniqueKey}${ext}`;

  // Use a fallback safe ID if orderId is missing or empty
  const safeOrderId = orderId || `order-${Date.now()}`;

  const fileRef = ref(
    storage,
    `orders/${safeOrderId}/${uniqueFilename}`
  );

  await uploadString(
    fileRef,
    dataUrl,
    "data_url"
  );

  return getDownloadURL(fileRef);
}