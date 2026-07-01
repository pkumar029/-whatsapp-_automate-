/**
 * Date & Time Utilities — Indian Standard Time (IST) formatting
 */

function parseUTCDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  let input = dateInput;
  if (typeof dateInput === 'string' && !dateInput.endsWith('Z') && !dateInput.includes('+')) {
    // If it has the ISO 'T' delimiter but no timezone suffix, append 'Z' to treat as UTC
    if (dateInput.includes('T')) {
      input = dateInput + 'Z';
    }
  }
  return new Date(input);
}

export function formatIST(dateInput) {
  if (!dateInput) return '—';
  try {
    const date = parseUTCDate(dateInput);
    if (!date || isNaN(date.getTime())) return dateInput;
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return dateInput;
  }
}

export function formatISTTime(dateInput) {
  if (!dateInput) return '—';
  try {
    const date = parseUTCDate(dateInput);
    if (!date || isNaN(date.getTime())) return dateInput;
    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateInput;
  }
}

export function formatISTDate(dateInput) {
  if (!dateInput) return '—';
  try {
    const date = parseUTCDate(dateInput);
    if (!date || isNaN(date.getTime())) return dateInput;
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return dateInput;
  }
}
