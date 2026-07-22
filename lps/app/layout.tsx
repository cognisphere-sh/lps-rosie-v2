import type { Metadata } from "next";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Austin Plant Supply",
  description: "Austin Plant Supply — inventory, requests, and customers (Rosie).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body>
        <ThemeProvider defaultTheme="dark">
          <div className="min-h-dvh bg-background text-foreground">
            {children}
            <SonnerToaster />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
