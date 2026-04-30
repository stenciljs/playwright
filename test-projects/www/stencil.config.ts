import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'TestApp',
  devServer: {
    port: 3335,
  },
  outputTargets: [{ type: 'www', serviceWorker: null }],
};
