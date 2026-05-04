import { PRESETS } from '../utils/ffmpegArgs'

const PRESET_META = [
  { key: 'iMessageSmall', label: 'iMessage Small', desc: '480p · CRF 32 · AAC 64k' },
  { key: 'iMessageHD',    label: 'iMessage HD',    desc: '720p · CRF 26 · AAC 96k' },
  { key: 'keepQuality',   label: 'Keep Quality',   desc: 'Original · CRF 20 · AAC 128k' },
]

export default function PresetButtons({ onApply, disabled }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Presets</p>
      <div className="flex flex-wrap gap-2">
        {PRESET_META.map(({ key, label, desc }) => (
          <button
            key={key}
            onClick={() => onApply(PRESETS[key])}
            disabled={disabled}
            title={desc}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-500
                       text-slate-200 text-xs rounded-lg border border-slate-600
                       hover:border-slate-500 transition-colors disabled:opacity-40
                       disabled:cursor-not-allowed"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
