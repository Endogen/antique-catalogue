import { expect, test, type Page } from "@playwright/test";

type Section = "items" | "users" | "collections" | "featured";

async function mockAdminList(page: Page, section: Section, initialTotal: number) {
  let total = initialTotal;
  const endpoint = section === "featured" ? "collections" : section;
  await page.addInitScript(() => localStorage.setItem("antique_admin_token", "test-admin"));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/admin/stats") {
      await route.fulfill({ json: {
        total_users: total, total_items: total, total_collections: total,
        featured_collection_id: null, featured_collection_name: null
      } });
    } else if (url.pathname === `/api/admin/${endpoint}/21` && request.method() === "DELETE") {
      total -= 1;
      await route.fulfill({ json: { message: "Deleted" } });
    } else if (url.pathname === `/api/admin/${endpoint}`) {
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const items = Array.from({ length: Math.max(0, Math.min(20, total - offset)) }, (_, index) => {
        const id = offset + index + 1;
        return {
          id, name: `Record ${id}`, email: `record-${id}@example.com`, username: `record-${id}`,
          collection_id: 7, collection_name: "Review", owner_email: "review@example.com",
          created_at: "2026-09-01T12:00:00Z", image_count: 0, collection_count: 0, item_count: 0,
          is_active: true, is_verified: true, is_public: true, is_featured: false, is_highlight: false
        };
      });
      await route.fulfill({ json: { total_count: total, items } });
    } else {
      await route.fulfill({ status: 401, json: { detail: "Not signed in" } });
    }
  });
  return { setTotal: (value: number) => { total = value; } };
}

for (const section of ["items", "users", "collections", "featured"] as const) {
  test(`${section} returns to the previous page when its last row disappears`, async ({ page }) => {
    const state = await mockAdminList(page, section, 21);
    const filter = section === "items" ? "&collection=7" : "";
    await page.goto(`/admin?section=${section}&q=review&page=2${filter}`);
    const lastLabel = section === "users" ? "record-21@example.com" : "Record 21";
    await expect(page.getByText(lastLabel, { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/page=2/);

    if (section === "featured") {
      // Another admin made the last public collection private.
      state.setTotal(20);
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
    } else {
      await page.getByRole("button", { name: /^Delete/ }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    }

    await expect(page).toHaveURL(url => !url.searchParams.has("page"));
    const params = new URL(page.url()).searchParams;
    expect(params.get("section")).toBe(section);
    expect(params.get("q")).toBe("review");
    if (section === "items") expect(params.get("collection")).toBe("7");
    await expect(page.getByText(section === "users" ? "record-1@example.com" : "Record 1", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);
  });
}

test("an out-of-range admin link opens the last existing page", async ({ page }) => {
  await mockAdminList(page, "items", 45);
  await page.goto("/admin?section=items&page=99");
  await expect(page).toHaveURL(/page=3/);
  await expect(page.getByText("Record 41", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Record 21", { exact: true })).toBeVisible();
});

test("an empty admin result resets to page one without looping", async ({ page }) => {
  await mockAdminList(page, "items", 0);
  await page.goto("/admin?section=items&page=2");
  await expect(page).toHaveURL(url => !url.searchParams.has("page"));
  await expect(page.getByText("No items available yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);
});

test("a previous search's empty result does not reset the new search's page", async ({ page }) => {
  const state = await mockAdminList(page, "items", 0);
  await page.goto("/admin?section=items&q=empty");
  await expect(page.getByText("No items match this search.", { exact: true })).toBeVisible();
  state.setTotal(21);
  // Native history updates preserve the mounted section, exercising the
  // keepPreviousData placeholder while the new query loads.
  await page.evaluate(() => window.history.pushState({}, "", "/admin?section=items&q=review&page=2"));
  await expect(page.getByText("Record 21", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
});
