import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? filesIn(file) : [file]
  })
}

test('application imports resolve, remain reachable, and have no runtime cycles', () => {
  const files = filesIn(path.join(root, 'src')).filter(
    (file) => /\.(tsx?|js)$/.test(file) && !file.endsWith('.d.ts'),
  )
  const graph = new Map()
  const referenced = new Set()
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    )
    const edges = []
    function add(specifier, runtime = true) {
      if (!specifier.startsWith('.')) return
      const base = path.resolve(path.dirname(file), specifier)
      const target = [base, base + '.ts', base + '.tsx', base + '.js'].find(
        (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
      )
      assert.ok(target, `Unresolved ${specifier} in ${path.relative(root, file)}`)
      referenced.add(target)
      if (runtime && /\.(tsx?|js)$/.test(target)) edges.push(target)
    }
    function inspect(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const bindings = node.importClause?.namedBindings
        const onlyTypes =
          node.isTypeOnly ||
          node.importClause?.isTypeOnly ||
          (bindings &&
            ts.isNamedImports(bindings) &&
            !node.importClause.name &&
            bindings.elements.every((element) => element.isTypeOnly))
        add(node.moduleSpecifier.text, !onlyTypes)
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteral(node.arguments[0])
      )
        add(node.arguments[0].text)
      ts.forEachChild(node, inspect)
    }
    inspect(source)
    graph.set(file, edges)
  }
  const complete = new Set()
  const stack = []
  function traverse(file) {
    assert.ok(
      !stack.includes(file),
      `Runtime cycle: ${[...stack, file].map((item) => path.relative(root, item)).join(' -> ')}`,
    )
    if (complete.has(file)) return
    stack.push(file)
    for (const edge of graph.get(file) ?? []) traverse(edge)
    stack.pop()
    complete.add(file)
  }
  traverse(path.join(root, 'src/main.tsx'))
  for (const file of files) {
    // Type-only contracts need a consumer, but are erased from the runtime graph.
    assert.ok(
      complete.has(file) || (referenced.has(file) && !graph.get(file)?.length),
      `Unreachable source: ${path.relative(root, file)}`,
    )
  }
})
