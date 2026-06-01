import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import StoreProvider from "./StoreProvider";
import ThemeProvider from "./components/ThemeProvider";

export const metadata: Metadata = {
  title: "MiKiTimetable - Hệ thống Thời Khóa Biểu",
  description: "Hệ thống xếp thời khóa biểu tự động cho trường THPT",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <ThemeProvider>
          <StoreProvider>
            {children}
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
