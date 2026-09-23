import { sqliteTable, text, integer, index, check, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const mutations = sqliteTable('mutations', {id:text().primaryKey(),action:text().notNull()});
export const items = sqliteTable('items', {
 id:text().primaryKey(),name:text().notNull(),sku:text().notNull(),category:text().notNull(),price:integer().notNull(),stock:integer().notNull(),value:integer().notNull(),minimum:integer().notNull(),version:integer().notNull().default(0),
},t=>[uniqueIndex('idx_items_sku').on(t.sku),check('item_stock_nonnegative',sql`${t.stock} >= 0`),check('item_value_nonnegative',sql`${t.value} >= 0`)]);
export const jobs = sqliteTable('jobs', {
 id:text().primaryKey(),customer:text().notNull(),contact:text().notNull(),device:text().notNull(),service:text().notNull(),notes:text().notNull(),date:text().notNull(),due:text().notNull(),quote:integer().notNull(),status:text().notNull(),version:integer().notNull().default(0),
},t=>[check('job_version_nonnegative',sql`${t.version} >= 0`)]);
export const sales = sqliteTable('sales', {
 id:text().primaryKey(),code:text().notNull(),date:text().notNull(),customer:text().notNull(),total:integer().notNull(),cost:integer().notNull(),paid:integer().notNull().default(0),notes:text().notNull(),status:text().notNull().default('active'),job_id:text().references(()=>jobs.id),version:integer().notNull().default(0),
},t=>[index('idx_sales_date').on(t.date),check('sale_payment_bounds',sql`${t.paid} >= 0 AND ${t.paid} <= ${t.total}`),check('sale_version_nonnegative',sql`${t.version} >= 0`)]);
export const lines = sqliteTable('sale_lines', {
 id:text().primaryKey(),sale_id:text().notNull().references(()=>sales.id),item_id:text().references(()=>items.id),kind:text().notNull(),description:text().notNull(),quantity:integer().notNull(),price:integer().notNull(),cost:integer().notNull(),
},t=>[index('idx_sale_lines_sale').on(t.sale_id)]);
export const payments = sqliteTable('payments', {
 id:text().primaryKey(),sale_id:text().notNull().references(()=>sales.id),date:text().notNull(),amount:integer().notNull(),method:text().notNull(),
},t=>[index('idx_payments_sale').on(t.sale_id),index('idx_payments_date').on(t.date)]);
export const expenses = sqliteTable('expenses', {
 id:text().primaryKey(),date:text().notNull(),description:text().notNull(),category:text().notNull(),amount:integer().notNull(),method:text().notNull(),status:text().notNull().default('active'),
});
export const movements = sqliteTable('stock_moves', {
 id:text().primaryKey(),item_id:text().notNull().references(()=>items.id),date:text().notNull(),quantity:integer().notNull(),amount:integer().notNull(),kind:text().notNull(),note:text().notNull(),
});
