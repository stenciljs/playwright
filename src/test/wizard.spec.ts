import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wizard } from '../wizard';

function makeTmpDir() {
  return mkdtempSync(join(tmpdir(), 'wizard-test-'));
}

const noCancel = () => false;

function makeSpinner() {
  return { start: vi.fn(), stop: vi.fn() };
}

function makeInitCtx(
  rootDir: string,
  outputTargets: Array<{ type: string; copy?: Array<{ src?: string }> }> = [],
  isNewProject = false,
) {
  return {
    config: { rootDir, fsNamespace: 'my-lib', outputTargets },
    isNewProject,
    nypm: { addDependency: vi.fn().mockResolvedValue(undefined) },
    openStencilConfig: vi.fn(),
    prompts: {
      intro: vi.fn(),
      outro: vi.fn(),
      confirm: vi.fn(),
      isCancel: noCancel,
      cancel: vi.fn(),
      spinner: vi.fn().mockReturnValue(makeSpinner()),
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    },
  };
}

describe('wizard.generate.fileTemplates', () => {
  it('offers a single e2e.ts template, selected by default', () => {
    const templates = [...(wizard.generate!.fileTemplates as any)];

    expect(templates).toHaveLength(1);
    expect(templates[0].extension).toBe('e2e.ts');
    expect(templates[0].selectedByDefault).toBe(true);
  });

  it('generated template uses setContent and the tag name', () => {
    const templates = [...(wizard.generate!.fileTemplates as any)];
    const content = templates[0].template('my-button');

    expect(content).toContain("describe('my-button'");
    expect(content).toContain("page.setContent('<my-button></my-button>')");
    expect(content).toContain("page.locator('my-button')");
  });
});

describe('wizard.init.run', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-lib', scripts: {} }, null, 2) + '\n');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('cancels when existing config exists and user declines overwrite', async () => {
    writeFileSync(join(tmpDir, 'playwright.config.ts'), 'export default {};\n');

    const ctx = makeInitCtx(tmpDir);
    ctx.prompts.confirm.mockResolvedValueOnce(false); // decline overwrite

    await wizard.init!.run(ctx as any);

    expect(ctx.prompts.cancel).toHaveBeenCalledWith('Skipping Playwright setup - existing config kept.');
    expect(readFileSync(join(tmpDir, 'playwright.config.ts'), 'utf8')).toBe('export default {};\n');
    expect(ctx.nypm.addDependency).not.toHaveBeenCalled();
  });

  it('proceeds and overwrites when user accepts overwrite', async () => {
    writeFileSync(join(tmpDir, 'playwright.config.ts'), 'export default {};\n');

    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);
    ctx.prompts.confirm.mockResolvedValueOnce(true); // accept overwrite

    await wizard.init!.run(ctx as any);

    expect(ctx.prompts.cancel).not.toHaveBeenCalled();
    const config = readFileSync(join(tmpDir, 'playwright.config.ts'), 'utf8');
    expect(config).toContain('createConfig');
  });

  it('installs @playwright/test as a dev dependency', async () => {
    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);

    await wizard.init!.run(ctx as any);

    expect(ctx.nypm.addDependency).toHaveBeenCalledWith(['@playwright/test'], { cwd: tmpDir, dev: true });
  });

  it('writes playwright.config.ts with the expected boilerplate', async () => {
    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);

    await wizard.init!.run(ctx as any);

    const config = readFileSync(join(tmpDir, 'playwright.config.ts'), 'utf8');
    expect(config).toContain("import { matchers, createConfig } from '@stencil/playwright'");
    expect(config).toContain('expect.extend(matchers)');
    expect(config).toContain('export default createConfig(');
  });

  it('adds ESNext.Disposable to an existing tsconfig.json lib array', async () => {
    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { lib: ['ES2022', 'DOM'] } }, null, 2) + '\n',
    );
    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);

    await wizard.init!.run(ctx as any);

    const tsconfig = JSON.parse(readFileSync(join(tmpDir, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.lib).toEqual(['ES2022', 'DOM', 'ESNext.Disposable']);
  });

  it('does not duplicate ESNext.Disposable if already present', async () => {
    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { lib: ['ES2022', 'ESNext.Disposable'] } }, null, 2) + '\n',
    );
    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);

    await wizard.init!.run(ctx as any);

    const tsconfig = JSON.parse(readFileSync(join(tmpDir, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.compilerOptions.lib).toEqual(['ES2022', 'ESNext.Disposable']);
  });

  it('skips tsconfig editing when no tsconfig.json exists', async () => {
    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);

    await wizard.init!.run(ctx as any);

    expect(existsSync(join(tmpDir, 'tsconfig.json'))).toBe(false);
  });

  it('does not warn when no output target is configured and no stencil.config.ts exists (zero-config v5)', async () => {
    // No stencil.config.ts on disk - the compiler defaults to "loader-bundle" automatically,
    // so there's nothing to warn about or offer to fix.
    const ctx = makeInitCtx(tmpDir, []);

    await wizard.init!.run(ctx as any);

    expect(ctx.prompts.log.warn).not.toHaveBeenCalled();
    expect(ctx.openStencilConfig).not.toHaveBeenCalled();
  });

  it('offers to add a www output target when stencil.config.ts exists and none is configured', async () => {
    writeFileSync(join(tmpDir, 'stencil.config.ts'), 'export const config = {};\n');
    const ctx = makeInitCtx(tmpDir, []);
    const editor = { addOutputTarget: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
    ctx.openStencilConfig.mockResolvedValue(editor);
    ctx.prompts.confirm.mockResolvedValueOnce(true); // accept adding output target

    await wizard.init!.run(ctx as any);

    expect(editor.addOutputTarget).toHaveBeenCalledWith(expect.stringContaining("type: 'www'"));
    expect(editor.save).toHaveBeenCalled();
  });

  it('warns when stencil.config.ts exists but has no usable output target and the user declines', async () => {
    writeFileSync(join(tmpDir, 'stencil.config.ts'), 'export const config = {};\n');
    const ctx = makeInitCtx(tmpDir, []);
    ctx.prompts.confirm.mockResolvedValueOnce(false); // decline adding output target

    await wizard.init!.run(ctx as any);

    expect(ctx.openStencilConfig).not.toHaveBeenCalled();
    expect(ctx.prompts.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('No "www" or "loader-bundle" output target configured'),
    );
  });

  it('warns about a missing copy config on an existing www target', async () => {
    const ctx = makeInitCtx(tmpDir, [{ type: 'www' }]);

    await wizard.init!.run(ctx as any);

    expect(ctx.prompts.log.warn).toHaveBeenCalledWith(expect.stringContaining('no "copy" config'));
  });

  it('does not warn when the www target already has a suitable copy config', async () => {
    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);

    await wizard.init!.run(ctx as any);

    expect(ctx.prompts.log.warn).not.toHaveBeenCalled();
  });

  it('writes a test:e2e script without touching an existing test script', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-lib', scripts: { test: 'my-custom-test' } }, null, 2) + '\n',
    );
    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);

    await wizard.init!.run(ctx as any);

    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.scripts.test).toBe('my-custom-test');
    expect(pkg.scripts['test:e2e']).toBe('playwright test');
  });

  it('does not add a bare "test" script', async () => {
    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }]);

    await wizard.init!.run(ctx as any);

    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf8'));
    expect(pkg.scripts.test).toBeUndefined();
    expect(pkg.scripts['test:e2e']).toBe('playwright test');
  });

  it('generates example e2e spec files for components when isNewProject is true', async () => {
    const componentDir = join(tmpDir, 'src', 'components', 'my-button');
    mkdirSync(componentDir, { recursive: true });
    writeFileSync(
      join(componentDir, 'my-button.tsx'),
      `import { Component, h } from '@stencil/core';
@Component({ tag: 'my-button', shadow: true })
export class MyButton { render() { return <button />; } }
`,
    );

    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }], true);

    await wizard.init!.run(ctx as any);

    const specFile = join(componentDir, 'my-button.e2e.ts');
    expect(existsSync(specFile)).toBe(true);
    const spec = readFileSync(specFile, 'utf8');
    expect(spec).toContain("describe('my-button'");
  });

  it('skips example test generation when isNewProject is false', async () => {
    const componentDir = join(tmpDir, 'src', 'components', 'my-button');
    mkdirSync(componentDir, { recursive: true });
    writeFileSync(
      join(componentDir, 'my-button.tsx'),
      `import { Component, h } from '@stencil/core';
@Component({ tag: 'my-button', shadow: true })
export class MyButton { render() { return <button />; } }
`,
    );

    const ctx = makeInitCtx(tmpDir, [{ type: 'www', copy: [{ src: '**/*.html' }, { src: '**/*.css' }] }], false);

    await wizard.init!.run(ctx as any);

    expect(existsSync(join(componentDir, 'my-button.e2e.ts'))).toBe(false);
  });
});
