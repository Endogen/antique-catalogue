import React from "react";
import { expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SchemaBuilder } from "@/components/schema-builder";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { queryKeys } from "@/lib/query-keys";

vi.mock("@/components/i18n-provider", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

it("keeps an unsaved field name when a background schema refresh arrives", async () => {
  const field = { id: 1, schema_template_id: 1, name: "Maker", field_type: "text", is_required: false, is_private: false, options: null, position: 0, created_at: "", updated_at: "" };
  const api = {
    list: vi.fn(async () => [field]),
    create: vi.fn(async () => field),
    update: vi.fn(async () => ({ ...field, name: "Manufacturer" })),
    delete: vi.fn(),
    reorder: vi.fn(async () => [field])
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><ConfirmProvider><SchemaBuilder api={api} sourceKey="template:1" /></ConfirmProvider></QueryClientProvider>);
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  const input = screen.getByLabelText("Field name") as HTMLInputElement;
  await waitFor(() => expect(input.value).toBe("Maker"));
  await userEvent.clear(input);
  await userEvent.type(input, "Manufacturer");
  await act(async () => {
    client.setQueryData(queryKeys.schemaTemplates.fields("template:1"), [{ ...field, position: 1 }]);
  });
  expect(input.value).toBe("Manufacturer");
  await userEvent.click(screen.getByRole("button", { name: "Update field" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith(1, expect.objectContaining({ name: "Manufacturer" })));
  view.unmount();
  client.clear();
});
