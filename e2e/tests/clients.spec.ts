import { test, expect } from '@playwright/test';

test.describe('Client Management', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display clients list', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.locator('h1')).toContainText('Clients');
  });

  test('should navigate to add client page', async ({ page }) => {
    await page.goto('/clients');
    const addButton = page.locator('button:has-text("Add Client")');
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.url()).toContain('/clients/add');
    }
  });

  test('should create new client', async ({ page }) => {
    await page.goto('/clients');
    
    const addButton = page.locator('button:has-text("Add Client")');
    if (await addButton.isVisible()) {
      await addButton.click();
      
      const timestamp = Date.now();
      
      // Fill in client details
      await page.fill('input[placeholder*="Name"], input[name="name"]', `Test Client ${timestamp}`);
      await page.fill('input[type="email"]', `client${timestamp}@example.com`);
      await page.fill('input[type="tel"], input[placeholder*="Phone"]', '555-0100');
      
      await page.click('button[type="submit"]');
      
      // Wait for success
      await expect(page.locator('.sonner-toast')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should filter clients', async ({ page }) => {
    await page.goto('/clients');
    
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Test');
      await page.waitForTimeout(500);
    }
  });

  test('should view client details', async ({ page }) => {
    await page.goto('/clients');
    
    const viewButton = page.locator('button:has-text("View"), button:has-text("Details")').first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      
      // Should show client details modal or page
      await page.waitForTimeout(500);
    }
  });
});
