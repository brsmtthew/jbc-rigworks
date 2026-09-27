import { readFile, access } from 'node:fs/promises'
import ts from 'typescript'

export async function resolve(specifier, context, next) {
  if (specifier === 'firebase/firestore')
    return { url: new URL('./memory-db.mjs', import.meta.url).href, shortCircuit: true }
  if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
    for (const extension of ['.ts', '.tsx']) {
      const url = new URL(specifier + extension, context.parentURL)
      try {
        await access(url)
        return { url: url.href, shortCircuit: true }
      } catch {
        /* Try the next extension. */
      }
    }
  }
  return next(specifier, context)
}
export async function load(url, context, next) {
  const memory = new URL('./memory-db.mjs', import.meta.url).href
  if (url.endsWith('/src/lib/database.ts') || url.endsWith('/src/hooks/useLiveData.ts'))
    return {
      format: 'module',
      shortCircuit: true,
      source: `export { recordRef, shopRef, firestoreData, useLiveCollection } from '${memory}'`,
    }
  if (url.endsWith('/src/lib/firebase.ts'))
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export const firebaseFirestore = {}; export const firebaseAuth = {}',
    }
  if (url.endsWith('/src/lib/preferences.ts'))
    return {
      format: 'module',
      shortCircuit: true,
      source: `export * from '${new URL('../../src/lib/shopSettings.ts', import.meta.url).href}'`,
    }
  if (/\.tsx?$/.test(url)) {
    const source = await readFile(new URL(url), 'utf8')
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    }
  }
  return next(url, context)
}
