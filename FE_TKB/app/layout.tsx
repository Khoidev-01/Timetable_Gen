import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import ServiceWorkerRegistrar from "./components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  metadataBase: new URL("https://gettimetable.cloud"),
  applicationName: "MiKiTimetable",
  title: {
    // Tab trình duyệt chỉ hiện tên. Câu mô tả vẫn nằm ở openGraph bên dưới, cho thẻ xem
    // trước khi dán link vào Zalo hay Facebook.
    default: "MiKiTimetable",
    template: "%s | MiKiTimetable",
  },
  description:
    "Tạo thời khóa biểu THPT nhanh, hạn chế trùng lịch giáo viên, phòng học và tiết dạy. Dễ dàng điều chỉnh, quản lý và tra cứu trên mọi thiết bị.",
  icons: {
    // Google reads /favicon.ico before anything else when picking the icon for a search
    // result, and it was a 404 until app/favicon.ico arrived. Next links that one itself.
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    // iOS ignores the manifest for the home-screen icon and reads this instead
    apple: "/icon-192.png",
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "/",
    siteName: "MiKiTimetable",
    title: "MiKiTimetable – Xếp thời khóa biểu tự động",
    description:
      "Tạo thời khóa biểu THPT nhanh, hạn chế trùng lịch và quản lý tập trung trên mọi thiết bị.",
    // Zalo, Facebook and Messenger crop a shared link to a 1.91:1 card. A square app
    // icon came out letterboxed, so the cover is drawn at that ratio instead.
    images: [{ url: "/og-cover.png", width: 1200, height: 630, alt: "MiKiTimetable - xếp thời khóa biểu THPT tự động" }],
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
