import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
test("public design, auth recovery, protected routes and mobile layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your city. Your journey." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/landing-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Book a ride", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make the city yours." }),
  ).toBeVisible();
  await page.goto("/rider/history");
  await expect(page).toHaveURL(/sign-in/);
  await expect(
    page.getByRole("heading", { name: "Good to see you." }),
  ).toBeVisible();
  await page.goto("/forgot-password");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.screenshot({
    path: "artifacts/landing-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
  await page.goto("/sign-in");
  await page.screenshot({
    path: "artifacts/sign-in-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(360);
});
test("seeded local passenger, driver and administrator workspaces", async ({
  browser,
}) => {
  test.skip(
    !process.env.E2E_EMULATORS,
    "Requires seeded local emulator accounts",
  );
  const accounts = JSON.parse(
    readFileSync(".env.demo-accounts.json", "utf8"),
  ) as { email: string; password: string; role: string }[];
  for (const a of accounts) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      page = await context.newPage();
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill(a.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/" + a.role + "$"));
    await page.screenshot({
      path: `artifacts/${a.role}-workspace-desktop.png`,
      fullPage: true,
    });
    for (const path of a.role === "rider"
      ? ["history", "profile", "help", "help/tickets"]
      : a.role === "driver"
        ? ["history", "earnings", "profile", "help"]
        : ["drivers", "rides", "support"]) {
      await page.goto("/" + a.role + "/" + path);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.getByText("This page could not load.")).toHaveCount(0);
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/" + a.role);
    await page.screenshot({
      path: `artifacts/${a.role}-workspace-mobile.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(360);
    await context.close();
  }
});
