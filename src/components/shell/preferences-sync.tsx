"use client";

import { useEffect } from "react";
import { applyToDocument, usePreferences } from "@/lib/preferences";

/** Mirrors the viewer's display preferences onto <html> (e.g. data-reduce-motion). */
export function PreferencesSync() {
  const prefs = usePreferences();
  useEffect(() => applyToDocument(prefs), [prefs]);
  return null;
}
