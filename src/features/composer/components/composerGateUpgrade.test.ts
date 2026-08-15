import { describe, expect, it } from "vitest";
import {
  COMPOSER_GATE_IDLE_UPGRADE_MS,
  COMPOSER_GATE_INPUT_QUIET_MS,
  COMPOSER_GATE_MIN_LIGHT_MS,
  shouldUpgradeComposerFromLight,
} from "../utils/composerGateUpgrade";

describe("shouldUpgradeComposerFromLight", () => {
  it("does not upgrade before startup-gate-ready even at the idle ceiling", () => {
    expect(
      shouldUpgradeComposerFromLight({
        elapsedMs: COMPOSER_GATE_IDLE_UPGRADE_MS,
        hadInputSinceMount: false,
        quietForMs: COMPOSER_GATE_IDLE_UPGRADE_MS,
        recentInput: false,
        startupGateReady: false,
      }),
    ).toBe(false);
  });

  it("does not upgrade in the first seconds even after a permission-button click goes quiet", () => {
    expect(
      shouldUpgradeComposerFromLight({
        elapsedMs: 2_200,
        hadInputSinceMount: true,
        quietForMs: 1_300,
        recentInput: false,
        startupGateReady: true,
      }),
    ).toBe(false);
  });

  it("does not upgrade while the user is still clicking composer chrome", () => {
    expect(
      shouldUpgradeComposerFromLight({
        elapsedMs: COMPOSER_GATE_MIN_LIGHT_MS + 500,
        hadInputSinceMount: true,
        quietForMs: 80,
        recentInput: true,
        startupGateReady: true,
      }),
    ).toBe(false);
  });

  it("upgrades after the light floor plus a quiet slice", () => {
    expect(
      shouldUpgradeComposerFromLight({
        elapsedMs: COMPOSER_GATE_MIN_LIGHT_MS + COMPOSER_GATE_INPUT_QUIET_MS,
        hadInputSinceMount: true,
        quietForMs: COMPOSER_GATE_INPUT_QUIET_MS,
        recentInput: false,
        startupGateReady: true,
      }),
    ).toBe(true);
  });

  it("does not treat an idle 2.8s as enough to mount ComposerImpl", () => {
    expect(
      shouldUpgradeComposerFromLight({
        elapsedMs: 2_800,
        hadInputSinceMount: false,
        quietForMs: 2_800,
        recentInput: false,
        startupGateReady: true,
      }),
    ).toBe(false);
  });

  it("still converges at the idle ceiling so Light cannot last forever", () => {
    expect(
      shouldUpgradeComposerFromLight({
        elapsedMs: COMPOSER_GATE_IDLE_UPGRADE_MS,
        hadInputSinceMount: true,
        quietForMs: 100,
        recentInput: false,
        startupGateReady: true,
      }),
    ).toBe(true);
  });
});
