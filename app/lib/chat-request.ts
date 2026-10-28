export const CHAT_UPSTREAM_TIMEOUT_MS = 25_000
export const THREAD_ID_MAX_CHARS = 160
export const THREAD_ID_MAX_UTF8_BYTES = 256
/** Daisy's thread for photos sent from the Photos page's camera/attach buttons. */
export const PHOTO_CATALOGUE_THREAD = 'photo-catalogue'

const THREAD_ID_SYNTAX = /^(?:main|photo-catalogue|jr-[1-9]\d*|(?:supplier|customer)-[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*)$/u
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u
const utf8 = new TextEncoder()

/** Exact canonical user-facing thread syntax; never repairs or coerces input. */
export function validCanonicalThreadId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  // Reject impossible giant inputs before trim/normalization/UTF-8 allocation.
  if (value.length > THREAD_ID_MAX_CHARS * 2) return false
  if (value !== value.trim() || value !== value.normalize('NFC') || value !== value.toLowerCase()) return false
  if ([...value].length > THREAD_ID_MAX_CHARS || utf8.encode(value).byteLength > THREAD_ID_MAX_UTF8_BYTES) return false
  if (CONTROL_CHARACTERS.test(value)) return false
  return THREAD_ID_SYNTAX.test(value)
}

