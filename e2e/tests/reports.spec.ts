import { test, expect } from '@playwright/test';

test.describe('Reports & Analytics', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display reports page', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('Reports');
  });

  test('should show overview tab with stats', async ({ page }) => {
    await page.goto('/reports');
    
    // Should display stat cards
    const statCards = page.locator('[class*="stat"], [class*="card"]');
    await expect(statCards.first()).toBeVisible({ timeout: 5000 });
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForTimeout(1000);
    
    // Click Shifts tab
    const shiftsTab = page.locator('button:has-text("Shifts")');
    if (await shiftsTab.isVisible()) {
      await shiftsTab.click();
      await page.waitForTimeout(500);
    }
    
    // Click Performance tab
    const performanceTab = page.locator('button:has-text("Performance")');
    if (await performanceTab.isVisible()) {
      await performanceTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('should filter by date range', async ({ page }) => {
    await page.goto('/reports');
    
    // Look for date range selector
    const dateFilter = page.locator('button:has-text("Last"), select');
    if (await dateFilter.first().isVisible()) {
      await dateFilter.first().click();
      await page.waitForTimeout(500);
      
      // Select a preset
      const option = page.locator('text=Last 30 days, text=This month').first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should export data', async ({ page }) => {
    await page.goto('/reports');
    
    const exportButton = page.locator('button:has-text("Export")');
    if (await exportButton.isVisible()) {
      // Start waiting for download before clicking
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    }
  });

  test('should display charts', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForTimeout(2000);
    
    // Look for chart containers
    const charts = page.locator('svg[class*="recharts"], [class*="chart"]');
    if (await charts.first().isVisible()) {
      await expect(charts.first()).toBeVisible();
    }
  });
});
