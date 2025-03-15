import { spawn } from 'child_process';
import { readFile } from 'fs/promises';

async function main() {
  const proc = spawn('npx', [
    'attw',
    '-f',
    'table-flipped',
    '--no-emoji',
    '--no-color',
    '--pack',
  ]);

  let stdout = '';
  proc.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  await new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });

  const text = stdout;

  const entrypointLines = text
    .slice(text.indexOf('"remix-i18next/'))
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.includes('─'))
    .map((line) =>
      line
        .replaceAll(/[^\d "()/A-Za-z│-]/g, '')
        .replaceAll('90m│39m', '│')
        .replaceAll(/^│/g, '')
        .replaceAll(/│$/g, ''),
    );

  const pkgContent = await readFile('package.json', 'utf-8');
  const pkg = JSON.parse(pkgContent);
  
  const entrypoints = entrypointLines.map((entrypointLine) => {
    const [entrypoint, ...resolutionColumns] = entrypointLine.split('│');
    if (!entrypoint) throw new Error('Entrypoint not found');
    if (!resolutionColumns[2]) throw new Error('ESM resolution not found');
    if (!resolutionColumns[3]) throw new Error('Bundler resolution not found');
    return {
      entrypoint: entrypoint.replace(pkg.name, '.').trim(),
      esm: resolutionColumns[2].trim(),
      bundler: resolutionColumns[3].trim(),
    };
  });

  const entrypointsWithProblems = entrypoints.filter(
    (item) => item.esm.includes('fail') || item.bundler.includes('fail'),
  );

  if (entrypointsWithProblems.length > 0) {
    console.error('Entrypoints with problems:');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 