const MAX_DISPLAY_H = 280
const MAX_DISPLAY_W = 400

/**
 * Shows the detected YouTube crop region as a thumbnail overlay.
 * Only renders when detection found a crop region (or is still running).
 * Gracefully returns null when no crop was detected after detection completes.
 *
 * @param {{
 *   cropRegion:       { x, y, w, h } | null,   video-pixel coords
 *   thumbnailDataUrl: string | null,
 *   isDetecting:      boolean,
 *   crop:             { x, y, w, h, enabled: boolean } | null,  from settings
 *   onChange:         (newCrop: object | null) => void,
 *   videoWidth:       number,
 *   videoHeight:      number,
 *   disabled:         boolean,
 * }} props
 */
export default function CropPreview({
  cropRegion,
  thumbnailDataUrl,
  isDetecting,
  crop,
  onChange,
  videoWidth,
  videoHeight,
  disabled,
}) {
  if (isDetecting) {
    return (
      <div className="px-3 py-2.5 bg-slate-800 rounded-xl flex items-center gap-2.5">
        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin shrink-0" />
        <span className="text-xs text-slate-500">Detecting crop region…</span>
      </div>
    )
  }

  if (!cropRegion || !thumbnailDataUrl) return null

  // Compute display dimensions, capped so the thumbnail fits the UI
  const scale = Math.min(1, MAX_DISPLAY_H / videoHeight, MAX_DISPLAY_W / videoWidth)
  const displayW = Math.round(videoWidth * scale)
  const displayH = Math.round(videoHeight * scale)

  // Overlay position uses live settings.crop.y so slider adjustments are instant
  const activeY = crop?.y ?? cropRegion.y
  const overlayTop = Math.round(activeY * scale)
  const overlayHeight = Math.round(cropRegion.h * scale)

  const isEnabled = !!crop?.enabled
  const maxY = videoHeight - cropRegion.h

  function handleToggle(e) {
    onChange(e.target.checked
      ? { ...cropRegion, enabled: true }
      : { ...cropRegion, enabled: false }
    )
  }

  function handleYChange(e) {
    onChange({ ...crop, y: Number(e.target.value) })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Crop Detection
      </p>

      {/* Thumbnail with overlay */}
      <div
        className="rounded-lg overflow-hidden mx-auto"
        style={{ position: 'relative', width: displayW, height: displayH }}
      >
        <img
          src={thumbnailDataUrl}
          alt="Video frame preview"
          style={{ width: displayW, height: displayH, display: 'block' }}
        />
        {isEnabled && (
          <div
            style={{
              position: 'absolute',
              top: overlayTop,
              left: 0,
              width: displayW,
              height: overlayHeight,
              border: '2px solid #22d3ee',
              backgroundColor: 'rgba(34, 211, 238, 0.08)',
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Enable / disable toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={handleToggle}
          disabled={disabled}
          className="accent-blue-500 w-4 h-4 shrink-0"
        />
        <span className="text-sm text-slate-300">Crop to YouTube player (16:9)</span>
      </label>

      {/* Y-offset adjustment — only shown when crop is active */}
      {isEnabled && (
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-slate-400">Top edge</span>
            <span className="text-xs text-slate-200 tabular-nums">{activeY} px</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxY > 0 ? maxY : 0}
            step={2}
            value={activeY}
            onChange={handleYChange}
            disabled={disabled}
            className="w-full accent-blue-500"
          />
          <p className="text-xs text-slate-500 mt-1.5 tabular-nums">
            Output: {cropRegion.w}×{cropRegion.h} px
          </p>
        </div>
      )}
    </div>
  )
}
