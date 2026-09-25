export type FrameShape = "square" | "circle";

export interface Frame {
  id: string;
  name: string;
  src: string;
  shape: FrameShape;
  category: string;
}

export const FRAMES: Frame[] = [
  // ==========================================
  // SIMPLE SQUARE FRAMES
  // ==========================================

  {
    id: "square_wood",
    name: "Classic Wood",
    src: "/frames/square/square_wood.png",
    shape: "square",
    category: "Wooden",
  },

  {
    id: "square_decoratedwood",
    name: "Decorated Wood",
    src: "/frames/square/square_decoratedwood.png",
    shape: "square",
    category: "Wooden",
  },

  {
    id: "square_black",
    name: "Matte Black",
    src: "/frames/square/square_black.png",
    shape: "square",
    category: "Classic",
  },

  {
    id: "square_gold",
    name: "Luxury Gold",
    src: "/frames/square/square_gold.png",
    shape: "square",
    category: "Metallic",
  },

  // ==========================================
  // SIMPLE CIRCLE FRAMES
  // ==========================================

  {
    id: "circle_wood",
    name: "Classic Wood",
    src: "/frames/circle/circle_wood.png",
    shape: "circle",
    category: "Wooden",
  },

  {
    id: "circle_decoratedwood",
    name: "Decorated Wood",
    src: "/frames/circle/circle_decoratedwood.png",
    shape: "circle",
    category: "Wooden",
  },

  {
    id: "circle_black",
    name: "Matte Black",
    src: "/frames/circle/circle_black.png",
    shape: "circle",
    category: "Classic",
  },

  {
    id: "circle_gold",
    name: "Luxury Gold",
    src: "/frames/circle/circle_gold.png",
    shape: "circle",
    category: "Metallic",
  },
];

export function framesFor(
  shape: FrameShape,
  category?: string
): Frame[] {
  return FRAMES.filter((frame) => {
    const matchesShape = frame.shape === shape;

    const matchesCategory =
      !category ||
      category === "All" ||
      frame.category === category;

    return matchesShape && matchesCategory;
  });
}