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
  // SQUARE FRAMES (/public/frames/square/)
  // ==========================================
  // New Styles
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
  {
    id: "square_music",
    name: "Music Rhythm",
    src: "/frames/square/square_music.png",
    shape: "square",
    category: "Music & Party",
  },
  {
    id: "square_dj",
    name: "DJ Vibe",
    src: "/frames/square/square_dj.png",
    shape: "square",
    category: "Music & Party",
  },

  // Celebrations & Milestones
  {
    id: "square_birthday",
    name: "Birthday Party",
    src: "/frames/square/square_birthday.png",
    shape: "square",
    category: "Celebration",
  },
  {
    id: "square_anniversary",
    name: "Anniversary Love",
    src: "/frames/square/square_anniversary.png",
    shape: "square",
    category: "Celebration",
  },
  {
    id: "square_love",
    name: "Love & Romance",
    src: "/frames/square/square_love.png",
    shape: "square",
    category: "Celebration",
  },
  {
    id: "square_friendship",
    name: "Friendship",
    src: "/frames/square/square_friendship.png",
    shape: "square",
    category: "Celebration",
  },
  {
    id: "square_mothersday",
    name: "Mother's Day",
    src: "/frames/square/square_mothersday.png",
    shape: "square",
    category: "Celebration",
  },

  // Travel, Goa & Vibes
  {
    id: "square_beach",
    name: "Beach Vibes",
    src: "/frames/square/square_beach.png",
    shape: "square",
    category: "Travel & Goa",
  },
  {
    id: "square_goa",
    name: "Goa Special",
    src: "/frames/square/square_goa.png",
    shape: "square",
    category: "Travel & Goa",
  },
  {
    id: "square_travel",
    name: "Wanderlust Travel",
    src: "/frames/square/square_travel.png",
    shape: "square",
    category: "Travel & Goa",
  },

  // Festivals & Occasions
  {
    id: "square_carnival",
    name: "Carnival",
    src: "/frames/square/square_carnival.png",
    shape: "square",
    category: "Festivals",
  },
  {
    id: "square_diwali",
    name: "Diwali Sparkle",
    src: "/frames/square/square_diwali.png",
    shape: "square",
    category: "Festivals",
  },
  {
    id: "square_christmas",
    name: "Christmas Joy",
    src: "/frames/square/square_christmas.png",
    shape: "square",
    category: "Festivals",
  },
  {
    id: "square_easter",
    name: "Easter Bliss",
    src: "/frames/square/square_easter.png",
    shape: "square",
    category: "Festivals",
  },
  {
    id: "square_ganeshchaturthi",
    name: "Ganesh Chaturthi",
    src: "/frames/square/square_ganeshchaturthi.png",
    shape: "square",
    category: "Festivals",
  },
  {
    id: "square_holi",
    name: "Holi Colors",
    src: "/frames/square/square_holi.png",
    shape: "square",
    category: "Festivals",
  },
  {
    id: "square_oktoberfest",
    name: "Oktoberfest",
    src: "/frames/square/square_oktoberfest.png",
    shape: "square",
    category: "Festivals",
  },
  {
    id: "square_india",
    name: "India Pride",
    src: "/frames/square/square_india.png",
    shape: "square",
    category: "Festivals",
  },

  // Themes & Hobbies
  {
    id: "square_floral",
    name: "Floral Bloom",
    src: "/frames/square/square_floral.png",
    shape: "square",
    category: "Themes",
  },
  {
    id: "square_football",
    name: "Football Star",
    src: "/frames/square/square_football.png",
    shape: "square",
    category: "Themes",
  },
  {
    id: "square_pets",
    name: "Pet Paws",
    src: "/frames/square/square_pets.png",
    shape: "square",
    category: "Themes",
  },
  {
    id: "square_cheers",
    name: "Cheers & Drinks",
    src: "/frames/square/square_cheers.png",
    shape: "square",
    category: "Themes",
  },
  {
    id: "square_id",
    name: "ID Badge",
    src: "/frames/square/square_id.png",
    shape: "square",
    category: "Themes",
  },

  // ==========================================
  // CIRCLE FRAMES (/public/frames/circle/)
  // ==========================================
  // New Styles
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
  {
    id: "circle_music",
    name: "Music Rhythm",
    src: "/frames/circle/circle_music.png",
    shape: "circle",
    category: "Music & Party",
  },
  {
    id: "circle_dj",
    name: "DJ Vibe",
    src: "/frames/circle/circle_dj.png",
    shape: "circle",
    category: "Music & Party",
  },

  // Celebrations & Milestones
  {
    id: "circle_birthday",
    name: "Birthday Party",
    src: "/frames/circle/circle_birthday.png",
    shape: "circle",
    category: "Celebration",
  },
  {
    id: "circle_anniversary",
    name: "Anniversary Love",
    src: "/frames/circle/circle_anniversary.png",
    shape: "circle",
    category: "Celebration",
  },
  {
    id: "circle_love",
    name: "Love & Romance",
    src: "/frames/circle/circle_love.png",
    shape: "circle",
    category: "Celebration",
  },
  {
    id: "circle_friendship",
    name: "Friendship",
    src: "/frames/circle/circle_friendship.png",
    shape: "circle",
    category: "Celebration",
  },
  {
    id: "circle_mothersday",
    name: "Mother's Day",
    src: "/frames/circle/circle_mothersday.png",
    shape: "circle",
    category: "Celebration",
  },

  // Travel, Goa & Vibes
  {
    id: "circle_beach",
    name: "Beach Vibes",
    src: "/frames/circle/circle_beach.png",
    shape: "circle",
    category: "Travel & Goa",
  },
  {
    id: "circle_goa",
    name: "Goa Special",
    src: "/frames/circle/circle_goa.png",
    shape: "circle",
    category: "Travel & Goa",
  },
  {
    id: "circle_travel",
    name: "Wanderlust Travel",
    src: "/frames/circle/circle_travel.png",
    shape: "circle",
    category: "Travel & Goa",
  },

  // Festivals & Occasions
  {
    id: "circle_carnival",
    name: "Carnival",
    src: "/frames/circle/circle_carnival.png",
    shape: "circle",
    category: "Festivals",
  },
  {
    id: "circle_diwali",
    name: "Diwali Sparkle",
    src: "/frames/circle/circle_diwali.png",
    shape: "circle",
    category: "Festivals",
  },
  {
    id: "circle_christmas",
    name: "Christmas Joy",
    src: "/frames/circle/circle_christmas.png",
    shape: "circle",
    category: "Festivals",
  },
  {
    id: "circle_easter",
    name: "Easter Bliss",
    src: "/frames/circle/circle_easter.png",
    shape: "circle",
    category: "Festivals",
  },
  {
    id: "circle_ganeshchaturthi",
    name: "Ganesh Chaturthi",
    src: "/frames/circle/circle_ganeshchaturthi.png",
    shape: "circle",
    category: "Festivals",
  },
  {
    id: "circle_holi",
    name: "Holi Colors",
    src: "/frames/circle/circle_holi.png",
    shape: "circle",
    category: "Festivals",
  },
  {
    id: "circle_oktoberfest",
    name: "Oktoberfest",
    src: "/frames/circle/circle_oktoberfest.png",
    shape: "circle",
    category: "Festivals",
  },
  {
    id: "circle_india",
    name: "India Pride",
    src: "/frames/circle/circle_india.png",
    shape: "circle",
    category: "Festivals",
  },

  // Themes & Hobbies
  {
    id: "circle_floral",
    name: "Floral Bloom",
    src: "/frames/circle/circle_floral.png",
    shape: "circle",
    category: "Themes",
  },
  {
    id: "circle_football",
    name: "Football Star",
    src: "/frames/circle/circle_football.png",
    shape: "circle",
    category: "Themes",
  },
  {
    id: "circle_pets",
    name: "Pet Paws",
    src: "/frames/circle/circle_pets.png",
    shape: "circle",
    category: "Themes",
  },
  {
    id: "circle_cheers",
    name: "Cheers & Drinks",
    src: "/frames/circle/circle_cheers.png",
    shape: "circle",
    category: "Themes",
  },
  {
    id: "circle_id",
    name: "ID Badge",
    src: "/frames/circle/circle_id.png",
    shape: "circle",
    category: "Themes",
  },
];

export function framesFor(shape: FrameShape, category?: string): Frame[] {
  return FRAMES.filter((frame) => {
    const matchesShape = frame.shape === shape;
    const matchesCategory =
      !category || category === "All" || frame.category === category;
    return matchesShape && matchesCategory;
  });
}