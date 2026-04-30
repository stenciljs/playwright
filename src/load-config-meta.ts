// @ts-ignore - position of type import changed in Stencil 5
import { loadConfig, OutputTargetWww } from '@stencil/core/compiler';
import { findUp } from 'find-up';
import { existsSync } from 'fs';
import { isAbsolute, join, relative } from 'path';

/**
 * Common shape for output targets with dir and buildDir properties.
 * Used for dist (v4) and loader-bundle (v5) targets.
 */
interface OutputTargetWithDir {
  type: string;
  dir?: string;
  buildDir?: string;
}

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

    // Grab a suitable output target for script injection.
    // Priority: www > dist (v4) > loader-bundle (v5)
    const wwwTarget = outputTargets.find((o): o is OutputTargetWww => o.type === 'www');
    const distTarget = outputTargets.find((o) => o.type === 'dist') as OutputTargetWithDir | undefined;
    // loader-bundle is a v5 output target type, so we need to cast to avoid type errors on v4
    const loaderBundleTarget = outputTargets.find((o) => (o as OutputTargetWithDir).type === 'loader-bundle') as
      | OutputTargetWithDir
      | undefined;

    if (wwwTarget) {
      // Get path from dev-server root to www
      // If dir is relative, it's already relative to project root (same as devServer.root)
      const wwwDir = wwwTarget.dir!;
      const relativePath = isAbsolute(wwwDir) ? relative(devServer.root!, wwwDir) : wwwDir;

      // Use buildDir from config (defaults to 'build' for www target)
      const buildDir = (wwwTarget as unknown as { buildDir?: string }).buildDir ?? 'build';
      const entryPath = join(relativePath, buildDir, fsNamespace);
      stencilEntryPath = entryPath === '' ? '.' : entryPath.startsWith('.') ? entryPath : `./${entryPath}`;
    } else if (distTarget || loaderBundleTarget) {
      // Fall back to dist or loader-bundle target
      const target = distTarget ?? loaderBundleTarget!;

      // Get path from dev-server root to target dir
      // If dir is relative, it's already relative to project root (same as devServer.root)
      const targetDir = target.dir!;
      const relativePath = isAbsolute(targetDir) ? relative(devServer.root!, targetDir) : targetDir;

      // dist/loader-bundle use empty string as default buildDir
      // Path structure: dir/buildDir/namespace/namespace (extra namespace folder)
      const buildDir = target.buildDir ?? '';
      const entryPath = join(relativePath, buildDir, fsNamespace, fsNamespace);
      stencilEntryPath = entryPath === '' ? '.' : entryPath.startsWith('.') ? entryPath : `./${entryPath}`;
    } else {
      // Make a best guess at the entry path
      stencilEntryPath = `${DEFAULT_STENCIL_ENTRY_PATH_PREFIX}/${fsNamespace}`;

      console.warn(
        `No "www", "dist", or "loader-bundle" output target found in the Stencil config. Using default entry path: "${stencilEntryPath}". Tests using 'setContent' may fail to execute.`,
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
