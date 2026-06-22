import { useState, useEffect, useRef } from 'react'
import { Icon } from './Icon'

export function CameraModal({ title, onCapture, onClose, closeOnCapture }: { title: string; onCapture: (bytes: Uint8Array) => void; onClose: () => void; closeOnCapture?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [cameraReady, setCameraReady] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    let stream: MediaStream | undefined
    setCameraReady(false)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } } })
      .then(s => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play()
          videoRef.current.onloadedmetadata = () => setCameraReady(true)
        }
      })
      .catch(err => console.error('Camera error:', err))
    return () => { stream?.getTracks().forEach(t => t.stop()); setCameraReady(false) }
  }, [facing])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleCapture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !cameraReady) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      blob.arrayBuffer().then(buf => {
        onCapture(new Uint8Array(buf))
        if (closeOnCapture) { onClose(); return }
        setFlash(true)
        setTimeout(() => setFlash(false), 250)
      })
    }, 'image/jpeg', 0.85)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal camera-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="camera-modal-body">
          <div className="capture-camera-wrap">
            <video ref={videoRef} className="capture-video" autoPlay playsInline muted />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <button className="capture-flip-btn" onClick={() => setFacing(f => f === 'environment' ? 'user' : 'environment')}>
              <Icon d={['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15']} size={18} />
            </button>
            {!cameraReady && <div className="capture-loading">Initializing camera…</div>}
            {flash && <div className="capture-flash" />}
          </div>
          <button className="capture-shutter" onClick={handleCapture} disabled={!cameraReady}>
            <div className="capture-shutter-inner" />
          </button>
        </div>
      </div>
    </div>
  )
}
