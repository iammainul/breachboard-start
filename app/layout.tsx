import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { display, mono, sans } from "@/app/fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { DEFAULT_FINISH, DEFAULT_THEME } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "Breachboard",
  description:
    "Breachboard — plan scenarios, facilitate sessions, capture decisions.",
};

const THEME_BOOTSTRAP = `(function(){try{var k="breachboard-theme";var t=localStorage.getItem(k)||localStorage.getItem("n0ts01337-theme")||localStorage.getItem("ttx-theme");var theme=(t==="light"||t==="institution"||t==="regulator")?"light":"dark";document.documentElement.setAttribute("data-theme",theme);document.documentElement.setAttribute("data-finish","glass");}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-finish={DEFAULT_FINISH}
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
        />
      </head>
      <body className="app-canvas min-h-full text-fg">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
