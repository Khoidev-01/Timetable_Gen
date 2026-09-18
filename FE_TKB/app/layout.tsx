import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import ServiceWorkerRegistrar from "./components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  metadataBase: new URL("https://gettimetable.cloud"),
  applicationName: "MiKiTimetable",
  title: {
    default: "MiKiTimetable – Xếp thời khóa biểu tự động",
    template: "%s | MiKiTimetable",
  },
  description:
    "Tạo thời khóa biểu THPT nhanh, hạn chế trùng lịch giáo viên, phòng học và tiết dạy. Dễ dàng điều chỉnh, quản lý và tra cứu trên mọi thiết bị.",
  icons: {
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
