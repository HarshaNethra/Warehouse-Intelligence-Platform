export interface UserSettings {
  inferenceDevice: 'cuda' | 'cpu';
  riskThreshold: number;
  enableAlerts: boolean;
}

export const SETTINGS_STORAGE_KEY = 'wms_platform_settings';

export const DEFAULT_SETTINGS: UserSettings = {
  inferenceDevice: 'cuda',
  riskThreshold: 65,
  enableAlerts: true,
};

export function parseAndValidateSettings(rawJson: string | null): UserSettings {
  if (!rawJson) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_SETTINGS;
    }

    const device: 'cuda' | 'cpu' = (parsed.inferenceDevice === 'cpu' || parsed.inferenceDevice === 'cuda')
      ? parsed.inferenceDevice
      : DEFAULT_SETTINGS.inferenceDevice;

    const thresholdNum = Number(parsed.riskThreshold);
    const riskThreshold = (!isNaN(thresholdNum) && thresholdNum >= 30 && thresholdNum <= 95)
      ? thresholdNum
      : DEFAULT_SETTINGS.riskThreshold;

    const enableAlerts = typeof parsed.enableAlerts === 'boolean'
      ? parsed.enableAlerts
      : DEFAULT_SETTINGS.enableAlerts;

    return {
      inferenceDevice: device,
      riskThreshold,
      enableAlerts,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
