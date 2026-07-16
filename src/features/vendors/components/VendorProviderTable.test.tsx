// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VendorProviderTable } from "./VendorProviderTable";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("VendorProviderTable", () => {
  it("renders shared vendor table chrome with optional drag column", () => {
    const { container } = render(
      <VendorProviderTable
        loading={false}
        empty={false}
        emptyText="empty"
        includeDragColumn
        renderRows={() => (
          <tbody data-slot="table-body">
            <tr data-slot="table-row">
              <td data-slot="table-cell" />
              <td data-slot="table-cell">Provider A</td>
              <td data-slot="table-cell">Ready</td>
              <td data-slot="table-cell">Actions</td>
            </tr>
          </tbody>
        )}
      />,
    );

    expect(screen.getByText("Provider A")).toBeTruthy();
    expect(screen.getByText("settings.vendor.providerColumn")).toBeTruthy();
    expect(screen.getByText("settings.vendor.statusColumn")).toBeTruthy();
    expect(screen.getByText("settings.vendor.actionsColumn")).toBeTruthy();
    expect(
      container.querySelector("th.vendor-provider-table-drag-cell"),
    ).toBeTruthy();
  });

  it("renders loading and empty states around the shared table", () => {
    const { rerender } = render(
      <VendorProviderTable
        loading
        empty={false}
        emptyText="empty"
        renderRows={() => null}
      />,
    );

    expect(screen.getByText("settings.loading")).toBeTruthy();

    rerender(
      <VendorProviderTable
        loading={false}
        empty
        emptyText="empty"
        renderRows={() => null}
      />,
    );

    expect(screen.getByText("empty")).toBeTruthy();
    expect(
      document.querySelector(".vendor-provider-table-frame")?.getAttribute("data-empty"),
    ).toBe("true");
    expect(document.querySelector(".vendor-provider-table-stack")).toBeTruthy();
  });

  it("can hide the table header for compact official config blocks", () => {
    const { container } = render(
      <VendorProviderTable
        loading={false}
        empty={false}
        emptyText="empty"
        showHeader={false}
        renderRows={() => (
          <tbody data-slot="table-body">
            <tr data-slot="table-row">
              <td data-slot="table-cell">Provider A</td>
            </tr>
          </tbody>
        )}
      />,
    );

    expect(container.querySelector("thead")).toBeNull();
    expect(screen.getByText("Provider A")).toBeTruthy();
  });
});
