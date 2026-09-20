import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmProvider, useConfirm } from "@/components/ui/confirm-dialog";
import { Lightbox } from "@/components/lightbox";
import { toLoadState } from "@/lib/query-state";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { ApiError } from "@/lib/api";

vi.mock("@/components/i18n-provider", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));
vi.mock("@/lib/use-authenticated-image", () => ({
  useAuthenticatedImageUrl: () => null
}));

function ConfirmHarness({ onResult }: { onResult: (value: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={async () => {
        onResult(
          await confirm({ title: "Delete this field?", tone: "destructive" })
        );
      }}
    >
      Delete
    </button>
  );
}

const renderConfirm = (onResult: (value: boolean) => void) =>
  render(
    <ConfirmProvider>
      <ConfirmHarness onResult={onResult} />
    </ConfirmProvider>
  );

describe("confirm dialog", () => {
  it("resolves true only when the user accepts", async () => {
    const onResult = vi.fn();
    renderConfirm(onResult);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("resolves false when cancelled, so the caller never hangs", async () => {
    const onResult = vi.fn();
    renderConfirm(onResult);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("dismisses on Escape and restores focus to the trigger", async () => {
    const onResult = vi.fn();
    renderConfirm(onResult);
    const trigger = screen.getByRole("button", { name: "Delete" });

    await userEvent.click(trigger);
    const dialog = await screen.findByRole("alertdialog");
    // Focus must land inside the dialog, not stay on the page behind it.
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe("lightbox", () => {
  it("traps focus, locks scrolling, and closes on Escape", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Lightbox open src="/api/images/1/original.jpg" alt="Vase" onClose={onClose} />
    );

    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();

    rerender(<Lightbox open={false} src={null} onClose={onClose} />);
    await waitFor(() => expect(document.body.style.overflow).not.toBe("hidden"));
  });
});

describe("query state mapping", () => {
  const base = { data: undefined, error: null, isError: false, isPending: true };

  it("reports a disabled query as idle rather than loading", () => {
    expect(
      toLoadState({ ...base, fetchStatus: "idle" } as never, "fallback", []).status
    ).toBe("idle");
    expect(
      toLoadState({ ...base, fetchStatus: "fetching" } as never, "fallback", []).status
    ).toBe("loading");
  });

  it("surfaces the API detail for an API error and the fallback otherwise", () => {
    const apiError = toLoadState(
      {
        data: undefined,
        error: new ApiError(404, "Collection not found"),
        isError: true,
        isPending: false,
        fetchStatus: "idle"
      } as never,
      "fallback",
      []
    );
    expect(apiError).toMatchObject({
      status: "error",
      error: "Collection not found"
    });

    const unknown = toLoadState(
      {
        data: undefined,
        error: new Error("boom"),
        isError: true,
        isPending: false,
        fetchStatus: "idle"
      } as never,
      "fallback",
      []
    );
    expect(unknown.error).toBe("fallback");
  });
});

describe("stacked overlays", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  function Stack({ outer, inner }: { outer: boolean; inner: boolean }) {
    const first = useFocusTrap<HTMLDivElement>(outer);
    const second = useFocusTrap<HTMLDivElement>(inner);
    return <>
      <button type="button">Open dialogs</button>
      {outer && <div ref={first} data-testid="outer" tabIndex={-1} />}
      {inner && <div ref={second} data-testid="inner" tabIndex={-1} />}
    </>;
  }

  it.each(["outer", "inner"])("keeps scrolling locked until both dialogs close, closing %s first", (first) => {
    document.body.style.overflow = "auto";
    const view = render(<Stack outer={false} inner={false} />);
    const trigger = screen.getByRole("button", { name: "Open dialogs" });
    trigger.focus();
    view.rerender(<Stack outer inner={false} />);
    view.rerender(<Stack outer inner />);
    view.rerender(<Stack outer={first !== "outer"} inner={first !== "inner"} />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(screen.getByTestId(first === "outer" ? "inner" : "outer"));
    view.rerender(<Stack outer={false} inner={false} />);
    expect(document.body.style.overflow).toBe("auto");
    expect(document.activeElement).toBe(trigger);
  });

  it("releases the scroll lock when a page with multiple open dialogs unmounts", () => {
    document.body.style.overflow = "scroll";
    const view = render(<React.StrictMode><Stack outer inner /></React.StrictMode>);
    expect(document.body.style.overflow).toBe("hidden");
    view.unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("closes only the topmost trap on Escape", async () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();

    function Stacked() {
      const outer = useFocusTrap<HTMLDivElement>(true, closeOuter);
      const inner = useFocusTrap<HTMLDivElement>(true, closeInner);
      return (
        <>
          <div ref={outer} data-testid="outer" tabIndex={-1}>
            <button type="button">outer action</button>
          </div>
          <div ref={inner} data-testid="inner" tabIndex={-1}>
            <button type="button">inner action</button>
          </div>
        </>
      );
    }

    render(<Stacked />);
    await userEvent.keyboard("{Escape}");

    // The later-opened trap owns the key; the one beneath it must survive.
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });
});
