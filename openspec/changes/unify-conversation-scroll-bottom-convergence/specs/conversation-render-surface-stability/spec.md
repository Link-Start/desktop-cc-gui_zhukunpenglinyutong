## MODIFIED Requirements

### Requirement: Live bottom-follow MUST react to rendered content growth

When live assistant text is delivered through a path that does not mutate the root conversation item array for every delta, the message surface MUST keep bottom-follow behavior tied to actual rendered content growth. History-open, live growth, turn-settle, timeline remeasure, auto-follow re-enable, and explicit bottom navigation MUST preserve their existing trigger semantics while delegating bottom movement to one shared convergence owner.

#### Scenario: streaming height growth keeps viewport pinned during follow window

- **WHEN** a conversation is actively streaming
- **AND** the message timeline's rendered height grows
- **AND** bottom-follow is currently allowed by the streaming follow window
- **THEN** the viewport MUST remain at the true bottom of the scroll container
- **AND** the behavior MUST NOT depend solely on reducer item identity or `scrollKey` changes

#### Scenario: direct bottom scroll includes container padding

- **WHEN** the user or live follow behavior scrolls to the latest output
- **THEN** the scroll target MUST be the scroll container's true bottom
- **AND** bottom padding MUST NOT remain below the viewport solely because a bottom sentinel used `scrollIntoView`

#### Scenario: post-write virtualizer correction is reconverged

- **WHEN** a bottom trigger writes the current true-bottom target
- **AND** virtual row measurement or content layout subsequently changes `scrollHeight` or corrects `scrollTop`
- **THEN** the active bottom operation MUST recompute the target on later animation frames
- **AND** it MUST complete only after the viewport remains at true bottom for consecutive stable frames or a bounded safety budget is exhausted

#### Scenario: existing bottom trigger points share one owner

- **WHEN** history-open, live growth, turn-settle, timeline scope reset, auto-follow re-enable, or the floating bottom control requests bottom movement
- **THEN** each trigger MUST delegate to the same active scroll convergence owner
- **AND** a newer request MUST cancel or replace an older active convergence run instead of creating competing writers

#### Scenario: deliberate scroll-away releases bottom-follow

- **WHEN** the user intentionally scrolls upward during a live conversation
- **THEN** automatic bottom-follow MUST pause
- **AND** any active automatic bottom convergence MUST be cancelled
- **AND** later rendered height growth MUST NOT force the viewport back to bottom until a follow window or explicit user action allows it

#### Scenario: explicit top and bottom navigation retain their positions

- **WHEN** the user activates the existing floating top or bottom control
- **THEN** the control MUST retain its current direction, visibility, visual, and accessibility semantics
- **AND** top navigation MUST converge to zero while bottom navigation MUST converge to the current true bottom through the shared owner

#### Scenario: history initialization is independent from focus follow

- **WHEN** an idle history conversation opens and its virtualized or deferred rows finish measuring after the first paint
- **THEN** the viewport MUST recheck and converge to the true bottom during a bounded initialization window
- **AND** disabling live focus follow MUST NOT disable this one-time history placement

#### Scenario: focus follow governs live and settle rechecks

- **WHEN** live output grows or a completed turn back-fills the full timeline
- **THEN** delayed bottom rechecks MUST run only while focus follow is enabled and the user remains parked at the bottom
- **AND** disabling focus follow or deliberately scrolling away MUST cancel active and pending automatic follow work

#### Scenario: explicit navigation does not mutate focus follow preference

- **WHEN** the user activates the floating bottom control while focus follow is disabled
- **THEN** the viewport MUST navigate to the true bottom once
- **AND** the persisted focus follow preference MUST remain disabled

#### Scenario: stable edge checks do not emit redundant scroll writes

- **WHEN** a convergence pulse or delayed checkpoint finds the viewport already within tolerance of its target
- **THEN** it MUST count the frame as stable without assigning `scrollTop` again
- **AND** duplicate requests for the same active intent MUST NOT restart its checkpoint sequence

#### Scenario: active conversation history initializes before settlement

- **WHEN** history content first becomes available while the conversation is already working or thinking
- **THEN** the viewport MUST perform and record its one-time history placement immediately
- **AND** a later turn settlement MUST NOT be mistaken for missing history initialization
- **AND** a user scroll-away after initial placement MUST remain authoritative through settlement

#### Scenario: automatic bottom intents receive a two-second final calibration

- **WHEN** history-open, live-follow, turn-settle, or focus-follow re-enable requests bottom convergence
- **THEN** the owner MUST retain immediate feedback and the existing early checkpoints
- **AND** it MUST re-evaluate the current true bottom at 2000ms within a lifecycle budget that tolerates timer jitter
- **AND** thread switch, manual scroll-away, top navigation, or focus-follow disable MUST cancel the pending final calibration where applicable

#### Scenario: closing and reopening the same cached thread restarts history placement

- **WHEN** the persistent message surface transitions from thread A to no active thread and later back to thread A
- **THEN** the reopened thread MUST be treated as a new history-placement lifecycle
- **AND** cached history that is already available without a loading phase MUST still converge to the true bottom
- **AND** oversized or lightweight timeline presentation MUST NOT bypass this placement

#### Scenario: every followed turn settles before back-fill can release the intent

- **WHEN** a followed conversation completes any later turn and the full timeline back-fills
- **THEN** turn-settle convergence MUST be armed during the layout phase before asynchronous geometry scroll signals
- **AND** repeated turns MUST each receive the same settle convergence sequence
- **AND** deliberate user scroll-away or disabled focus follow MUST remain authoritative
