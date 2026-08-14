import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jayanth's Workout Tracker",
    short_name: "Jayanth's Workout Tracker",
    description: "Push · Pull · Legs · Sprint training tracker for Transform 365.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/icon-black-bg-nLOXDLOy2CJHF6kJb6ak4zkyOS6qc5.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
