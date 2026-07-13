import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ProjectConfig, StencilWizardPlugin, WizardContext } from '@stencil/cli';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks for a "www" or "loader-bundle" output target.
 * @param config The resolved Stencil project config.
 * @returns Whether a "www" and/or "loader-bundle" output target is present.
 */
function detectOutputTargets(config: ProjectConfig) {
  const outputs = config.outputTargets as ReadonlyArray<{ type: string }>;
  const www = outputs.some((o) => o.type === 'www');
  const loaderBundle = outputs.some((o) => o.type === 'loader-bundle');
  return { www, loaderBundle };
}

const PLAYWRIGHT_CONFIG_TEMPLATE = `import { expect } from '@playwright/test';
import { matchers, createConfig } from '@stencil/playwright';

// Add custom Stencil matchers to Playwright assertions
expect.extend(matchers);

export default createConfig({
  // Overwrite Playwright config options here
});
`;

function e2eSpecTemplate(tagName: string): string {
  return `import { expect } from '@playwright/test';
import { test } from '@stencil/playwright';

test.describe('${tagName}', () => {
  test('renders', async ({ page }) => {
    await page.setContent('<${tagName}></${tagName}>');

    const el = page.locator('${tagName}');
    await expect(el).toBeAttached();
  });
});
`;
}

/**
 * Adds "ESNext.Disposable" to tsconfig.json's `lib` array, required for the dev server build.
 * @param rootDir Absolute path to the project root.
 */
async function ensureDisposableLib(rootDir: string): Promise<void> {
  const tsconfigPath = join(rootDir, 'tsconfig.json');
  if (!(await fileExists(tsconfigPath))) return;

  try {
    const tsconfig = JSON.parse(await readFile(tsconfigPath, 'utf8')) as {
      compilerOptions?: { lib?: string[] };
    };
    const lib = tsconfig.compilerOptions?.lib ?? [];
    if (lib.some((l) => l.toLowerCase() === 'esnext.disposable')) return;

    tsconfig.compilerOptions ??= {};
    tsconfig.compilerOptions.lib = [...lib, 'ESNext.Disposable'];
    await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n', 'utf8');
  } catch {
    // Malformed / unreadable tsconfig.json - leave it for the user to update manually.
  }
}

/**
 * Warns or offers to add a suitable output target, since Playwright tests run against compiled output.
 * @param context The wizard context for the current `stencil init` run.
 */
async function ensureOutputTarget(context: WizardContext): Promise<void> {
  const { config, prompts } = context;
  const { www, loaderBundle } = detectOutputTargets(config);

  if (www || loaderBundle) return;

  const stencilConfigPath = join(config.rootDir, 'stencil.config.ts');
  if (!(await fileExists(stencilConfigPath))) {
    // Zero-config (v5): no stencil.config.ts means the compiler falls back to a
    // "loader-bundle" output target automatically - nothing to configure here.
    return;
  }

  const addWww = await prompts.confirm({
    message: 'No "www" or "loader-bundle" output target found. Add a "www" output target now?',
    initialValue: true,
  });
  if (!prompts.isCancel(addWww) && addWww) {
    const editor = await context.openStencilConfig();
    editor.addOutputTarget("{ type: 'www', serviceWorker: null }");
    await editor.save();
    return;
  }

  prompts.log.warn(
    'No "www" or "loader-bundle" output target configured - Playwright tests may not have anything to run against.',
  );
}

/**
 * Adds a "test:e2e" script to package.json.
 * @param rootDir Absolute path to the project root.
 */
async function updatePackageJsonScripts(rootDir: string): Promise<void> {
  const pkgPath = join(rootDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, any>;

  pkg.scripts ??= {};
  pkg.scripts['test:e2e'] ??= 'playwright test';

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

/**
 * Writes a starter `.e2e.ts` spec alongside each existing component, for new projects.
 * @param rootDir Absolute path to the project root.
 */
async function generateExampleTests(rootDir: string): Promise<void> {
  const componentsDir = join(rootDir, 'src', 'components');
  const entries = await readdir(componentsDir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const componentFile = join(componentsDir, entry.name, `${entry.name}.tsx`);
    if (!(await fileExists(componentFile))) continue;

    const source = await readFile(componentFile, 'utf8');
    if (!source.includes('@Component')) continue;

    const tagMatch = source.match(/tag:\s*['"]([^'"]+)['"]/);
    const tagName = tagMatch?.[1] ?? entry.name;

    const specFile = join(componentsDir, entry.name, `${tagName}.e2e.ts`);
    if (await fileExists(specFile)) continue;

    await writeFile(specFile, e2eSpecTemplate(tagName), 'utf8');
  }
}

export const wizard: StencilWizardPlugin = {
  init: {
    id: '@stencil/playwright',
    displayName: 'Playwright',
    description: 'E2E testing',

    async run(context: WizardContext): Promise<void> {
      const { config, isNewProject, prompts, nypm } = context;
      const { intro, outro, confirm, isCancel, cancel, spinner } = prompts;
      const rootDir = config.rootDir;

      intro('Playwright - E2E testing for Stencil');

      const playwrightConfigPath = join(rootDir, 'playwright.config.ts');

      if (!isNewProject && (await fileExists(playwrightConfigPath))) {
        const overwrite = await confirm({
          message: 'playwright.config.ts already exists. Overwrite it?',
          initialValue: false,
        });
        if (isCancel(overwrite) || !overwrite) {
          cancel('Skipping Playwright setup - existing config kept.');
          return;
        }
      }

      const s = spinner();
      s.start('Installing dependencies');
      await nypm.addDependency(['@playwright/test'], { cwd: rootDir, dev: true });
      s.stop('Dependencies installed');

      await writeFile(playwrightConfigPath, PLAYWRIGHT_CONFIG_TEMPLATE, 'utf8');
      await ensureDisposableLib(rootDir);
      await ensureOutputTarget(context);
      await updatePackageJsonScripts(rootDir);

      if (isNewProject) {
        await generateExampleTests(rootDir);
      }

      prompts.log.info('Run "npx playwright install" to download the browser binaries before running tests.');

      outro('Playwright configured');
    },
  },

  generate: {
    fileTemplates: [
      {
        label: 'E2E test (.e2e.ts)',
        extension: 'e2e.ts',
        selectedByDefault: true,
        template: (tagName: string) => e2eSpecTemplate(tagName),
      },
    ],
  },
};
