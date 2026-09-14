import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider, useI18n } from "@/components/i18n-provider";

function Language() {
  const { locale, setLocale } = useI18n();
  return <button onClick={() => setLocale("en")}>{locale}</button>;
}
beforeEach(() => {
  document.cookie = "preferred-language=;path=/;max-age=0";
  localStorage.clear();
});
afterEach(() => { vi.restoreAllMocks(); document.cookie = "preferred-language=;path=/;max-age=0"; });

it("migrates a legacy choice and preserves subsequent cookie choices", async () => {
  localStorage.setItem("preferred-language", "de");
  const view = render(<I18nProvider initialLocale="en"><Language /></I18nProvider>);
  await waitFor(() => expect(document.documentElement.lang).toBe("de"));
  expect(document.cookie).toContain("preferred-language=de");
  expect(localStorage.getItem("preferred-language")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "de" }));
  view.rerender(<I18nProvider initialLocale="de"><Language /></I18nProvider>);
  expect(screen.getByRole("button", { name: "en" })).toBeTruthy();
  expect(document.cookie).toContain("preferred-language=en");
});

it("lets an existing cookie win over the legacy preference", () => {
  document.cookie = "preferred-language=en;path=/";
  localStorage.setItem("preferred-language", "de");
  render(<I18nProvider initialLocale="en"><Language /></I18nProvider>);
  expect(screen.getByRole("button", { name: "en" })).toBeTruthy();
});

it("uses the server locale when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  render(<I18nProvider initialLocale="de"><Language /></I18nProvider>);
  expect(screen.getByRole("button", { name: "de" })).toBeTruthy();
});
