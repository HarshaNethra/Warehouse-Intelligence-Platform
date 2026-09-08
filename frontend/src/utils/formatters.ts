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
