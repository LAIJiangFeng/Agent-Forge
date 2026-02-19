// -----------------------------------------------------------
// Translation Service — Detect English and translate to Chinese
// Uses Google Translate free API + Electron net module (proxy-aware)
// -----------------------------------------------------------

import { net } from 'electron'

// -----------------------------------------------------------
// Cache
// -----------------------------------------------------------
const translationCache = new Map<string, string>()

// -----------------------------------------------------------
// Detect if text is primarily English
// -----------------------------------------------------------
function isEnglish(text: string): boolean {
  if (!text || text.trim().length === 0) return false

  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[#*_[\]()>|-]/g, '')
    .replace(/\d+/g, '')
    .trim()

  if (cleaned.length < 10) return false

  const asciiLetters = cleaned.match(/[a-zA-Z]/g)?.length || 0
  const cjkChars = cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)?.length || 0

  if (cjkChars > 5) return false
  return asciiLetters / cleaned.length > 0.6
}

// -----------------------------------------------------------
// Google Translate free API via Electron net (proxy-aware)
// -----------------------------------------------------------
function googleTranslate(text: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const truncated = text.length > 4500 ? text.slice(0, 4500) : text
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q=${encodeURIComponent(truncated)}`

      const request = net.request(url)
      let data = ''

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          data += chunk.toString()
        })

        response.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
              const translated = parsed[0]
                .filter((seg: unknown) => Array.isArray(seg) && seg[0])
                .map((seg: unknown[]) => seg[0])
                .join('')
              resolve(translated)
            } else {
              resolve(text)
            }
          } catch {
            resolve(text)
          }
        })

        response.on('error', () => resolve(text))
      })

      request.on('error', () => resolve(text))
      request.end()
    } catch {
      resolve(text)
    }
  })
}

// -----------------------------------------------------------
// Translate single text with cache + English detection
// -----------------------------------------------------------
async function translateText(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text
  if (!isEnglish(text)) return text

  const cacheKey = text.slice(0, 300)
  const cached = translationCache.get(cacheKey)
  if (cached) return cached

  const translated = await googleTranslate(text)
  translationCache.set(cacheKey, translated)
  return translated
}

// -----------------------------------------------------------
// Public API
// -----------------------------------------------------------
export interface TranslatedSkillContent {
  description: string
  instructions: string
  features: string[]
}

export async function translateSkillContent(
  description: string,
  instructions: string,
  features: string[]
): Promise<TranslatedSkillContent> {
  try {
    const translatedDesc = await translateText(description)
    const translatedInst = await translateText(instructions)
    const translatedFeats: string[] = []
    for (const f of features) {
      translatedFeats.push(await translateText(f))
    }

    return {
      description: translatedDesc,
      instructions: translatedInst,
      features: translatedFeats
    }
  } catch (err) {
    console.error('[Translate] error:', err)
    return { description, instructions, features }
  }
}
