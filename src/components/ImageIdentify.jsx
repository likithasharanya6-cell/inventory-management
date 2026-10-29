import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { identifyItem } from '../lib/recognize'
import { Img, Modal } from './ui'

// Admin: pick a photo → identify the item in the browser → add it straight to its category (or ask
// for the category when recognition isn't confident) → open its page, where details can be edited.
export default function ImageIdentify({ categories, onClose, onSaved }) {
  const navigate = useNavigate()
  const input = useRef(null)
  const [step, setStep] = useState('pick')
  const [preview, setPreview] = useState('')
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const [choice, setChoice] = useState('')

  useEffect(() => { input.current?.click() }, [])

  function onProgress(p) {
    if (p.status === 'progress' && p.file?.endsWith('.onnx')) setProgress(Math.round(p.progress))
    if (p.status === 'ready') setProgress(null)
  }

  async function onFile(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please choose an image file')
    if (!categories.length) return setError('Create at least one category first')
    setError('')
    const local = URL.createObjectURL(file)
    setPreview(local)
    setStep('working')

    let item
    try {
      item = await identifyItem(file, categories.map((c) => c.name), onProgress)
    } catch (e) {
      console.error('Image recognition failed', e)
      setStep('pick')
      return setError('Image recognition could not start. Check your internet connection and try again.')
    }

    const cat = categories.find((c) => c.name === item.category)
    if (!cat) {
      // Not confident: ask for the category instead of guessing.
      setPending({ file, item })
      setChoice('')
      return setStep('choose')
    }
    await addProduct(file, item.name, cat.id)
  }

  async function addProduct(file, name, categoryId) {
    setStep('working')
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    const up = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type })
    if (up.error) { setStep('pick'); return setError(`Image upload failed: ${up.error.message}`) }
    const image_url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl

    const { data: row, error: ie } = await supabase.from('products').insert({
      name,
      category_id: categoryId,
      image_url,
      description: `${name} — added automatically from a photo.`,
    }).select().single()
    if (ie) { setStep('pick'); return setError(ie.message) }
    onSaved()
    navigate(`/product/${row.id}`)
  }

  return (
    <Modal title="Add product from photo" onClose={onClose}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files[0])} />
      {step === 'pick' ? (
        <button className="btn primary" onClick={() => input.current?.click()}>Choose a photo</button>
      ) : step === 'choose' ? (
        <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
          <div className="thumb lg"><Img src={preview} size={20} /></div>
          <div className="stack" style={{ gap: 10, flex: 1 }}>
            <div className="small muted">Couldn't identify this item confidently. Choose its category:</div>
            <select className="input" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="" disabled>Choose a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div><button className="btn primary" disabled={!choice} onClick={() => addProduct(pending.file, pending.item.nameFor(categories.find((c) => c.id === choice).name), choice)}>Add product</button></div>
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: 16 }}>
          <div className="thumb lg"><Img src={preview} size={20} /></div>
          <div className="row">
            <div className="spinner" />
            <span className="muted">
              {progress != null ? `Downloading recognition model (first time only)… ${progress}%` : 'Identifying and adding the item…'}
            </span>
          </div>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </Modal>
  )
}
