import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate as system admin', async ({ page }) => {
  await page.goto('/auth');
  
  // Fill in login credentials
  await page.fill('input[type="email"]', 'admin@caremuch.com');
  await page.fill('input[type="password"]', 'admin123');
  
  // Click sign in button
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('/system-admin-dashboard');
  
  // Save authenticated state
  await page.context().storageState({ path: authFile });
});
