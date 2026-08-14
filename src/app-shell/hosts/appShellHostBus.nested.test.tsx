/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
import { memo, useState } from "react";
import { describe, expect, it } from "vitest";
import {
  AppShellHostBusProvider,
  useHostFields,
  useHostSnapshot,
  usePublishHostSlice,
} from "./appShellHostBus";

function SessionLike(props: {
  settingsOpen: boolean;
  children: React.ReactNode;
}) {
  usePublishHostSlice("session", {
    settingsOpen: props.settingsOpen,
    openSettings: () => {},
  });
  return <>{props.children}</>;
}

const RuntimeLike = memo(function RuntimeLike(props: {
  activeThreadId: string;
  children: React.ReactNode;
}) {
  usePublishHostSlice("runtime", {
    activeThreadId: props.activeThreadId,
    handleSend: () => "sent:" + props.activeThreadId,
  });
  return <>{props.children}</>;
});

const AssembledLike = memo(function AssembledLike() {
  const snapshot = useHostSnapshot();
  const session = useHostFields("session", ["settingsOpen", "openSettings"]);
  const runtime = useHostFields("runtime", ["activeThreadId", "handleSend"]);
  const handleSend = runtime.handleSend as (() => string) | undefined;
  return (
    <div>
      <span data-testid="settings">{String(session.settingsOpen ?? "missing")}</span>
      <span data-testid="snapshot-settings">
        {String(snapshot.session?.settingsOpen ?? "missing")}
      </span>
      <span data-testid="thread">{String(runtime.activeThreadId ?? "missing")}</span>
      <span data-testid="send">{handleSend ? handleSend() : "missing"}</span>
    </div>
  );
});

function NestedTree() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState("thread-1");
  return (
    <AppShellHostBusProvider>
      <SessionLike settingsOpen={settingsOpen}>
        <RuntimeLike activeThreadId={activeThreadId}>
          <AssembledLike />
        </RuntimeLike>
      </SessionLike>
      <button type="button" onClick={() => setSettingsOpen(true)}>
        open-settings
      </button>
      <button type="button" onClick={() => setActiveThreadId("thread-2")}>
        open-history
      </button>
    </AppShellHostBusProvider>
  );
}

describe("nested host tree notify", () => {
  it("lets descendant assembled view see ancestor host setState", () => {
    render(<NestedTree />);
    expect(screen.getByTestId("settings").textContent).toBe("false");
    expect(screen.getByTestId("thread").textContent).toBe("thread-1");

    act(() => {
      screen.getByText("open-settings").click();
    });
    expect(screen.getByTestId("settings").textContent).toBe("true");
    expect(screen.getByTestId("snapshot-settings").textContent).toBe("true");

    act(() => {
      screen.getByText("open-history").click();
    });
    expect(screen.getByTestId("thread").textContent).toBe("thread-2");
    expect(screen.getByTestId("send").textContent).toBe("sent:thread-2");
  });
});
