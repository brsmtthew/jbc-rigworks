export type Item={id:string;name:string;sku:string;category:string;price:number;stock:number;value:number;minimum:number;version:number};
export type Job={id:string;customer:string;contact:string;device:string;service:string;notes:string;date:string;due:string;quote:number;status:string;version:number};
export type Line={id:string;sale_id:string;item_id:string|null;kind:string;description:string;quantity:number;price:number;cost:number};
export type Sale={id:string;code:string;date:string;customer:string;total:number;cost:number;paid:number;notes:string;status:string;job_id:string|null;version:number;lines:Line[]};
export type Payment={id:string;sale_id:string;date:string;amount:number;method:string};
export type Expense={id:string;date:string;description:string;category:string;amount:number;method:string;status:string};
export type Movement={id:string;item_id:string;date:string;quantity:number;amount:number;kind:string;note:string};
export type Workspace={items:Item[];jobs:Job[];sales:Sale[];payments:Payment[];expenses:Expense[];movements:Movement[]};
export const emptyWorkspace:Workspace={items:[],jobs:[],sales:[],payments:[],expenses:[],movements:[]};
export const services=['PC deep cleaning','Laptop deep cleaning','PC assembly','Diagnostics & repair','Upgrade installation','Other service'];
export const categories=['Components','Peripherals','Accessories','Consumables'];
export const expenseCategories=['Supplies','Utilities','Rent','Marketing','Delivery','Tools & equipment','Other'];
export const methods=['Cash','GCash','Bank transfer','Other'];
export const jobStatuses=['Queued','In progress','Ready','Completed','Cancelled'];
export function newId(){
 if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function money(cents:number,compact=false){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:compact?0:2,maximumFractionDigits:compact?0:2}).format(cents/100);}
export function dateLabel(date:string){return new Date(date+'T00:00:00').toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});}
export function monthLabel(value:string){return new Date(value+'-01T00:00:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'});}
export function paymentStatus(s:Sale){return s.status==='void'?'Voided':s.paid===s.total?'Paid':s.paid>0?'Partial':'Unpaid';}
export function unitCost(i:Item){return i.stock?Math.round(i.value/i.stock):0;}
export function summary(w:Workspace,period:string){
 const within=(date:string)=>period==='all'||date.startsWith(period);
 const sales=w.sales.filter(s=>s.status==='active'&&within(s.date));
 const revenue=sales.reduce((s,x)=>s+x.total,0),cost=sales.reduce((s,x)=>s+x.cost,0);
 const expenses=w.expenses.filter(x=>x.status==='active'&&within(x.date)).reduce((s,x)=>s+x.amount,0);
 const receipts=w.payments.filter(x=>within(x.date)&&w.sales.some(s=>s.id===x.sale_id&&s.status==='active')).reduce((s,x)=>s+x.amount,0);
 const purchases=w.movements.filter(x=>x.kind==='purchase'&&within(x.date)).reduce((s,x)=>s+x.amount,0);
 const serviceCost=sales.reduce((s,x)=>s+x.lines.filter(l=>l.kind==='service').reduce((v,l)=>v+l.cost,0),0);
 const cashExpenses=w.expenses.filter(x=>x.status==='active'&&x.method!=='Non-cash'&&within(x.date)).reduce((s,x)=>s+x.amount,0);
 const receivables=w.sales.filter(s=>s.status==='active').reduce((s,x)=>s+x.total-x.paid,0);
 return {sales,revenue,cost,expenses,profit:revenue-cost-expenses,receipts,purchases,serviceCost,cashExpenses,cashFlow:receipts-purchases-serviceCost-cashExpenses,receivables,margin:revenue?(revenue-cost-expenses)/revenue*100:0};
}
// Display-only examples; never saved into the business database.
export function demoWorkspace():Workspace {
 const month=today().slice(0,7),d=(n:number)=>month+'-'+String(n).padStart(2,'0');
 const items:Item[]=[
 {id:'i1',name:'Kingston NV2 500GB SSD',sku:'SSD-001',category:'Components',price:220000,stock:3,value:480000,minimum:3,version:0},
 {id:'i2',name:'8GB DDR4 3200MHz RAM',sku:'RAM-001',category:'Components',price:140000,stock:8,value:680000,minimum:3,version:0},
 {id:'i3',name:'Arctic MX-4 thermal paste',sku:'SUP-001',category:'Consumables',price:45000,stock:2,value:50000,minimum:3,version:0},
 {id:'i4',name:'Wireless keyboard & mouse',sku:'PER-001',category:'Peripherals',price:85000,stock:6,value:330000,minimum:2,version:0},
 {id:'i5',name:'HDMI cable · 1.5m',sku:'ACC-001',category:'Accessories',price:20000,stock:12,value:96000,minimum:4,version:0}];
 const sales:Sale[]=Array.from({length:18},(_,n)=>{
 const product=n%3===0,item=items[n%items.length],total=product?item.price:(n%2?85000:120000),cost=product?unitCost(item):15000,id='s'+n;
 return {id,code:'JBC-'+String(1001+n),date:d(n+1),customer:['Sample customer A','Sample customer B','Walk-in customer','Sample customer C'][n%4],total,cost,paid:n>14?Math.round(total/2):total,notes:'Sample record',status:'active',job_id:null,version:0,lines:[{id:'l'+n,sale_id:id,item_id:product?item.id:null,kind:product?'product':'service',description:product?item.name:services[n%2],quantity:1,price:total,cost}]};});
 const jobs:Job[]=[
 {id:'j1',customer:'Sample customer A',contact:'',device:'ASUS TUF laptop',service:'Laptop deep cleaning',notes:'Clean fans and replace thermal paste.',date:d(18),due:d(22),quote:85000,status:'In progress',version:0},
 {id:'j2',customer:'Sample customer B',contact:'',device:'Custom desktop PC',service:'PC assembly',notes:'Customer supplied components.',date:d(19),due:d(23),quote:150000,status:'Queued',version:0},
 {id:'j3',customer:'Sample customer C',contact:'',device:'Lenovo IdeaPad',service:'Upgrade installation',notes:'SSD installation and setup.',date:d(17),due:d(21),quote:50000,status:'Ready',version:0}];
 return {items,jobs,sales,payments:sales.map(s=>({id:'p'+s.id,sale_id:s.id,date:s.date,amount:s.paid,method:'GCash'})),expenses:[
 {id:'e1',date:d(3),description:'Cleaning supplies',category:'Supplies',amount:65000,method:'Cash',status:'active'},
 {id:'e2',date:d(10),description:'Electricity allocation',category:'Utilities',amount:80000,method:'GCash',status:'active'},
 {id:'e3',date:d(15),description:'Social media promotion',category:'Marketing',amount:50000,method:'GCash',status:'active'}
 ],movements:[{id:'m1',item_id:'i1',date:d(1),quantity:3,amount:480000,kind:'purchase',note:'Example stock purchase'}]};
}
