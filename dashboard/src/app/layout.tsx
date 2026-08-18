import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nemu Admin Dashboard",
  description: "Modern management for Nemu App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0a] text-white antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
