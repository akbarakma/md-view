import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Markdown Viewer",
  description: "A quiet, editorial space for reading and writing Markdown.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The app is a fixed-height shell, so by default the on-screen keyboard covers
  // its bottom edge — the editor's last lines and the chat composer both end up
  // underneath it. `resizes-content` shrinks the layout viewport instead, so the
  // shell simply gets shorter and everything stays reachable.
  interactiveWidget: "resizes-content",
  // Deliberately NOT `viewportFit: "cover"`. Cover would let the page paint under
  // the notch and rounded corners, but only the chat composer reads a safe-area
  // inset — in landscape on a notched phone the left/right insets are ~59px, so
  // the wordmark, the preview text and the mermaid fullscreen controls would slide
  // under the sensor housing. With the default the browser insets the viewport
  // itself, which already keeps the composer clear of the home indicator.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
