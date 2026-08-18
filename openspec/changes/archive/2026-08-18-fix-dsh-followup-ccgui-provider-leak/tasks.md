# fix-dsh-followup-ccgui-provider-leak tasks

- [x] 1. OpenSpec proposal / design / spec delta
- [x] 2. `resolveDshModelForSend` fail-closed：拒 `ccgui`，无合法 catalog id 则 `null`
- [x] 3. `useThreadMessaging` DSH send 走 helper；`dsh-pending-*` 才回退 `composerEnginePrefs.dsh.modelId`，已有 `dsh:` session 脏 resolver 必须 omit
- [x] 4. `handleSelectModel` skip 轴：`threadEngine === "dsh" && targetEngine !== "dsh"`（不看 drifted `activeEngine`）
- [x] 5. Rust `send_user_turn` 在 `session.selectModel` 前拒收 `ccgui`
- [x] 6. vitest + cargo 回归（含 drifted `activeEngine` / pending picker / pending-only pref）
