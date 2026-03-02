"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        callback?: (token: string) => void;
        "error-callback"?: () => void;
        "expired-callback"?: () => void;
        theme?: "light" | "dark" | "auto";
        size?: "normal" | "compact";
        language?: string;
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface CloudflareCaptchaProps {
  onVerify: (verified: boolean, token?: string) => void;
  siteKey?: string;
}

export default function CloudflareCaptcha({
  onVerify,
  siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_SITE_KEY || "1x00000000000000000000AA", // Default test key
}: CloudflareCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Load Cloudflare Turnstile script
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      setIsLoaded(true);
    };

    script.onerror = () => {
      console.error("Failed to load Cloudflare Turnstile script");
      onVerify(false, undefined);
    };

    document.body.appendChild(script);

    return () => {
      // Cleanup: remove script and widget
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.error("Error removing Turnstile widget:", e);
        }
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted || !isLoaded || !containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    // Initialize with verified = false (user must click widget first)
    onVerify(false, undefined);

    // Render Turnstile widget
    try {
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        size: "normal",
        language: "id",
        callback: (token: string) => {
          // Token received only after user interaction - verification successful
          if (token) {
            setHasInteracted(true);
            onVerify(true, token);
          } else {
            setHasInteracted(false);
            onVerify(false, undefined);
          }
        },
        "error-callback": () => {
          // Error occurred
          setHasInteracted(false);
          onVerify(false, undefined);
        },
        "expired-callback": () => {
          // Token expired - reset state
          setHasInteracted(false);
          onVerify(false, undefined);
        },
      });

      widgetIdRef.current = widgetId;
    } catch (error) {
      console.error("Error rendering Turnstile widget:", error);
      onVerify(false, undefined);
    }

    return () => {
      // Cleanup widget on unmount
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          console.error("Error removing Turnstile widget:", e);
        }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, isLoaded, siteKey]);

  if (!mounted) {
    return (
      <div className="w-full">
        <div className="border-2 border-gray-300 bg-gray-50 rounded-lg p-4 min-h-[70px] flex items-center justify-center">
          <span className="text-gray-500 text-sm">Memuat verifikasi...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="cloudflare-turnstile">
      <div
        ref={containerRef}
        className="flex justify-start"
        style={{ minHeight: "65px" }}
      />
    </div>
  );
}
