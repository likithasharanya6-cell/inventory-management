// In-browser equipment recognition for Categories → Upload image.
//
// Recognition is by example: the photo is embedded with the CLIP image model and compared with
// ~350 labelled reference photos of real equipment (recognition-data.js). Matching against text
// descriptions alone could not tell cameras, lenses, flashes and gimbals apart reliably.
// The model downloads once per device on first use and the browser caches it; photos never leave
// the device for recognition.

const KNN = 7
const MIN_PROB = 0.6 // winning kind's probability
const MIN_GAP = 0.3 // lead over the runner-up kind
const MIN_SIMILARITY = 0.75 // must closely resemble at least one real reference photo
const TYPE_AGREEMENT = 0.7 // share of nearest same-kind references that must agree on an item type

// Kind → existing category (matched by category name). Kinds without their own category (gimbals,
// audio) go to the catch-all category.
const KIND_CATEGORY = {
  camera: /camera/i,
  lens: /lens/i,
  tripod: /tripod|stand/i,
  lighting: /light/i,
  gimbal: /gimbal|stabili/i,
  drone: /drone/i,
  audio: /audio|sound|mic/i,
}
const GENERIC = /^(other|others|misc|miscellaneous|general)$/i
const KIND_NAME = {
  camera: 'Camera', lens: 'Camera Lens', tripod: 'Tripod', lighting: 'Lighting Equipment',
  gimbal: 'Gimbal Stabilizer', drone: 'Drone', audio: 'Audio Equipment',
}

export function categoryForKind(kind, categoryNames) {
  const own = categoryNames.find((n) => !GENERIC.test(n.trim()) && KIND_CATEGORY[kind]?.test(n))
  return own || categoryNames.find((n) => GENERIC.test(n.trim())) || null
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s }
const normalize = (v) => { const n = Math.sqrt(dot(v, v)); return v.map((x) => x / n) }

let loading = null
function load(onProgress) {
  if (!loading) {
    loading = Promise.all([import('@huggingface/transformers'), import('./recognition-data.js')])
      .then(async ([T, D]) => {
        const [processor, vision] = await Promise.all([
          T.AutoProcessor.from_pretrained(D.MODEL),
          T.CLIPVisionModelWithProjection.from_pretrained(D.MODEL, { dtype: 'q8', progress_callback: onProgress }),
        ])
        const bytes = Uint8Array.from(atob(D.VECTORS), (c) => c.charCodeAt(0))
        const ints = new Int8Array(bytes.buffer)
        const refs = D.LABELS.map(([k, t], i) => ({
          kind: D.KINDS[k],
          type: t >= 0 ? D.TYPE_NAMES[t] : '',
          v: normalize(Array.from(ints.subarray(i * 512, (i + 1) * 512))),
        }))
        const protos = Object.fromEntries(D.KINDS.map((k) => {
          const r = refs.filter((x) => x.kind === k)
          return [k, normalize(r[0].v.map((_, i) => r.reduce((a, x) => a + x.v[i], 0)))]
        }))
        return { T, processor, vision, refs, protos, kinds: D.KINDS }
      })
      .catch((e) => { loading = null; throw e })
  }
  return loading
}

// Probability per kind: half from the kind's average reference, half from the nearest references.
function kindProbabilities(v, { refs, protos, kinds }) {
  const sims = Object.fromEntries(kinds.map((k) => [k, dot(v, protos[k])]))
  const maxSim = Math.max(...Object.values(sims))
  const proto = Object.fromEntries(kinds.map((k) => [k, Math.exp(100 * (sims[k] - maxSim))]))
  const protoTotal = Object.values(proto).reduce((a, b) => a + b, 0)

  const nearest = refs.map((r) => [r.kind, dot(v, r.v)]).sort((a, b) => b[1] - a[1]).slice(0, KNN)
  const knn = Object.fromEntries(kinds.map((k) => [k, 0]))
  for (const [k, sim] of nearest) knn[k] += Math.exp(50 * (sim - nearest[0][1]))
  const knnTotal = Object.values(knn).reduce((a, b) => a + b, 0)

  const probs = kinds.map((k) => [k, 0.5 * proto[k] / protoTotal + 0.5 * knn[k] / knnTotal])
  return { ranked: probs.sort((a, b) => b[1] - a[1]), topSimilarity: nearest[0][1] }
}

// Name from the item type most of the nearest same-kind references share; otherwise a plain name
// for the kind. No brand or model is guessed — those can't be verified from the photo.
function nameForKind(v, kind, refs) {
  const nearest = refs.filter((r) => r.kind === kind)
    .map((r) => [r.type, dot(v, r.v)]).sort((a, b) => b[1] - a[1]).slice(0, KNN)
  const votes = {}
  for (const [t] of nearest) if (t) votes[t] = (votes[t] || 0) + 1
  const [type, n] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0] || []
  return type && n / nearest.length >= TYPE_AGREEMENT ? type : KIND_NAME[kind]
}

// Identify the equipment in a photo (File/Blob, or a URL/path). Returns the category to assign
// (null when the result isn't reliable) and a product name; nameFor(category) gives a name that
// fits a category the user picks manually.
export async function identifyItem(image, categoryNames, onProgress) {
  const model = await load(onProgress)
  const raw = typeof image === 'string' ? await model.T.RawImage.read(image) : await model.T.RawImage.fromBlob(image)
  const { image_embeds } = await model.vision(await model.processor(raw))
  const v = Array.from(image_embeds.normalize(2, -1).data)

  const { ranked, topSimilarity } = kindProbabilities(v, model)
  const [[kind, p1], [, p2]] = ranked
  const category = categoryForKind(kind, categoryNames)
  const reliable = Boolean(category) && p1 >= MIN_PROB && p1 - p2 >= MIN_GAP && topSimilarity >= MIN_SIMILARITY

  const nameFor = (categoryName) => {
    // The chosen category decides what kind of item this is: name it as the best-ranked kind that
    // belongs there. For the catch-all category, keep what the photo most looks like unless a kind
    // that belongs there is plausible. A category no kind maps to gets a plain name.
    const match = ranked.find(([k]) => categoryForKind(k, categoryNames) === categoryName)
    if (GENERIC.test(categoryName.trim())) return nameForKind(v, match && match[1] >= 0.2 ? match[0] : kind, model.refs)
    return match ? nameForKind(v, match[0], model.refs) : `${categoryName.trim().replace(/s$/i, '')} Item`
  }
  return {
    kind,
    category: reliable ? category : null,
    name: reliable ? nameFor(category) : nameForKind(v, kind, model.refs),
    nameFor,
    scores: { probability: p1, lead: p1 - p2, similarity: topSimilarity },
  }
}
