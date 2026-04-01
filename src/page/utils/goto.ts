/* eslint-disable jsdoc/require-param */
/* eslint-disable jsdoc/require-returns */
import type { Page } from '@playwright/test';

import type { E2EPageOptions } from '../../playwright-declarations';

/**
 * This is an extended version of Playwright's `page.goto` method. In addition to performing
 * the normal `page.goto` work, this code also automatically waits for the Stencil components
 * to be hydrated before proceeding with the test.
 *
 * If no Stencil components are present (no `appload` event fires), the navigation
 * proceeds after the timeout without error.
 */
export const goto = async (page: Page, url: string, originalFn: typeof page.goto, options?: E2EPageOptions) => {
  const navigationPromise = originalFn(url, options);

  // Wait for Stencil's appload event, but don't fail if it never fires
  // (e.g., when the page has no Stencil components)
  await Promise.all([
    page
      .waitForFunction(() => (window as any).testAppLoaded === true, {
        // This timeout was taken from the existing Playwright adapter in the Ionic Framework repository.
        // They tested this number and found it to be a reliable timeout for the Stencil components to be hydrated.
        timeout: 4750,
      })
      .catch(() => {
        // Timeout is expected when there are no Stencil components - proceed anyway
      }),
    navigationPromise,
  ]);

  return navigationPromise;
};
