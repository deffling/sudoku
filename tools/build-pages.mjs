import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] || path.join(root, 'dist'));
const buildId = process.env.GITHUB_SHA || 'local';

if (output === root || !/^(local|[0-9a-f]{7,40})$/i.test(buildId)) {
  throw new Error('Expected a release commit SHA and an output directory outside the source root.');
}

await mkdir(output, { recursive: true });
for (const file of ['index.html', 'manifest.webmanifest']) {
  await cp(path.join(root, file), path.join(output, file));
}
await cp(path.join(root, 'icons'), path.join(output, 'icons'), { recursive: true });

for (const file of ['sudoku.html', 'sw.js']) {
  const source = await readFile(path.join(root, file), 'utf8');
  const stamped = source.replaceAll('@@BUILD_ID@@', buildId);
  if (stamped === source || stamped.includes('@@BUILD_ID@@')) {
    throw new Error(`Failed to inject the build ID into ${file}.`);
  }
  await writeFile(path.join(output, file), stamped);
}

console.log(`Built Sudoku ${buildId.slice(0, 7)} in ${output}`);
