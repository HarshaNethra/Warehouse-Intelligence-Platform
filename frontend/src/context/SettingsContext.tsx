import React, { useState, useEffect } from 'react';
import {
  type UserSettings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  parseAndValidateSettings,
} from '../types/settings';
import { SettingsContext } from './settingsContextDef';

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(SETTINGS_STORAGE_KEY) : null;
      return parseAndValidateSettings(stored);
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save settings to localStorage:', e);
      }
      return updated;
    });
  };

  const resetSettings = () => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
      console.error('Failed to reset settings:', e);
    }
    setSettings(DEFAULT_SETTINGS);
  };

  // Listen to storage events for cross-tab synchronisation
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY) {
        setSettings(parseAndValidateSettings(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

