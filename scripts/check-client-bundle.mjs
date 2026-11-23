/**
 * Validate the browser artifact that DSH really executes.
 *
 * Rolldown can drop executable banner/footer code when minifying. Looking for
 * a string such as '"dsh-mindmap"' in a bundle does not prove that the module
 * registered; execute the top-level script in an isolated context with a fake
 * DSH loader and inspect the actual registration.
 */
import { readFile } from 'node:fs/promises'
import { Script } from 'node:vm'

const clientUrl = new URL('../lib/client.js', import.meta.url)
const code = await readFile(clientUrl, 'utf8')
const EXPECTED_ID = 'dsh-mindmap'
const allowed = new Set(['react', 'react/jsx-runtime', '@deepseek-ai/cordis'])

const requires = [...code.matchAll(/\brequire\s*\(\s*(['"])([^'"\\]+)\1\s*\)/g)]
  .map(match => match[2])
const forbidden = [...new Set(requires.filter(name => !allowed.has(name)))]
const nodeSpecifiers = [...new Set(
  [...code.matchAll(/['"](node:[a-z][\w/-]*)['"]/gi)].map(match => match[1]),
)]

const failures = []

// Guard the exact regression seen in v0.1.4: the DSH registration was
// present, but its factory threw "ReferenceError: module is not defined".
// The post-minify wrapper must initialize CommonJS locals BEFORE bundled
// code executes. An intro injected pre-minification is not sufficient.
const cjsFactoryPrefix = /^\s*window\.__ModuleLoader__\.load\(\{\s*id:\s*["']dsh-mindmap["']\s*,\s*factory:\s*\(require\)\s*=>\s*\{\s*var module\s*=\s*\{\s*exports:\s*\{\s*\}\s*\}\s*;\s*var exports\s*=\s*module\.exports\s*;/
if (!cjsFactoryPrefix.test(code)) {
  failures.push('DSH factory must initialize module and exports inside the post-minify wrapper')
}

if (forbidden.length) failures.push('unregistered require() modules: ' + forbidden.join(', '))
if (nodeSpecifiers.length) failures.push('Node.js specifiers still bundled: ' + nodeSpecifiers.join(', '))

// This runs the module-loader wrapper, not its factory. With a correct
// postBanner/postFooter, all bundled library code remains inside the
// uninvoked factory and cannot access the audit process.
const registrations = []
try {
  new Script(code, { filename: 'lib/client.js' }).runInNewContext({
    window: {
      __ModuleLoader__: {
        load: (entry) => registrations.push(entry),
      },
    },
  }, { timeout: 3000 })
} catch (error) {
  failures.push('bundle cannot register in an isolated browser loader: ' + String(error))
}

if (registrations.length !== 1) {
  failures.push('expected one DSH module registration; got ' + registrations.length)
} else {
  const entry = registrations[0]
  if (entry?.id !== EXPECTED_ID) {
    failures.push('wrong DSH client module id: ' + String(entry?.id))
  }
  if (typeof entry?.factory !== 'function') {
    failures.push('DSH client registration has no factory function')
  }
}

if (failures.length) {
  console.error('[dsh-mindmap] browser bundle rejected:\n' + failures.map(f => ' - ' + f).join('\n'))
  process.exitCode = 1
} else {
  console.log('[dsh-mindmap] browser bundle verified: id=' + EXPECTED_ID + ', one valid factory, no Node builtins or unregistered module-table imports')
}
