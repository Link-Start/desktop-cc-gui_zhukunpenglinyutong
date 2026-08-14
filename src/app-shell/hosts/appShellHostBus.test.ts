import { describe, expect, it } from "vitest";
import { createAppShellHostBus } from "./appShellHostBus";

describe("createAppShellHostBus", () => {
  it("notifies only subscribers of the changed slice", () => {
    const bus = createAppShellHostBus();
    let sessionTicks = 0;
    let gitTicks = 0;
    bus.subscribe('session', () => {
      sessionTicks += 1;
    });
    bus.subscribe('git', () => {
      gitTicks += 1;
    });
    bus.publish('session', { id: 'ws-1' });
    expect(sessionTicks).toBe(1);
    expect(gitTicks).toBe(0);
    bus.publish('git', { ready: true });
    expect(sessionTicks).toBe(1);
    expect(gitTicks).toBe(1);
  });

  it("skips notify when the published slice is the same reference", () => {
    const bus = createAppShellHostBus();
    const slice = { id: 'ws-1' };
    let ticks = 0;
    bus.subscribe('session', () => {
      ticks += 1;
    });
    bus.publish('session', slice);
    bus.publish('session', slice);
    expect(ticks).toBe(1);
  });

  it("flushes a silent publish when a new equal-field object is published later", () => {
    const bus = createAppShellHostBus();
    let ticks = 0;
    bus.subscribe('session', () => {
      ticks += 1;
    });
    bus.publish('session', { settingsOpen: true }, { notify: false });
    expect(ticks).toBe(0);
    bus.publish('session', { settingsOpen: true });
    expect(ticks).toBe(1);
  });

  it("flushes a silent publish when the same reference is published again", () => {
    const bus = createAppShellHostBus();
    const slice = { settingsOpen: true, openSettings: () => {} };
    let sessionTicks = 0;
    let fieldTicks = 0;
    bus.subscribe('session', () => {
      sessionTicks += 1;
    });
    bus.subscribeFields('session', ['settingsOpen'], () => {
      fieldTicks += 1;
    });
    bus.publish('session', slice, { notify: false });
    expect(sessionTicks).toBe(0);
    expect(fieldTicks).toBe(0);
    expect(bus.get('session')).toBe(slice);
    bus.publish('session', slice);
    expect(sessionTicks).toBe(1);
    expect(fieldTicks).toBe(1);
  });

  it("notifies field subscribers only when those fields change", () => {
    const bus = createAppShellHostBus();
    let idTicks = 0;
    bus.subscribeFields('session', ['id'], () => {
      idTicks += 1;
    });
    bus.publish('session', { id: 'ws-1', name: 'one' });
    bus.publish('session', { id: 'ws-1', name: 'two' });
    expect(idTicks).toBe(1);
    bus.publish('session', { id: 'ws-2', name: 'two' });
    expect(idTicks).toBe(2);
  });
});
