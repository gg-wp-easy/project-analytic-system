import { useEffect, useState } from "react";
import { DEFAULT_OPTIMIZER_SETTINGS, OPTIMIZER_SETTINGS_STORAGE_KEY, type OptimizerSettings } from "../model";
import { normalizeOptimizerSettings } from "./optimizer-settings.helpers";

export function useOptimizerSettings() {
  const [settings, setSettings] = useState<OptimizerSettings>(DEFAULT_OPTIMIZER_SETTINGS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPTIMIZER_SETTINGS_STORAGE_KEY);
      if (!raw) {
        return;
      }
      setSettings(normalizeOptimizerSettings(JSON.parse(raw) as Partial<OptimizerSettings>));
    } catch {
      // ignore broken persisted state
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(OPTIMIZER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return { settings, setSettings };
}
