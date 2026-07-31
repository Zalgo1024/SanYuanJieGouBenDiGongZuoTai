import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AuthGate from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "三元结构分析平台",
  description:
    "基于三元结构理论（生存×繁衍×逆反×利益）的多主体利益分析工作台",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <AuthGate>{children}</AuthGate>
        </Providers>
      </body>
    </html>
  );
}
