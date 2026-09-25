import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { Minus, Plus, RotateCcw, RotateCw } from 'lucide-react'
import { componentOf, components, isPcPart } from '../../lib/pc'
import type { ComponentType, InventoryItem } from '../../types/business'

const parts: { name: ComponentType; x: number; y: number; label: string }[] = [
  { name: 'Processor', x: 40, y: 38, label: 'CPU' },
  { name: 'Motherboard', x: 26, y: 53, label: 'Board' },
  { name: 'Memory', x: 60, y: 43, label: 'RAM' },
  { name: 'Graphics', x: 46, y: 66, label: 'GPU' },
  { name: 'Storage', x: 31, y: 73, label: 'Drive' },
  { name: 'Power supply', x: 35, y: 84, label: 'PSU' },
  { name: 'Cooling', x: 75, y: 34, label: 'Cooling' },
  { name: 'Case', x: 83, y: 73, label: 'Case' },
]
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
type Selection = Partial<Record<ComponentType, string>>
type Drag = { pointerId: number; x: number; y: number; yaw: number; pitch: number }

export function PcModelPicker({ selected, inventory, onSelect }: { selected: Selection; inventory: InventoryItem[]; onSelect: (part: ComponentType) => void }) {
  const [yaw, setYaw] = useState(-19)
  const [pitch, setPitch] = useState(7)
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<Drag | null>(null)

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }
  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    const start = drag.current
    if (!start || start.pointerId !== event.pointerId) return
    setYaw(start.yaw + (event.clientX - start.x) * .62)
    setPitch(clamp(start.pitch - (event.clientY - start.y) * .42, -20, 23))
  }
  function stopDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function zoomBy(amount: number) { setZoom(value => clamp(Math.round((value + amount) * 100) / 100, .72, 1.45)) }

  const stockByPart = new Map(components.map(part => {
    const items = inventory.filter(item => isPcPart(item) && componentOf(item) === part.name && item.stock > 0)
    const chosen = inventory.find(item => item.id === selected[part.name] && isPcPart(item))
    const units = items.reduce((sum, item) => sum + item.stock, 0)
    return [part.name, { items, chosen, units }] as const
  }))
  const modelTransform = `perspective(1100px) rotateX(${pitch}deg) rotateY(${yaw}deg) scale(${zoom})`

  return <section className="pc-model-picker" aria-labelledby="pc-model-title">
    <div className="pc-model-heading">
      <div><span className="eyebrow">INTERACTIVE PART PICKER</span><h2 id="pc-model-title">Choose a component on the PC</h2><p>Drag to rotate · scroll to zoom · select a part to browse matching stock.</p></div>
      <div className="pc-view-controls" role="group" aria-label="3D model controls">
        <button type="button" className="icon-button" onClick={() => setYaw(value => value - 24)} aria-label="Rotate view left" title="Rotate left"><RotateCcw size={17}/></button>
        <button type="button" className="icon-button" onClick={() => setYaw(value => value + 24)} aria-label="Rotate view right" title="Rotate right"><RotateCw size={17}/></button>
        <span className="pc-control-divider" aria-hidden="true"/>
        <button type="button" className="icon-button" onClick={() => zoomBy(-.12)} disabled={zoom <= .72} aria-label="Zoom out" title="Zoom out"><Minus size={17}/></button>
        <span className="pc-zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" className="icon-button" onClick={() => zoomBy(.12)} disabled={zoom >= 1.45} aria-label="Zoom in" title="Zoom in"><Plus size={17}/></button>
        <button type="button" className="icon-button pc-reset-view" onClick={() => { setYaw(-19); setPitch(7); setZoom(1) }} aria-label="Reset 3D view" title="Reset view"><RotateCcw size={16}/></button>
      </div>
    </div>

    <div className="pc-model-stage">
      <div className="pc-model-viewport" aria-label="Rotatable desktop PC model. Drag to orbit; use the mouse wheel or zoom controls to change scale." onWheel={event => { event.preventDefault(); zoomBy(event.deltaY > 0 ? -.08 : .08) }}>
        <div className="pc-scene-mark pc-scene-mark-top"><span>JBC / BUILD STUDIO</span><span>CASE VIEW · 01</span></div>
        <svg className={`pc-model-svg${dragging ? ' is-dragging' : ''}`} viewBox="0 0 640 410" role="img" aria-label="Open glass desktop case with motherboard, processor, memory, graphics card, storage, power supply, cooling fans, and case details" style={{ transform: modelTransform }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
          <defs>
            <linearGradient id="pc-shell" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#526d89"/><stop offset=".5" stopColor="#253c57"/><stop offset="1" stopColor="#112740"/></linearGradient>
            <linearGradient id="pc-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c7e8ff" stopOpacity=".3"/><stop offset=".5" stopColor="#7ec4f1" stopOpacity=".1"/><stop offset="1" stopColor="#dceeff" stopOpacity=".22"/></linearGradient>
            <linearGradient id="pc-metal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e0e9f2"/><stop offset="1" stopColor="#9eb1c4"/></linearGradient>
            <linearGradient id="pc-board" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#17505b"/><stop offset="1" stopColor="#0e293b"/></linearGradient>
            <linearGradient id="pc-gpu" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#367dce"/><stop offset=".55" stopColor="#1655a0"/><stop offset="1" stopColor="#0e3265"/></linearGradient>
            <radialGradient id="pc-fan"><stop stopColor="#79a9c9" stopOpacity=".9"/><stop offset=".2" stopColor="#173751"/><stop offset=".8" stopColor="#111f34"/><stop offset="1" stopColor="#819ab0"/></radialGradient>
            <filter id="pc-shadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="17" stdDeviation="14" floodColor="#07172a" floodOpacity=".35"/></filter>
          </defs>
          <ellipse cx="329" cy="366" rx="205" ry="23" fill="#061b31" opacity=".32"/>
          <g filter="url(#pc-shadow)">
            <path d="m177 78 248-41 91 47v270l-98 35-241-68z" fill="url(#pc-shell)" stroke="#859bb0" strokeWidth="3"/>
            <path d="m425 37 91 47v270l-98 35V83z" fill="#344b64" stroke="#92a9bd" strokeWidth="3"/>
            <path d="m425 37 91 47-248 44-91-50z" fill="#a8bbcd" stroke="#8197ad" strokeWidth="3"/>
            <path d="m177 78 248-41v271l-248-54z" fill="#0c1c30" stroke="#7189a2" strokeWidth="3"/>
            <g className={`pc-svg-part${selected.Case ? ' is-picked' : ''}`}>
              <path d="m188 87 228-38v252l-228-49z" fill="url(#pc-glass)" stroke="#b5d4ed" strokeWidth="2"/>
              <path d="m198 94 12 4v194l-12-3z" fill="#d4e5f3" opacity=".5"/>
              <path d="m398 61 11-2v240l-11-2z" fill="#e7f4ff" opacity=".34"/>
              <path d="m177 78 248-41 91 47v270l-98 35-241-68z" fill="none" stroke="#96aec4" strokeWidth="4"/>
            </g>
            <g className={`pc-svg-part${selected.Motherboard ? ' is-picked' : ''}`}>
              <path d="m217 111 174-29v199l-174-28z" fill="url(#pc-board)" stroke="#478092" strokeWidth="2"/>
              <path d="m226 119 153-25M226 127v134M230 267l143 22" fill="none" stroke="#4d8990" strokeWidth="1.5" opacity=".75"/>
              <path d="m226 150 26-4v24l-26 4zm117 72 32-5v15l-32 5zm-100 27 30-5v8l-30 5z" fill="#88b2a5" opacity=".5"/>
              <g fill="#70abb2" opacity=".7"><circle cx="238" cy="139" r="2"/><circle cx="248" cy="137" r="2"/><circle cx="360" cy="107" r="2"/><circle cx="364" cy="116" r="2"/><circle cx="234" cy="245" r="2"/><circle cx="366" cy="264" r="2"/></g>
            </g>
            <g className={`pc-svg-part${selected.Processor ? ' is-picked' : ''}`}>
              <path d="m263 136 47-8 1 45-47 8z" fill="#142c43" stroke="#78a8c1" strokeWidth="2"/>
              <path d="m269 140 35-6v34l-35 6z" fill="url(#pc-metal)" stroke="#e4f2fb" strokeWidth="1.5"/>
              <path d="m275 145 23-4v23l-23 4z" fill="#347bc0" stroke="#8ec7f1" strokeWidth="1"/>
              <text x="285" y="160" textAnchor="middle" fill="#eff8ff" fontSize="6" fontWeight="700" letterSpacing="1">JBC</text>
            </g>
            <g className={`pc-svg-part${selected.Memory ? ' is-picked' : ''}`}>
              <path d="m328 106 12-2v92l-12 2z" fill="#101b2b" stroke="#7ab4ca" strokeWidth="2"/>
              <path d="m345 103 12-2v92l-12 2z" fill="#101b2b" stroke="#7ab4ca" strokeWidth="2"/>
              <path d="m332 110 5-.8v83l-5 .8zm17-3 5-.8v83l-5 .8z" fill="#42c3b6"/>
              <path d="m328 106 12-2m5-1 12-2" stroke="#d0fbf5" strokeWidth="2"/>
            </g>
            <g className={`pc-svg-part${selected.Storage ? ' is-picked' : ''}`}>
              <path d="m238 190 55-9 1 12-55 9z" fill="#132a40" stroke="#6f9bb0" strokeWidth="1.5"/>
              <circle cx="244" cy="194" r="2" fill="#53d6b2"/><path d="m253 191 31-5" stroke="#90b4ca" strokeWidth="2"/>
            </g>
            <g className={`pc-svg-part${selected.Graphics ? ' is-picked' : ''}`}>
              <path d="m228 218 156-26 1 47-156 27z" fill="url(#pc-gpu)" stroke="#9ac7ec" strokeWidth="2"/>
              <path d="m239 226 125-21v29l-125 22z" fill="#102744" stroke="#6da5d3" strokeWidth="1.5"/>
              <circle cx="274" cy="239" r="14" fill="url(#pc-fan)" stroke="#86b8dd" strokeWidth="2"/><circle cx="274" cy="239" r="4" fill="#94bedb"/>
              <circle cx="325" cy="230" r="14" fill="url(#pc-fan)" stroke="#86b8dd" strokeWidth="2"/><circle cx="325" cy="230" r="4" fill="#94bedb"/>
              <path d="m238 267 16-3m115-20 13-2" stroke="#e7f5ff" strokeWidth="3"/>
            </g>
            <g className={`pc-svg-part${selected['Power supply'] ? ' is-picked' : ''}`}>
              <path d="m218 284 173 30v28l-173-40z" fill="#15263b" stroke="#91a8bd" strokeWidth="2"/>
              <circle cx="250" cy="312" r="12" fill="#203d58" stroke="#728da5" strokeWidth="2"/><circle cx="250" cy="312" r="5" fill="#8da6bd"/>
              <path d="m274 303 92 16" stroke="#5c7185" strokeWidth="2"/>
              <text x="323" y="331" textAnchor="middle" fill="#a8bacb" fontSize="7" fontWeight="700" letterSpacing="1.2">POWER</text>
            </g>
            <g className={`pc-svg-part${selected.Cooling ? ' is-picked' : ''}`}>
              <path d="m436 111 57 12v35l-57-11z" fill="#1a2d43" stroke="#91a6bb" strokeWidth="2"/>
              <circle cx="465" cy="139" r="21" fill="url(#pc-fan)" stroke="#a6c1d7" strokeWidth="2"/><circle cx="465" cy="139" r="5" fill="#b4d7e9"/>
              <path d="m436 178 57 12v35l-57-11z" fill="#1a2d43" stroke="#91a6bb" strokeWidth="2"/>
              <circle cx="465" cy="206" r="21" fill="url(#pc-fan)" stroke="#a6c1d7" strokeWidth="2"/><circle cx="465" cy="206" r="5" fill="#b4d7e9"/>
              <path d="m465 118v42m0 25v42" stroke="#57cfbf" strokeWidth="1.5" opacity=".7"/>
            </g>
            <path d="m444 278 48 10v32l-48-10z" fill="#1b3149" stroke="#94aabe" strokeWidth="2"/>
            <circle cx="469" cy="300" r="7" fill="#70aee0" stroke="#c5deef" strokeWidth="2"/>
            <circle cx="489" cy="305" r="3" fill="#35c6ad"/>
            <path d="m426 37v308" stroke="#d9e5ef" strokeWidth="3" opacity=".65"/>
            <path d="m174 327 244 66 102-36" fill="none" stroke="#b0c2d2" strokeWidth="6" strokeLinecap="round"/>
            <path d="M211 337v15m209-17v14m63-18v12" stroke="#344a61" strokeWidth="7" strokeLinecap="round"/>
          </g>
          <g className="pc-model-logo"><text x="456" y="358" textAnchor="middle">JBC RIGWORKS</text></g>
        </svg>

        <div className="pc-model-hotspots" aria-label="Select a PC component">{parts.map(part => {
          const stock = stockByPart.get(part.name)!
          const chosenName = selected[part.name] === '__custom' ? 'Custom / owned part' : stock.chosen ? [stock.chosen.brand, stock.chosen.model || stock.chosen.name].filter(Boolean).join(' / ') : ''
          return <button key={part.name} type="button" className={`${selected[part.name] ? 'is-selected' : ''}${stock.items.length ? ' has-stock' : ' no-stock'}`} style={{ left: `${part.x}%`, top: `${part.y}%` }} onClick={() => onSelect(part.name)} aria-label={`Select ${part.name}. ${stock.units} units across ${stock.items.length} in-stock models${chosenName ? `. Selected: ${chosenName}` : ''}`} title={`${part.name} · ${stock.units} units available${chosenName ? ` · ${chosenName}` : ''}`}><span>{part.label}</span><i aria-hidden="true"/><small>{stock.units} in stock</small></button>
        })}</div>
        <div className="pc-scene-mark pc-scene-mark-bottom"><span>ORBIT: DRAG ANYWHERE ON THE CASE</span><span>ZOOM: WHEEL / CONTROLS</span></div>
      </div>

      <div className="pc-stock-key" aria-label="Part stock overview">{components.map(part => {
        const stock = stockByPart.get(part.name)!
        const custom = selected[part.name] === '__custom'
        const selectedName = custom ? 'Custom / owned part' : stock.chosen ? [stock.chosen.brand, stock.chosen.model || stock.chosen.name].filter(Boolean).join(' / ') : 'No part selected'
        return <button type="button" key={part.name} className={`pc-stock-key-item${selected[part.name] ? ' is-selected' : ''}`} onClick={() => onSelect(part.name)} aria-label={`Check ${part.name}. ${stock.units} units available. ${selectedName}`}>
          <span className="pc-stock-key-icon"><part.icon size={16}/></span><span className="pc-stock-key-copy"><strong>{part.name}</strong><small title={selectedName}>{selectedName}</small></span>
          <span className={`pc-stock-count${stock.units ? ' in-stock' : ''}`}>{stock.units}<small>units</small></span>
        </button>
      })}</div>
      <p className="pc-model-caption">Stock totals update from the shared inventory. Choose any component to see its available models, prices, and quantities.</p>
    </div>
  </section>
}
