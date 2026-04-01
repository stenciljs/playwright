// @ts-ignore - position of type import changed in Stencil 5
import { loadConfig, OutputTargetWww } from '@stencil/core/compiler';
import { findUp } from 'find-up';
import { existsSync } from 'fs';
import { relative } from 'path';

const DEFAULT_NAMESPACE = 'app';
const DEFAULT_BASE_URL = 'http://localhost:3333';
const DEFAULT_WEB_SERVER_URL = `${DEFAULT_BASE_URL}/ping`;

const DEFAULT_STENCIL_ENTRY_PATH_PREFIX = './build';
const DEFAULT_STENCIL_ENTRY_PATH = `${DEFAULT_STENCIL_ENTRY_PATH_PREFIX}/${DEFAULT_NAMESPACE}`;

/**
 * For internal use only.
 *
 * Loads and validates the project's Stencil config.
 *
 * @param cwd - Optional directory to start searching from. Defaults to process.cwd().
 * @returns The processed Stencil config metadata.
 */
export const loadConfigMeta = async (cwd?: string) => {
  let baseURL = DEFAULT_BASE_URL;
  let webServerUrl = DEFAULT_WEB_SERVER_URL;
  let stencilNamespace = DEFAULT_NAMESPACE;
  let stencilEntryPath = DEFAULT_STENCIL_ENTRY_PATH;

  // Find the Stencil config file in either the current directory, or the nearest ancestor directory.
  // This allows for the Playwright config to exist in a different directory than the Stencil config.
  const stencilConfigPath = await findUp(['stencil.config.ts', 'stencil.config.js'], { cwd });

  // Only load the Stencil config if the user has created one
  if (stencilConfigPath && existsSync(stencilConfigPath)) {
    const { devServer, fsNamespace, outputTargets } = (await loadConfig({ configPath: stencilConfigPath })).config;

    // Grab the WWW output target. If one doesn't exist, we'll throw a warning and roll
    // with the default value for the entry path.
    const wwwTarget = outputTargets.find((o): o is OutputTargetWww => o.type === 'www');
    if (wwwTarget) {
      // Get path from dev-server root to www
      let relativePath = relative(devServer.root!, wwwTarget.dir!);
      relativePath = relativePath === '' ? '.' : relativePath;
      if (!relativePath.startsWith('.')) {
        relativePath = `./${relativePath}`;
      }

      stencilEntryPath = `${relativePath}/build/${fsNamespace}`;
    } else {
      // Make a best guess at the entry path
      stencilEntryPath = `${DEFAULT_STENCIL_ENTRY_PATH_PREFIX}/${fsNamespace}`;

      console.warn(
        `No "www" output target found in the Stencil config. Using default entry path: "${stencilEntryPath}". Tests using 'setContent' may fail to execute.`,
      );
    }

    baseURL = `${devServer.protocol}://${devServer.address}:${devServer.port}`;
    webServerUrl = `${baseURL}${devServer.pingRoute ?? ''}`;
    stencilNamespace = fsNamespace;
  } else {
    const msg = stencilConfigPath
      ? `Unable to find your project's Stencil configuration file, starting from '${stencilConfigPath}'. Falling back to defaults.`
      : `No Stencil config file was found matching the glob 'stencil.config.{ts,js}' in the current or parent directories. Falling back to defaults.`;

    console.warn(msg);
  }

  return {
    baseURL,
    webServerUrl,
    stencilNamespace,
    stencilEntryPath,
  };
};
