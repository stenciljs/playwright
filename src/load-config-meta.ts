// @ts-ignore - position of type import changed in Stencil 5
import { loadConfig, OutputTargetWww } from '@stencil/core/compiler';
import { findUp } from 'find-up';
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

  // Always attempt to load a config, even if no stencil.config.ts/.js was found - a v5 "zero-config"
  // project has neither, and Stencil's own loadConfig() already knows how to resolve sensible
  // defaults for that case (namespace from package.json, "loader-bundle" output target, etc).
  const results = await loadConfig({ configPath: stencilConfigPath ?? undefined });

  if (results.config && !results.diagnostics.some((d) => d.level === 'error')) {
    const { devServer, fsNamespace, outputTargets, rootDir: resolvedRootDir } = results.config;

    // Grab a suitable output target for script injection.
    // Priority: www > dist (v4) > loader-bundle (v5)
    const wwwTarget = outputTargets.find((o): o is OutputTargetWww => o.type === 'www');
    const distTarget = outputTargets.find((o) => (o as OutputTargetWithDir).type === 'dist') as
      OutputTargetWithDir | undefined;
    // loader-bundle is a v5 output target type, so we need to cast to avoid type errors on v4
    const loaderBundleTarget = outputTargets.find((o) => (o as OutputTargetWithDir).type === 'loader-bundle') as
      OutputTargetWithDir | undefined;

    // Use the resolved project rootDir as fallback if devServer.root is not usable
    const rootDir = devServer.root && devServer.root !== '/' ? devServer.root : resolvedRootDir;

    if (wwwTarget) {
      // Get path from dev-server root to www
      const wwwDir = wwwTarget.dir!;
      const relativePath = isAbsolute(wwwDir) ? relative(rootDir, wwwDir) : wwwDir;

      // Use buildDir from config (defaults to 'build' for www target)
      // Stencil may resolve buildDir to absolute path, so we need to handle that
      let buildDir = (wwwTarget as unknown as { buildDir?: string }).buildDir ?? 'build';
      if (buildDir && isAbsolute(buildDir)) {
        buildDir = buildDir === wwwDir ? '' : relative(wwwDir, buildDir);
      }

      const entryPath = join(relativePath, buildDir, fsNamespace);
      stencilEntryPath = entryPath === '' ? '.' : entryPath.startsWith('.') ? entryPath : `./${entryPath}`;
    } else if (distTarget || loaderBundleTarget) {
      // Fall back to dist or loader-bundle target
      const target = distTarget ?? loaderBundleTarget!;

      // Get path from dev-server root to target dir
      const targetDir = target.dir!;
      const relativePath = isAbsolute(targetDir) ? relative(rootDir, targetDir) : targetDir;

      // dist/loader-bundle use empty string as default buildDir
      // Stencil may resolve buildDir to absolute path, so we need to handle that
      let buildDir = target.buildDir ?? '';
      if (buildDir && isAbsolute(buildDir)) {
        // If buildDir is absolute, compute relative path from targetDir
        // If buildDir equals targetDir, use empty string (no subdirectory)
        buildDir = buildDir === targetDir ? '' : relative(targetDir, buildDir);
      }

      // Path structure: dir/buildDir/namespace/namespace (extra namespace folder)
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
      ? `Unable to load your project's Stencil configuration file at '${stencilConfigPath}'. Falling back to defaults.`
      : `Unable to resolve a Stencil configuration for this project. Falling back to defaults.`;

    console.warn(msg);
  }

  return {
    baseURL,
    webServerUrl,
    stencilNamespace,
    stencilEntryPath,
  };
};
