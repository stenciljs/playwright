import * as esbuild from 'esbuild';

async function build() {
  const baseOptions: esbuild.BuildOptions = {
    bundle: true,
    entryPoints: ['src/index.ts'],
    external: ['@playwright/test', '@stencil/core'],
    platform: 'node',
    sourcemap: 'linked',
    target: 'node22',
  };

  await Promise.all([
    esbuild.build({
      ...baseOptions,
      outfile: 'dist/index.js',
      format: 'esm',
    }),
    esbuild.build({
      ...baseOptions,
      entryPoints: ['src/wizard.ts'],
      external: [...baseOptions.external!, '@stencil/cli'],
      outfile: 'dist/wizard.js',
      format: 'esm',
    }),
  ]);
}

build();
