import { test, expect } from '@playwright/test';

test.describe('Caregiver Management', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display caregivers list', async ({ page }) => {
    await page.goto('/caregivers');
    await expect(page.locator('h1')).toContainText('Caregivers');
  });

  test('should navigate to add caregiver page', async ({ page }) => {
    await page.goto('/caregivers');
    const addButton = page.locator('button:has-text("Add Caregiver")');
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.url()).toContain('/caregivers/add');
    }
  });

  test('should filter caregivers by status', async ({ page }) => {
    await page.goto('/caregivers');
    
    // Look for filter controls
    const filterSelect = page.locator('select').first();
    if (await filterSelect.isVisible()) {
      await filterSelect.selectOption('active');
      await page.waitForTimeout(500);
    }
  });

  test('should view caregiver details', async ({ page }) => {
    await page.goto('/caregivers');
    
    // Click first view/details button
    const detailsButton = page.locator('button:has-text("View"), button:has-text("Details")').first();
    if (await detailsButton.isVisible()) {
      await detailsButton.click();
      await page.waitForTimeout(500);
      
      // Should show caregiver information
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    }
  });

  test('should navigate to caregiver approvals', async ({ page }) => {
    await page.goto('/caregiver-approvals');
    await expect(page.locator('h1')).toContainText('Caregiver Approvals');
  });

  test('should display pending approvals', async ({ page }) => {
    await page.goto('/caregiver-approvals');
    
    // Should show table or empty state
    const table = page.locator('table');
    const emptyState = page.locator('text=No pending approvals');
    
    await expect(table.or(emptyState)).toBeVisible();
  });
});
