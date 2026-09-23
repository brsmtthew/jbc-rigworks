'use client';
import {useState,type ReactNode} from 'react';
import {Plus,Trash2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {money,today,newId,unitCost,services,categories,expenseCategories,methods,jobStatuses,type Workspace,type Item,type Sale,type Job} from '@/lib/business';

export type Modal={type:'sale'|'item'|'stock'|'loss'|'expense'|'job'|'payment'|'detail';item?:Item;sale?:Sale;job?:Job};
export type Save=(payload:Record<string,unknown>,requestId:string)=>Promise<void>;
export function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Choice({options,label,...props}:{options:(string|{value:string;label:string})[];label:string;name?:string;defaultValue?:string;value?:string;onValueChange?:(v:string)=>void;disabled?:boolean}){
 return <Select {...props}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={typeof o==='string'?o:o.value} value={typeof o==='string'?o:o.value}>{typeof o==='string'?o:o.label}</SelectItem>)}</SelectContent></Select>;
}
const numeric=(f:FormData,k:string)=>Math.round(Number(f.get(k)||0)*100);
const val=(f:FormData,k:string)=>String(f.get(k)||'');

export function RecordForm({modal,w,save,close,demo,exitDemo}:{modal:Modal;w:Workspace;save:Save;close:()=>void;demo:boolean;exitDemo:()=>void}){
 const [requestId]=useState(()=>newId()),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [payMode,setPayMode]=useState('Paid in full');
 const [lines,setLines]=useState([{key:newId(),kind:'service',itemId:'',description:modal.job?.service||services[0],quantity:'1',price:modal.job?String(modal.job.quote/100):'',cost:'0'}]);
 const patchLine=(key:string,change:object)=>setLines(ls=>ls.map(l=>l.key===key?{...l,...change}:l));
 const total=lines.reduce((s,l)=>s+Math.round(Number(l.price)*100)*Number(l.quantity),0);
 const directCost=lines.reduce((sum,line)=>{
  if(line.kind==='service')return sum+Math.round(Number(line.cost)*100);
  const stockItem=w.items.find(i=>i.id===line.itemId),quantity=Number(line.quantity);
  return sum+(stockItem?.stock?Math.round(stockItem.value/stockItem.stock*quantity):0);
 },0);
 const item=modal.item,job=modal.job,sale=modal.sale,t=modal.type;
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||demo)return;setBusy(true);setError('');
  const f=new FormData(event.currentTarget);let p:Record<string,unknown>={};
  try{
   if(t==='sale')p={action:'sale.create',date:val(f,'date'),customer:val(f,'customer'),notes:val(f,'notes'),jobId:job?.id||null,method:val(f,'method')||'Cash',paid:payMode==='Paid in full'?total:payMode==='Unpaid'?0:numeric(f,'paid'),lines:lines.map(l=>({kind:l.kind,...(l.kind==='product'?{itemId:l.itemId}:{}),description:l.description,quantity:Number(l.quantity),price:Math.round(Number(l.price)*100),cost:Math.round(Number(l.cost)*100)}))};
   if(t==='item')p={action:item?'item.update':'item.create',id:item?.id,version:item?.version,name:val(f,'name'),sku:val(f,'sku'),category:val(f,'category'),price:numeric(f,'price'),minimum:Number(f.get('minimum')),stock:Number(f.get('stock')),cost:numeric(f,'cost'),date:val(f,'date'),stockType:val(f,'stockType')};
   if(t==='stock'||t==='loss')p={action:t==='stock'?'stock.add':'stock.loss',id:item?.id,date:val(f,'date'),quantity:Number(f.get('quantity')),cost:numeric(f,'cost'),note:val(f,'notes')};
   if(t==='expense')p={action:'expense.create',date:val(f,'date'),description:val(f,'description'),category:val(f,'category'),amount:numeric(f,'amount'),method:val(f,'method')};
   if(t==='payment')p={action:'payment.create',id:sale?.id,date:val(f,'date'),amount:numeric(f,'amount'),method:val(f,'method')};
   if(t==='job')p={action:job?'job.update':'job.create',id:job?.id,version:job?.version,customer:val(f,'customer'),contact:val(f,'contact'),device:val(f,'device'),service:val(f,'service'),notes:val(f,'notes'),date:val(f,'date'),due:val(f,'due'),quote:numeric(f,'quote'),status:val(f,'status')};
   await save(p,requestId);close();
  }catch(e){setError(e instanceof Error?e.message:'Could not save. Try again.');}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="entry-form">
  {demo&&<div className="form-note">This is a sample workspace. Open your real workspace to save an entry.</div>}
  {(t==='sale'||t==='job')&&<div className="form-grid"><Field label="Customer"><Input name="customer" placeholder="Customer name or Walk-in" defaultValue={job?.customer||''} required maxLength={180}/></Field><Field label={t==='job'?'Received date':'Sale date'}><Input name="date" type="date" defaultValue={job?.date||today()} max={today()} required/></Field></div>}
  {t==='sale'&&<>
   <div className="line-heading"><h3>Sale items</h3><span>Prices in PHP</span></div>
   {lines.map((l,n)=><div className="sale-line" key={l.key}>
    <div className="line-top"><span>Item {n+1}</span><Button type="button" variant="ghost" size="icon" aria-label={'Remove item '+(n+1)} disabled={lines.length===1} onClick={()=>setLines(ls=>ls.filter(x=>x.key!==l.key))}><Trash2 size={15}/></Button></div>
    <div className="form-grid"><Field label="Type"><Choice label={'Item '+(n+1)+' type'} value={l.kind} options={[{value:'service',label:'Service'},{value:'product',label:'Product'}]} onValueChange={v=>patchLine(l.key,{kind:v,itemId:'',description:v==='service'?services[0]:'',price:'',cost:'0'})}/></Field>
    <Field label={l.kind==='product'?'Inventory item':'Service'}>{l.kind==='product'?<Choice label="Choose a product" value={l.itemId} options={w.items.map(i=>({value:i.id,label:i.name+' · '+i.stock+' in stock'}))} onValueChange={v=>{const i=w.items.find(x=>x.id===v)!;patchLine(l.key,{itemId:v,description:i.name,price:String(i.price/100)});}}/>:<Input aria-label={'Service '+(n+1)} list="service-suggestions" value={l.description} onChange={e=>patchLine(l.key,{description:e.target.value})} required maxLength={180}/>}</Field></div>
    <div className="form-grid three"><Field label="Quantity"><Input aria-label={'Quantity '+(n+1)} type="number" min="1" max="100000" step="1" value={l.quantity} onChange={e=>patchLine(l.key,{quantity:e.target.value})} required/></Field><Field label="Unit price (₱)"><Input aria-label={'Unit price '+(n+1)} type="number" min="0" step="0.01" value={l.price} onChange={e=>patchLine(l.key,{price:e.target.value})} required/></Field><Field label={l.kind==='service'?'Total direct costs (₱)':'Cost of stock'}>{l.kind==='service'?<Input aria-label={'Direct costs '+(n+1)} type="number" min="0" step="0.01" value={l.cost} onChange={e=>patchLine(l.key,{cost:e.target.value})} required/>:<div className="read-field">Automatic</div>}</Field></div>
   </div>)}
   <datalist id="service-suggestions">{services.map(s=><option key={s} value={s}/>)}</datalist>
   <Button type="button" variant="outline" onClick={()=>setLines(ls=>[...ls,{key:newId(),kind:'service',itemId:'',description:'',quantity:'1',price:'',cost:'0'}])} disabled={lines.length>=30}><Plus size={16}/> Add item</Button>
   <p className="field-help">Direct costs are cash costs for this service, such as subcontracted labor. Do not enter them again as an expense. Add used inventory as a product line with a ₱0 price if it is included in your service fee.</p>
   <div className="form-total"><div><span>Total sale</span><strong>{money(total||0)}</strong></div><div><span>Gross profit before expenses</span><b>{money((total-directCost)||0)}</b></div></div>
   <div className="form-grid"><Field label="Payment"><Choice label="Payment status" options={['Paid in full','Partial payment','Unpaid']} value={payMode} onValueChange={setPayMode}/></Field>{payMode!=='Unpaid'&&<Field label="Payment method"><Choice name="method" label="Payment method" defaultValue="Cash" options={methods}/></Field>}</div>
   {payMode==='Partial payment'&&<Field label="Amount received (₱)"><Input name="paid" type="number" min="0.01" max={total/100} step="0.01" required/></Field>}
   <Field label="Notes (optional)"><Textarea name="notes" placeholder="Reference, service details, or payment notes" maxLength={2000}/></Field>
  </>}
  {t==='item'&&<>
   <Field label="Item name"><Input name="name" defaultValue={item?.name} required maxLength={180} placeholder="e.g. 8GB DDR4 RAM"/></Field>
   <div className="form-grid"><Field label="SKU"><Input name="sku" defaultValue={item?.sku} required maxLength={180} placeholder="e.g. RAM-001"/></Field><Field label="Category"><Choice name="category" label="Item category" defaultValue={item?.category||'Components'} options={categories}/></Field></div>
   <div className="form-grid"><Field label="Selling price (₱)"><Input name="price" type="number" min="0" step="0.01" defaultValue={item?item.price/100:''} required/></Field><Field label="Low-stock level"><Input name="minimum" type="number" min="0" max="100000" step="1" defaultValue={item?.minimum??3} required/></Field></div>
   {!item&&<><div className="form-grid"><Field label="Starting quantity"><Input name="stock" type="number" min="0" max="100000" step="1" defaultValue="0" required/></Field><Field label="Unit cost (₱)"><Input name="cost" type="number" min="0" step="0.01" defaultValue="0" required/></Field></div><Field label="Starting stock"><Choice name="stockType" label="Starting stock type" defaultValue="opening" options={[{value:'opening',label:'Already owned · opening stock'},{value:'purchase',label:'New purchase · cash paid'}]}/></Field><Field label="Stock date"><Input name="date" type="date" defaultValue={today()} max={today()} required/></Field><p className="field-help">Opening stock does not count as a new cash payment. New purchases appear in cash flow. Stock costs enter profit when items are sold or written off.</p></>}
  </>}
  {(t==='stock'||t==='loss')&&<>
   <div className="form-note"><b>{item?.name}</b><br/>{item?.stock} currently in stock · {money(unitCost(item!))} average unit cost</div>
   <div className="form-grid"><Field label={t==='stock'?'Quantity received':'Quantity to write off'}><Input name="quantity" type="number" min="1" step="1" max={t==='loss'?item?.stock:100000} required/></Field><Field label="Date"><Input name="date" type="date" max={today()} defaultValue={today()} required/></Field></div>
   {t==='stock'&&<Field label="Unit purchase cost (₱)"><Input name="cost" type="number" min="0" step="0.01" defaultValue={unitCost(item!)/100} required/></Field>}
   <Field label={t==='stock'?'Supplier / notes (optional)':'Reason'}><Textarea name="notes" required={t==='loss'} maxLength={2000}/></Field>
   <p className="field-help">{t==='stock'?'Records a paid stock purchase and updates the weighted average cost. Do not record the purchase again under Expenses.':'Removes stock and records its cost as a non-cash expense. This cannot be undone in this version.'}</p>
  </>}
  {t==='expense'&&<>
   <Field label="Description"><Input name="description" placeholder="e.g. Cleaning supplies" required maxLength={180}/></Field>
   <div className="form-grid"><Field label="Category"><Choice name="category" label="Expense category" options={expenseCategories} defaultValue="Supplies"/></Field><Field label="Date paid"><Input name="date" type="date" defaultValue={today()} max={today()} required/></Field></div>
   <div className="form-grid"><Field label="Amount (₱)"><Input name="amount" type="number" min="0.01" step="0.01" required/></Field><Field label="Payment method"><Choice name="method" label="Payment method" options={methods} defaultValue="Cash"/></Field></div>
   <p className="field-help">Record paid operating expenses here. Use Inventory for stock purchases and the sale form for direct service costs to avoid counting costs twice.</p>
  </>}
  {t==='payment'&&<>
   <div className="form-note">{sale?.code} · {sale?.customer}<br/><strong>{money(sale!.total-sale!.paid)} remaining</strong></div>
   <Field label="Amount received (₱)"><Input name="amount" type="number" min="0.01" max={(sale!.total-sale!.paid)/100} step="0.01" defaultValue={(sale!.total-sale!.paid)/100} required/></Field>
   <div className="form-grid"><Field label="Payment date"><Input name="date" type="date" min={sale?.date} max={today()} defaultValue={today()} required/></Field><Field label="Payment method"><Choice name="method" label="Payment method" options={methods} defaultValue="Cash"/></Field></div>
  </>}
  {t==='job'&&<>
   <div className="form-grid"><Field label="Contact (optional)"><Input name="contact" defaultValue={job?.contact} placeholder="Phone or email" maxLength={80}/></Field><Field label="Device"><Input name="device" defaultValue={job?.device} placeholder="Model / description" required maxLength={180}/></Field></div>
   <Field label="Service"><Choice name="service" label="Service" options={services} defaultValue={job?.service||services[0]}/></Field>
   <div className="form-grid"><Field label="Target date"><Input name="due" type="date" defaultValue={job?.due||today()} required/></Field><Field label="Quoted price (₱)"><Input name="quote" type="number" min="0" step="0.01" defaultValue={job?job.quote/100:''} required/></Field></div>
   <Field label="Job status"><Choice name="status" label="Job status" options={jobStatuses} defaultValue={job?.status||'Queued'}/></Field>
   <Field label="Work notes (optional)"><Textarea name="notes" defaultValue={job?.notes} placeholder="Reported issue, agreed work, and updates" maxLength={2000}/></Field>
   <p className="field-help">A quote does not count as revenue. Use Create sale when the work is ready to bill.</p>
  </>}
  {error&&<div role="alert" className="form-error">{error}</div>}
  <div className="form-actions"><Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button>{demo?<Button type="button" onClick={exitDemo}>Open real workspace</Button>:<Button type="submit" disabled={busy}>{busy?'Saving…':t==='sale'?'Save sale':t==='payment'?'Record payment':t==='stock'?'Add stock':t==='loss'?'Confirm write-off':'Save '+(t==='job'?'job':t==='item'?'item':'expense')}</Button>}</div>
 </form>;
}
