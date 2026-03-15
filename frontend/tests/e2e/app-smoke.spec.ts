import { expect, test } from "@playwright/test";

test("loads the shell and primary navigation", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByRole("navigation");

  await expect(page.getByRole("link", { name: "LeStudio ALPHA" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Status" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Motor Setup" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Camera Setup" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Teleop" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Record" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Dataset" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Train" })).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "Eval" })).toBeVisible();
});

test("navigates across lazily loaded pages", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByRole("navigation");

  await sidebar.getByRole("link", { name: "Motor Setup" }).click();
  await expect(page.getByRole("heading", { name: "Motor Setup" })).toBeVisible();

  await sidebar.getByRole("link", { name: "Teleop" }).click();
  await expect(page.getByRole("heading", { name: "Teleop" })).toBeVisible();

  await sidebar.getByRole("link", { name: "Train" }).click();
  await expect(page.getByRole("heading", { name: "AI Training" })).toBeVisible();

  await sidebar.getByRole("link", { name: "Eval" }).click();
  await expect(page.getByRole("heading", { name: "Policy Evaluation" })).toBeVisible();
});

test("keeps remote token UI hidden on localhost", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /session token saved for/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /session token required for remote changes/i })).toHaveCount(0);
});
