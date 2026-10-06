import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const banned = ['pyl-', 'right-door', 'fortune', 'Fortune', 'debtrenegociation1', 'invest', 'boost']
const textExt = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.txt', '.map'])

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path, out)
    else out.push(path)
  }
  return out
}

const files = await walk('dist')
const hits = []
for (const file of files) {
  const buf = await readFile(file)
  const text = textExt.has(extname(file)) ? buf.toString('utf8') : buf.toString('latin1')
  for (const word of banned) {
    if (text.includes(word)) hits.push(`${file}: ${word}`)
  }
}
if (hits.length) {
  console.error(hits.join('\n'))
  process.exit(1)
}
console.log(`forbid ok (${files.length} files)`)
