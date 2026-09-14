import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const password = "Test-collector-password-42";
const photo = path.resolve("tests/fixtures/vase.png");
let runtimeErrors: string[];
test.beforeEach(({ page }) => {
  runtimeErrors = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
});
test.afterEach(() => expect(runtimeErrors).toEqual([]));

async function mailbox(page: Page, email: string, route = "verify") {
  const messages = await (await page.request.get("/api/__test__/mailbox")).json();
  const message = messages.filter((m: { to: string[]; body: string }) => m.to.includes(email) && m.body.includes(`/${route}?`)).at(-1);
  expect(message).toBeTruthy();
  return message.body.match(new RegExp(`http://127\\.0\\.0\\.1:3410/${route}\\?token=[^\\s]+`))[0] as string;
}

async function account(page: Page, email: string, resend = false) {
  await page.goto("/register");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Check your email", exact: true })).toBeVisible();
  if (resend) {
    await page.goto("/verify");
    await page.locator("#resend-email").fill(email);
    await page.getByRole("button", { name: "Resend verification email", exact: true }).click();
    await expect(page.locator("#resend-verification [role=status]")).toBeVisible();
  }
  await page.goto(await mailbox(page, email));
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("button", { name: "Email verified", exact: true })).toBeVisible();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function headers(page: Page) {
  const token = await page.evaluate(() => localStorage.getItem("antique_access_token"));
  return { Authorization: `Bearer ${token}` };
}

async function create(page: Page, route: string, data: object) {
  const response = await page.request.post(`/api${route}`, { headers: await headers(page), data });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test("verification resend, schema rename, private move preview, and publication", async ({ page, browser }) => {
  await account(page, "move@example.com", true);
  const source = await create(page, "/collections", { name: "Private archive" });
  const target = await create(page, "/collections", { name: "Public display", is_public: true });
  const maker = await create(page, `/collections/${source.id}/fields`, { name: "Maker", field_type: "text" });
  await create(page, `/collections/${source.id}/fields`, { name: "Purchase price", field_type: "number", is_private: true });
  await create(page, `/collections/${source.id}/fields`, { name: "Acquired", field_type: "timestamp" });
  const destinationMaker = await create(page, `/collections/${target.id}/fields`, { name: "Manufacturer", field_type: "text", is_required: true });
  await create(page, `/collections/${target.id}/fields`, { name: "Purchase price", field_type: "number" });
  const timestamp = "2026-09-13T10:30:45.123+02:00";
  const item = await create(page, `/collections/${source.id}/items`, { name: "Porcelain vase", metadata: { Maker: "Meissen", "Purchase price": 900, Acquired: timestamp } });
  const imageResponse = await page.request.post(`/api/items/${item.id}/images`, { headers: await headers(page), multipart: { file: { name: "vase.png", mimeType: "image/png", buffer: await (await import("node:fs/promises")).readFile(photo) } } });
  expect(imageResponse.ok()).toBeTruthy();
  const image = await imageResponse.json();
  expect((await page.request.patch(`/api/collections/${source.id}/fields/${maker.id}`, { headers: await headers(page), data: { name: "Manufacturer" } })).ok()).toBeTruthy();
  await page.goto(`/collections/${source.id}/items/${item.id}`);
  await page.getByRole("button", { name: "Edit item", exact: true }).click();
  await expect(page.locator(`#metadata-${maker.id}`)).toHaveValue("Meissen");
  await page.locator("#name").fill("Restored porcelain vase");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit item", exact: true })).toBeVisible();
  let saved = await (await page.request.get(`/api/collections/${source.id}/items/${item.id}`, { headers: await headers(page) })).json();
  expect(saved.metadata.Acquired).toBe(timestamp);
  expect(saved.metadata.Manufacturer).toBe("Meissen");
  await page.getByRole("button", { name: "Edit item", exact: true }).click();
  await page.locator("#destination-collection").selectOption(String(target.id));
  await expect(page.getByText("Values preserved privately: Purchase price, Acquired", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/move-preview.png", fullPage: true });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/collections/${target.id}/items/${item.id}$`));
  await expect(page.getByText("This item is a private draft.", { exact: false })).toBeVisible();
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get(`http://127.0.0.1:3410/api/images/${image.id}/thumb.jpg`)).status()).toBe(404);
  await page.getByRole("button", { name: "Edit item", exact: true }).click();
  await expect(page.locator(`#metadata-${destinationMaker.id}`)).toHaveValue("Meissen");
  await page.getByRole("button", { name: "Save and publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit item", exact: true })).toBeVisible();
  saved = await (await anonymous.request.get(`http://127.0.0.1:3410/api/public/collections/${target.id}/items/${item.id}`)).json();
  expect(saved.metadata).toEqual({ Manufacturer: "Meissen" });
  expect(saved).not.toHaveProperty("preserved_metadata");
  expect((await anonymous.request.get(`http://127.0.0.1:3410/api/images/${image.id}/thumb.jpg`)).status()).toBe(200);
  const visitor = await anonymous.newPage();
  await visitor.goto(`http://127.0.0.1:3410/explore/${target.id}/items/${item.id}`);
  await expect(visitor.getByRole("heading", { name: "Restored porcelain vase", exact: true })).toBeVisible();
  await expect(visitor.getByText("900", { exact: true })).toHaveCount(0);
  await anonymous.close();
});

test("mobile capture keeps draft photos private and renews an expired session", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await account(page, "capture@example.com");
  const collection = await create(page, "/collections", { name: "Mobile captures", is_public: true });
  await page.goto("/speed-capture");
  await page.getByRole("button", { name: /Mobile captures/ }).click();
  const captured = page.waitForResponse(r => r.url().endsWith("/complete") && r.url().includes("/uploads/") && r.request().method() === "POST");
  await page.locator('input[type="file"]').setInputFiles(photo);
  const captureResponse = await captured;
  expect(captureResponse.status()).toBe(200);
  const result = (await captureResponse.json()).result;
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
  await expect.poll(() => page.locator('img[src^="blob:"]').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: "test-results/mobile-capture.png", fullPage: true });
  const token = await page.evaluate(() => localStorage.getItem("antique_access_token"));
  const expired = await (await page.request.post("/api/__test__/expire-access", { data: { token } })).json();
  await page.evaluate(t => localStorage.setItem("antique_access_token", t), expired.access_token);
  const refreshed = page.waitForResponse(r => r.url().endsWith("/auth/refresh") && r.status() === 200);
  await page.goto(`/collections/${collection.id}/items/${result.item_id}`);
  await refreshed;
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
  await expect.poll(() => page.locator('img[src^="blob:"]').first().evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  const anonymous = await browser.newContext();
  expect((await anonymous.request.get(`http://127.0.0.1:3410/api/images/${result.image_id}/thumb.jpg`)).status()).toBe(404);
  await anonymous.close();
});

test("emailed password reset revokes existing access and refresh sessions", async ({ page, browser }) => {
  const email = "reset@example.com";
  await account(page, email);
  const oldHeaders = await headers(page);
  const recovery = await browser.newContext();
  const resetPage = await recovery.newPage();
  await resetPage.goto("http://127.0.0.1:3410/forgot-password");
  await resetPage.locator("#email").fill(email);
  await resetPage.getByRole("button", { name: "Send reset email", exact: true }).click();
  await expect(resetPage.getByRole("status")).toBeVisible();
  await resetPage.goto(await mailbox(page, email, "reset-password"));
  await resetPage.locator("#password").fill(`${password}-new`);
  await resetPage.locator("#confirmPassword").fill(`${password}-new`);
  await resetPage.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(resetPage.getByRole("button", { name: "Password updated", exact: true })).toBeVisible();
  expect((await page.request.get("/api/auth/me", { headers: oldHeaders })).status()).toBe(401);
  expect((await page.request.post("/api/auth/refresh")).status()).toBe(401);
  await page.reload();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(`${password}-new`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await recovery.close();
});

test("owner can download a backup, preview it, and restore a private copy", async ({ page }) => {
  await account(page, "backup@example.com");
  const source = await create(page, "/collections", { name: "Ceramics backup", is_public: true });
  await create(page, `/collections/${source.id}/fields`, { name: "Private cost", field_type: "number", is_private: true });
  const item = await create(page, `/collections/${source.id}/items`, { name: "Blue vase", metadata: { "Private cost": 123 } });
  const image = await page.request.post(`/api/items/${item.id}/images`, { headers: await headers(page), multipart: { file: { name: "vase.png", mimeType: "image/png", buffer: await (await import("node:fs/promises")).readFile(photo) } } });
  expect(image.ok()).toBeTruthy();
  await page.goto(`/collections/${source.id}`);
  await page.getByRole("button", { name: "Export collection", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("private fields");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup ZIP", exact: true }).click();
  const download = await downloadEvent;
  const backup = await download.path();
  expect(backup).toBeTruthy();
  await page.goto("/collections");
  await page.getByRole("button", { name: "Restore collection", exact: true }).click();
  await page.locator("#archive-file").setInputFiles(backup!);
  await expect(page.locator("#restore-name")).toHaveValue("Ceramics backup");
  await expect(page.getByRole("dialog")).toContainText("Private fields: 1");
  await page.locator("#restore-name").fill("Restored ceramics");
  await page.screenshot({ path: "test-results/restore-preview.png", fullPage: true });
  await page.getByRole("button", { name: "Restore as private collection", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Restored ceramics", exact: true, level: 1 })).toBeVisible();
  const restoredId = Number(page.url().split("/").at(-1));
  expect(restoredId).not.toBe(source.id);
  const collection = await (await page.request.get(`/api/collections/${restoredId}`, { headers: await headers(page) })).json();
  expect(collection.is_public).toBe(false);
  const items = await (await page.request.get(`/api/collections/${restoredId}/items`, { headers: await headers(page) })).json();
  expect(items[0].metadata).toEqual({ "Private cost": 123 });
  expect(items[0].image_count).toBe(1);
});

test("an interrupted photo resumes after reload without retransmitting accepted chunks", async ({ page }) => {
  await account(page, "resume@example.com");
  const collection = await create(page, "/collections", { name: "Interrupted capture" });
  await page.goto("/speed-capture");
  await page.getByRole("button", { name: /Interrupted capture/ }).click();
  let interrupt = true;
  const offsets: number[] = [];
  await page.route("**/api/uploads/*?offset=*", async route => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    offsets.push(offset);
    if (interrupt && offset >= 1024 * 1024) await route.abort("internetdisconnected");
    else await route.continue();
  });
  const buffer = Buffer.concat([await (await import("node:fs/promises")).readFile(photo), Buffer.alloc(2 * 1024 * 1024)]);
  await page.locator('input[type="file"]').setInputFiles({ name: "resumable-vase.png", mimeType: "image/png", buffer });
  await expect(page.getByText("Photo saved on this device. Open Uploads to resume.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Uploads (1)", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "resumable-vase.png" })).toHaveAttribute("value", "1048576");
  await page.screenshot({ path: "test-results/interrupted-upload.png", fullPage: true });
  const before = offsets.length;
  interrupt = false;
  await page.reload();
  await page.getByRole("button", { name: /Uploads \(/ }).click();
  await expect(page.getByRole("link", { name: "View item", exact: true })).toBeVisible();
  expect(offsets.slice(before)[0]).toBe(1024 * 1024);
  await page.getByRole("link", { name: "View item", exact: true }).click();
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
  const drafts = await (await page.request.get(`/api/collections/${collection.id}/items?drafts_only=true`, { headers: await headers(page) })).json();
  expect(drafts).toHaveLength(1);
  expect(drafts[0].image_count).toBe(1);
});
