import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPCModel, PARTS } from './model.js';
import { normalizeCatalog, reconcileSelection, buildSnapshot } from './catalog.js';

/** Mount one independent builder. No network requests, global CSS, or inventory writes. */
export function createPCBuilder(container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('Pass a DOM container');
  let catalog = normalizeCatalog(options.catalog ?? []);
  let selection = reconcileSelection(catalog, options.selection);
  let active = null, exploded = false, showLabels = true, disposed = false, visible = true;
  const reduced = options.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const money = new Intl.NumberFormat(options.locale ?? 'en-PH', {style:'currency',currency:options.currency ?? 'PHP',maximumFractionDigits:0});
  const cleanups = [];
  const el = (tag, cls, content) => { const n=document.createElement(tag); if(cls)n.className=cls; if(content!=null)n.textContent=content; return n; };
  const on = (node,type,fn,opts) => { node.addEventListener(type,fn,opts); cleanups.push(()=>node.removeEventListener(type,fn,opts)); };
  const root = el('section','jbc-pc'); container.append(root);
  const header = el('div','jbc-pc__header');
  const heading = el('div'); heading.append(el('span','jbc-pc__eyebrow','JBC / BUILD STUDIO'),el('h2',null,'Explore your next build'),el('p',null,'Rotate the PC. Get closer. Choose your components.'));
  const badge = el('span','jbc-pc__badge', options.demo ? 'DEMO INVENTORY' : 'COMPONENT CATALOG'); header.append(heading,badge);root.append(header);
  const layout=el('div','jbc-pc__layout'), left=el('div','jbc-pc__left'), stage=el('div','jbc-pc__stage');
  const canvasWrap=el('div','jbc-pc__canvas'), labelLayer=el('div','jbc-pc__labels');
  const stageTitle=el('div','jbc-pc__stage-title'); stageTitle.append(el('span',null,'JBC RIGWORKS'),el('small',null,'ATX / INTERACTIVE 3D'));
  const status=el('div','jbc-pc__view-state','INTERIOR VIEW');
  const toolbar=el('div','jbc-pc__toolbar');
  const buttons={};
  function button(key,text,title,handler,toggle=false) {
    const b=el('button',null,text);b.type='button';b.title=title;b.setAttribute('aria-label',title);if(toggle)b.setAttribute('aria-pressed','false');
    on(b,'click',handler);toolbar.append(b);buttons[key]=b;return b;
  }
  button('reset','↺','Reset camera',()=>resetView());
  button('out','−','Zoom out',()=>zoom(1.2));button('in','+','Zoom in',()=>zoom(1/1.2));
  button('rotate','Orbit','Auto rotate',()=>{controls.autoRotate=!controls.autoRotate;buttons.rotate.setAttribute('aria-pressed',String(controls.autoRotate));},true);
  button('glass','Glass','Show side panel',()=>{model.glass.visible=!model.glass.visible;buttons.glass.setAttribute('aria-pressed',String(model.glass.visible));},true);
  button('explode','Explode','Exploded view',()=>setExploded(!exploded),true);
  button('labels','Labels','Show part labels',()=>{showLabels=!showLabels;buttons.labels.setAttribute('aria-pressed',String(showLabels));},true).setAttribute('aria-pressed','true');
  const hint=el('div','jbc-pc__hint','Drag to orbit · Scroll / pinch to zoom · Tap a part to inspect');
  stage.append(canvasWrap,labelLayer,stageTitle,status,toolbar,hint);left.append(stage);
  const cards=el('div','jbc-pc__cards');left.append(cards);
  const aside=el('aside','jbc-pc__aside');aside.setAttribute('aria-label','Component selection');
  layout.append(left,aside);root.append(layout);
  const live=el('div','jbc-pc__sr');live.setAttribute('role','status');live.setAttribute('aria-live','polite');root.append(live);
  const footer=el('div','jbc-pc__footer');footer.append(el('span',null,'Generic component shapes. Your selected product names appear on the model.'),el('span',null,'Compatibility must be checked before ordering.'));root.append(footer);
  let renderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}
  catch(error) {root.remove();const message=el('p',null,'3D preview unavailable. Enable WebGL or try another browser.');container.append(message);throw new Error('WebGL initialization failed',{cause:error});}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x081525,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','3D PC. Drag to rotate, scroll to zoom. Arrow keys rotate, plus and minus zoom, Home resets. Use part buttons to select components.');canvasWrap.append(canvas);
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(38,1,.04,100);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.75;controls.maxDistance=23;controls.maxPolarAngle=Math.PI*.94;controls.autoRotateSpeed=.6;controls.enablePan=true;
  const pmrem=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment(), env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.75;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc9e6ff,0x24334b,2));
  const key=new THREE.DirectionalLight(0xe3f2ff,4);key.position.set(5,8,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=7;key.shadow.camera.bottom=-6;key.shadow.bias=-.001;scene.add(key);
  const rim=new THREE.DirectionalLight(0x459dff,3);rim.position.set(-3,5,-5);scene.add(rim);
  const model=createPCModel();scene.add(model.root);
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(3.08,3.14,.10,80),new THREE.MeshStandardMaterial({color:0x0b1725,metalness:.12,roughness:.8}));floor.position.y=-.075;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(50,50,0x1d3c57,0x142b42);grid.position.y=-.14;scene.add(grid);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(3.07,.012,8,100),new THREE.MeshBasicMaterial({color:0x307eb7}));halo.rotation.x=Math.PI/2;halo.position.y=-.015;scene.add(halo);
  const highlight=new THREE.Box3Helper(new THREE.Box3(),0x5edfff);highlight.visible=false;scene.add(highlight);
  let tween=null;
  function transition(position,target) {tween={from:camera.position.clone(),to:position.clone(),startTarget:controls.target.clone(),endTarget:target.clone(),at:performance.now()};if(reduced){camera.position.copy(position);controls.target.copy(target);tween=null;controls.update();}}
  function resetView() {
    active=null;model.tower.visible=true;renderCards();renderAside();updateLabels();
    controls.autoRotate=false;buttons.rotate.setAttribute('aria-pressed','false');
    const w=stage.clientWidth;const target=new THREE.Vector3(exploded?.45:0,2.25,0);
    transition(new THREE.Vector3(9,5.8,6.7).multiplyScalar(Math.max(1,.9*stage.clientHeight/Math.max(w,1))).add(exploded?new THREE.Vector3(1.7,.8,1.7):new THREE.Vector3()),target);
    status.textContent=exploded?'EXPLODED VIEW':'INTERIOR VIEW';
  }
  function zoom(factor) {tween=null;const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();}
  function setExploded(value) {exploded=Boolean(value);model.glass.visible=false;buttons.glass.setAttribute('aria-pressed','false');buttons.explode.setAttribute('aria-pressed',String(exploded));resetView();}
  function focusPart(category) {
    if(!Object.hasOwn(PARTS,category))throw new TypeError('Unknown part');
    active=category;controls.autoRotate=false;buttons.rotate.setAttribute('aria-pressed','false');
    if(category!=='case'){model.glass.visible=false;buttons.glass.setAttribute('aria-pressed','false');}
    // Lift the cooler from sight when inspecting the CPU, without moving the CPU socket.
    model.tower.visible=category!=='cpu';
    const target=new THREE.Vector3(...model.anchors[category]).add(new THREE.Vector3(...model.offsets[category]).multiplyScalar(exploded?1:0));
    if(category==='case')target.set(0,2.25,0);
    let distance={cpu:2.2,motherboard:5.3,ram:3.1,gpu:4.1,storage:2.15,psu:3.2,case:10,cooling:5.5}[category];
    if(stage.clientWidth<550)distance*=1.3;
    const dir=category==='cooling'?new THREE.Vector3(.85,.23,1):new THREE.Vector3(1,.20,.38);
    transition(target.clone().add(dir.normalize().multiplyScalar(distance)),target);
    status.textContent=PARTS[category].label.toUpperCase()+' / INSPECT';renderCards();renderAside();updateLabels();
    live.textContent=`Inspecting ${PARTS[category].label}`;
    options.onPartFocus?.(category);
  }
  const labelNodes={}, labelLines={};
  const lines=document.createElementNS('http://www.w3.org/2000/svg','svg');lines.classList.add('jbc-pc__leader-lines');labelLayer.append(lines);
  for(const [category,p] of Object.entries(PARTS)) {
    const b=el('button','jbc-pc__label');b.type='button';b.dataset.part=category;
    b.append(el('span',null,p.short),el('small',null,'Choose part'));on(b,'click',()=>focusPart(category));labelLayer.append(b);labelNodes[category]=b;
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');lines.append(line);labelLines[category]=line;
  }
  function updateLabels() {
    for(const [category,node] of Object.entries(labelNodes)) {
      const item=catalog.find(i=>i.id===selection[category]);node.querySelector('small').textContent=item?.name ?? 'Choose part';
      node.title=`${PARTS[category].label}: ${item?.name ?? 'No selection'}`;node.setAttribute('aria-label',node.title);node.classList.toggle('is-selected',Boolean(item));node.classList.toggle('is-active',active===category);
    }
  }
  function emit(reason) {const data=getBuild();options.onChange?.(data,{reason});container.dispatchEvent(new CustomEvent('jbc:build-change',{detail:{...data,reason},bubbles:true}));}
  function choose(category,id) {
    const item=catalog.find(i=>i.id===id&&i.category===category&&i.stock>0);
    if(id!=null&&!item)return false;
    if(id==null)delete selection[category];else selection[category]=id;
    updateLabels();renderCards();renderAside();live.textContent=item?`${item.name} selected`:'Selection removed';emit('selection');return true;
  }
  function renderCards() {
    cards.replaceChildren();
    for(const [category,p] of Object.entries(PARTS)) {
      const item=catalog.find(i=>i.id===selection[category]);const stock=catalog.filter(i=>i.category===category).reduce((s,i)=>s+i.stock,0);
      const b=el('button','jbc-pc__card');b.type='button';b.dataset.category=category;b.classList.toggle('is-active',active===category);b.setAttribute('aria-pressed',String(active===category));
      b.append(el('span','jbc-pc__part-icon',p.short),el('strong',null,p.label),el('small',null,item?.name ?? 'Choose component'),el('span','jbc-pc__stock',`${stock} in stock`));
      b.onclick=()=>focusPart(category);cards.append(b);
    }
  }
  function renderAside() {
    const focused=aside.contains(document.activeElement)?document.activeElement?.dataset?.item:null;
    aside.replaceChildren();const snapshot=getBuild();
    aside.append(el('span','jbc-pc__eyebrow','YOUR CONFIGURATION'),el('h3',null,active?PARTS[active].label:'Make it your own'),el('p','jbc-pc__description',active?PARTS[active].description:'Select a part on the model or a component below to browse available stock.'));
    const progress=el('div','jbc-pc__progress');progress.append(el('span',null,`${snapshot.selectedCount} of 8 selected`));const bar=el('div');const fill=el('i');fill.style.width=`${snapshot.selectedCount/8*100}%`;bar.append(fill);progress.append(bar);aside.append(progress);
    const list=el('div','jbc-pc__products');
    if(options.externalPicker && snapshot.selectedCount) {
      for(const item of snapshot.parts) list.append(el('p','jbc-pc__description',item.name));
      list.append(el('p','jbc-pc__description','Choose a component to change its source or specifications. Review compatibility in your build summary.'));
    } else if(active && !options.externalPicker) {
      const available=catalog.filter(i=>i.category===active);list.append(el('div','jbc-pc__list-title',`${available.filter(i=>i.stock>0).length} available options`));
      if(!available.length)list.append(el('p','jbc-pc__empty','No products in this category yet. Add items to your inventory to see them here.'));
      for(const item of available) {
        const b=el('button','jbc-pc__product');b.type='button';b.dataset.item=item.id;b.disabled=item.stock<1;b.setAttribute('aria-pressed',String(selection[active]===item.id));b.classList.toggle('is-selected',selection[active]===item.id);
        b.append(el('span','jbc-pc__product-top',selection[active]===item.id?'✓ SELECTED':item.stock>0?`${item.stock} IN STOCK`:'OUT OF STOCK'),el('strong',null,item.name));
        if(item.specs)b.append(el('small',null,String(item.specs)));b.append(el('b',null,money.format(item.price)));b.onclick=()=>choose(active,item.id);list.append(b);
      }
      if(selection[active]) {const b=el('button','jbc-pc__remove','Remove selection');b.type='button';b.onclick=()=>choose(active,null);list.append(b);}
    } else {
      const welcome=el('div','jbc-pc__welcome');welcome.append(el('span',null,'01 — EXPLORE'),el('strong',null,'A closer look at every part.'),el('p',null,'Open the side panel, separate the components, or zoom right into the details.'));list.append(welcome);
    }
    aside.append(list);
    const total=el('div','jbc-pc__total');total.append(el('span',null,'Selected parts subtotal'),el('strong',null,money.format(snapshot.total)),el('small',null,options.demo?'Sample products and prices only.':'Availability and final price confirmed at checkout.'));aside.append(total);
    if(focused)Array.from(aside.querySelectorAll('[data-item]')).find(b=>b.dataset.item===focused)?.focus({preventScroll:true});
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
  on(canvas,'pointerdown',e=>{down={x:e.clientX,y:e.clientY,id:e.pointerId,at:performance.now()};tween=null;});
  on(canvas,'pointercancel',()=>down=null);
  on(canvas,'pointerup',e=>{
    if(!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||performance.now()-down.at>450){down=null;return;}down=null;
    const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObject(model.root,true).filter(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});
    if(hits.length){let o=hits[0].object;while(o&&!o.userData.part)o=o.parent;if(o)focusPart(o.userData.part);}
  });
  on(canvas,'wheel',()=>tween=null,{passive:true});
  on(canvas,'keydown',e=>{
    if(['+','=','-','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
    if(e.key==='+'||e.key==='=')zoom(1/1.2);if(e.key==='-')zoom(1.2);if(e.key==='Home')resetView();
    if(e.key.startsWith('Arrow')){tween=null;const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')s.theta-=.15;if(e.key==='ArrowRight')s.theta+=.15;if(e.key==='ArrowUp')s.phi-=.15;if(e.key==='ArrowDown')s.phi+=.15;s.phi=THREE.MathUtils.clamp(s.phi,.06,Math.PI*.94);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();}
  });
  let previousWidth=0;
  const resize=new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;if(w&&h){renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(w!==previousWidth){previousWidth=w;if(active)focusPart(active);else resetView();}}});resize.observe(stage);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});intersection.observe(stage);
  function placeLabels() {
    const w=stage.clientWidth,h=stage.clientHeight,placed=[];
    const entries=Object.entries(labelNodes).sort(([a],[b])=>Number(b===active)-Number(a===active));
    for(const [category,node] of entries) {
      const point=new THREE.Vector3(...model.anchors[category]);model.groups[category].localToWorld(point);point.project(camera);
      const enabled=showLabels && point.z>-1&&point.z<1 && Math.abs(point.x)<.92&&Math.abs(point.y)<.77;
      node.hidden=!enabled;const line=labelLines[category];line.style.display=enabled?'':'none';
      if(!enabled)continue;
      const ax=(point.x*.5+.5)*w,ay=(-point.y*.5+.5)*h;
      const width=node.offsetWidth,height=node.offsetHeight;
      let x=ax,y=ay;
      const overlaps=(cx,cy)=>placed.some(p=>Math.abs(cx-p.x)<(width+p.width)/2+5 && Math.abs(cy-p.y)<(height+p.height)/2+5);
      const candidates=[[0,0],[0,-30],[0,30],[-80,0],[80,0],[0,-60],[0,60],[-90,-35],[90,35],[0,-90],[0,90]];
      for(const [dx,dy] of candidates){x=THREE.MathUtils.clamp(ax+dx,width/2+8,w-width/2-8);y=THREE.MathUtils.clamp(ay+dy,75,h-112);if(!overlaps(x,y))break;}
      placed.push({x,y,width,height});node.style.left=`${x}px`;node.style.top=`${y}px`;
      line.setAttribute('x1',ax);line.setAttribute('y1',ay);line.setAttribute('x2',x);line.setAttribute('y2',y);
    }
  }
  let frame=0,last=performance.now();
  function animate(now) {
    if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;
    if(!visible||document.hidden)return;
    for(const [category,g] of Object.entries(model.groups))g.position.lerp(new THREE.Vector3(...model.offsets[category]).multiplyScalar(exploded?1:0),reduced?1:1-Math.exp(-dt*9));
    if(tween){const t=Math.min((now-tween.at)/650,1),s=t*t*(3-2*t);camera.position.lerpVectors(tween.from,tween.to,s);controls.target.lerpVectors(tween.startTarget,tween.endTarget,s);if(t===1)tween=null;}
    if(!reduced)model.fans.forEach(f=>f.rotation.z-=dt*2.2);
    controls.update(dt);model.root.updateMatrixWorld(true);highlight.visible=Boolean(active);if(active)highlight.box.setFromObject(model.groups[active]);placeLabels();renderer.render(scene,camera);
  }
  function getBuild(){return buildSnapshot(catalog,selection);}
  function setCatalog(items){const next=normalizeCatalog(items);catalog=next;selection=reconcileSelection(catalog,selection);renderCards();renderAside();updateLabels();emit('catalog');}
  function setSelection(next){selection=reconcileSelection(catalog,next);renderCards();renderAside();updateLabels();emit('external-selection');}
  function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();cleanups.forEach(fn=>fn());controls.dispose();const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());env.dispose();renderer.dispose();root.remove();}
  renderCards();renderAside();updateLabels();resetView();frame=requestAnimationFrame(animate);
  return {getBuild,setCatalog,setSelection,focusPart,resetView,setExploded,dispose};
}
