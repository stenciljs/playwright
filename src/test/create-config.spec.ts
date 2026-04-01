import { describe, expect, it, vi } from 'vitest';

import { createConfig } from '../create-config';

// Mock the loadConfigMeta function to just return the default values
vi.mock('../load-config-meta', () => ({
  loadConfigMeta: () => ({
    baseURL: 'http://localhost:3333',
    webServerUrl: 'http://localhost:3333/ping',
    stencilNamespace: 'app',
    stencilEntryPath: './build/app',
  }),
}));

describe('createConfig', () => {
  it('should create a default config', async () => {
    const config = await createConfig();

    expect(config).toEqual({
      testMatch: '*.e2e.ts',
      use: {
        baseURL: 'http://localhost:3333',
      },
      webServer: {
        command: 'stencil build --dev --watch --serve --no-open --testing',
        cwd: undefined,
        url: 'http://localhost:3333/ping',
        reuseExistingServer: !process.env.CI,
        timeout: undefined,
        stdout: 'pipe',
      },
    });
  });

  it('should override the default config', async () => {
    const config = await createConfig({
      webServer: {
        port: 4444,
      },
      testDir: 'tests/e2e',
    });

    expect(config).toEqual({
      testMatch: '*.e2e.ts',
      testDir: 'tests/e2e',
      use: {
        baseURL: 'http://localhost:3333',
      },
      webServer: {
        command: 'stencil build --dev --watch --serve --no-open --testing',
        cwd: undefined,
        url: 'http://localhost:3333/ping',
        reuseExistingServer: !process.env.CI,
        timeout: undefined,
        port: 4444,
        stdout: 'pipe',
      },
    });
  });
});
