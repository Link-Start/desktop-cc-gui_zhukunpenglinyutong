/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  AppShellHostBusProvider,
  useHostFields,
  useHostSnapshot,
  usePublishHostSlice,
} from "./appShellHostBus";

function Publisher(props: { settingsOpen: boolean; activeThreadId: string }) {
  usePublishHostSlice("session", {
    settingsOpen: props.settingsOpen,
    openSettings: () => {},
  });
  usePublishHostSlice("runtime", {
    activeThreadId: props.activeThreadId,
    handleSend: () => "sent:" + props.activeThreadId,
  });
  return null;
}

function Subscriber() {
  const snapshot = useHostSnapshot();
  const session = useHostFields("session", ["settingsOpen"]);
  const runtime = useHostFields("runtime", ["activeThreadId", "handleSend"]);
  const handleSend = runtime.handleSend as (() => string) | undefined;
  return (
    <div>
      <span data-testid="snapshot-settings">
        {String(snapshot.session?.settingsOpen ?? "missing")}
      </span>
      <span data-testid="field-settings">
        {String(session.settingsOpen ?? "missing")}
      </span>
      <span data-testid="thread">
        {String(runtime.activeThreadId ?? "missing")}
      </span>
      <span data-testid="send">
        {handleSend ? handleSend() : "missing"}
      </span>
    </div>
  );
}

function Harness() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState("thread-1");
  return (
    <AppShellHostBusProvider>
      <Publisher settingsOpen={settingsOpen} activeThreadId={activeThreadId} />
      <Subscriber />
      <button type="button" onClick={() => setSettingsOpen(true)}>
        open-settings
      </button>
      <button type="button" onClick={() => setActiveThreadId("thread-2")}>
        open-history
      </button>
    </AppShellHostBusProvider>
  );
}

describe("appShellHostBus publish flush", () => {
  it("propagates settings and thread changes after the silent render publish", () => {
    render(<Harness />);
    expect(screen.getByTestId("snapshot-settings").textContent).toBe("false");
    expect(screen.getByTestId("field-settings").textContent).toBe("false");
    expect(screen.getByTestId("thread").textContent).toBe("thread-1");
    expect(screen.getByTestId("send").textContent).toBe("sent:thread-1");

    act(() => {
      screen.getByText("open-settings").click();
    });
    expect(screen.getByTestId("snapshot-settings").textContent).toBe("true");
    expect(screen.getByTestId("field-settings").textContent).toBe("true");

    act(() => {
      screen.getByText("open-history").click();
    });
    expect(screen.getByTestId("thread").textContent).toBe("thread-2");
    expect(screen.getByTestId("send").textContent).toBe("sent:thread-2");
  });
});
