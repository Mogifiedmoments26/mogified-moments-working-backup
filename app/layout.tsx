import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mogified Moments",
  description:
    "Personalised magnets made from your favourite moments.",
    openGraph: {
      title: "Mogified Moments",
      description: "Personalised magnets made from your favourite moments.",
      url: "https://mogified-moments.vercel.app",
      siteName: "Mogified Moments",
      images: [
        {
          url: "/logo.png",
          width: 600,
          height: 600,
          alt: "Mogified Moments Logo",
        },
      ],
      locale: "en_IN",
      type: "website",
    },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}