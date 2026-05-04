import { useState } from 'react'

const RESOLUTIONS = [
  { value: 'original', label: 'Original' },
  { value: '1080p',    label: '1080p' },
  { value: '720p',     label: '720p' },
  { value: '480p',     label: '480p' },
  { value: '360p',     label: '360p' },
]

const FRAMERATES = [
  { value: 'original', label: 'Original' },
  { value: '60',       label: '60 fps' },
  { value: '30',       label: '30 fps' },
  { value: '24',       label: '24 fps' },
]

const AUDIO_BITRATES = ['64k', '96k', '128k', '192k']

function Select({ label, value, onChange, options, disabled }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg
                   px-2 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        ))}
      </select>
    </label>
  )
}

function Slider({ label, value, onChange, min, max, step, display }) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs text-slate-200 tabular-nums">{display ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
    </label>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2 first:mt-0">
      {children}
    </p>
  )
}

export default function SettingsPanel({ settings, onChange, disabled }) {
  const [open, setOpen] = useState(false)

  const set = (key) => (val) => onChange({ ...settings, [key]: val })

  const crfQuality = settings.crf <= 22 ? 'high quality' : settings.crf <= 30 ? 'medium quality' : 'low quality'

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800
                   hover:bg-slate-750 text-slate-200 text-sm font-medium transition-colors"
      >
        <span>Settings</span>
        <span className="text-slate-400 text-xs">{open ? '▲ Hide' : '▼ Customize'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 bg-slate-800/50">
          <SectionLabel>Video</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Resolution"
              value={settings.resolution}
              onChange={set('resolution')}
              options={RESOLUTIONS}
              disabled={disabled || settings.stripVideo}
            />
            <Select
              label="Framerate"
              value={settings.framerate}
              onChange={set('framerate')}
              options={FRAMERATES}
              disabled={disabled || settings.stripVideo}
            />
            <Select
              label="Codec"
              value={settings.videoCodec}
              onChange={set('videoCodec')}
              options={[
                { value: 'h264', label: 'H.264 (libx264)' },
                { value: 'h265', label: 'H.265 (libx265)' },
              ]}
              disabled={disabled || settings.stripVideo}
            />
            <label className="flex items-center gap-2 self-end pb-1.5">
              <input
                type="checkbox"
                checked={settings.stripVideo}
                onChange={(e) => set('stripVideo')(e.target.checked)}
                disabled={disabled}
                className="accent-blue-500 w-4 h-4"
              />
              <span className="text-sm text-slate-300">Strip video</span>
            </label>
          </div>
          <div className="mt-3">
            <Slider
              label="Quality (CRF)"
              value={settings.crf}
              onChange={set('crf')}
              min={18}
              max={51}
              step={1}
              display={`${settings.crf} — ${crfQuality}`}
            />
            <div className="flex justify-between text-xs text-slate-600 mt-0.5">
              <span>Better quality</span>
              <span>Smaller file</span>
            </div>
          </div>

          <SectionLabel>Audio</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Codec"
              value={settings.audioCodec}
              onChange={set('audioCodec')}
              options={[
                { value: 'aac',   label: 'AAC' },
                { value: 'opus',  label: 'Opus' },
                { value: 'strip', label: 'Strip audio' },
              ]}
              disabled={disabled}
            />
            <Select
              label="Bitrate"
              value={settings.audioBitrate}
              onChange={set('audioBitrate')}
              options={AUDIO_BITRATES.map((b) => ({ value: b, label: b }))}
              disabled={disabled || settings.audioCodec === 'strip'}
            />
          </div>
          <div className="mt-3">
            <Slider
              label="Volume"
              value={settings.volume}
              onChange={set('volume')}
              min={0}
              max={200}
              step={5}
              display={`${settings.volume}%`}
            />
          </div>

          <SectionLabel>Sync Correction</SectionLabel>
          <div>
            <Slider
              label="Audio delay"
              value={settings.audioDelay}
              onChange={set('audioDelay')}
              min={-2000}
              max={2000}
              step={50}
              display={
                settings.audioDelay === 0
                  ? '0 ms (no correction)'
                  : `${settings.audioDelay > 0 ? '+' : ''}${settings.audioDelay} ms`
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              Positive = delay audio (audio plays too early). Negative = advance audio (audio plays too late).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
