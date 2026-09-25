export type PartCategory = 'cpu' | 'motherboard' | 'ram' | 'gpu' | 'storage' | 'psu' | 'case' | 'cooling'
export type BuilderSelection = Partial<Record<PartCategory, string>>
export type CatalogItem = { id: string; category: PartCategory; name: string; stock: number; price: number; specs?: string }
export type BuildSnapshot = { selection: BuilderSelection; parts: CatalogItem[]; total: number; selectedCount: number; complete: boolean }
export type BuilderInstance = {
  getBuild(): BuildSnapshot
  setCatalog(items: CatalogItem[]): void
  setSelection(selection: BuilderSelection): void
  focusPart(category: PartCategory): void
  resetView(): void
  setExploded(value: boolean): void
  dispose(): void
}
export function createPCBuilder(container: HTMLElement, options?: {
  catalog?: CatalogItem[]
  selection?: BuilderSelection
  currency?: string
  locale?: string
  reducedMotion?: boolean
  onChange?: (build: BuildSnapshot, meta: { reason: 'selection' | 'catalog' | 'external-selection' }) => void
  onPartFocus?: (category: PartCategory) => void
}): BuilderInstance
