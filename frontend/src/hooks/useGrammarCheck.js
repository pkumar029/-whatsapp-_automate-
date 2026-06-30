import { useState, useCallback, useRef, useEffect } from 'react'
import { messagesApi } from '../services/api'

/**
 * Hook: grammar + spell check via backend LanguageTool proxy.
 *
 * - Debounces API calls 800ms after the last text change.
 * - Skips texts shorter than 10 chars (too short to check).
 * - Exposes `language` setter so the user can switch locale.
 */
export function useGrammarCheck() {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null)   // { matches, corrected, issues }
  const [language, setLanguage] = useState('en-US')

  const timerRef = useRef(null)
  const langRef = useRef(language)
  useEffect(() => { langRef.current = language }, [language])

  const check = useCallback((text) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!text || text.trim().length < 10) {
      setResult(null)
      setChecking(false)
      return
    }

    setChecking(true)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await messagesApi.checkGrammar({ text, language: langRef.current })
        setResult(res.data)
      } catch {
        setResult(null)
      } finally {
        setChecking(false)
      }
    }, 800)
  }, [])

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setResult(null)
    setChecking(false)
  }, [])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return { checking, result, language, setLanguage, check, reset }
}
