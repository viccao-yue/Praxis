import { build } from 'esbuild';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const entry = new URL('../packages/plugins/vision/', import.meta.url);
const output = await build({
  entryPoints: [fileURLToPath(new URL('src/client.tsx', entry))],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-slots'],
});

await writeFile(
  new URL('dist/client.browser.js', entry),
  `window.__ModuleLoader__.load({id: "workdsh-plugin-vision", factory: function(require) { const module = {exports:{}};\n${output.outputFiles[0].text}\nreturn module.exports; }});\n`,
);
