import { createPCBuilder } from './PCBuilder.js';
import { demoCatalog } from './demo-catalog.js';
import './pc-builder.css';
const builder=createPCBuilder(document.querySelector('#builder'),{catalog:demoCatalog,demo:true});
// Exposed only in this demo for experimentation and integration testing.
window.jbcDemo=builder;
if(import.meta.hot)import.meta.hot.dispose(()=>builder.dispose());
