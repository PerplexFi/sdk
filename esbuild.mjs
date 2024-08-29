import { readFileSync } from 'node:fs';
import * as esbuild from 'esbuild';

const packageJson = JSON.parse(readFileSync('./package.json'));

// CJS
await esbuild.build({
    entryPoints: ['src/index.ts'],
    platform: 'node',
    format: 'cjs',
    external: Object.keys(packageJson.dependencies),
    bundle: true,
    outfile: packageJson.exports['.'].require,
});

// ESM
await esbuild.build({
    entryPoints: ['src/index.ts'],
    platform: 'node',
    format: 'esm',
    external: Object.keys(packageJson.dependencies),
    bundle: true,
    outfile: packageJson.exports['.'].import,
});

// Browser ESM
await esbuild.build({
    entryPoints: ['src/index.ts'],
    platform: 'browser',
    format: 'esm',
    bundle: true,
    minify: false,
    outfile: packageJson.exports['.'].browser,
});
