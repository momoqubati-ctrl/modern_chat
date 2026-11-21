import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App.js";

// Global anti-autofill & keyboard accessory suppressor for generic inputs
if (typeof document !== "undefined") {
  const applyAntiAutofill = (el: Element | null) => {
    if (!el) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.type === "password") return; // preserve intentional login/registration password fields
      if (!el.getAttribute("autocomplete")) el.setAttribute("autocomplete", "off");
      if (!el.getAttribute("autocorrect")) el.setAttribute("autocorrect", "off");
      if (!el.getAttribute("autocapitalize")) el.setAttribute("autocapitalize", "off");
      if (!el.getAttribute("spellcheck")) el.setAttribute("spellcheck", "false");
      if (!el.getAttribute("data-lpignore")) el.setAttribute("data-lpignore", "true");
      if (!el.getAttribute("data-1p-ignore")) el.setAttribute("data-1p-ignore", "true");
      if (!el.getAttribute("data-bwignore")) el.setAttribute("data-bwignore", "true");
      if (!el.getAttribute("data-form-type")) el.setAttribute("data-form-type", "other");
      if (el.form && !el.form.getAttribute("autocomplete")) el.form.setAttribute("autocomplete", "off");
    }
  };

  const applyToExisting = () => {
    try {
      const elements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input:not([type='password']), textarea");
      elements.forEach(applyAntiAutofill);
    } catch {}
  };

  document.addEventListener("pointerdown", (e) => applyAntiAutofill(e.target as Element), { capture: true, passive: true });
  document.addEventListener("focusin", (e) => applyAntiAutofill(e.target as Element), { capture: true, passive: true });
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyToExisting, { once: true });
  } else {
    setTimeout(applyToExisting, 100);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
