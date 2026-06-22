/**
 * Extracts and formats error messages from API response errors safely.
 * Handles FastAPI's validation error arrays (HTTP 422) without crashing React.
 */
export const getErrorMessage = (err, defaultMsg = 'An error occurred') => {
  if (err.response?.data?.detail) {
    const detail = err.response.data.detail
    if (Array.isArray(detail)) {
      return detail.map(d => {
        const path = d.loc ? d.loc.filter(l => l !== 'body').join('.') : ''
        return `${path ? path + ': ' : ''}${d.msg}`
      }).join(' | ')
    }
    if (typeof detail === 'string') return detail
    return JSON.stringify(detail)
  }
  return err.message || defaultMsg
}
