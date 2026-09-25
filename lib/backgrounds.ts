export type BackgroundId =
  | "birthday"
  | "wedding"
  | "baby-kids"
  | "love"
  | "goa"
  | "travel"
  | "christmas"
  | "pets"
  | "friends"
  | "diwali"
  | "oktoberfest"
  | "carnival"
  | "new-year"
  | "floral"
  | "garden"
  | "football"
  | "leaf";

export type BackgroundCategory =
  | "Celebration"
  | "Family"
  | "Love"
  | "Travel"
  | "Festive"
  | "Pets"
  | "Nature"
  | "Sports";

export type MagnetBackground = {
  id: BackgroundId;
  name: string;
  description: string;
  category: BackgroundCategory;
  squareSrc: string;
  circleSrc: string;
  supportsAutoCutout: boolean;
  previewClass: string;
};

export const BACKGROUNDS: MagnetBackground[] = [
  {
    id: "birthday",
    name: "Birthday",
    description: "Bright, colourful and full of celebration.",
    category: "Celebration",
    squareSrc: "/backgrounds/birthday-square.webp",
    circleSrc: "/backgrounds/birthday-circle.webp",
    supportsAutoCutout: true,
    previewClass: "birthday",
  },

  {
    id: "wedding",
    name: "Wedding",
    description: "Elegant floral details for wedding celebrations.",
    category: "Celebration",
    squareSrc: "/backgrounds/wedding-square.webp",
    circleSrc: "/backgrounds/wedding-circle.webp",
    supportsAutoCutout: true,
    previewClass: "wedding",
  },

  {
    id: "baby-kids",
    name: "Baby & Kids",
    description: "Playful, colourful and perfect for little ones.",
    category: "Family",
    squareSrc: "/backgrounds/baby-kids-square.webp",
    circleSrc: "/backgrounds/baby-kids-circle.webp",
    supportsAutoCutout: true,
    previewClass: "baby-kids",
  },

  {
    id: "love",
    name: "Love",
    description: "Romantic hearts and soft celebratory colours.",
    category: "Love",
    squareSrc: "/backgrounds/love-square.webp",
    circleSrc: "/backgrounds/love-circle.webp",
    supportsAutoCutout: true,
    previewClass: "love",
  },

  {
    id: "goa",
    name: "Goa",
    description: "Tropical Goan colours, palms and coastal vibes.",
    category: "Travel",
    squareSrc: "/backgrounds/goa-square.webp",
    circleSrc: "/backgrounds/goa-circle.webp",
    supportsAutoCutout: true,
    previewClass: "goa",
  },

  {
    id: "travel",
    name: "Travel",
    description: "A fun travel-themed backdrop for adventure memories.",
    category: "Travel",
    squareSrc: "/backgrounds/travel-square.webp",
    circleSrc: "/backgrounds/travel-circle.webp",
    supportsAutoCutout: true,
    previewClass: "travel",
  },

  {
    id: "christmas",
    name: "Christmas",
    description: "Festive lights, gifts and Christmas cheer.",
    category: "Festive",
    squareSrc: "/backgrounds/christmas-square.webp",
    circleSrc: "/backgrounds/christmas-circle.webp",
    supportsAutoCutout: true,
    previewClass: "christmas",
  },

  {
    id: "pets",
    name: "Pets",
    description: "Playful pet-themed details for furry family members.",
    category: "Pets",
    squareSrc: "/backgrounds/pets-square.webp",
    circleSrc: "/backgrounds/pets-circle.webp",
    supportsAutoCutout: true,
    previewClass: "pets",
  },

  {
    id: "friends",
    name: "Friends",
    description: "Colourful party details for friendship memories.",
    category: "Celebration",
    squareSrc: "/backgrounds/friends-square.webp",
    circleSrc: "/backgrounds/friends-circle.webp",
    supportsAutoCutout: true,
    previewClass: "friends",
  },

  {
    id: "diwali",
    name: "Diwali",
    description: "Warm diyas, lights and festive Indian colours.",
    category: "Festive",
    squareSrc: "/backgrounds/diwali-square.webp",
    circleSrc: "/backgrounds/diwali-circle.webp",
    supportsAutoCutout: true,
    previewClass: "diwali",
  },

  {
    id: "oktoberfest",
    name: "Oktoberfest",
    description: "A festive Goa-meets-Oktoberfest celebration backdrop.",
    category: "Festive",
    squareSrc: "/backgrounds/oktoberfest-square.webp",
    circleSrc: "/backgrounds/oktoberfest-circle.webp",
    supportsAutoCutout: true,
    previewClass: "oktoberfest",
  },

  {
    id: "carnival",
    name: "Carnival",
    description: "Colourful masks, confetti and carnival celebration.",
    category: "Festive",
    squareSrc: "/backgrounds/carnival-square.webp",
    circleSrc: "/backgrounds/carnival-circle.webp",
    supportsAutoCutout: true,
    previewClass: "carnival",
  },

  {
    id: "new-year",
    name: "New Year",
    description: "Sparkling fireworks, balloons and midnight celebration.",
    category: "Festive",
    squareSrc: "/backgrounds/new-year-square.webp",
    circleSrc: "/backgrounds/new-year-circle.webp",
    supportsAutoCutout: true,
    previewClass: "new-year",
  },

  {
    id: "floral",
    name: "Floral",
    description: "A lush pink and white floral event-wall backdrop.",
    category: "Nature",
    squareSrc: "/backgrounds/floral-square.webp",
    circleSrc: "/backgrounds/floral-circle.webp",
    supportsAutoCutout: true,
    previewClass: "floral",
  },

  {
    id: "garden",
    name: "Garden",
    description: "A bright flower-filled garden setting.",
    category: "Nature",
    squareSrc: "/backgrounds/garden-square.webp",
    circleSrc: "/backgrounds/garden-circle.webp",
    supportsAutoCutout: true,
    previewClass: "garden",
  },

  {
    id: "football",
    name: "Football",
    description: "Stadium lights, pitch and football match atmosphere.",
    category: "Sports",
    squareSrc: "/backgrounds/football-square.webp",
    circleSrc: "/backgrounds/football-circle.webp",
    supportsAutoCutout: true,
    previewClass: "football",
  },

  {
    id: "leaf",
    name: "Leaf",
    description: "Rich tropical banana leaves with festive floral details.",
    category: "Nature",
    squareSrc: "/backgrounds/leaf-square.webp",
    circleSrc: "/backgrounds/leaf-circle.webp",
    supportsAutoCutout: true,
    previewClass: "leaf",
  },
];

export function getBackground(
  backgroundId: BackgroundId | null | undefined
): MagnetBackground | null {
  if (!backgroundId) return null;

  return (
    BACKGROUNDS.find((background) => background.id === backgroundId) ?? null
  );
}

export function getBackgroundsByCategory(
  category: BackgroundCategory
): MagnetBackground[] {
  return BACKGROUNDS.filter(
    (background) => background.category === category
  );
}

export function getBackgroundSrc(
  background: MagnetBackground,
  shape: "square" | "circle"
): string {
  return shape === "circle" ? background.circleSrc : background.squareSrc;
}