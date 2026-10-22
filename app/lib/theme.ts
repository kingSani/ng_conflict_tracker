"use client";

export type Theme = "dark" | "light";

const THEME_EVENT = "conflict-theme-change";

export function getThemeSnapshot(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem("conflict-theme");
  if (saved === "dark" || saved === "light") return saved;
  const query = new URLSearchParams(window.location.search).get("theme");
  return query === "light" ? "light" : "dark";
}

export function getServerThemeSnapshot(): Theme {
  return "dark";
}

export function subscribeTheme(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(THEME_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(THEME_EVENT, listener);
  };
}

export function setThemePreference(theme: Theme): void {
  window.localStorage.setItem("conflict-theme", theme);
  window.dispatchEvent(new Event(THEME_EVENT));
}
