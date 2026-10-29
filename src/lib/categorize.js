// Category matching for CSV import: reuse existing categories, merge synonyms/plurals,
// and guess a category from the product name/description only when exactly one rule matches.

const SYNONYMS = {
  camera: 'Cameras', dslr: 'Cameras', mirrorless: 'Cameras', camcorder: 'Cameras',
  lens: 'Lenses', optic: 'Lenses',
  light: 'Lighting', lighting: 'Lighting', led: 'Lighting',
  drone: 'Drones', uav: 'Drones', aerial: 'Drones',
  audio: 'Audio', sound: 'Audio', mic: 'Audio', microphone: 'Audio',
  tripod: 'Tripods & Support', support: 'Tripods & Support', grip: 'Tripods & Support', gimbal: 'Tripods & Support',
  battery: 'Power & Batteries', power: 'Power & Batteries',
  storage: 'Storage & Media', media: 'Storage & Media',
  monitor: 'Monitors & Displays', display: 'Monitors & Displays',
  cable: 'Cables & Accessories', accessory: 'Cables & Accessories',
}

const RULES = [
  ['Cameras', /\b(cameras?|dslr|mirrorless|camcorder|cinema camera|gopro|action cam|komodo|bmpcc|eos r\d?|sony a7\w*|fx[369]|gh[56])\b/i],
  ['Lenses', /\b(lens|lenses|prime lens|zoom lens)\b/i],
  ['Lighting', /\b(lights?|lighting|led panel|softbox|strobe|speedlight|fresnel|ring light|tube light|par can|aputure|godox|nanlite)\b/i],
  ['Drones', /\b(drones?|uav|quadcopter|mavic|phantom|dji mini|dji air|fpv)\b/i],
  ['Audio', /\b(mics?|microphones?|lavalier|lapel|audio|recorder|speakers?|mixer|headphones?|boom pole)\b/i],
  ['Tripods & Support', /\b(tripods?|monopods?|gimbals?|stabili[sz]er|slider|jib|crane|c-stand|stands?)\b/i],
  ['Power & Batteries', /\b(batter(y|ies)|chargers?|v-mount|power bank|generator)\b/i],
  ['Storage & Media', /\b(sd card|cfexpress|memory card|ssd|hard drive|hdd)\b/i],
  ['Monitors & Displays', /\b(monitors?|tv|television|projectors?|led wall|display)\b/i],
  ['Cables & Accessories', /\b(cables?|hdmi|sdi|adapters?)\b/i],
]

export function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length > 3 ? w.replace(/ies$/, 'y').replace(/(ses|xes|ches|shes)$/, (m) => m.slice(0, -2)).replace(/s$/, '') : w))
    .join(' ')
}

const titleCase = (s) => s.trim().replace(/\s+/g, ' ').replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1))

// Resolve a raw category string to a name, reusing anything in `known` that means the same thing.
export function canonicalCategory(raw, known) {
  if (!raw || !String(raw).trim()) return null
  const key = normalizeKey(raw)
  const synonym = SYNONYMS[key]
  const keys = [key, synonym && normalizeKey(synonym)].filter(Boolean)
  const hit = known.find((k) => keys.includes(normalizeKey(k)))
  return hit || synonym || titleCase(String(raw))
}

// Guess from product text; null when no rule or several rules match (ambiguous → manual).
export function detectCategory(text, known) {
  const matches = RULES.filter(([, re]) => re.test(text || ''))
  if (matches.length !== 1) return null
  return canonicalCategory(matches[0][0], known)
}
