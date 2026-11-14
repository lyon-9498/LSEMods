import { test, expect } from "@playwright/test";

test("catalogue search and course page", async ({ page }) => {
  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: /Browse LSE courses/i })).toBeVisible();
  await page.getByRole("textbox", { name: /Search courses/i }).fill("SP100");
  await expect(page.getByRole("link", { name: /SP100/i }).first()).toBeVisible({ timeout: 5000 });
  await page.getByRole("link", { name: /SP100/i }).first().click();
  await expect(page.getByRole("heading", { name: /Understanding International/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add to Plan/i }).first()).toBeVisible();
});

test("builder loads", async ({ page }) => {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { name: /Course Builder/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Degree Plan/i })).toBeVisible();
});

test("community and support CTAs", async ({ page }) => {
  await page.goto("/community");
  await expect(page.getByRole("link", { name: /Join Telegram/i })).toBeVisible();
  await page.goto("/support");
  await expect(page.getByRole("link", { name: /Contribute on Open Collective/i })).toBeVisible();
});

test("slash focuses catalogue search on desktop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop slash shortcut");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/courses");
  const search = page.getByRole("textbox", { name: /Search courses/i });
  await expect(search).toBeVisible();
  await page.locator("body").click({ position: { x: 8, y: 8 } });
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
});
