import { useState, useEffect } from 'react'
import { bytesToUrl } from '../helpers'

export function ItemImage({ bytes, className }: { bytes: Uint8Array; className?: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    const url = bytesToUrl(bytes)
    if (!url) return
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [bytes])

  if (!src) return <div className={`img-placeholder ${className ?? ''}`}><span>No image</span></div>
  return <img src={src} alt="" className={className} />
}
