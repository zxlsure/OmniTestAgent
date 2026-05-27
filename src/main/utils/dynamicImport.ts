/**
 * Workaround: tsc compiles import() to require(), which is incompatible with ESM-only packages
 * (e.g., electron-store, openai). Using new Function() prevents tsc from downleveling the
 * dynamic import, preserving the native import() at runtime. This is a known TypeScript issue
 * when targeting CommonJS while some dependencies only ship ESM.
 */
export async function dynamicImport<T = { default: any }>(modulePath: string): Promise<T> {
  const importer = new Function('module', 'return import(module)') as (m: string) => Promise<T>
  return importer(modulePath)
}
