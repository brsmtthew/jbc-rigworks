import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, ShoppingCart } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Panel } from '../../components/ui/Panel'
import { DataTable } from '../../components/ui/DataTable'
import { useWorkspace } from '../../lib/workspaceStorage'
import { formatPHP } from '../../data/appData'
import { InvoiceDialog } from '../sales/InvoiceDialog'
import type { Sale } from '../../types/business'

export function CustomerOrdersPage({ embedded = false }: { embedded?: boolean }) {
  const { sales } = useWorkspace()
  const [invoice, setInvoice] = useState<Sale | null>(null)
  return <>{!embedded && <PageHeader eyebrow="MY ACCOUNT" title="My orders" description="Review your local orders and print an itemized invoice."><Link className="primary-button" to="/customer/shop"><ShoppingCart size={16} />Shop & order</Link></PageHeader>}<Panel title="Order history"><DataTable rows={sales} label="My orders" columns={[
    { label: 'Order', sortValue: sale => sale.id, render: sale => <><strong>{sale.id}</strong><small>{sale.detail}</small></> }, { label: 'Date', sortValue: sale => sale.date, render: sale => sale.date }, { label: 'Order progress', sortValue: sale => sale.orderStatus || 'Requested', render: sale => sale.orderStatus || 'Requested' }, { label: 'Payment', sortValue: sale => sale.status, render: sale => sale.status }, { label: 'Total', sortValue: sale => sale.total, render: sale => formatPHP(sale.total), numeric: true }, { label: 'Invoice', render: sale => <button className="icon-button" aria-label={`Invoice ${sale.id}`} onClick={() => setInvoice(sale)}><Printer size={18} /></button> },
  ]} /></Panel>{invoice && <InvoiceDialog sale={invoice} onClose={() => setInvoice(null)} />}</>
}
