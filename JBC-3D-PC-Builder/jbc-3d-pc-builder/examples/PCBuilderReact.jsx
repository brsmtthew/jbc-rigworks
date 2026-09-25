import { useEffect, useRef } from 'react';
import { createPCBuilder } from '../src/PCBuilder.js';
import '../src/pc-builder.css';

/** Pass inventory from your existing API/store. This wrapper does not fetch or reserve stock. */
export default function PCBuilderReact({ catalog, initialSelection = {}, onBuildChange, onPartFocus }) {
  const host=useRef(null),instance=useRef(null);
  const callbacks=useRef({onBuildChange,onPartFocus});
  callbacks.current={onBuildChange,onPartFocus};
  const initial=useRef({catalog,selection:initialSelection});
  useEffect(()=>{
    instance.current=createPCBuilder(host.current,{
      ...initial.current,
      onChange:(build,meta)=>callbacks.current.onBuildChange?.(build,meta),
      onPartFocus:category=>callbacks.current.onPartFocus?.(category),
    });
    return ()=>{instance.current?.dispose();instance.current=null;};
  },[]);
  useEffect(()=>{instance.current?.setCatalog(catalog);},[catalog]);
  return <div ref={host} />;
}
