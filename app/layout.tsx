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
    icon: [{ url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/icon-black-bg-nLOXDLOy2CJHF6kJb6ak4zkyOS6qc5.png", type: "image/png" }],
    apple: [{ url: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/icon-black-bg-nLOXDLOy2CJHF6kJb6ak4zkyOS6qc5.png", type: "image/png" }],
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
