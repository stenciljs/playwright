import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'TestAssetsGlobalStyle',
  outputTargets: [
    {
      type: 'dist',
      dir: 'dist/loader-bundle',
    },
  ],
};
