/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SetupIncompleteBanner } from "./SetupIncompleteBanner";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../services/clientStorage", () => ({
  isClientStoreReady: () => true,
  subscribeClientStoreHydrated: () => () => {},
}));

vi.mock("../utils/setupGate", () => ({
  readFirstRunSetupProfile: () => ({ level: "partial" }),
  shouldOfferSetupBanner: () => true,
}));

describe("SetupIncompleteBanner", () => {
  it("shows a resume action after CLI setup is skipped", () => {
    const reopen = vi.fn();
    window.addEventListener("ccgui:first-run-setup-reopen", reopen);
    render(<SetupIncompleteBanner />);
    expect(screen.getByTestId("first-run-setup-banner")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "onboarding.banner.action" }));
    expect(reopen).toHaveBeenCalled();
    window.removeEventListener("ccgui:first-run-setup-reopen", reopen);
  });
});
