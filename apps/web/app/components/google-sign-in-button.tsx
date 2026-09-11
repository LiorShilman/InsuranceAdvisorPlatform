"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Loads Google Identity Services and renders the real Google button (not a
 * custom-styled overlay — see ls-financial-advisor's google-sso component
 * for that pattern; here we render Google's own button as-is, simpler and
 * needs no CSS layering trick). On a successful pick, hands the raw ID
 * token up to the caller — verification happens server-side
 * (app/api/auth/google/route.ts), never trusted here.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: unknown) => void;
          renderButton: (el: HTMLElement, options: unknown) => void;
        };
      };
    };
  }
}

type Props = {
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
};

export function GoogleSignInButton({ onCredential, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [clientId] = useState(() => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  // Latest callbacks via a ref, so the setup effect below can run exactly
  // once (empty-ish dep array) instead of re-initializing/re-rendering
  // Google's button — and stacking duplicate buttons — on every parent
  // render, which would happen if onCredential/onError were passed inline
  // and put directly in the dependency array.
  const callbacksRef = useRef({ onCredential, onError });
  callbacksRef.current = { onCredential, onError };

  useEffect(() => {
    if (!clientId) return;

    function render() {
      if (!window.google || !containerRef.current) return;
      // Clears any button rendered by a prior call — e.g. React Strict
      // Mode's dev-only double effect invocation would otherwise stack two.
      containerRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => {
          if (response.credential) callbacksRef.current.onCredential(response.credential);
          else callbacksRef.current.onError?.("לא התקבל אישור מ-Google");
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        locale: "he",
      });
    }

    if (window.google?.accounts) {
      render();
      return;
    }
    // Reuse an already-appended (still loading) script tag instead of
    // adding a second one — matters under React Strict Mode's dev-only
    // double effect invocation, which would otherwise fire this twice.
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", render);
      return () => existing.removeEventListener("load", render);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    script.onerror = () => callbacksRef.current.onError?.("טעינת שירותי Google נכשלה");
    document.head.appendChild(script);
    // Deliberately not removing the script itself on unmount — Google
    // Identity Services is meant to be loaded once and reused across the app.
  }, [clientId]);

  if (!clientId) return null;

  return <div ref={containerRef} style={{ display: "flex", justifyContent: "center" }} />;
}
