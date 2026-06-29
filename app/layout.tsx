import type { Metadata, Viewport } from "next"
import "./globals.css"
import InstallPrompt from "@/components/install-prompt"

export const metadata: Metadata = {
  title: "Jayanth's Workout Tracker",
  description: "Push · Pull · Legs · Sprint training tracker for Transform 365.",
  applicationName: "Jayanth's Workout Tracker",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jayanth's Workout Tracker",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-background">
      <body>
        {children}
        <InstallPrompt />
      </body>
    </html>
  )
}
