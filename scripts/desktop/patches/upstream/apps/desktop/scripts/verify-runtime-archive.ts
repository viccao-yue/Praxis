/** Verify runtime bytes and executable permissions using ASAR records and physical unpacked files. */
import { createHash } from 'node:crypto'
import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readAsar, type Node } from 'app-builder-lib/out/asar/asar.js'
import type { DesktopRuntimeDescriptor, DesktopRuntimeFile } from '../src/runtime-tree.ts'

/**
 * Compare the complete archived dsh tree with the sealed preparation inventory.
 * @param archivePath - Application ASAR file beside its unpacked directory.
 * @param expected - Verified preparation descriptor, including its complete file inventory.
 * @returns Resolves when bytes, file membership and meaningful executable permissions match.
 */
export async function verifyRuntimeArchive(archivePath: string, expected: DesktopRuntimeDescriptor): Promise<void> {
  const archive = await readAsar(archivePath)
  const descriptor = await archive.readFile(join('dsh', 'desktop-runtime.json'))
  if (!descriptor.equals(Buffer.from(`${JSON.stringify(expected, undefined, 2)}\n`))) {
    throw new Error('desktop runtime: archived descriptor differs from preparation')
  }
  const files: DesktopRuntimeFile[] = []
  const unpacked = new Set<string>()
  async function visit(node: Node, path: string): Promise<void> {
    if (node.link !== undefined) throw new Error(`desktop runtime: unexpected ASAR link ${path}`)
    if (node.files !== undefined) {
      for (const [name, child] of Object.entries(node.files)) await visit(child, path === '' ? name : `${path}/${name}`)
      return
    }
    const name = join('dsh', ...path.split('/'))
    const physical = node.unpacked === true ? await lstat(join(`${archivePath}.unpacked`, name)) : undefined
    if (physical !== undefined && !physical.isFile()) throw new Error(`desktop runtime: unexpected unpacked entry ${path}`)
    if (node.unpacked === true) unpacked.add(join(`${archivePath}.unpacked`, name))
    if (path === 'desktop-runtime.json') return
    const body = await archive.readFile(name)
    // ASAR stores only owner-execute; group/other-only executable files fail the inventory comparison.
    const executable = process.platform !== 'win32' && (physical !== undefined
      ? (physical.mode & 0o111) !== 0
      : node.executable === true)
    files.push({ path, bytes: body.byteLength, sha256: createHash('sha256').update(body).digest('hex'), executable })
  }
  await visit(archive.getFile('dsh', false), '')
  const entries = await readdir(join(`${archivePath}.unpacked`, 'dsh'), { recursive: true, withFileTypes: true })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT' && unpacked.size === 0) return []
      throw error
    })
  for (const entry of entries) {
    if (entry.isDirectory()) continue
    const path = join(entry.parentPath, entry.name)
    if (!entry.isFile() || !unpacked.has(path)) throw new Error(`desktop runtime: unexpected unpacked entry ${path}`)
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  if (JSON.stringify(files) !== JSON.stringify(expected.files)) {
    // WORKDSH TEST PATCH: electron-builder drops empty .gitkeep files from the ASAR.
    // Those placeholders are not runtime bytes. Any other membership or hash drift still fails.
    const actual = new Map(files.map(file => [file.path, `${file.bytes}:${file.sha256}:${file.executable}`]))
    const wanted = new Map(expected.files.map(file => [file.path, `${file.bytes}:${file.sha256}:${file.executable}`]))
    const missing = [...wanted.keys()].filter(path => !actual.has(path))
    const extra = [...actual.keys()].filter(path => !wanted.has(path))
    const changed = [...wanted.keys()].filter(path => actual.has(path) && actual.get(path) !== wanted.get(path))
    const emptyGitkeep = missing.length > 0 && extra.length === 0 && changed.length === 0
      && missing.every(path => path.endsWith('/.gitkeep') && wanted.get(path)?.startsWith('0:'))
    if (!emptyGitkeep) {
      const sample = [...missing, ...extra, ...changed].slice(0, 8).join(', ')
      throw new Error(`desktop runtime: ASAR integrity verification failed; missing=${missing.length} extra=${extra.length} changed=${changed.length}${sample === '' ? '' : `: ${sample}`}`)
    }
  }
}
