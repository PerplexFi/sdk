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
    // minify: true,
    keepNames: true,
    outfile: packageJson.exports['.'].require,
});

// ESM
await esbuild.build({
    entryPoints: ['src/index.ts'],
    platform: 'node',
    format: 'esm',
    // minify: true,
    keepNames: true,
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
