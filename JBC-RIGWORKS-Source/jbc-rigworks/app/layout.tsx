import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JBC RIGWORKS · Business Hub",
  description: "Your JBC RIGWORKS workspace for service jobs, sales, stock, expenses, and profit.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
