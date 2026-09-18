"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h2>Page Not Found</h2>
      <p>Could not find the requested page.</p>
      <Link href="/" style={{ color: "#7048d8", fontWeight: "bold" }}>
        Return Home
      </Link>
    </div>
  );
}