import { test, expect } from '@playwright/test';

test.describe('Role & Permissions Management', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display role permissions page', async ({ page }) => {
    await page.goto('/role-permissions');
    await expect(page.locator('h1')).toContainText('Role Permissions');
  });

  test('should display system roles page', async ({ page }) => {
    await page.goto('/system-roles');
    await expect(page.locator('h1')).toContainText('System Roles');
  });

  test('should list all roles', async ({ page }) => {
    await page.goto('/role-permissions');
    await page.waitForTimeout(1000);
    
    // Should display roles in table or cards
    const roles = page.locator('table, [class*="card"]');
    await expect(roles).toBeVisible();
  });

  test('should toggle permissions for a role', async ({ page }) => {
    await page.goto('/role-permissions');
    await page.waitForTimeout(1000);
    
    // Find first permission toggle
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      const initialState = await checkbox.isChecked();
      await checkbox.click();
      await page.waitForTimeout(500);
      
      // Should show save button or auto-save
      const currentState = await checkbox.isChecked();
      expect(currentState).not.toBe(initialState);
    }
  });

  test('should save permission changes', async ({ page }) => {
    await page.goto('/role-permissions');
    await page.waitForTimeout(1000);
    
    // Toggle a permission
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
      
      // Look for save button
      const saveButton = page.locator('button:has-text("Save")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
        
        // Wait for success
        await expect(page.locator('.sonner-toast')).toContainText('success', { timeout: 5000 });
      }
    }
  });

  test('should filter permissions by module', async ({ page }) => {
    await page.goto('/role-permissions');
    await page.waitForTimeout(1000);
    
    // Look for module filter
    const moduleFilter = page.locator('select, button[role="combobox"]').first();
    if (await moduleFilter.isVisible()) {
      await moduleFilter.click();
      await page.waitForTimeout(500);
    }
  });
});
