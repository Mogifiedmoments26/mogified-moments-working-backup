type BatchItem = {
  photoUrl: string;
  token?: string;
  orderId: string;
  shape?: "square" | "circle" | "keychain";
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Compiles magnet images onto an A4 sheet at 300 DPI
 * Ready for direct printing on standard glossy magnetic/photo paper.
 */
export async function generateA4BatchSheet(items: BatchItem[]): Promise<string> {
  const canvas = document.createElement("canvas");
  // A4 standard at 300 DPI
  canvas.width = 2480;
  canvas.height = 3508;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not open canvas context");

  // Pure white paper background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Default to 61mm square size (~720px at 300 DPI)
  const magnetPx = 720;
  const gapPx = 30;
  const cols = 3;
  const rows = 3;

  const gridWidth = cols * magnetPx + (cols - 1) * gapPx;
  const gridHeight = rows * magnetPx + (rows - 1) * gapPx;

  // Center the 3x3 grid on the A4 sheet
  const startX = Math.round((canvas.width - gridWidth) / 2);
  const startY = Math.round((canvas.height - gridHeight) / 2);

  // Render up to 9 magnets per sheet
  const printableItems = items.slice(0, 9);

  for (let i = 0; i < printableItems.length; i++) {
    const item = printableItems[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x = startX + col * (magnetPx + gapPx);
    const y = startY + row * (magnetPx + gapPx);
    const isCircle = item.shape === "circle" || item.shape === "keychain";

    try {
      const img = await loadImage(item.photoUrl);

      ctx.save();
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(x + magnetPx / 2, y + magnetPx / 2, magnetPx / 2, 0, Math.PI * 2);
        ctx.clip();
      }

      ctx.drawImage(img, x, y, magnetPx, magnetPx);
      ctx.restore();

      // Guideline & Token label
      ctx.save();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 2;
      if (isCircle) {
        ctx.beginPath();
        ctx.arc(x + magnetPx / 2, y + magnetPx / 2, magnetPx / 2, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(x, y, magnetPx, magnetPx);
      }

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(item.token || item.orderId, x + 8, y + 32);
      ctx.restore();
    } catch (e) {
      console.warn("Could not render magnet into batch sheet:", item, e);
    }
  }

  // Footer Branding & Meta
  ctx.fillStyle = "#666666";
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `Mogified Moments · Live Print Sheet (${printableItems.length} Items) · Generated ${new Date().toLocaleTimeString()}`,
    canvas.width / 2,
    canvas.height - 100
  );

  return canvas.toDataURL("image/png", 1.0);
}