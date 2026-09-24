import { useState } from 'react'
import { Package, ShieldCheck } from 'lucide-react'
import { Dialog } from '../../components/ui/Dialog'
import { formatPHP } from '../../data/appData'
import { components, componentOf, componentTier } from '../../lib/pc'
import { useShopSettings } from '../../lib/preferences'
import type { InventoryItem } from '../../types/business'
export function ProductDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
 const [imageFailed, setImageFailed] = useState(false)
 const [shop] = useShopSettings()
 const Icon = components.find(part => part.name === componentOf(item))?.icon || Package
 return <Dialog title={item.brand ? `${item.brand} ${item.model || item.name}` : item.model || item.name} wide onClose={onClose}><div className="product-detail-layout"><div className="product-photo">{item.image && !imageFailed ? <img src={item.image} alt={item.name} onError={() => setImageFailed(true)}/>: <><Icon size={90}/><span>Photo not provided</span></>}</div><div><span className="eyebrow">{item.category}</span><h3>{formatPHP(item.price)}</h3><dl className="detail-list">{[['Brand',item.brand || 'Not specified'],['Model',item.model || item.name],['SKU',item.sku],['Availability',item.stock + ' in stock'],['Component',componentOf(item) || 'Accessory'],['Tier',componentTier(item) ? `${componentTier(item)} component rating` : 'Not classified'],['Socket',item.socket || 'Not specified'],['Memory',item.memoryType || 'Not specified']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><h3>Specifications</h3><p className="product-specs">{item.specs || 'Specifications have not been added yet.'}</p><h3><ShieldCheck size={18}/> Warranty</h3><p>{(item.warrantyMonths || shop.warrantyMonths) === '' ? 'Duration to be confirmed' : (item.warrantyMonths || shop.warrantyMonths) + ' months'}. {item.warrantyTerms || shop.warrantyTerms || 'Terms to be confirmed by the workshop.'}</p></div></div></Dialog>
}
