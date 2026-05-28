import { test, expect } from '@playwright/test';

test.describe('auth flow', () => {
  test('redirects unauthenticated visitor to /login', async ({ page }) => {
    const response = await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    expect(response?.ok()).toBeTruthy();
  });

  test('login as admin then sees dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@alshaya.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});
