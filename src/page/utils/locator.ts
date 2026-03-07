import type { Locator } from '@playwright/test';

import type { E2EPage } from '../../playwright-declarations';
import { addE2EListener, EventSpy } from '../event-spy';

export type LocatorOptions = {
  hasText?: string | RegExp;
  has?: Locator;
};

// Augment Playwright's Locator interface to include spyOnEvent
declare module '@playwright/test' {
  interface Locator {
    /**
     * Creates a new EventSpy and listens on the element for an event.
     * The test will timeout if the event never fires.
     *
     * Usage:
     * const input = page.locator('ion-input');
     * const ionChange = await locator.spyOnEvent('ionChange');
     * ...
     * await ionChange.next();
     */
    spyOnEvent: (eventName: string) => Promise<EventSpy>;
  }
}

export interface E2ELocator extends Locator {
  /**
   * Creates a new EventSpy and listens on the element for an event.
   * The test will timeout if the event never fires.
   *
   * Usage:
   * const input = page.locator('ion-input');
   * const ionChange = await locator.spyOnEvent('ionChange');
   * ...
   * await ionChange.next();
   */
  spyOnEvent: (eventName: string) => Promise<EventSpy>;
}

export const locator = (
  page: E2EPage,
  originalFn: typeof page.locator,
  selector: string,
  options?: LocatorOptions,
): E2ELocator => {
  const locator = originalFn(selector, options) as E2ELocator;
  locator.spyOnEvent = async (eventName: string) => {
    const spy = new EventSpy(eventName);
    const handle = await locator.evaluateHandle((node: HTMLElement) => node);
    await addE2EListener(page, handle, eventName, (ev: CustomEvent) => spy.push(ev));
    return spy;
  };
  return locator;
};
