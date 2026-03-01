import { PlaywrightTestConfig } from '@playwright/test';
import merge from 'deepmerge';

import { loadConfigMeta } from './load-config-meta';
import { ProcessConstants } from './process-constants';

// Recursively apply the `Partial` type to all nested object types in the provided generic type
type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

interface CreateConfigOptions {
  /**
   * Directory to start searching for the Stencil config file.
   * Useful when the working directory differs from the test directory (e.g., VSCode Playwright extension).
   * Defaults to process.cwd().
   */
  cwd?: string;
}

/**
 * Helper function to easily create a Playwright config for Stencil projects. This function will
 * automatically load the Stencil config meta to set default values for the Playwright config respecting the
 * Stencil dev server configuration, and set the Stencil namespace and entry path as environment variables for use
 * in the Playwright tests.
 *
 * @param overrides Values to override in the default config. Any Playwright config option can be overridden.
 * @param options Additional options for config creation.
 * @returns A {@link PlaywrightTestConfig} object
 */
export const createConfig = async (
  overrides: DeepPartial<PlaywrightTestConfig> = {},
  options: CreateConfigOptions = {},
): Promise<PlaywrightTestConfig> => {
  const { webServerUrl, baseURL, stencilEntryPath, stencilNamespace } = await loadConfigMeta(options.cwd);

  // Set the Stencil namespace and entry path as environment variables so we can use them when constructing
  // the HTML `head` content in the `setContent` function. This is just an easy way for us to maintain some context
  // about the current Stencil project's configuration.
  process.env[ProcessConstants.STENCIL_NAMESPACE] = stencilNamespace;
  process.env[ProcessConstants.STENCIL_ENTRY_PATH] = stencilEntryPath;

  return merge<DeepPartial<PlaywrightTestConfig>>(
    {
      testMatch: '*.e2e.ts',
      use: {
        baseURL,
      },
      webServer: {
        command: 'NODE_ENV=test npx stencil build --dev --watch --serve --no-open --testing',
        url: webServerUrl,
        reuseExistingServer: !!!process.env.CI,
        // Max time to wait for dev server to start before aborting, defaults to 60000 (60 seconds)
        timeout: undefined,
        // Pipe the dev server output to the console
        // Gives visibility to the developer if the dev server fails to start
        stdout: 'pipe',
        // Run in the specified directory (needed for VSCode Playwright extension)
        cwd: options.cwd,
        env: {
          // Ensure we set the NODE_ENV to "test" when running the dev server, as some Stencil configs may rely on this environment variable to set different configuration values for testing
          NODE_ENV: 'test',
        },
      },
    },
    overrides,
  ) as PlaywrightTestConfig;
};
