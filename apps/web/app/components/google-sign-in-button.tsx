"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Loads Google Identity Services and renders a button that actually matches
 * this app's own design system — not Google's default "outline"/"filled_black"
 * widget, whose stark white box looked out of place against this app's dark
 * surfaces (2026-09-12 user feedback). Same pattern already proven in the
 * sibling `ls-financial-advisor` project's `google-sso.component.ts`: a
 * fully custom-styled button the user actually sees (`.google-btn`, reusing
 * this app's own `.btn` tokens — automatically theme-correct in both light
 * and dark mode via CSS variables, no theme-tracking JS needed), with
 * Google's real button rendered nearly-invisible directly on top of it
 * (`.google-btn-overlay`, opacity 0.01 — not display:none/visibility:hidden,
 * which would stop it from receiving the click) so the actual click target
 * and the accessible/keyboard-focusable element are still Google's own.
 * Only the pixels are custom; the interaction is still 100% Google's widget.
 * Verification of what it returns still happens server-side, same as
 * before (app/api/auth/google/route.ts) — this only changes what's drawn.
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
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
    let cancelled = false;

    function render() {
      if (cancelled || !window.google || !overlayRef.current || !wrapperRef.current) return;
      const width = Math.round(wrapperRef.current.getBoundingClientRect().width) || 320;
      // Clears any button rendered by a prior call — both React Strict
      // Mode's dev-only double effect invocation and a resize re-render
      // into the same overlay.
      overlayRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => {
          if (response.credential) callbacksRef.current.onCredential(response.credential);
          else callbacksRef.current.onError?.("לא התקבל אישור מ-Google");
        },
      });
      // theme/text here are irrelevant to what's actually seen (the overlay
      // is ~invisible) — only width/size matter, so the real click target
      // covers the same area as the custom button drawn beneath it.
      window.google.accounts.id.renderButton(overlayRef.current, { type: "standard", size: "large", width });
    }

    function loadThenRender() {
      if (window.google?.accounts) {
        render();
        return;
      }
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        existing.addEventListener("load", render);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = render;
      script.onerror = () => callbacksRef.current.onError?.("טעינת שירותי Google נכשלה");
      document.head.appendChild(script);
      // Deliberately not removing the script itself on unmount — Google
      // Identity Services is meant to be loaded once and reused across the app.
    }

    loadThenRender();

    // Re-render on container resize so the real (overlay) button's width
    // always matches the custom button drawn under it, on any card width.
    const resizeObserver = new ResizeObserver(() => render());
    if (wrapperRef.current) resizeObserver.observe(wrapperRef.current);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div ref={wrapperRef} className="google-btn-wrapper">
      <button type="button" className="btn google-btn" tabIndex={-1} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        המשך עם Google
      </button>
      {/* The real, functional Google button — nearly invisible, positioned
          exactly over the button above so its click/keyboard target is what
          the user actually interacts with. `aria-hidden` above prevents the
          decorative fake button from being announced twice to screen readers. */}
      <div ref={overlayRef} className="google-btn-overlay" />
    </div>
  );
}
