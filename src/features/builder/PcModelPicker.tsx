import { RotateCw } from 'lucide-react'
import type { ComponentType } from '../../types/business'

const parts: { name: ComponentType; x: number; y: number; label: string }[] = [
  { name: 'Processor', x: 55, y: 34, label: 'CPU' },
  { name: 'Motherboard', x: 38, y: 53, label: 'Board' },
  { name: 'Memory', x: 66, y: 51, label: 'RAM' },
  { name: 'Graphics', x: 57, y: 70, label: 'GPU' },
  { name: 'Storage', x: 32, y: 74, label: 'Drive' },
  { name: 'Power supply', x: 35, y: 89, label: 'PSU' },
  { name: 'Cooling', x: 75, y: 31, label: 'Cooler' },
  { name: 'Case', x: 84, y: 76, label: 'Case' },
]

export function PcModelPicker({ selected, onSelect, angle, onRotate }: { selected: Partial<Record<ComponentType, string>>; onSelect: (part: ComponentType) => void; angle: number; onRotate: () => void }) {
  return <section className="pc-model-picker" aria-labelledby="pc-model-title">
    <div className="pc-model-heading"><div><span className="eyebrow">INTERACTIVE PART PICKER</span><h2 id="pc-model-title">Choose a component on the PC</h2><p>Select a highlighted part to open the shared stock directory.</p></div><button type="button" className="secondary-button" onClick={onRotate} aria-label="Rotate PC case view"><RotateCw size={17}/><span>Rotate view</span></button></div>
    <div className="pc-model-stage">
      <svg className="pc-model-svg" viewBox="0 0 540 330" role="img" aria-label="Interactive 3D style desktop case with selectable components">
        <defs><linearGradient id="pc-side" x1="0" x2="1"><stop stopColor="#dce9f7"/><stop offset="1" stopColor="#a9c2dc"/></linearGradient><linearGradient id="pc-front" x1="0" x2="1"><stop stopColor="#f7faff"/><stop offset="1" stopColor="#c9daeb"/></linearGradient></defs>
        <g className="pc-model-rotate" style={{ transform: `rotateY(${angle}deg)` }}>
          <path d="M184 43 344 17 431 63 431 285 344 310 184 267Z" fill="url(#pc-side)" stroke="#52708d" strokeWidth="3"/>
          <path d="M344 17 431 63 431 285 344 310Z" fill="url(#pc-front)" stroke="#52708d" strokeWidth="3"/>
          <path d="m198 64 134-21v212l-134-19Z" fill="#f7fbff" stroke="#99afc6" strokeWidth="2"/>
          <path d="m216 82 49-8v46l-49 8Z" fill="#d9e9f8" stroke="#7390ad" strokeWidth="2"/>
          <path d="m276 72 39-6v45l-39 6Z" fill="#bdd6ef" stroke="#7390ad" strokeWidth="2"/>
          <path d="m219 143 101-15v31l-101 15Z" fill="#2f79b9" stroke="#205b90" strokeWidth="2"/>
          <path d="m218 189 66-10v26l-66 10Z" fill="#77a7d3" stroke="#52708d" strokeWidth="2"/>
          <path d="m220 230 89-14v20l-89 14Z" fill="#c5d7e9" stroke="#7892ac" strokeWidth="2"/>
          <circle cx="377" cy="106" r="26" fill="#d5e3f0" stroke="#7892ac" strokeWidth="3"/><circle cx="377" cy="106" r="15" fill="none" stroke="#91a8be" strokeWidth="2"/>
          <circle cx="377" cy="170" r="26" fill="#d5e3f0" stroke="#7892ac" strokeWidth="3"/><circle cx="377" cy="170" r="15" fill="none" stroke="#91a8be" strokeWidth="2"/>
          <path d="M360 211h35v54h-35z" fill="#91abc4" stroke="#68839f" strokeWidth="2"/><circle cx="378" cy="239" r="13" fill="#dce8f3" stroke="#68839f" strokeWidth="2"/>
          <text x="382" y="291" textAnchor="middle" className="pc-model-brand">JBC BUILD STUDIO</text>
        </g>
      </svg>
      <div className="pc-model-hotspots" aria-label="Select a PC component">{parts.map(part => <button key={part.name} type="button" className={selected[part.name] ? 'is-selected' : ''} style={{ left: `${part.x}%`, top: `${part.y}%` }} onClick={() => onSelect(part.name)} aria-label={`Select ${part.name} from PC model`} title={`${part.name}${selected[part.name] ? ' selected' : ''}`}><span>{part.label}</span><i aria-hidden="true"/></button>)}</div>
      <p className="pc-model-caption">Interactive 3D-style view · Select a part label to browse matching models and specs.</p>
    </div>
  </section>
}
