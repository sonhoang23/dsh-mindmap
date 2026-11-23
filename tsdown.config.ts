/**
 * DSH Mindmap: host ESM plus one browser-safe CJS module-loader factory.
 * The DSH client loader can require only its registered module table;
 * Node builtins are never an allowed client external.
 */
import { builtinModules, createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import type { UserConfig } from 'tsdown'

const ID = 'dsh-mindmap'
const EXTERNALS = ['react', 'react/jsx-runtime', '@deepseek-ai/cordis']
const BROWSER_PROCESS = '\0dsh-mindmap:browser-process'
const VFILE_FALLBACK_PREFIX = '\0dsh-mindmap:vfile-browser:'
const require = createRequire(import.meta.url)
const VFILE_BROWSER_IMPORTS: Record<string, string> = {
  '#minpath': 'minpath.browser.js',
  '#minproc': 'minproc.browser.js',
  '#minurl': 'minurl.browser.js',
}
const NODE_BUILTINS = new Set([...builtinModules, ...builtinModules.map(name => 'node:' + name)])

/**
 * Markdown tooling may use node:process solely to discover environment flags.
 * In the web bundle that must resolve to a local browser implementation,
 * never the DSH module table. Any other Node builtin is a build error.
 */
// tsdown's plugins option is a union, not an indexable array.
// Match the type used by Better Sidebar's tested build plugins.
function clientBoundary(): NonNullable<UserConfig['plugins']> {
  return {
    name: 'dsh-mindmap-browser-boundary',
    resolveId(source: string, importer: string | undefined) {
      const normalizedImporter = importer?.replaceAll('\\', '/')
      // If Rolldown resolves the package's conditional #min* before our
      // hook sees them, we may be handed the import from the Node-only shim.
      // Redirect that exact vfile import back to its upstream browser module.
      if (normalizedImporter?.endsWith('/vfile/lib/minurl.js') && source === 'node:url') {
        return VFILE_FALLBACK_PREFIX + 'url:' + encodeURIComponent(resolve(dirname(importer!), 'minurl.browser.js'))
      }
      if (normalizedImporter?.endsWith('/vfile/lib/minpath.js') && source === 'node:path') {
        return VFILE_FALLBACK_PREFIX + 'path:' + encodeURIComponent(resolve(dirname(importer!), 'minpath.browser.js'))
      }

      // vfile publishes #minpath/#minproc/#minurl with "node" and "default"
      // conditions. The DSH CJS bundler may still activate "node" even
      // with browser-first resolution, so select the upstream browser files
      // explicitly, scoped to imports FROM vfile itself.
      if (Object.hasOwn(VFILE_BROWSER_IMPORTS, source)
        && importer?.replaceAll('\\', '/').includes('/vfile/lib/')) {
        return resolve(dirname(importer), VFILE_BROWSER_IMPORTS[source])
      }

      if (source === 'process' || source === 'node:process') return BROWSER_PROCESS

      // Use the maintained browser-compatible Buffer implementation.
      // "buffer" is a Node builtin, so do not let the loader externalize it.
      if (source === 'buffer' || source === 'node:buffer') {
        return require.resolve('buffer/')
      }
      if (NODE_BUILTINS.has(source)) {
        throw new Error(
          'dsh-mindmap browser bundle imports Node builtin "' + source
          + '". Use the dependency browser entry or implement a reviewed browser alternative.',
        )
      }
      if (source.startsWith('@deepseek-ai/') && !EXTERNALS.includes(source)) {
        throw new Error('dsh-mindmap browser bundle imports a DSH module outside the client module table: ' + source)
      }
      return null
    },
    load(id: string) {
      if (id.startsWith(VFILE_FALLBACK_PREFIX)) {
        const target = id.slice(VFILE_FALLBACK_PREFIX.length)
        const divider = target.indexOf(':')
        const kind = target.slice(0, divider)
        const browserFile = decodeURIComponent(target.slice(divider + 1))
        return kind === 'url'
          ? 'export { urlToPath as fileURLToPath } from ' + JSON.stringify(browserFile) + ';'
          : 'export { minpath as default } from ' + JSON.stringify(browserFile) + ';'
      }
      if (id !== BROWSER_PROCESS) return null
      return [
        'const env = Object.freeze({ NODE_ENV: "production" });',
        'const browser = true;',
        'const argv = [];',
        'const versions = Object.freeze({});',
        'const platform = "browser";',
        'const cwd = () => "/";',
        'const nextTick = (fn, ...args) => queueMicrotask(() => fn(...args));',
        'const process = Object.freeze({ env, browser, argv, versions, platform, cwd, nextTick });',
        'export { env, browser, argv, versions, platform, cwd, nextTick };',
        'export default process;',
      ].join('\n')
    },
  }
}

const host: UserConfig = {
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  dts: true,
  clean: true,
  outputOptions: { entryFileNames: '[name].js' },
}

const client: UserConfig = {
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  dts: false,
  clean: false,
  minify: true,
  sourcemap: false,
  deps: {
    neverBundle: EXTERNALS,
    alwaysBundle: (id: string) => !EXTERNALS.includes(id),
  },
  // CJS output otherwise picks Node conditional exports from transitive
  // packages. Better Sidebar uses this same browser-first ordering.
  inputOptions: {
    resolve: {
      conditionNames: ['browser', 'import', 'default'],
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  plugins: [clientBoundary()],
  outputOptions: {
    codeSplitting: false,
    entryFileNames: 'client.js',
    // These are executable JS wrappers (not comments). Rolldown may strip
    // banner/footer while minifying; postBanner/postFooter run AFTER minify
    // so DSH always receives the registration function and exact package ID.
    postBanner: 'window.__ModuleLoader__.load({ id: ' + JSON.stringify(ID) + ', factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    postFooter: 'return module.exports; } });',
  },
}

export default [host, client]
