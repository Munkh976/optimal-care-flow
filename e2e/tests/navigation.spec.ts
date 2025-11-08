import { test, expect } from '@playwright/test';

test.describe('Navigation & Permissions', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display sidebar navigation', async ({ page }) => {
    await page.goto('/system-admin-dashboard');
    
    // Sidebar should be visible
    const sidebar = page.locator('aside, [role="navigation"]');
    await expect(sidebar).toBeVisible();
  });

  test('should navigate between main sections', async ({ page }) => {
    await page.goto('/system-admin-dashboard');
    
    // Navigate to Users
    await page.click('a[href="/users"]');
    await expect(page).toHaveURL('/users');
    await expect(page.locator('h1')).toContainText('Users');
    
    // Navigate to Caregivers
    await page.click('a[href="/caregivers"]');
    await expect(page).toHaveURL('/caregivers');
    await expect(page.locator('h1')).toContainText('Caregivers');
    
    // Navigate to Schedule
    await page.click('a[href="/schedule"]');
    await expect(page).toHaveURL('/schedule');
    await expect(page.locator('h1')).toContainText('Schedule');
  });

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/users');
    
    // Active link should have special styling
    const activeLink = page.locator('a[href="/users"]');
    const classes = await activeLink.getAttribute('class');
    expect(classes).toContain('bg-');
  });

  test('should redirect unauthenticated users to login', async ({ browser }) => {
    // Create new context without auth
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('/dashboard');
    
    // Should redirect to auth page
    await page.waitForURL('/auth', { timeout: 5000 });
    
    await context.close();
  });

  test('should display correct menu items based on role', async ({ page }) => {
    await page.goto('/system-admin-dashboard');
    
    // System admin should see admin-specific items
    const systemRolesLink = page.locator('a[href="/system-roles"]');
    await expect(systemRolesLink).toBeVisible();
    
    const adminUtilitiesLink = page.locator('a[href="/admin-utilities"]');
    await expect(adminUtilitiesLink).toBeVisible();
  });

  test('should navigate to dashboard from logo/home', async ({ page }) => {
    await page.goto('/users');
    
    // Click logo or home link
    const homeLink = page.locator('a[href="/dashboard"], a[href="/system-admin-dashboard"]').first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await page.waitForTimeout(500);
    }
  });

  test('should display breadcrumbs on nested pages', async ({ page }) => {
    await page.goto('/users/add');
    
    // Look for breadcrumb navigation
    const breadcrumb = page.locator('nav[aria-label*="breadcrumb"], .breadcrumb');
    if (await breadcrumb.isVisible()) {
      await expect(breadcrumb).toContainText('Users');
    }
  });

  test('should handle 404 for invalid routes', async ({ page }) => {
    await page.goto('/invalid-route-that-does-not-exist');
    
    // Should show 404 page or redirect
    await expect(page.locator('text=404, text=Not Found')).toBeVisible({ timeout: 3000 });
  });
});
