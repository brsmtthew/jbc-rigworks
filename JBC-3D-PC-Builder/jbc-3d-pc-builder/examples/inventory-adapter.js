// Adapt these field names and category aliases to YOUR existing data schema.
// Call from the parent/store whenever the inventory snapshot changes.
const categoryMap={Processor:'cpu',Motherboard:'motherboard',Memory:'ram',Graphics:'gpu',Storage:'storage','Power supply':'psu',Case:'case',Cooling:'cooling'};
export function toBuilderCatalog(rows) {
  return rows.filter(row=>Object.hasOwn(categoryMap,row.category)).map(row=>({
    id:String(row.id),
    category:categoryMap[row.category],
    name:row.name,
    // Available stock excludes reserved units; use your existing source of truth.
    stock:Math.max(0,Number(row.quantity)-Number(row.reservedQuantity ?? 0)),
    price:Number(row.sellingPrice),
    specs:row.description ?? '',
  }));
}
