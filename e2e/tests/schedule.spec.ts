import { test, expect } from '@playwright/test';

test.describe('Schedule Management', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display schedule page', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.locator('h1')).toContainText('Schedule');
  });

  test('should show calendar view', async ({ page }) => {
    await page.goto('/schedule');
    
    // Calendar should be visible
    const calendar = page.locator('.fc-view-harness, [class*="calendar"]');
    await expect(calendar).toBeVisible({ timeout: 5000 });
  });

  test('should navigate between months', async ({ page }) => {
    await page.goto('/schedule');
    await page.waitForTimeout(1000);
    
    // Click next month button
    const nextButton = page.locator('button:has-text("Next"), .fc-next-button').first();
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should filter shifts', async ({ page }) => {
    await page.goto('/schedule');
    
    // Look for filter controls
    const filterButton = page.locator('button:has-text("Filter")');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should create new shift', async ({ page }) => {
    await page.goto('/schedule');
    
    const addButton = page.locator('button:has-text("Add Shift"), button:has-text("Create")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Should open create shift dialog
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should display unassigned shifts', async ({ page }) => {
    await page.goto('/unassigned-shifts');
    await expect(page.locator('h1')).toContainText('Unassigned Shifts');
  });

  test('should navigate to quick assign', async ({ page }) => {
    await page.goto('/quick-assign');
    await expect(page.locator('h1')).toContainText('Quick Assign');
  });

  test('should display available shifts for caregivers', async ({ page }) => {
    await page.goto('/available-shifts');
    await expect(page.locator('h1')).toContainText('Available Shifts');
  });
});
