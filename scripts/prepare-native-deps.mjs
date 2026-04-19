import { cpSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// better-sqlite3 + its runtime transitive deps (bindings → file-uri-to-path)
const nativeDeps = ['better-sqlite3', 'bindings', 'file-uri-to-path']

for (const dep of nativeDeps) {
  const src = join(root, 'node_modules', dep)
  const dst = join(root, 'server', 'node_modules', dep)
  mkdirSync(dst, { recursive: true })
  cpSync(src, dst, { recursive: true })
  console.log(`copied ${dep} → server/node_modules/${dep}`)
}
