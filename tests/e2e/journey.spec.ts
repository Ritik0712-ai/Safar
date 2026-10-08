import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
test("two identities finish booking, PIN, captured fixture payment, receipt and rating", async ({
  browser,
}) => {
  test.skip(
    !process.env.E2E_PROVIDER_FIXTURES,
    "Requires explicit automated provider fixtures",
  );
  test.setTimeout(150000);
  const accounts = JSON.parse(
    readFileSync(".env.e2e-accounts.json", "utf8"),
  ) as { role: string; email: string; password: string }[];
  const riderContext = await browser.newContext(),
    driverContext = await browser.newContext(),
    rider = await riderContext.newPage(),
    driver = await driverContext.newPage();
  for (const [page, role] of [
    [rider, "rider"],
    [driver, "driver"],
  ] as const) {
    const a = accounts.find((a) => a.role === role)!;
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(a.email);
    await page.getByLabel("Password", { exact: true }).fill(a.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/" + role + "$"), {
      timeout: 25000,
    });
    await expect(page.locator("main h1")).toBeVisible();
  }
  await driver
    .getByRole("button", { name: "Use demo location & go online" })
    .click();
  await expect(
    driver.getByText("Ready for the road.", { exact: true }),
  ).toBeVisible();
  await rider
    .getByRole("button", { name: "Choose on map", exact: true })
    .first()
    .click();
  await rider.getByLabel("Latitude").fill("12.9716");
  await rider.getByLabel("Longitude").fill("77.5946");
  await rider.getByRole("button", { name: "Use these coordinates" }).click();
  await rider
    .getByRole("button", { name: "Choose on map", exact: true })
    .last()
    .click();
  await rider.getByLabel("Latitude").fill("12.9784");
  await rider.getByLabel("Longitude").fill("77.6408");
  await rider.getByRole("button", { name: "Use these coordinates" }).click();
  await rider.getByRole("button", { name: "Get fare", exact: true }).click();
  await expect(
    rider.getByRole("button", { name: "Request Economy" }),
  ).toBeVisible();
  await rider.screenshot({
    path: "artifacts/booking-review.png",
    fullPage: true,
  });
  await rider.getByRole("button", { name: "Request Economy" }).click();
  await expect(rider).toHaveURL(/\/rider\/rides\//);
  await expect(
    driver.getByRole("button", { name: "Accept", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await driver.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(driver).toHaveURL(/\/driver\/rides\//);
  await expect(rider.getByRole("button", { name: "Show PIN" })).toBeVisible({
    timeout: 20000,
  });
  await rider.getByRole("button", { name: "Show PIN" }).click();
  const pin = await rider.getByLabel("Trip PIN", { exact: true }).innerText();
  await rider.screenshot({ path: "artifacts/active-ride.png", fullPage: true });
  await driver.getByRole("button", { name: "I’ve arrived" }).click();
  await driver.getByRole("button", { name: "Confirm arrival" }).click();
  await expect(driver.getByLabel("Passenger’s trip PIN")).toBeVisible();
  await driver.getByLabel("Passenger’s trip PIN").fill(pin.trim());
  await driver.getByRole("button", { name: "Start ride", exact: true }).click();
  await expect(
    driver.getByRole("button", { name: "Complete ride", exact: true }),
  ).toBeVisible();
  await driver.screenshot({
    path: "artifacts/driver-in-progress.png",
    fullPage: true,
  });
  await driver
    .getByRole("button", { name: "Complete ride", exact: true })
    .click();
  await driver.getByRole("button", { name: "Confirm completion" }).click();
  await expect(
    rider.getByRole("link", { name: "Pay ₹115", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await rider.getByRole("link", { name: "Pay ₹115", exact: true }).click();
  await rider.route(
    "https://checkout.razorpay.com/v1/checkout.js",
    async (route) => {
      const order = (await (
        await fetch("http://127.0.0.1:4111/last-order")
      ).json()) as { id: string };
      const paymentId = "pay_fixture_" + order.id,
        signature = createHmac("sha256", "fixture-secret")
          .update(order.id + "|" + paymentId)
          .digest("hex");
      const payload = JSON.stringify({
        razorpay_order_id: order.id,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });
      await route.fulfill({
        contentType: "application/javascript",
        body: `window.Razorpay=function(options){this.on=function(){};this.open=function(){const button=document.createElement('button');button.textContent='Complete automated fixture payment';Object.assign(button.style,{position:'fixed',left:'50%',top:'50%',zIndex:'3000',padding:'24px',background:'white',border:'2px solid #006b5b'});button.onclick=function(){button.remove();options.handler(${payload});};document.body.appendChild(button);};};`,
      });
    },
  );
  await rider.getByRole("button", { name: "Pay ₹115", exact: true }).click();
  await rider
    .getByRole("button", { name: "Complete automated fixture payment" })
    .click();
  await expect(
    rider.getByRole("heading", { name: "Test payment verified." }),
  ).toBeVisible({ timeout: 20000 });
  await rider.screenshot({
    path: "artifacts/payment-success.png",
    fullPage: true,
  });
  const downloading = rider.waitForEvent("download");
  await rider.getByRole("button", { name: "Download receipt" }).click();
  const download = await downloading;
  await download.saveAs("artifacts/journey-test-receipt.pdf");
  await rider.getByRole("link", { name: "Rate driver", exact: true }).click();
  await rider.getByRole("radio", { name: "5 stars", exact: true }).click();
  await rider
    .getByLabel("A few words (optional)")
    .fill("A clear and comfortable journey.");
  await rider.getByRole("button", { name: "Submit rating" }).click();
  await expect(
    rider.getByRole("link", { name: "View my rating" }),
  ).toBeVisible();
  await rider.goto("/rider/history");
  await expect(rider.getByText("Paid", { exact: true })).toBeVisible();
  await driver.goto("/driver/earnings");
  await expect(driver.getByText("₹92", { exact: true }).first()).toBeVisible();
  await riderContext.close();
  await driverContext.close();
});
