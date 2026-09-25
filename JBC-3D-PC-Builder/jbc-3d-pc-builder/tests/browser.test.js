import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:5175}});await server.listen();
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5175');await page.waitForSelector('canvas');await page.waitForTimeout(1200);
 assert.equal(await page.locator('.jbc-pc__card').count(),8);
 const label=page.locator('.jbc-pc__label[data-part="gpu"]');
 const pos=()=>label.evaluate(e=>[e.style.left,e.style.top]);
 let before=await pos();const canvas=page.locator('canvas');const bounds=await canvas.boundingBox();
 await page.mouse.move(bounds.x+bounds.width*.75,bounds.y+bounds.height*.45);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.90,bounds.y+bounds.height*.45,{steps:12});await page.mouse.up();await page.waitForTimeout(600);
 assert.notDeepEqual(await pos(),before,'drag changes orbit');
 before=await pos();await page.mouse.wheel(0,-250);await page.waitForTimeout(600);assert.notDeepEqual(await pos(),before,'wheel changes zoom');
 await page.getByRole('button',{name:'Reset camera',exact:true}).click();await page.waitForTimeout(800);
 await page.locator('[data-category="cpu"]').click();await page.waitForTimeout(800);
 assert.equal(await page.locator('[data-item="cpu-3"]').isDisabled(),true);
 await page.locator('[data-item="cpu-1"]').click();
 assert.equal(await page.evaluate(()=>window.jbcDemo.getBuild().total),11500);
 assert.match(await page.locator('.jbc-pc__label[data-part="cpu"]').textContent(),/Ryzen 5 7600/);
 await page.locator('[data-item="cpu-2"]').click();assert.equal(await page.evaluate(()=>window.jbcDemo.getBuild().total),16900);
 await page.locator('[data-category="gpu"]').click();await page.locator('[data-item="gpu-1"]').click();assert.equal(await page.evaluate(()=>window.jbcDemo.getBuild().total),35800);
 await page.evaluate(async()=>{const {demoCatalog}=await import('/src/demo-catalog.js');window.jbcDemo.setCatalog(demoCatalog.map(i=>i.id==='cpu-2'?{...i,stock:0}:i));});
 assert.equal(await page.evaluate(()=>window.jbcDemo.getBuild().selection.cpu),undefined);
 assert.equal(await page.evaluate(()=>window.jbcDemo.getBuild().total),18900);
 await page.evaluate(()=>window.jbcDemo.setSelection({}));
 await page.getByRole('button',{name:'Exploded view',exact:true}).click();await page.waitForTimeout(1100);
 assert.equal(await page.getByRole('button',{name:'Exploded view',exact:true}).getAttribute('aria-pressed'),'true');
 await mkdir('previews',{recursive:true});await page.screenshot({path:'previews/exploded.png',fullPage:true});
 await page.getByRole('button',{name:'Exploded view',exact:true}).click();await page.waitForTimeout(1100);
 await page.screenshot({path:'previews/desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Show side panel',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Show side panel',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Show side panel',exact:true}).click();
 // GLB round-trip parsing and semantic groups.
 const model=await page.evaluate(async()=>{const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');const gltf=await new GLTFLoader().loadAsync('/models/jbc-atx-pc.glb');return gltf.scene.children[0].children.map(o=>o.name);});
 for(const category of ['cpu','motherboard','ram','gpu','storage','psu','case','cooling'])assert.ok(model.includes(category));
 // Every category is reachable without aiming at the 3D mesh.
 for(const category of ['cpu','motherboard','ram','gpu','storage','psu','case','cooling']){
   await page.locator(`[data-category="${category}"]`).click();
   assert.equal(await page.locator(`[data-category="${category}"]`).getAttribute('aria-pressed'),'true');
 }
 await page.evaluate(async()=>{window.jbcDemo.dispose();const {createPCBuilder}=await import('/src/PCBuilder.js');const {demoCatalog}=await import('/src/demo-catalog.js');window.jbcDemo=createPCBuilder(document.querySelector('#builder'),{catalog:demoCatalog,demo:true});});
 assert.equal(await page.locator('canvas').count(),1);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reset camera',exact:true}).click();await page.waitForTimeout(900);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'previews/mobile.png',fullPage:true});
 await page.locator('[data-category="ram"]').click();await page.locator('[data-item="ram-1"]').click();assert.equal(await page.evaluate(()=>window.jbcDemo.getBuild().selection.ram),'ram-1');
 await page.evaluate(()=>window.jbcDemo.setCatalog([]));assert.equal(await page.evaluate(()=>window.jbcDemo.getBuild().selectedCount),0);assert.match(await page.locator('.jbc-pc__products').textContent(),/No products/);
 assert.deepEqual(errors,[]);
 console.log('PASS: drag, wheel zoom, focus, 8 categories, labels, stock validation, totals, live updates, GLB round-trip, remount, empty catalog, mobile layout.');
} finally {await browser.close();await server.close();}
