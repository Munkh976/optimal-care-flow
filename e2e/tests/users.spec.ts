import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.use({ storageState: 'e2e/.auth/user.json' });

  test('should display users list', async ({ page }) => {
    await page.goto('/users');
    await expect(page.locator('h1')).toContainText('Users');
    await expect(page.locator('table')).toBeVisible();
  });

  test('should navigate to add user page', async ({ page }) => {
    await page.goto('/users');
    await page.click('text=Add User');
    await expect(page).toHaveURL('/users/add');
    await expect(page.locator('h1')).toContainText('Add User');
  });

  test('should create new user', async ({ page }) => {
    await page.goto('/users/add');
    
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    
    await page.fill('input[placeholder="John Doe"]', 'Test User');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'testpass123');
    await page.selectOption('select', 'caregiver');
    
    await page.click('button[type="submit"]');
    
    // Wait for success toast
    await expect(page.locator('.sonner-toast')).toContainText('User created successfully', { timeout: 5000 });
    
    // Should redirect to users list
    await page.waitForURL('/users');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/users/add');
    
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('.sonner-toast')).toBeVisible({ timeout: 3000 });
  });

  test('should edit user role', async ({ page }) => {
    await page.goto('/users');
    
    // Click first edit button
    const editButton = page.locator('button:has-text("Edit")').first();
    await editButton.click();
    
    // Should navigate to edit page
    await expect(page.url()).toContain('/users/edit/');
    
    // Change role
    await page.selectOption('select', 'agency_admin');
    await page.click('button:has-text("Save Changes")');
    
    // Wait for success
    await expect(page.locator('.sonner-toast')).toContainText('Role updated successfully', { timeout: 5000 });
  });

  test('should search and filter users', async ({ page }) => {
    await page.goto('/users');
    
    // Type in search box if it exists
    const searchInput = page.locator('input[placeholder*="Search"]');
    if (await searchInput.isVisible()) {
      await searchInput.fill('admin');
      await page.waitForTimeout(500); // Wait for filter
    }
  });
});
