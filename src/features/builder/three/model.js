import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PARTS = {
  cpu: { label: 'Processor', short: 'CPU', description: 'The processor handles instructions and computation.' },
  motherboard: { label: 'Motherboard', short: 'BOARD', description: 'Connects and powers the core components.' },
  ram: { label: 'Memory', short: 'RAM', description: 'Fast working memory for apps, games, and multitasking.' },
  gpu: { label: 'Graphics card', short: 'GPU', description: 'Renders graphics and accelerates supported workloads.' },
  storage: { label: 'Storage', short: 'SSD', description: 'Stores your operating system, applications, and files.' },
  psu: { label: 'Power supply', short: 'PSU', description: 'Supplies power to the whole system.' },
  case: { label: 'Case', short: 'CASE', description: 'The chassis holds and protects your components.' },
  cooling: { label: 'Cooling', short: 'COOLING', description: 'Moves heat away from the processor and through the case.' },
};

/** Original generic ATX model. Units are illustrative, not manufacturing dimensions. */
export function createPCModel() {
  const root = new THREE.Group(); root.name = 'JBC_PC';
  const groups = {}, fans = [];
  for (const key of Object.keys(PARTS)) {
    const g = new THREE.Group(); g.name = key; g.userData.part = key; groups[key] = g; root.add(g);
  }
  const material = (color, metalness = .5, roughness = .45, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const metal = material('#263342', .8, .32), dark = material('#101820', .6, .42), silver = material('#98a9ba', .85, .26);
  const pcb = material('#173d42', .3, .65), black = material('#080f19', .15, .6), gold = material('#cead69', .65, .3);
  const cyan = material('#56dfff', .25, .3, { emissive: '#21b4f1', emissiveIntensity: 2 });
  const blue = material('#287afb', .4, .35, { emissive: '#185bdd', emissiveIntensity: .5 });
  function mesh(parent, geometry, mat, xyz, name) {
    const o = new THREE.Mesh(geometry, mat); o.position.set(...xyz); o.castShadow = true; o.receiveShadow = true;
    if(name) o.name = name; parent.add(o); return o;
  }
  const box = (p, size, pos, mat = metal, radius = .025) => mesh(p, new RoundedBoxGeometry(...size, 2, radius), mat, pos);
  function cyl(p, r, depth, pos, mat, axis = 'y') {
    const o = mesh(p, new THREE.CylinderGeometry(r, r, depth, 24), mat, pos);
    if(axis === 'x') o.rotation.z = Math.PI / 2;
    if(axis === 'z') o.rotation.x = Math.PI / 2;
    return o;
  }
  function ring(p, r, tube, pos, mat, axis = 'z') {
    const o = mesh(p, new THREE.TorusGeometry(r, tube, 8, 48), mat, pos);
    if(axis === 'x') o.rotation.y = Math.PI / 2;
    if(axis === 'y') o.rotation.x = Math.PI / 2;
    return o;
  }
  function wire(p, pts, mat, width = .024) {
    return mesh(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(a => new THREE.Vector3(...a))), 20, width, 5, false), mat, [0,0,0]);
  }
  function fan(p, pos, size, axis = 'z', rgb = true) {
    const f = new THREE.Group(); f.position.set(...pos); p.add(f);
    if(axis === 'x') f.rotation.y = Math.PI / 2;
    if(axis === 'y') f.rotation.x = -Math.PI / 2;
    box(f, [size,size,.12], [0,0,0], dark);
    cyl(f, size*.43, .16, [0,0,.025], black, 'z');
    ring(f, size*.4, .027, [0,0,.12], rgb ? cyan : silver);
    const rotor = new THREE.Group(); rotor.position.z = .13; f.add(rotor); fans.push(rotor);
    for(let i=0;i<9;i++) {
      const blade = box(rotor, [size*.15, size*.29, .022], [0,size*.22,0], metal, .04);
      const pivot = new THREE.Group(); rotor.add(pivot); pivot.add(blade); pivot.rotation.z = i*Math.PI*2/9; blade.rotation.z = -.45;
    }
    cyl(f, size*.105, .08, [0,0,.16], silver, 'z');
    for(const x of [-1,1]) for(const y of [-1,1]) cyl(f,.025,.015,[x*size*.43,y*size*.43,.075],silver,'z');
    return f;
  }
  const chassis = groups.case;
  box(chassis,[2.12,.13,3.82],[0,.2,0]); box(chassis,[2.12,.12,3.82],[0,4.65,0]);
  box(chassis,[.08,4.4,3.65],[-1.02,2.43,0],dark);
  for(const x of [-1,1]) for(const z of [-1.84,1.84]) box(chassis,[.09,4.4,.09],[x,2.43,z]);
  for(const z of [-1.83,1.83]) box(chassis,[2.05,.09,.09],[0,4.55,z],silver);
  for(const z of [-1.83,1.83]) box(chassis,[2.05,.09,.09],[0,.31,z],silver);
  for(const x of [-.77,.77]) for(const z of [-1.35,1.35]) box(chassis,[.28,.19,.4],[x,.075,z],black);
  // Front airflow grille, with true openings instead of a solid panel.
  for(let i=0;i<19;i++) box(chassis,[.024,3.53,.035],[-.85+i*.095,2.63,1.88],metal,.008);
  box(chassis,[1.95,.55,.08],[0,.62,1.86],dark);
  box(chassis,[1.95,.15,.08],[0,4.48,1.86],dark);
  for(let i=0;i<16;i++) box(chassis,[1.65,.026,.035],[0,4.72,-1.5+i*.17],black,.008);
  cyl(chassis,.09,.025,[.61,4.73,1.3],silver);
  ring(chassis,.065,.009,[.61,4.75,1.3],cyan,'y');
  for(const x of [-.55,-.25]) box(chassis,[.19,.025,.07],[x,4.73,1.3],black,.01);
  // Back I/O opening, expansion slots, and visible fasteners.
  box(chassis,[.32,2.15,.08],[-.78,3.38,-1.85],silver);
  for(let i=0;i<7;i++) box(chassis,[1.6,.1,.06],[0,1.26+i*.16,-1.85],dark);
  for(let i=0;i<7;i++) box(chassis,[.21,.12,.09],[-.75,2.59+i*.24,-1.91],black,.008);
  const glass = new THREE.Group(); glass.name = 'SidePanel'; chassis.add(glass);
  box(glass,[.027,4.14,3.52],[1.035,2.44,0],new THREE.MeshPhysicalMaterial({color:'#a7d8ef',transparent:true,opacity:.13,metalness:.05,roughness:.1,depthWrite:false}),.012);
  for(const y of [.4,4.48]) box(glass,[.045,.045,3.52],[1.06,y,0],silver);
  for(const z of [-1.76,1.76]) box(glass,[.045,4.12,.045],[1.06,2.44,z],silver);
  for(const y of [.5,4.37]) for(const z of [-1.66,1.66]) cyl(glass,.043,.055,[1.10,y,z],silver,'x');
  glass.visible = false;
  const board = groups.motherboard;
  box(board,[.07,2.75,2.6],[-.76,2.85,-.3],pcb);
  for(const y of [1.55,2.78,4.13]) for(const z of [-1.52,.9]) cyl(board,.055,.07,[-.70,y,z],gold,'x');
  // Etched circuit traces.
  for(let i=0;i<21;i++) {
    box(board,[.008,.012,.3+(i%4)*.13],[-.718,1.62+i*.115,-.5+(i%3)*.45],gold,.002);
  }
  box(board,[.22,1.08,.32],[-.56,3.56,-1.3],metal);
  box(board,[.20,.22,1.05],[-.56,4.02,-.42],metal);
  for(let i=0;i<9;i++) box(board,[.24,.022,.32],[-.54,3.1+i*.112,-1.3],silver,.003);
  for(let i=0;i<2;i++) box(board,[.1,.09,1.75],[-.66,2.02-i*.31,-.45],black);
  box(board,[.14,.37,.43],[-.63,1.92,.57],metal);
  cyl(board,.14,.035,[-.68,2.17,-1.20],silver,'x');
  for(let i=0;i<8;i++) cyl(board,.047,.13,[-.61,2.67+i*.13,-.94],silver,'x');
  const cpu = groups.cpu;
  box(cpu,[.085,.7,.7],[-.64,3.35,-.35],black);
  box(cpu,[.07,.54,.54],[-.56,3.35,-.35],silver);
  box(cpu,[.01,.20,.28],[-.519,3.35,-.35],blue,.007);
  const ram = groups.ram;
  for(const z of [.41,.66]) {
    box(ram,[.32,1.40,.07],[-.49,3.37,z],black);
    box(ram,[.06,1.37,.095],[-.30,3.37,z],cyan);
    for(let i=0;i<5;i++) box(ram,[.05,.15,.085],[-.40,2.88+i*.21,z],metal,.008);
    for(const y of [2.65,4.09]) box(ram,[.16,.1,.11],[-.59,y,z],silver);
  }
  const gpu = groups.gpu;
  box(gpu,[1.55,.13,2.33],[.05,2.19,-.3],metal);
  box(gpu,[1.50,.36,2.33],[.05,1.96,-.3],dark);
  box(gpu,[.035,.045,2.15],[.844,2.18,-.3],cyan);
  for(const z of [-1.07,-.3,.47]) fan(gpu,[.08,1.76,z],.67,'y',false).rotation.x = Math.PI/2;
  for(let i=0;i<22;i++) box(gpu,[1.2,.18,.018],[.02,2.02,-1.38+i*.10],silver,.003);
  for(let i=0;i<4;i++) wire(gpu,[[.68,2.22,.61],[.85,2.40,.8],[.89,1.6,1.13],[.7,1.05,.85]],black,.028);
  const storage = groups.storage;
  box(storage,[.07,.23,.86],[-.64,2.53,-.25],black);
  box(storage,[.02,.17,.63],[-.59,2.53,-.25],silver);
  box(storage,[.03,.15,.21],[-.57,2.53,-.5],blue);
  const psu = groups.psu;
  box(psu,[1.7,.71,1.48],[0,.72,-.97],dark);
  fan(psu,[.87,.74,-.97],.58,'x',false);
  box(psu,[.018,.16,.45],[.87,.91,-.62],silver,.008);
  for(let i=0;i<5;i++) box(psu,[.015,.014,.31],[.885,.72+i*.032,-.5],black,.003);
  for(let i=0;i<6;i++) wire(psu,[[.18+i*.05,.70,-.2],[.33+i*.05,.70,.20],[.51+i*.05,1.25,.46],[.61+i*.03,1.46,.53]],i%2?black:metal,.026);
  const cooling = groups.cooling;
  // Tower cooler and three front intake fans.
  const tower = new THREE.Group(); tower.name='CPUCooler'; cooling.add(tower);
  box(tower,[.66,.85,.85],[-.15,3.35,-.35],silver);
  for(let i=0;i<17;i++) box(tower,[.76,.013,.93],[-.10,2.97+i*.048,-.35],metal,.003);
  for(const z of [-.60,-.37,-.14]) wire(tower,[[-.51,3.2,z],[.14,2.95,z],[.25,3.52,z]],gold,.035);
  fan(tower,[.35,3.35,-.35],.89,'x');
  for(const y of [1.59,2.66,3.73]) fan(cooling,[0,y,1.62],.96,'z');
  // Cable loom in the rear chamber.
  for(let i=0;i<5;i++) wire(board,[[-.61,4.05,.97],[-.31,4.12,1.16],[-.41,1.28,1.20],[-.6,.85,.81]],black,.032);
  const basePositions = Object.fromEntries(Object.entries(groups).map(([key,g])=>[key,g.position.clone()]));
  const offsets = { case:[0,0,0],motherboard:[-.50,0,-.05],cpu:[1.1,.5,-.6],ram:[.8,.3,.75],gpu:[1.20,-.10,-.20],storage:[1.1,.12,.3],psu:[.35,-.05,-1.2],cooling:[1.5,.5,.1] };
  const anchors = {cpu:[-.48,3.35,-.35],motherboard:[-.67,3.94,-1.07],ram:[-.29,3.93,.7],gpu:[.85,2.15,-.18],storage:[-.54,2.53,-.25],psu:[.89,.72,-.97],case:[1.07,4.52,1.55],cooling:[.88,3.72,1.65]};
  return { root, groups, fans, glass, tower, anchors, basePositions, offsets };
}
