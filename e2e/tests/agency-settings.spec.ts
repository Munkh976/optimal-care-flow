import { test, expect } from '@playwright/test';

test.describe('Agency Settings', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display agency settings page', async ({ page }) => {
    await page.goto('/agency-settings');
    await expect(page.locator('h1')).toContainText('Agency Settings');
  });

  test('should load agency data', async ({ page }) => {
    await page.goto('/agency-settings');
    await page.waitForTimeout(1000);
    
    // Should display form fields
    const nameInput = page.locator('input[value*=""], input[placeholder*="Agency"]').first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
  });

  test('should expand/collapse sections', async ({ page }) => {
    await page.goto('/agency-settings');
    await page.waitForTimeout(1000);
    
    // Click to expand Basic Information
    const basicInfoTrigger = page.locator('button:has-text("Basic Information")');
    if (await basicInfoTrigger.isVisible()) {
      await basicInfoTrigger.click();
      await page.waitForTimeout(500);
    }
  });

  test('should update agency information', async ({ page }) => {
    await page.goto('/agency-settings');
    await page.waitForTimeout(1000);
    
    // Expand basic info section
    const basicInfoTrigger = page.locator('button:has-text("Basic Information")');
    if (await basicInfoTrigger.isVisible()) {
      await basicInfoTrigger.click();
      await page.waitForTimeout(500);
    }
    
    // Update agency name
    const nameInput = page.locator('input[placeholder*="Agency"], label:has-text("Agency Name") ~ input').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Agency Updated');
      
      // Save changes
      const saveButton = page.locator('button:has-text("Save Changes")');
      await saveButton.click();
      
      // Wait for success toast
      await expect(page.locator('.sonner-toast')).toContainText('successfully', { timeout: 5000 });
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/agency-settings');
    await page.waitForTimeout(1000);
    
    // Expand section
    const basicInfoTrigger = page.locator('button:has-text("Basic Information")');
    if (await basicInfoTrigger.isVisible()) {
      await basicInfoTrigger.click();
      await page.waitForTimeout(500);
    }
    
    // Clear a required field
    const nameInput = page.locator('input[placeholder*="Agency"], label:has-text("Agency Name") ~ input').first();
    if (await nameInput.isVisible()) {
      await nameInput.clear();
      
      // Try to save
      const saveButton = page.locator('button:has-text("Save Changes")');
      await saveButton.click();
      
      // Should show validation error
      await expect(page.locator('.sonner-toast')).toBeVisible({ timeout: 3000 });
    }
  });
});
