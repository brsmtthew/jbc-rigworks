import { writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createPCModel } from '../src/model.js';
// GLTFExporter uses the browser FileReader API. No textures are embedded here.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result=>{this.result='data:application/octet-stream;base64,'+Buffer.from(result).toString('base64');this.onloadend?.();}); }
};
const {root}=createPCModel();root.updateMatrixWorld(true);
const result=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false});
await writeFile(new URL('../public/models/jbc-atx-pc.glb',import.meta.url),Buffer.from(result));
console.log(`Exported original PC model: ${result.byteLength} bytes`);
