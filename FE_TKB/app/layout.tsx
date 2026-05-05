import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StoreProvider from "./StoreProvider";
import ThemeProvider from "./components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <StoreProvider>
            {children}
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
