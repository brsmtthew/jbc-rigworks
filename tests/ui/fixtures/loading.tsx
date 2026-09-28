import { createRoot } from 'react-dom/client'
import { LoadingState } from '../../../src/components/ui/LoadingState'
import '../../../src/styles/loading.css'

const value = new URLSearchParams(location.search).get('variant')
const variant = value === 'screen' || value === 'table' || value === 'compact' ? value : 'cards'
createRoot(document.getElementById('root')!).render(
  <LoadingState variant={variant} label="Loading your activity…" />,
)
