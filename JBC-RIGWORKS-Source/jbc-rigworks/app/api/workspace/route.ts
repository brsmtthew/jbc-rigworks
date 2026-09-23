import { getRawDb } from '@/db';
import { z } from 'zod';
import { categories, expenseCategories, methods, jobStatuses, today, type Item, type Sale, type Job, type Line } from '@/lib/business';

export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const text=z.string().trim().min(1).max(180);
const notes=z.string().trim().max(2000).default('');
const cents=z.number().int().min(0).max(1_000_000_000);
const qty=z.number().int().min(0).max(100000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Choose a valid date.');
const pastDate=date.refine(v=>v<=today(),'Use today or an earlier date.');
const uuid=z.string().uuid();
const method=z.enum(methods as [string,...string[]]);
function fail(message:string):never{throw new Error('USER:'+message);}

export async function GET(){
 try {
  const db=getRawDb();
  const [items,jobs,sales,lines,payments,expenses,movements]=await db.batch<Record<string,unknown>>([
   db.prepare('SELECT * FROM items ORDER BY name'),db.prepare('SELECT * FROM jobs ORDER BY date DESC,rowid DESC'),
   db.prepare('SELECT * FROM sales ORDER BY date DESC,rowid DESC'),db.prepare('SELECT * FROM sale_lines'),
   db.prepare('SELECT * FROM payments ORDER BY date DESC'),db.prepare('SELECT * FROM expenses ORDER BY date DESC,rowid DESC'),
   db.prepare('SELECT * FROM stock_moves ORDER BY date DESC,rowid DESC')]);
  const bySale=new Map<string,unknown[]>();
  for(const l of lines.results){const key=String(l.sale_id);bySale.set(key,[...(bySale.get(key)||[]),l]);}
  return json({items:items.results,jobs:jobs.results,sales:sales.results.map(s=>({...s,lines:bySale.get(String(s.id))||[]})),payments:payments.results,expenses:expenses.results,movements:movements.results});
 } catch(e){console.error('Workspace load failed',e);return json({error:'Your workspace could not load. Please try again.'},503);}
}

export async function POST(request:Request){
 try {
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Please use your business workspace to save changes.'},403);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'This request came from another website.'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON is required.'},415);
  const raw=await request.text();if(raw.length>50000)return json({error:'This entry is too large.'},413);
  const input=JSON.parse(raw),op=uuid.parse(input.requestId),action=text.parse(input.action),db=getRawDb();
  const prior=await db.prepare('SELECT action FROM mutations WHERE id=?').bind(op).first<{action:string}>();
  if(prior){if(prior.action!==action)fail('Please reopen this form and try again.');return json({ok:true});}
  const statements:D1PreparedStatement[]=[];
  const add=(sql:string,...args:(string|number|null)[])=>statements.push(db.prepare(sql).bind(...args));
  const getItem=async(id:string)=>{const item=await db.prepare('SELECT * FROM items WHERE id=?').bind(id).first<Item>();if(!item)fail('That stock item no longer exists.');return item;};
  const getSale=async(id:string)=>{const sale=await db.prepare('SELECT * FROM sales WHERE id=?').bind(id).first<Sale>();if(!sale||sale.status!=='active')fail('That sale is no longer active.');return sale;};

  if(action==='item.create'){
   const v=z.object({name:text,sku:text,category:z.enum(categories as [string,...string[]]),price:cents,stock:qty,cost:cents,minimum:qty,date:pastDate,stockType:z.enum(['opening','purchase'])}).parse(input);
   if(v.stock*v.cost>1e12)fail('Stock value is too large.');
   add('INSERT INTO items (id,name,sku,category,price,stock,value,minimum,version) VALUES (?,?,?,?,?,?,?,?,0)',op,v.name,v.sku.toUpperCase(),v.category,v.price,v.stock,v.stock*v.cost,v.minimum);
   if(v.stock)add('INSERT INTO stock_moves (id,item_id,date,quantity,amount,kind,note) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),op,v.date,v.stock,v.stock*v.cost,v.stockType,v.stockType==='opening'?'Opening stock already owned':'Initial stock purchase');
  }else if(action==='item.update'){
   const v=z.object({id:uuid,name:text,sku:text,category:z.enum(categories as [string,...string[]]),price:cents,minimum:qty,version:qty}).parse(input);
   await getItem(v.id);
   add('UPDATE items SET name=?,sku=?,category=?,price=?,minimum=?,stock=CASE WHEN version=? THEN stock ELSE -1 END,version=version+1 WHERE id=?',v.name,v.sku.toUpperCase(),v.category,v.price,v.minimum,v.version,v.id);
  }else if(action==='stock.add'||action==='stock.loss'){
   const v=z.object({id:uuid,quantity:qty.refine(v=>v>0,'Enter a quantity above zero.'),cost:cents,date:pastDate,note:notes}).parse(input);
   const item=await getItem(v.id);
   if(action==='stock.add'){
    const amount=v.quantity*v.cost;if(amount+item.value>1e12)fail('Stock value is too large.');
    add('UPDATE items SET stock=stock+?,value=value+?,version=version+1 WHERE id=?',v.quantity,amount,v.id);
    add('INSERT INTO stock_moves (id,item_id,date,quantity,amount,kind,note) VALUES (?,?,?,?,?,?,?)',op,v.id,v.date,v.quantity,amount,'purchase',v.note||'Stock purchase');
   }else{
    if(v.quantity>item.stock)fail('The quantity is higher than available stock.');
    const value=v.quantity===item.stock?item.value:Math.round(item.value/item.stock*v.quantity);
    add('UPDATE items SET stock=CASE WHEN version=? THEN stock-? ELSE -1 END,value=value-?,version=version+1 WHERE id=?',item.version,v.quantity,value,v.id);
    add('INSERT INTO stock_moves (id,item_id,date,quantity,amount,kind,note) VALUES (?,?,?,?,?,?,?)',op,v.id,v.date,-v.quantity,value,'write-off',v.note||'Stock write-off');
    add('INSERT INTO expenses (id,date,description,category,amount,method,status) VALUES (?,?,?,?,?,?,?)',op,v.date,'Stock write-off: '+item.name,'Stock write-off',value,'Non-cash','active');
   }
  }else if(action==='sale.create'){
   const v=z.object({date:pastDate,customer:text,notes,jobId:uuid.nullable().optional(),paid:cents,method,lines:z.array(z.object({kind:z.enum(['service','product']),itemId:uuid.optional(),description:text,quantity:qty.refine(v=>v>0),price:cents,cost:cents})).min(1).max(30)}).parse(input);
   let job:Job|null=null;
   if(v.jobId){job=await db.prepare('SELECT * FROM jobs WHERE id=?').bind(v.jobId).first<Job>();if(!job||job.status==='Cancelled')fail('This job is unavailable.');if(await db.prepare("SELECT id FROM sales WHERE job_id=? AND status='active'").bind(v.jobId).first())fail('This job already has a sale.');}
   const stockItems=new Map<string,{item:Item;quantity:number;cost:number}>();
   const prepared:Line[]=[];
   for(const l of v.lines){
    let cost=l.cost,description=l.description;
    if(l.kind==='product'){
     if(!l.itemId)fail('Choose an inventory item.');
     if(stockItems.has(l.itemId))fail('Use one line per product and update its quantity.');
     const item=await getItem(l.itemId);if(l.quantity>item.stock)fail('Not enough stock for '+item.name+'.');
     cost=l.quantity===item.stock?item.value:Math.round(item.value/item.stock*l.quantity);description=item.name;
     stockItems.set(l.itemId,{item,quantity:l.quantity,cost});
    }
    prepared.push({id:crypto.randomUUID(),sale_id:op,item_id:l.kind==='product'?l.itemId!:null,kind:l.kind,description,quantity:l.quantity,price:l.price,cost});
   }
   const total=prepared.reduce((s,l)=>s+l.price*l.quantity,0),cost=prepared.reduce((s,l)=>s+l.cost,0);
   if(total<=0||total>1e12||cost>1e12)fail('Enter a valid sale total above zero.');if(v.paid>total)fail('Payment cannot exceed the sale total.');
   add('INSERT INTO sales (id,code,date,customer,total,cost,paid,notes,status,job_id,version) VALUES (?,?,?,?,?,?,?,?,?,?,0)',op,'JBC-'+op.slice(0,8).toUpperCase(),v.date,v.customer,total,cost,v.paid,v.notes,'active',v.jobId||null);
   for(const l of prepared)add('INSERT INTO sale_lines (id,sale_id,item_id,kind,description,quantity,price,cost) VALUES (?,?,?,?,?,?,?,?)',l.id,op,l.item_id,l.kind,l.description,l.quantity,l.price,l.cost);
   for(const {item,quantity,cost:amount} of stockItems.values()){
    add('UPDATE items SET stock=CASE WHEN version=? THEN stock-? ELSE -1 END,value=value-?,version=version+1 WHERE id=?',item.version,quantity,amount,item.id);
    add('INSERT INTO stock_moves (id,item_id,date,quantity,amount,kind,note) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),item.id,v.date,-quantity,amount,'sale','Sale JBC-'+op.slice(0,8).toUpperCase());
   }
   if(v.paid)add('INSERT INTO payments (id,sale_id,date,amount,method) VALUES (?,?,?,?,?)',crypto.randomUUID(),op,v.date,v.paid,v.method);
   if(job)add("UPDATE jobs SET status='Completed',version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE id=?",job.version,job.id);
  }else if(action==='payment.create'){
   const v=z.object({id:uuid,amount:cents.refine(v=>v>0),date:pastDate,method}).parse(input);const sale=await getSale(v.id);
   if(v.date<sale.date)fail('Payment date cannot be before the sale date.');
   if(v.amount>sale.total-sale.paid)fail('This payment exceeds the outstanding balance. Refresh the sale and try again.');
   add('UPDATE sales SET paid=paid+?,version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE id=?',v.amount,sale.version,sale.id);
   add('INSERT INTO payments (id,sale_id,date,amount,method) VALUES (?,?,?,?,?)',op,sale.id,v.date,v.amount,v.method);
  }else if(action==='sale.void'){
   const id=uuid.parse(input.id),sale=await getSale(id);
   if(sale.paid>0)fail('Paid sales cannot be voided in this version. Only unpaid entries can be voided.');
   const lines=(await db.prepare("SELECT * FROM sale_lines WHERE sale_id=? AND kind='product'").bind(id).all<Line>()).results;
   add("UPDATE sales SET status='void',version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE id=?",sale.version,id);
   for(const l of lines){
    add('UPDATE items SET stock=stock+?,value=value+?,version=version+1 WHERE id=?',l.quantity,l.cost,l.item_id);
    add('INSERT INTO stock_moves (id,item_id,date,quantity,amount,kind,note) VALUES (?,?,?,?,?,?,?)',crypto.randomUUID(),l.item_id,today(),l.quantity,l.cost,'return','Voided '+sale.code);
   }
  }else if(action==='expense.create'){
   const v=z.object({date:pastDate,description:text,category:z.enum(expenseCategories as [string,...string[]]),amount:cents.refine(v=>v>0),method}).parse(input);
   add('INSERT INTO expenses (id,date,description,category,amount,method,status) VALUES (?,?,?,?,?,?,?)',op,v.date,v.description,v.category,v.amount,v.method,'active');
  }else if(action==='expense.void'){
   const id=uuid.parse(input.id),expense=await db.prepare('SELECT * FROM expenses WHERE id=?').bind(id).first();
   if(!expense||expense.status!=='active')fail('That expense is no longer active.');
   if(expense.method==='Non-cash')fail('Stock write-offs cannot be voided here.');
   add("UPDATE expenses SET status='void' WHERE id=?",id);
  }else if(action==='job.create'||action==='job.update'){
   const v=z.object({customer:text,contact:z.string().trim().max(80),device:text,service:text,notes,date:pastDate,due:date,quote:cents,status:z.enum(jobStatuses as [string,...string[]])}).parse(input);
   if(v.due<v.date)fail('The target date cannot be before the received date.');
   if(action==='job.create')add('INSERT INTO jobs (id,customer,contact,device,service,notes,date,due,quote,status,version) VALUES (?,?,?,?,?,?,?,?,?,?,0)',op,v.customer,v.contact,v.device,v.service,v.notes,v.date,v.due,v.quote,v.status);
   else {
    const id=uuid.parse(input.id),version=qty.parse(input.version);if(!await db.prepare('SELECT id FROM jobs WHERE id=?').bind(id).first())fail('That job no longer exists.');
    add('UPDATE jobs SET customer=?,contact=?,device=?,service=?,notes=?,date=?,due=?,quote=?,status=?,version=CASE WHEN version=? THEN version+1 ELSE -1 END WHERE id=?',v.customer,v.contact,v.device,v.service,v.notes,v.date,v.due,v.quote,v.status,version,id);
   }
  }else fail('Unknown action.');
  add('INSERT INTO mutations (id,action) VALUES (?,?)',op,action);
  await db.batch(statements);
  return json({ok:true,id:op});
 }catch(e){
  if(e instanceof z.ZodError)return json({error:e.issues.map(i=>i.path.join('.')+': '+i.message).join(' ')},400);
  if(e instanceof SyntaxError)return json({error:'This entry could not be read. Please try again.'},400);
  const m=e instanceof Error?e.message:String(e);
  if(m.startsWith('USER:'))return json({error:m.slice(5)},400);
  if(m.includes('UNIQUE constraint failed: items.sku'))return json({error:'That SKU is already in use. Choose a different SKU.'},409);
  if(m.includes('constraint failed'))return json({error:'The record changed while you were editing. Refresh the workspace before trying again.'},409);
  console.error('Workspace save failed',e);return json({error:'Your entry could not be saved. Please try again; your inputs have been kept.'},503);
 }
}
