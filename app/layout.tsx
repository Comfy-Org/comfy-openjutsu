import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Openjutsu · Comfy guide",
  description: "Swap the person in a video for the character in one image with a Comfy workflow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
