// Detect browser name, OS, and device type from navigator.userAgent
export function getBrowserInfo() {
  const ua = navigator.userAgent
  const uaLower = ua.toLowerCase()

  // Browser
  let browser = 'Unknown Browser'
  if (/edg\//i.test(ua))              browser = 'Microsoft Edge'
  else if (/opr\//i.test(ua))         browser = 'Opera'
  else if (/samsung/i.test(ua))       browser = 'Samsung Browser'
  else if (/chrome\/[\d.]+/i.test(ua) && !/chromium/i.test(ua)) browser = 'Google Chrome'
  else if (/chromium/i.test(ua))      browser = 'Chromium'
  else if (/firefox\/[\d.]+/i.test(ua)) browser = 'Mozilla Firefox'
  else if (/safari\/[\d.]+/i.test(ua) && !/chrome/i.test(ua))   browser = 'Safari'

  // OS
  let os = 'Unknown OS'
  if (/windows nt 10/i.test(ua))      os = 'Windows 11/10'
  else if (/windows nt/i.test(ua))    os = 'Windows'
  else if (/android/i.test(ua))       os = 'Android'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/mac os x/i.test(ua))      os = 'macOS'
  else if (/linux/i.test(ua))         os = 'Linux'

  // Device type
  let device = 'Desktop'
  if (/mobile|android|iphone|ipod/i.test(ua))  device = 'Mobile'
  else if (/ipad|tablet/i.test(ua))             device = 'Tablet'

  // Browser version
  let version = ''
  const vMatch =
    ua.match(/(?:chrome|firefox|safari|edg|opr)\/(\d+)/i) ||
    ua.match(/version\/(\d+)/i)
  if (vMatch) version = vMatch[1]

  return { browser, version, os, device }
}

export function getSessionStart() {
  const key = 'wa_session_start'
  const stored = localStorage.getItem(key)
  if (stored) return new Date(stored)
  const now = new Date().toISOString()
  localStorage.setItem(key, now)
  return new Date(now)
}
