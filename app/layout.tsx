import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa Lista",
  description: "Asistente de mesa para restaurantes con Next.js y Supabase",
  applicationName: "Mesa Lista",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#f8f5ef"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
