export type PartyPackage = {
  id: string;
  name: string;
  quantity: number;
  packagePrice: number;
  regularPrice: number;
  description: string;
};

export const PARTY_PACKAGES: PartyPackage[] = [
  {
    id: "bronze",
    name: "Bronze",
    quantity: 50,
    packagePrice: 7000,
    regularPrice: 7500,
    description: "50 Pieces for birthdays, parties and celebrations.",
  },
  {
    id: "silver",
    name: "Silver",
    quantity: 100,
    packagePrice: 13000,
    regularPrice: 15000,
    description: "100 Pieces for bigger celebrations and events.",
  },
  {
    id: "gold",
    name: "Gold",
    quantity: 200,
    packagePrice: 24000,
    regularPrice: 30000,
    description: "200 Pieces for grand parties and receptions.",
  },
  {
    id: "platinum",
    name: "Platinum",
    quantity: 500,
    packagePrice: 55000,
    regularPrice: 75000,
    description: "500 Pieces for large weddings and corporate events.",
  },
  {
    id: "diamond",
    name: "Diamond",
    quantity: 1000,
    packagePrice: 100000,
    regularPrice: 150000,
    description: "1,000 Pieces ultimate celebration package with full guest coverage.",
  },
];