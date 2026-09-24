import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const password = "Test-collector-password-42";
const photo = path.resolve("tests/fixtures/vase.png");
let runtimeErrors: string[];
test.beforeEach(async ({ page }) => {
  runtimeErrors = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  expect((await page.request.post("/api/__test__/reset-rate-limits")).ok()).toBeTruthy();
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

async function withoutNativeUuid(page: Page) {
  // Reproduce HTTP LAN/Tailscale browsers even when tests run on localhost.
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
  });
}

test("login keeps credentials out of the URL when JavaScript is unavailable", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/login");
    await page.locator("#email").fill("no-script@example.com");
    await page.locator("#password").fill(password);
    await page.route("**/login", route => route.request().method() === "POST"
      ? route.fulfill({ status: 200, body: "Submission intercepted" })
      : route.continue());
    const submitted = page.waitForRequest(request => request.isNavigationRequest());
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const request = await submitted;
    expect(request.method()).toBe("POST");
    expect(new URL(request.url()).search).toBe("");
    const body = new URLSearchParams(request.postData() ?? "");
    expect(body.get("email")).toBe("no-script@example.com");
    expect(body.get("password")).toBe(password);
  } finally {
    await context.close();
  }
});

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
  await withoutNativeUuid(page);
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
  await withoutNativeUuid(page);
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
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await expect(page.getByRole("button", { name: "Restore collection", exact: true })).toBeFocused();
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
  await page.getByRole("link", { name: "Back to collections", exact: true }).click();
  await expect(page).toHaveURL(/\/collections$/);
  await expect(page.getByRole("heading", { name: "Restored ceramics", exact: true, level: 3 })).toBeVisible();
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
  // Real photo detail, not zero padding: the client downscales and re-encodes
  // before queueing, which discards padding and would leave a single chunk.
  const dataUrl = await page.evaluate(() => {
    const side = 2600;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d")!;
    const image = context.createImageData(side, side);
    for (let offset = 0; offset < image.data.length; offset += 65536) {
      crypto.getRandomValues(image.data.subarray(offset, offset + 65536));
    }
    for (let pixel = 3; pixel < image.data.length; pixel += 4) image.data[pixel] = 255;
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.95);
  });
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  expect(buffer.byteLength).toBeGreaterThan(2 * 1024 * 1024);
  await page.locator('input[type="file"]').setInputFiles({ name: "resumable-photo.jpg", mimeType: "image/jpeg", buffer });
  await expect(page.getByText("Photo saved on this device. Open Uploads to resume.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Uploads (1)", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "resumable-photo.jpg" })).toHaveAttribute("value", "1048576");
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

test("stored dark theme applies after reload", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("preferred-theme", "dark"));
  await page.goto("/login");
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("new collection is visible on return to list", async ({ page }) => {
  await account(page, "review-cache@example.com");
  await page.getByRole("link", { name: "Collections Saved collections", exact: false }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Create collection", exact: true }).first().click();
  await page.locator("#name").fill("Cache regression collection");
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await expect(page).toHaveURL(/\/collections\/\d+\/settings$/);
  await page.getByRole("link", { name: "Collections Saved collections", exact: false }).click();
  await expect(page).toHaveURL(/\/collections$/);
  await expect(page.getByRole("heading", { name: "Cache regression collection", exact: true, level: 3 })).toBeVisible();
});

test("new schema field remains visible after navigation", async ({ page }) => {
  await account(page, "review-schema@example.com");
  const collection = await create(page, "/collections", { name: "Schema probe" });
  await page.goto(`/collections/${collection.id}`);
  await page.getByRole("link", { name: "Define schema", exact: true }).first().click();
  await page.locator("#field-name").fill("Manufacturer probe");
  await page.getByRole("button", { name: "Add field", exact: true }).click();
  await expect(page.getByText("Field added.", { exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole("link", { name: "Add item", exact: true }).first().click();
  await expect(page.getByLabel("Manufacturer probe", { exact: true })).toBeVisible();
});

test("saved language preference survives the upgrade", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("preferred-language", "de"));
  await page.goto("/login");
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  expect((await page.context().cookies()).find(cookie => cookie.name === "preferred-language")?.value).toBe("de");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
});

test("item edits, stars, deletion and collection edits remain current after navigation", async ({ page }) => {
  await account(page, "cache-crud@example.com");
  const collection = await create(page, "/collections", { name: "Cache CRUD" });
  await page.goto("/stars");
  await page.getByRole("link", { name: "Collections Saved collections", exact: false }).click();
  await page.getByRole("link", { name: "View collection", exact: true }).click();
  await page.getByRole("button", { name: "Star", exact: true }).click();
  await expect(page.getByRole("button", { name: "Starred", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Stars Starred items and collections", exact: false }).click();
  await expect(page).toHaveURL(/\/stars$/);
  await expect(page.getByRole("heading", { name: "Cache CRUD", exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole("link", { name: "Add item", exact: true }).first().click();
  await page.getByLabel("Item name", { exact: true }).fill("Original vase");
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await expect(page).toHaveURL(/\/items\/\d+$/);
  const itemUrl = page.url();
  await page.getByRole("link", { name: "Back to collection", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/collections/${collection.id}$`));
  await expect(page.getByRole("heading", { name: "Original vase", exact: true, level: 3 })).toBeVisible();
  await page.locator(`a[href="${new URL(itemUrl).pathname}"]`).first().click();
  await page.getByRole("button", { name: "Edit item", exact: true }).click();
  await page.getByLabel("Item name", { exact: true }).fill("Updated vase");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit item", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to collection", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/collections/${collection.id}$`));
  await expect(page.getByRole("heading", { name: "Updated vase", exact: true, level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Original vase", exact: true })).toHaveCount(0);
  await page.locator(`a[href="${new URL(itemUrl).pathname}"]`).first().click();
  await page.getByRole("button", { name: "Edit item", exact: true }).click();
  await page.locator("#delete-confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete item", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/collections/${collection.id}$`));
  await expect(page.getByRole("heading", { name: "Updated vase", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to collections", exact: true }).click();
  await page.getByRole("link", { name: "Collection settings", exact: true }).click();
  await page.locator("#name").fill("Renamed collection");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Renamed collection" })).toBeVisible();
  await page.getByRole("link", { name: "Back to collections", exact: true }).first().click();
  await expect(page).toHaveURL(/\/collections$/);
  await expect(page.getByRole("heading", { name: "Renamed collection", exact: true, level: 3 })).toBeVisible();
  await page.getByRole("link", { name: "Collection settings", exact: true }).click();
  await page.locator("#delete-collection-confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete collection", exact: true }).click();
  await expect(page).toHaveURL(/\/collections$/);
  await expect(page.getByRole("heading", { name: "Renamed collection", exact: true })).toHaveCount(0);
});

test("applying a template refreshes the builder and item form", async ({ page }) => {
  await account(page, "cache-template@example.com");
  const collection = await create(page, "/collections", { name: "Template target" });
  await create(page, "/schema-templates", { name: "Ceramic schema", fields: [{ name: "Origin", field_type: "text" }] });
  await page.goto(`/collections/${collection.id}`);
  await page.getByRole("link", { name: "Define schema", exact: true }).first().click();
  await page.getByRole("button", { name: "Ceramic schema 1 field", exact: true }).click();
  await page.getByRole("button", { name: "Apply template", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drag to reorder Origin", exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole("link", { name: "Add item", exact: true }).first().click();
  await expect(page.getByLabel("Origin", { exact: true })).toBeVisible();
});

test("schema template edits, ordering and deletion survive return navigation", async ({ page }) => {
  await account(page, "cache-schema-edits@example.com");
  const template = await create(page, "/schema-templates", { name: "Editable schema", fields: [{ name: "Maker", field_type: "text" }] });
  await page.goto(`/schema-templates/${template.id}`);
  await page.locator("#field-name").fill("Origin");
  await page.getByRole("button", { name: "Add field", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drag to reorder Origin", exact: true })).toBeVisible();
  const row = (name: string) => page.locator("div.rounded-2xl").filter({ has: page.getByRole("button", { name: `Drag to reorder ${name}`, exact: true }) }).last();
  await row("Origin").getByRole("button", { name: "Move up", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Drag to reorder/ }).first()).toHaveAttribute("aria-label", "Drag to reorder Origin");
  await row("Maker").getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator("#field-name").fill("Manufacturer");
  await page.getByRole("button", { name: "Update field", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drag to reorder Manufacturer", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Schema templates Reusable metadata schemas", exact: false }).click();
  await expect(page).toHaveURL(/\/schema-templates$/);
  await page.locator(`a[href="/schema-templates/${template.id}"]`).first().click();
  await expect(page.getByRole("button", { name: /^Drag to reorder/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^Drag to reorder/ }).first()).toHaveAttribute("aria-label", "Drag to reorder Origin");
  await row("Manufacturer").getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: "Drag to reorder Manufacturer", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Schema templates Reusable metadata schemas", exact: false }).click();
  await expect(page).toHaveURL(/\/schema-templates$/);
  await page.locator(`a[href="/schema-templates/${template.id}"]`).first().click();
  await expect(page.getByRole("button", { name: /^Drag to reorder/ })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Drag to reorder Origin", exact: true })).toBeVisible();
});

test("reopening a public photo checks access after its owner makes it private", async ({ page, browser }) => {
  await account(page, "cache-photo-access@example.com");
  const collection = await create(page, "/collections", { name: "Photo access", is_public: true });
  const item = await create(page, `/collections/${collection.id}/items`, { name: "Public vase" });
  const uploaded = await page.request.post(`/api/items/${item.id}/images`, {
    headers: await headers(page), multipart: { file: { name: "vase.png", mimeType: "image/png", buffer: await (await import("node:fs/promises")).readFile(photo) } }
  });
  expect(uploaded.ok()).toBeTruthy();
  const image = await uploaded.json();
  const anonymous = await browser.newContext();
  try {
    const visitor = await anonymous.newPage();
    visitor.on("pageerror", error => runtimeErrors.push(error.message));
    await visitor.goto(`http://127.0.0.1:3410/explore/${collection.id}`);
    await expect(visitor.locator('img[src^="blob:"]')).toBeVisible();
    await visitor.locator(`a[href="/explore/${collection.id}/items/${item.id}"]`).first().click();
    await expect(visitor).toHaveURL(new RegExp(`/items/${item.id}$`));
    await expect(visitor.getByRole("img", { name: "Public vase", exact: true }).first()).toBeVisible();
    expect((await page.request.patch(`/api/collections/${collection.id}`, { headers: await headers(page), data: { is_public: false } })).ok()).toBeTruthy();
    const accessCheck = visitor.waitForResponse(response => response.url().endsWith(`/api/images/${image.id}/medium.jpg`) && response.status() === 404);
    await visitor.goBack();
    await accessCheck;
    await expect(visitor).toHaveURL(new RegExp(`/explore/${collection.id}$`));
    await expect(visitor.locator('img[src^="blob:"]')).toHaveCount(0);
  } finally {
    await anonymous.close();
  }
});

test("one admin write refreshes each admin view exactly once", async ({ page }) => {
  await account(page, "adminfeature@example.com");
  await create(page, "/collections", { name: "Featurable", is_public: true });

  await page.goto("/admin");
  await page.locator("#admin-email").fill("admin@example.com");
  await page.locator("#admin-password").fill("Isolated-e2e-admin-password-42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Earlier tests leave their own public collections in the shared database,
  // so scope to the row that holds this collection's heading and button.
  const row = page
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: "Featurable", exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Feature", exact: true }) })
    .last();
  const feature = row.getByRole("button", { name: "Feature", exact: true });
  await expect(feature).toBeVisible();
  // Let the reads the console issues on sign-in settle before counting.
  await expect(page.getByText("Registered accounts", { exact: false })).toBeVisible();

  const reads: string[] = [];
  page.on("request", request => {
    const { pathname } = new URL(request.url());
    if (request.method() === "GET" && pathname.startsWith("/api/admin/")) reads.push(pathname);
  });

  await feature.click();
  await expect(row.getByText("Featured", { exact: true })).toBeVisible();
  await page.waitForTimeout(500);

  // The write publishes one invalidation, which refreshes every admin view.
  // A handler that also refreshed by hand would race that invalidation: the
  // second pass cancels the first mid-flight and the same view is read twice.
  const counts = new Map<string, number>();
  for (const path of reads) counts.set(path, (counts.get(path) ?? 0) + 1);
  expect([...counts.entries()].filter(([, count]) => count > 1)).toEqual([]);
  expect(counts.get("/api/admin/stats")).toBe(1);
});

test("capture stays available while photos upload, and queued shots keep their order", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await account(page, "rapidcapture@example.com");
  const collection = await create(page, "/collections", { name: "Rapid captures" });
  await page.goto("/speed-capture");
  await page.getByRole("button", { name: /Rapid captures/ }).click();

  // Hold every upload open so all three shots are in flight together.
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/uploads", async route => {
    await held;
    await route.continue();
  });

  const newItem = page.getByRole("button", { name: "New Item", exact: true });
  await newItem.click();
  await page.locator('input[type="file"]').setInputFiles(photo);

  // The button must stay usable: that is the whole point of the background queue.
  await expect(newItem).toBeEnabled();
  await newItem.click();
  await page.locator('input[type="file"]').setInputFiles(photo);
  await page.getByRole("button", { name: "Same Item", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(photo);

  // All three are pending, previewed locally before any server round trip.
  await expect(page.getByText("3 photos uploading", { exact: true })).toBeVisible();
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(3);

  release();
  await expect(page.getByText(/photos? uploading/)).toHaveCount(0, { timeout: 20000 });

  // Two drafts, and the "Same Item" shot joined the second one rather than
  // creating a third or attaching to the first.
  const drafts = await (await page.request.get(`/api/collections/${collection.id}/items?drafts_only=true`, { headers: await headers(page) })).json();
  expect(drafts).toHaveLength(2);
  expect(drafts.map((d: { image_count: number }) => d.image_count).sort()).toEqual([1, 2]);
});


test("rapid captures survive reload while the first upload is blocked", async ({ page }) => {
  await account(page, "durablecapture@example.com");
  const collection = await create(page, "/collections", { name: "Durable captures" });
  await page.goto("/speed-capture");
  await page.getByRole("button", { name: /Durable captures/ }).click();
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/uploads", async route => {
    await held;
    // Reload may have already cancelled the held request.
    await route.abort().catch(error => {
      if (!String(error).includes("Route is already handled")) throw error;
    });
  });
  try {
    for (const mode of ["New Item", "New Item", "Same Item"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await page.locator('input[type="file"]').setInputFiles(photo);
    }
    // Count durable records, not the in-memory preview thumbnails.
    await expect.poll(() => page.evaluate(() => new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("antique-upload-queue", 1);
      request.onsuccess = () => {
        const db = request.result;
        const count = db.transaction("uploads").objectStore("uploads").count();
        count.onsuccess = () => { db.close(); resolve(count.result); };
        count.onerror = () => reject(count.error);
      };
    }))).toBe(3);
    await page.reload();
  } finally {
    release();
    await page.unroute("**/api/uploads");
  }
  await page.reload();
  await expect.poll(async () => {
    const drafts = await (await page.request.get(`/api/collections/${collection.id}/items?drafts_only=true`, { headers: await headers(page) })).json();
    return drafts.map((draft: { image_count: number }) => draft.image_count).sort();
  }, { timeout: 20000 }).toEqual([1, 2]);
});

test("retrying a failed new capture keeps subsequent photos with that item", async ({ page }) => {
  await account(page, "failedcapture@example.com");
  const collection = await create(page, "/collections", { name: "Failed captures" });
  await page.goto("/speed-capture");
  await page.getByRole("button", { name: /Failed captures/ }).click();
  await page.getByRole("button", { name: "New Item", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(photo);
  await expect(page.getByRole("button", { name: "Uploads (0)", exact: true })).toBeVisible();
  let blocked = true;
  await page.route("**/api/uploads", async route => {
    if (blocked) await route.abort(); else await route.continue();
  });
  await page.getByRole("button", { name: "New Item", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(photo);
  await expect(page.getByText("Photo saved on this device. Open Uploads to resume.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Same Item", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(photo);
  await expect(page.getByRole("button", { name: "Uploads (2)", exact: true })).toBeVisible();
  blocked = false;
  await page.reload();
  await expect.poll(async () => {
    const drafts = await (await page.request.get(`/api/collections/${collection.id}/items?drafts_only=true`, { headers: await headers(page) })).json();
    // Newest first: the second draft must receive both photos.
    return drafts.sort((a: { id: number }, b: { id: number }) => b.id - a.id)
      .map((draft: { image_count: number }) => draft.image_count);
  }, { timeout: 20000 }).toEqual([2, 1]);
});


test("upload size validation reaches the server above the former client limit", async ({ page }) => {
  await account(page, "configuredlimit@example.com");
  await create(page, "/collections", { name: "Configured limit" });
  await page.goto("/speed-capture");
  await page.getByRole("button", { name: /Configured limit/ }).click();
  let receivedSize = 0;
  await page.route("**/api/uploads", async route => {
    receivedSize = route.request().postDataJSON().size;
    await route.fulfill({ status: 422, json: { detail: "Configured server limit" } });
  });
  // Undecodable image input follows the resize fallback, retaining its size.
  const buffer = Buffer.alloc(11 * 1024 * 1024);
  await page.getByRole("button", { name: "New Item", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "unsupported.jpg", mimeType: "image/jpeg", buffer });
  await expect.poll(() => receivedSize).toBe(buffer.length);
  await page.getByRole("button", { name: "Uploads (1)", exact: true }).click();
  await expect(page.getByText("Configured server limit", { exact: true })).toBeVisible();
});


test("resuming a capture clears its error without leaving the capture screen", async ({ page }) => {
  await account(page, "capture-retry-feedback@example.com");
  await create(page, "/collections", { name: "Retry feedback" });
  await page.goto("/speed-capture");
  await page.getByRole("button", { name: /Retry feedback/ }).click();
  let blocked = true;
  await page.route("**/api/uploads", route => blocked ? route.abort() : route.continue());
  await page.getByRole("button", { name: "New Item", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(photo);
  const message = page.getByText("Photo saved on this device. Open Uploads to resume.", { exact: true });
  await expect(message).toBeVisible();
  blocked = false;
  await page.getByRole("button", { name: "Uploads (1)", exact: true }).click();
  await page.getByRole("button", { name: "Resume upload", exact: true }).click();
  await expect(page.getByRole("button", { name: "Uploads (0)", exact: true })).toBeVisible();
  await expect(message).toHaveCount(0);
});

test("item uploader resizes large originals before enforcing server limits", async ({ page }) => {
  await withoutNativeUuid(page);
  await account(page, "audit-large@example.com");
  const collection = await create(page, "/collections", { name: "Audit large photo" });
  const item = await create(page, `/collections/${collection.id}/items`, { name: "Vase" });
  await page.goto(`/collections/${collection.id}/items/${item.id}`);
  let starts = 0;
  page.on("request", request => { if (request.url().endsWith("/api/uploads") && request.method() === "POST") starts++; });
  const original = await (await import("node:fs/promises")).readFile(photo);
  const buffer = Buffer.concat([original, Buffer.alloc(11 * 1024 * 1024)]);
  await page.locator('input[type="file"][multiple]').setInputFiles({ name: "large-photo.png", mimeType: "image/png", buffer });
  await expect(page.getByText("Uploaded", { exact: true })).toBeVisible();
  expect(starts).toBe(1);
  const images = await page.request.get(`/api/items/${item.id}/images`, { headers: await headers(page) });
  expect(await images.json()).toHaveLength(1);
});

test("all item photos survive reload while the first upload is blocked", async ({ page }) => {
  await account(page, "audit-batch@example.com");
  const collection = await create(page, "/collections", { name: "Audit batch" });
  const item = await create(page, `/collections/${collection.id}/items`, { name: "Vase" });
  await page.goto(`/collections/${collection.id}/items/${item.id}`);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let started = false;
  await page.route("**/api/uploads", async route => {
    started = true;
    await held;
    await route.abort().catch(() => undefined);
  });
  const buffer = await (await import("node:fs/promises")).readFile(photo);
  try {
    await page.locator('input[type="file"][multiple]').setInputFiles(
      ["one.png", "two.png", "three.png"].map(name => ({ name, mimeType: "image/png", buffer }))
    );
    await expect.poll(() => started).toBe(true);
    await expect(page.getByText("Queued", { exact: true })).toHaveCount(2);
    const count = () => page.evaluate(() => new Promise<number>(resolve => {
      const request = indexedDB.open("antique-upload-queue", 1);
      request.onsuccess = () => {
        const db = request.result;
        const count = db.transaction("uploads").objectStore("uploads").count();
        count.onsuccess = () => { db.close(); resolve(count.result); };
      };
    }));
    expect(await count()).toBe(3);
    await page.unroute("**/api/uploads");
    await page.reload();
    expect(await count()).toBe(3);
    await expect.poll(async () => {
      const response = await page.request.get(`/api/items/${item.id}/images`, { headers: await headers(page) });
      return (await response.json()).map((image: { filename: string }) => image.filename.split(".")[0]);
    }).toEqual(["one", "two", "three"]);
    await expect(page.getByText("Uploaded", { exact: true })).toHaveCount(3);
  } finally { release(); }
});

test("other accounts' pending photos do not consume this account's quota", async ({ page }) => {
  await account(page, "audit-quota@example.com");
  await create(page, "/collections", { name: "Audit quota" });
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("antique-upload-queue", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("uploads", { keyPath: "id" });
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("uploads", "readwrite");
      for (let i = 0; i < 20; i++) tx.objectStore("uploads").put({
        id: crypto.randomUUID(), owner: 999999, target: { mode: "capture-new", collection_id: 999999 },
        file: new Blob(["photo"]), filename: "previous-account.jpg", size: 5, received: 0, state: "queued"
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.goto("/speed-capture");
  await page.getByRole("button", { name: /Audit quota/ }).click();
  await page.getByRole("button", { name: "New Item", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(photo);
  await expect(page.getByRole("button", { name: "Uploads (0)", exact: true })).toBeVisible();
  await expect(page.getByText("Finish or discard pending uploads first.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Uploads (0)", exact: true }).click();
  await expect(page.getByRole("link", { name: "View item", exact: true })).toHaveCount(1);
  await expect(page.getByText("previous-account.jpg", { exact: true })).toHaveCount(0);
});


test("resuming an item upload updates its inline status", async ({ page }) => {
  await account(page, "item-retry@example.com");
  const collection = await create(page, "/collections", { name: "Item retry" });
  const item = await create(page, `/collections/${collection.id}/items`, { name: "Vase" });
  await page.goto(`/collections/${collection.id}/items/${item.id}`);
  let blocked = true;
  await page.route("**/api/uploads", route => blocked ? route.abort() : route.continue());
  await page.locator('input[type="file"][multiple]').setInputFiles(photo);
  await expect(page.getByText("Photo saved on this device. Open Uploads to resume.", { exact: true })).toBeVisible();
  blocked = false;
  await page.getByRole("button", { name: "Uploads (1)", exact: true }).click();
  await page.getByRole("button", { name: "Resume upload", exact: true }).click();
  await expect(page.getByText("Uploaded", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Photo saved on this device. Open Uploads to resume.", { exact: true })).toHaveCount(0);
  blocked = true;
  await page.locator('input[type="file"][multiple]').setInputFiles(photo);
  await expect(page.getByText("Photo saved on this device. Open Uploads to resume.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Discard upload", exact: true }).click();
  await expect(page.getByText("Photo saved on this device. Open Uploads to resume.", { exact: true })).toHaveCount(0);
});

test("simultaneous tabs cannot exceed the account's pending-photo allowance", async ({ page, context }) => {
  await account(page, "atomic-quota@example.com");
  const collection = await create(page, "/collections", { name: "Atomic quota" });
  const item = await create(page, `/collections/${collection.id}/items`, { name: "Vase" });
  await context.route("**/api/uploads", route => route.abort());
  await page.evaluate(({ itemId }) => new Promise<void>((resolve, reject) => {
    const token = localStorage.getItem("antique_access_token")!;
    const owner = Number(JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub);
    const request = indexedDB.open("antique-upload-queue", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("uploads", { keyPath: "id" });
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("uploads", "readwrite");
      for (let i = 0; i < 19; i++) tx.objectStore("uploads").add({
        id: crypto.randomUUID(), owner, target: { mode: "item", item_id: itemId },
        file: new Blob(["photo"]), filename: `pending-${i}.jpg`, size: 5, received: 0, state: "error"
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
  }), { itemId: item.id });
  const second = await context.newPage();
  try {
    await Promise.all([page, second].map(tab => tab.goto(`/collections/${collection.id}/items/${item.id}`)));
    await Promise.all([page, second].map(tab => tab.locator('input[type="file"][multiple]').setInputFiles(photo)));
    await expect.poll(async () => {
      const errors = await Promise.all([page, second].map(tab => tab.getByRole("alert").filter({ hasText: "Finish or discard pending uploads first." }).count()));
      return errors.reduce((sum, count) => sum + count, 0);
    }).toBe(1);
    const count = await page.evaluate(() => new Promise<number>(resolve => {
      const request = indexedDB.open("antique-upload-queue", 1);
      request.onsuccess = () => {
        const db = request.result;
        const count = db.transaction("uploads").objectStore("uploads").count();
        count.onsuccess = () => { db.close(); resolve(count.result); };
      };
    }));
    expect(count).toBe(20);
  } finally { await second.close(); }
});
