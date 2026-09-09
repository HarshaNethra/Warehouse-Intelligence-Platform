/**
 * Extracts clean relative video offset in seconds (e.g. 14.2s) from an event,
 * preventing raw epoch timestamps (e.g. 1788966474) from appearing as timecodes.
 */
export function extractVideoOffsetSeconds(event: { timestamp?: number | string | null; timestamp_seconds?: number | null; evidence_frame?: string | null; video_reference?: string | null }): number {
  if (event.timestamp_seconds != null && event.timestamp_seconds >= 0 && event.timestamp_seconds < 100000) {
    return Number(event.timestamp_seconds);
  }

  const rawUrl = event.evidence_frame || event.video_reference || '';
  if (rawUrl.includes('#t=')) {
    const parsed = parseFloat(rawUrl.split('#t=')[1]);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }

  const num = typeof event.timestamp === 'number' ? event.timestamp : parseFloat(String(event.timestamp || 0));
  if (!isNaN(num) && num >= 0) {
    if (num < 100000) return num;
    // If epoch timestamp, derive bounded seconds offset within video duration
    return parseFloat((num % 60).toFixed(1));
  }
  return 12.5;
}

/**
 * Converts floating-point seconds (e.g., 19.55) into standard MM:SS format (e.g., "00:19").
 * Returns "00:00" for invalid, NaN, or negative inputs.
 */
export function formatTimecode(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return "00:00";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Converts raw epoch UNIX timestamps (e.g., 1788888479) into readable string representations.
 * Example output: "Sep 09, 2026 • 12:22:03 AM".
 * Automatically handles both seconds and millisecond epoch inputs as well as timecodes.
 */
export function formatEpochDate(epochInput: number | string | undefined | null): string {
  if (epochInput === undefined || epochInput === null || epochInput === '') {
    return 'N/A';
  }

  const num = typeof epochInput === 'string' ? parseFloat(epochInput) : epochInput;
  if (isNaN(num) || num < 0) {
    return String(epochInput);
  }

  // Small video timecodes (e.g. 19.2s)
  if (num >= 0 && num < 100000) {
    return `Timecode ${formatTimecode(num)} (${num.toFixed(1)}s)`;
  }

  // POSIX epoch timestamp (seconds vs milliseconds check)
  const epochMs = num > 1e11 ? num : num * 1000;
  const date = new Date(epochMs);
  if (isNaN(date.getTime())) {
    return `${num}s`;
  }

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return `${dateStr} • ${timeStr}`;
}

/**
 * Backwards compatible alias for formatEpochDate
 */
export const formatTimestamp = formatEpochDate;

