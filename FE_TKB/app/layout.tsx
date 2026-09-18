import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import ServiceWorkerRegistrar from "./components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  metadataBase: new URL("https://gettimetable.cloud"),
  applicationName: "MiKiTimetable",
  title: "MiKiTimetable | Xếp thời khóa biểu THPT thông minh",
  description:
    "Tự động xếp thời khóa biểu THPT nhanh, giảm xung đột giáo viên, phòng học và tiết dạy; hỗ trợ quản lý, điều chỉnh và tra cứu lịch tập trung.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/icon-192.png",
    // iOS ignores the manifest for the home-screen icon and reads this instead
    apple: "/icon-192.png",
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "/",
    siteName: "MiKiTimetable",
    title: "MiKiTimetable | Xếp thời khóa biểu THPT thông minh",
    description:
      "Tự động xếp lịch THPT nhanh, giảm xung đột và giúp nhà trường quản lý thời khóa biểu tập trung.",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "MiKiTimetable" }],
  },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MiKiTimetable" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
