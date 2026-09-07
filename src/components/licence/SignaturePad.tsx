import { useRef, useState } from 'react'
import { Button } from '@/components/common/Button'

/** HTML canvas drawn-signature capture. Renders to a PNG blob on "Done" — upload happens in the caller. */
export function SignaturePad({ onDone }: { onDone: (blob: Blob) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  function getContext() {
    const canvas = canvasRef.current
    return canvas?.getContext('2d') ?? null
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = getContext()
    if (!ctx) return
    drawing.current = true
    setHasDrawn(true)
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = getContext()
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#ffffff'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handlePointerUp() {
    drawing.current = false
  }

  function handleClear() {
    const canvas = canvasRef.current
    const ctx = getContext()
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  function handleDone() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (blob) onDone(blob)
    }, 'image/png')
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={400}
        height={140}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full touch-none rounded-lg border border-surface-border bg-surface-3"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" type="button" onClick={handleClear}>
          Clear
        </Button>
        <Button size="sm" type="button" onClick={handleDone} disabled={!hasDrawn}>
          Use this signature
        </Button>
      </div>
    </div>
  )
}
