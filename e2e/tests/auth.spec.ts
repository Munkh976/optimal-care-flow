import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/auth');
    await expect(page.locator('h1')).toContainText('CareMuch');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should display error for invalid credentials', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error toast
    await expect(page.locator('.sonner-toast')).toBeVisible({ timeout: 3000 });
  });

  test('should redirect authenticated users from login page', async ({ page }) => {
    // Login first
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'admin@caremuch.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/system-admin-dashboard');
    
    // Try to go to auth page again
    await page.goto('/auth');
    
    // Should be redirected away from auth page
    await expect(page).not.toHaveURL('/auth');
  });

  test('should sign out successfully', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'admin@caremuch.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/system-admin-dashboard');
    
    // Click sign out
    await page.click('text=Sign Out');
    
    // Should redirect to auth page
    await page.waitForURL('/auth');
  });

  test('should link to caregiver registration', async ({ page }) => {
    await page.goto('/auth');
    const link = page.locator('a[href="/caregiver-registration"]');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL('/caregiver-registration');
  });
});
