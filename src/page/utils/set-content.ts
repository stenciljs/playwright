import type { Page, TestInfo } from '@playwright/test';

import type { E2EPageOptions } from '../../playwright-declarations';

/**
 * Overwrites the default Playwright page.setContent method.
 *
 * Navigates to a blank page, sets the content, and waits for the
 * Stencil components to be hydrated before proceeding with the test.
 *
 * @param page The Playwright page object.
 * @param html The HTML content to set on the page.
 * @param testInfo Test information from the test bed. Used to access base URL.
 * @param options The test config associated with the current test run.
 */
export const setContent = async (page: Page, html: string, testInfo: TestInfo, options?: E2EPageOptions) => {
  if (page.isClosed()) {
    throw new Error('setContent unavailable: page is already closed');
  }

  const baseUrl = testInfo.project.use.baseURL;
  const baseEntryPath = process.env.STENCIL_ENTRY_PATH;

  // Extract head and body content from the server-rendered HTML
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  const headContent = headMatch ? headMatch[1] : '';
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  const output = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Stencil Playwright Test</title>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0" />
        ${headContent}
        <script src="${baseEntryPath}.js" nomodule></script>
        <script type="module" src="${baseEntryPath}.esm.js"></script>
      </head>
      <body>
        ${bodyContent}
      </body>
    </html>
  `;

  if (baseUrl) {
    await page.route(baseUrl, (route) => {
      if (route.request().url() === `${baseUrl}/`) {
        /**
         * Intercepts the empty page request and returns the
         * HTML content that was passed in.
         */
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: output,
        });
      } else {
        // Allow all other requests to pass through
        route.continue();
      }
    });

    await page.goto(`${baseUrl}#`, options);
  } else {
    throw new Error('setContent unavailable: no dev server base URL provided');
  }
};
