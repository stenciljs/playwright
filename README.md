# @stencil/playwright

> [!NOTE]
> The Stencil Playwright adapter is currently an experimental package. Breaking changes may be introduced at any time.
>
> The Stencil Playwright adapter is designed to only work with **version 4.13.0 and higher** of Stencil!

Stencil Playwright is a testing adapter package that allows developers to easily use the [Playwright testing framework](https://playwright.dev/docs/intro)
in their Stencil project.

For full documentation, please see the [Playwright testing docs on the official Stencil site](https://stenciljs.com/docs/testing/playwright/overview).

## Getting Started

1. Install the necessary dependencies:

   ```bash
   npm i @stencil/playwright @playwright/test --save-dev
   ```

1. Install the Playwright browser binaries:

   ```bash
   npx playwright install
   ```

1. Create a Playwright config at the root of your Stencil project:

   ```ts
   import { expect } from '@playwright/test';
   import { matchers, createConfig } from '@stencil/playwright';

   // Add custom Stencil matchers to Playwright assertions
   expect.extend(matchers);

   export default createConfig({
     // Overwrite Playwright config options here
   });
   ```

   The `createConfig()` function is a utility that will create a default Playwright configuration based on your project's Stencil config. Read
   more about how to use this utility in the [API section](#createconfigoverrides-playwrighttestconfig-promiseplaywrighttestconfig).

   > [!NOTE]
   > For `createConfig()` to work correctly, your Stencil config must be named either `stencil.config.ts` or `stencil.config.js`.

1. update your project's `tsconfig.json` to add the `ESNext.Disposable` option to the `lib` array:

   ```ts title="tsconfig.json"
   {
     lib: [
       ...,
       "ESNext.Disposable"
     ],
     ...
   }
   ```

   > [!NOTE]
   > This will resolve a build error related to `Symbol.asyncDispose`. If this is not added, tests may fail to run since the Stencil dev server will be unable
   > to start due to the build error.

1. Ensure the Stencil project has a [`www` output target](https://stenciljs.com/docs/www). Playwright relies on pre-compiled output running in a dev server
   to run tests against. When using the `createConfig()` helper, a configuration for the dev server will be automatically created based on
   the Stencil project's `www` output target config and [dev server config](https://stenciljs.com/docs/dev-server). If no `www` output target is specified,
   tests will not be able to run.

1. Add the `copy` option to the `www` output target config:

   ```ts title="stencil.config.ts"
   {
      type: 'www',
      serviceWorker: null,
      copy: [{ src: '**/*.html' }, { src: '**/*.css' }]
   }
   ```

   This will clone all HTML and CSS files to the `www` output directory so they can be served by the dev server. If you put all testing related
   files in specific directory(s), you can update the `copy` task glob patterns to only copy those files:

   ```ts title="stencil.config.ts"
   {
      type: 'www',
      serviceWorker: null,
      copy: [{ src: '**/test/*.html' }, { src: '**/test/*.css' }]
   }
   ```

   > [!NOTE]
   > If the `copy` property is not set, you will not be able to use the `page.goto` testing pattern!

1. Test away! Check out the [e2e testing page on the Stencil docs](https://stenciljs.com/docs/testing/playwright/e2e-testing) for more help
   getting started writing tests.

## Testing Patterns

### `page.goto()`

The `goto()` method allows tests to load a pre-defined HTML template. This pattern is great if a test file has many tests to execute that all use the same HTML code
or if additional `script` or `style` tags need to be included in the HTML. However, with this pattern, developers are responsible for defining the necessary `script`
tags pointing to the Stencil entry code (so all web components are correctly loaded and registered).

```html
<!-- my-component.e2e.html -->

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf8" />

    <!-- Replace with the path to your entrypoint -->
    <script src="./build/test-app.esm.js" type="module"></script>
    <script src="./build/test-app.js" nomodule></script>
  </head>
  <body>
    <my-component first="Stencil"></my-component>
  </body>
</html>
```

```ts
// my-component.e2e.ts

import { expect } from '@playwright/test';
import { test } from '@stencil/playwright';

test.describe('my-component', () => {
  test('should render the correct name', async ({ page }) => {
    // The path here is the path to the www output relative to the dev server root directory
    await page.goto('/my-component/my-component.e2e.html');

    // Rest of test
  });
});
```

### `page.setContent()`

The `setContent()` method allows tests to define their own HTML code on a test-by-test basis. This pattern is helpful if the HTML for a test is small, or to
avoid affecting other tests is using the `page.goto()` pattern and modifying a shared HTML template file. With this pattern, the `script` tags pointing to Stencil
entry code will be automatically injected into the generated HTML.

```ts
// my-component.e2e.ts

import { expect } from '@playwright/test';
import { test } from '@stencil/playwright';

test.describe('my-component', () => {
  test('should render the correct name', async ({ page }) => {
    await page.setContent('<my-component first="Stencil"></my-component>');

    // Rest of test
  });
});
```

## API

### `createConfig(overrides?: PlaywrightTestConfig): Promise<PlaywrightTestConfig>`

Returns a [Playwright test configuration](https://playwright.dev/docs/test-configuration#introduction).

`overrides`, as the name implies, will overwrite the default configuration value(s) if supplied. These values can include any valid Playwright config option. Changing
option values in a nested object will use a "deep merge" to combine the default and overridden values. So, creating a config like the following:

```ts
import { expect } from '@playwright/test';
import { matchers, createConfig } from '@stencil/playwright';

expect.extend(matchers);

export default createConfig({
  // Change which test files Playwright will execute
  testMatch: '*.spec.ts',

  webServer: {
    // Only wait max 30 seconds for server to start
    timeout: 30000,
  },
});
```

Will result in:

```ts
{
  testMatch: '*.spec.ts',
  use: {
    baseURL: 'http://localhost:3333',
  },
  webServer: {
    command: 'npx stencil build --dev --watch --serve --no-open',
    url: 'http://localhost:3333/ping',
    reuseExistingServer: !process.env.CI,
    // Only timeout gets overridden, not the entire object
    timeout: 30000,
  },
}
```

### `test`

`test` designates which tests will be executed by Playwright. See the [Playwright API documentation](https://playwright.dev/docs/api/class-test#test-call) regarding usage.

This package modifies the [`page` fixture](#page) and offers a [`skip` utility](#skip) as discussed below.

#### `page`

The page fixture is a class that allows interacting with the current test's browser tab. In addition to the [default Playwright Page API](https://playwright.dev/docs/api/class-page),
Stencil extends the class with a few additional methods:

- `waitForChanges()`: Waits for Stencil components to re-hydrate before continuing.
- `spyOnEvent()`: Creates a new EventSpy and listens on the window for an event to emit.

#### `skip`

The `skip` utility allows developers to skip tests for certain browsers or [component modes](https://stenciljs.com/docs/styling#style-modes):

```ts
test('my-test', ({ page, skip }) => {
    // Skip tests for certain browsers
    skip.browser('firefox', 'This behavior is not available on Firefox');

    // Skip tests for certain modes
    skip.mode('md', 'This behavior is not available in Material Design');

    ...
})
```
