/**
 * Date & Time Utilities — Indian Standard Time (IST) formatting
 */

export function formatIST(dateInput) {
  if (!dateInput) return '—';
  try {
    const date = new Date(dateInput);
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
    const date = new Date(dateInput);
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
    const date = new Date(dateInput);
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
