"use client"

import { useEffect, useState } from "react"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone() {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos() {
  if (typeof window === "undefined") return false
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    // Register the service worker (required for installability).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }

    if (isStandalone()) return // already installed

    const dismissedAt = Number(localStorage.getItem("jwt-install-dismissed") || 0)
    const recentlyDismissed = Date.now() - dismissedAt < 1000 * 60 * 60 * 24 * 3 // 3 days

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      if (!recentlyDismissed) setVisible(true)
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall)

    const onInstalled = () => {
      setVisible(false)
      setDeferred(null)
    }
    window.addEventListener("appinstalled", onInstalled)

    // iOS / Safari never fire beforeinstallprompt — show manual instructions.
    if (isIos() && !recentlyDismissed) {
      setIosHint(true)
      setVisible(true)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem("jwt-install-dismissed", String(Date.now()))
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Install Jayanth's Workout Tracker"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(16px, env(safe-area-inset-bottom))",
        transform: "translateX(-50%)",
        zIndex: 9999,
        width: "min(440px, calc(100% - 24px))",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 16,
        background: "#111",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt="App icon"
        width={44}
        height={44}
        style={{ flexShrink: 0, borderRadius: 10 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Install this app</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2, lineHeight: 1.4 }}>
          {iosHint
            ? "Tap the Share button, then “Add to Home Screen”."
            : "Add Jayanth's Workout Tracker to your home screen."}
        </div>
      </div>

      {!iosHint && (
        <button
          onClick={install}
          style={{
            flexShrink: 0,
            background: "#e11d2a",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "9px 14px",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        style={{
          flexShrink: 0,
          background: "transparent",
          color: "rgba(255,255,255,0.6)",
          border: "none",
          fontSize: 20,
          lineHeight: 1,
          cursor: "pointer",
          padding: 4,
        }}
      >
        &times;
      </button>
    </div>
  )
}
