import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfigMeta } from '../load-config-meta';

const stencilConfig: {
  rootDir: string;
  fsNamespace: string;
  devServer: {
    protocol: string;
    address: string;
    port: number;
    pingRoute: string;
    root: string;
  };
  outputTargets: Array<{ type: string; dir: string; buildDir?: string }>;
} = {
  rootDir: '/mock-path',
  fsNamespace: 'mock-namespace',
  devServer: {
    protocol: 'http',
    address: 'localhost',
    port: 4444,
    pingRoute: '/status',
    root: '/mock-path',
  },
  outputTargets: [
    {
      type: 'www',
      dir: '/mock-path/www',
    },
  ],
};

const findUpMock = vi.fn();
vi.mock('find-up', () => ({
  findUp: () => findUpMock(),
}));

const loadConfigMock = vi.fn();
vi.mock('@stencil/core/compiler', () => ({
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
}));

describe('loadConfigMeta', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Most tests just want a successfully-resolved config - override per-test for failure cases.
    loadConfigMock.mockResolvedValue({ config: stencilConfig, diagnostics: [] });
  });

  it('should fall back to defaults when the resolved config has an error diagnostic', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');
    loadConfigMock.mockResolvedValueOnce({
      config: null,
      diagnostics: [{ level: 'error', messageText: 'boom' }],
    });

    const configMeta = await loadConfigMeta();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Unable to load your project's Stencil configuration file at '/mock-path/stencil.config.ts'. Falling back to defaults.",
    );
    expect(configMeta).toEqual({
      baseURL: 'http://localhost:3333',
      stencilEntryPath: './build/app',
      stencilNamespace: 'app',
      webServerUrl: 'http://localhost:3333/ping',
    });
  });

  it('should use the validated Stencil config values', async () => {
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');

    const configMeta = await loadConfigMeta();

    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './www/build/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });

  it('should resolve "zero-config" (v5) defaults when no stencil.config.ts/.js is found', async () => {
    // No config file on disk - findUp comes back empty, but loadConfig() still resolves
    // (namespace from package.json, default "loader-bundle" output target, etc).
    findUpMock.mockResolvedValueOnce(undefined);

    const configMeta = await loadConfigMeta();

    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './www/build/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });

  it('should log a warning if no Stencil configuration could be resolved at all', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    findUpMock.mockResolvedValueOnce(undefined);
    loadConfigMock.mockResolvedValueOnce({ config: null, diagnostics: [] });

    const configMeta = await loadConfigMeta();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Unable to resolve a Stencil configuration for this project. Falling back to defaults.',
    );
    expect(configMeta).toEqual({
      baseURL: 'http://localhost:3333',
      stencilEntryPath: './build/app',
      stencilNamespace: 'app',
      webServerUrl: 'http://localhost:3333/ping',
    });
  });

  it('should log a warning if no supported output target is found', async () => {
    stencilConfig.outputTargets = [];
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const configMeta = await loadConfigMeta();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `No "www", "dist", or "loader-bundle" output target found in the Stencil config. Using default entry path: "./build/mock-namespace". Tests using 'setContent' may fail to execute.`,
    );
    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './build/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });

  it('should use www target with custom buildDir', async () => {
    stencilConfig.outputTargets = [
      {
        type: 'www',
        dir: '/mock-path/www',
        buildDir: 'custom-build',
      },
    ];
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');

    const configMeta = await loadConfigMeta();

    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './www/custom-build/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });

  it('should fall back to dist target when www is not available', async () => {
    stencilConfig.outputTargets = [
      {
        type: 'dist',
        dir: '/mock-path/dist',
      },
    ];
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');

    const configMeta = await loadConfigMeta();

    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './dist/mock-namespace/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });

  it('should fall back to loader-bundle target when www and dist are not available', async () => {
    stencilConfig.outputTargets = [
      {
        type: 'loader-bundle',
        dir: '/mock-path/dist/loader-bundle',
      },
    ];
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');

    const configMeta = await loadConfigMeta();

    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './dist/loader-bundle/mock-namespace/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });

  it('should prefer www target over dist and loader-bundle', async () => {
    stencilConfig.outputTargets = [
      {
        type: 'dist',
        dir: '/mock-path/dist',
      },
      {
        type: 'www',
        dir: '/mock-path/www',
      },
      {
        type: 'loader-bundle',
        dir: '/mock-path/dist/loader-bundle',
      },
    ];
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');

    const configMeta = await loadConfigMeta();

    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './www/build/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });

  it('should prefer dist target over loader-bundle', async () => {
    stencilConfig.outputTargets = [
      {
        type: 'loader-bundle',
        dir: '/mock-path/dist/loader-bundle',
      },
      {
        type: 'dist',
        dir: '/mock-path/dist',
      },
    ];
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');

    const configMeta = await loadConfigMeta();

    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './dist/mock-namespace/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });

  it('should handle loader-bundle target with relative dir path', async () => {
    stencilConfig.outputTargets = [
      {
        type: 'loader-bundle',
        dir: 'dist/loader-bundle', // relative path, not absolute
      },
    ];
    findUpMock.mockResolvedValueOnce('/mock-path/stencil.config.ts');

    const configMeta = await loadConfigMeta();

    expect(configMeta).toEqual({
      baseURL: 'http://localhost:4444',
      stencilEntryPath: './dist/loader-bundle/mock-namespace/mock-namespace',
      stencilNamespace: 'mock-namespace',
      webServerUrl: 'http://localhost:4444/status',
    });
  });
});
