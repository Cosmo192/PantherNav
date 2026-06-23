import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PantherNav",
  description: "Real-time campus transit for Georgia State University."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
