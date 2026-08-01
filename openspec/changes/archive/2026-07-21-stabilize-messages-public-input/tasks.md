## 1. Freeze precedence
- [x] 1.1 Extend conversation-state tests for matching canonical precedence、scope mismatch、engine derivation and legacy-only rendering.
- [x] 1.2 Add pure adapter tests including explicit empty collection preservation.

## 2. Establish canonical input
- [x] 2.1 Define grouped concrete input types in `contracts/messagesInput.ts`.
- [x] 2.2 Implement pure `adaptLegacyMessagesProps` with scope-safe fallback state construction.
- [x] 2.3 Move the existing body mechanically to `MessagesCore.tsx`; keep `Messages.tsx` as façade.

## 3. Publish and migrate
- [x] 3.1 Add the minimal stable `src/features/messages/index.ts` surface.
- [x] 3.2 Migrate layout direct callers/types to the public index without expanding exports.

## 4. Verify
- [x] 4.1 Run focused、layout smoke、full messages、typecheck、lint、build、boundary and large-file gates.
- [x] 4.2 Record review evidence、line counts and baseline qualifiers.
