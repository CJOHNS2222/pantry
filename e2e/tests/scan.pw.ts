import { test, expect } from '@playwright/test';

// Basic smoke test for web flow: open app and add an item via the add UI.
// This is intentionally lightweight and does not require native Capacitor device.

test('add item flow smoke', async ({ page }) => {
  await page.goto('http://localhost:5173'); // default Vite dev server

  // Wait for app to render
  await page.waitForSelector('text=My Pantry', { timeout: 5000 });

  // Click the add button (floating +)
  const add = await page.$('button[aria-label="Add items to pantry"]');
  if (add) {
    await add.click();
    // Expect modal or form to appear
    await expect(page.locator('text=Add Item')).toHaveCount(1);
  }
});
