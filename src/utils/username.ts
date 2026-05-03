// Username validator + auto-generator.
//
// The username is exposed publicly when a user shares a profile (the share
// code embeds it so the recipient knows where the profile came from), so we
// gate it against obvious slurs and profanity. The list isn't exhaustive —
// determined bypassers will get through — but it catches the common ones.
// We also test a normalized form (digits + punctuation stripped) to catch
// trivial leetspeak / obfuscation.

const BANNED_PATTERNS: RegExp[] = [
  // Racial / ethnic / orientation slurs (with leet variants)
  /n[i1!|]+gg?[ae3]r?s?/i,
  /f[a@4]+gg?(?:[o0]t|y)?s?/i,
  /\br[e3]+t[a@4]rd(?:ed|s)?\b/i,
  /\bch[i1!|]+nk(?:y|s)?\b/i,
  /\bsp[i1!|]+c(?:s|ks)?\b/i,
  /\bk[i1!|]+ke?s?\b/i,
  /\btr[a@4]+nn?[i1!|]e?s?\b/i,
  /\bg[o0][o0]ks?\b/i,
  /\bw[e3]+tb[a@4]+cks?\b/i,
  // Hate symbols / groups
  /\b(?:hitler|nazis?|kkk|isis)\b/i,
  // Common profanity
  /\bf[uvw*]+ck/i,
  /\bsh[i1!|]+t/i,
  /\bb[i1!|]+tch/i,
  /[a@4]+ssh[o0]+le/i,
  /\bcunts?\b/i,
  /\bwh[o0]+res?\b/i,
  /\bsluts?\b/i,
  /\bd[i1!|]+ckhead/i,
  // Sexual content
  /\bp[o0]+rn/i,
  /\bxxx\b/i,
  /\bn[u\v]+des?\b/i,
]

function normalize(s: string): string {
  // Strip whitespace, punctuation, and digits so things like "n.i.g.g.e.r"
  // or "sh1t" still match the patterns above.
  return s.toLowerCase().replace(/[\s_\-.\d]/g, '')
}

export interface UsernameCheck {
  ok: boolean
  reason?: string
}

export function validateUsername(name: string): UsernameCheck {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return { ok: false, reason: 'Username is required.' }
  }
  if (trimmed.length > 40) {
    return { ok: false, reason: 'Username must be 40 characters or fewer.' }
  }

  const norm = normalize(trimmed)
  for (const re of BANNED_PATTERNS) {
    if (re.test(trimmed) || re.test(norm)) {
      return {
        ok: false,
        reason: "That username contains language that isn't allowed. Please pick another.",
      }
    }
  }
  return { ok: true }
}

export function generateUsername(): string {
  // Branded "Xcel-######" placeholder — six random digits, ~900K possibilities.
  // Dash separator reads as intentional, ties the auto-generated name to the
  // app rather than the generic "User###" you'd see in any random utility.
  const n = Math.floor(100000 + Math.random() * 900000)
  return `Xcel-${n}`
}
