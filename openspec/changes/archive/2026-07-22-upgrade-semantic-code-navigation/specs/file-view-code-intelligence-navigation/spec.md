## ADDED Requirements

### Requirement: Editor MUST Support Go To Implementation

系统 SHALL 在 file editor 提供“Go to Implementations” action，并 MUST 复用既有 open-at-location 与 candidate selection surface。

#### Scenario: A symbol has one implementation
- **WHEN** 用户在 interface、trait、class 或 method symbol 上触发 go-to-implementation
- **AND** backend 返回唯一 target
- **THEN** editor MUST 直接打开或激活目标文件并定位到目标位置

#### Scenario: A symbol has multiple implementations
- **WHEN** backend 返回多个 implementation targets
- **THEN** editor MUST 展示具名 candidate list
- **AND** 用户选择后 MUST 跳转到对应 target

#### Scenario: No implementation exists
- **WHEN** backend 返回空 implementation result
- **THEN** editor MUST 显示明确 empty feedback
- **AND** MUST NOT 清空或修改当前文件内容

### Requirement: Rust Files MUST Participate In Code Intelligence Navigation

Rust source files SHALL 支持 definition、references 与 implementation navigation，semantic provider 可用时 MUST 使用其 scope/type-aware result。

#### Scenario: Navigate a Rust definition
- **WHEN** 用户在 `.rs` file 的 symbol 上触发 definition
- **THEN** 系统 MUST 返回可导航 Rust definition 或明确 empty feedback

#### Scenario: Navigate Rust trait implementations
- **WHEN** 用户在 Rust trait 或 trait method 上触发 go-to-implementation
- **THEN** 系统 MUST 返回 `impl Trait for Type` 等 semantic targets
- **AND** unrelated same-name functions MUST NOT 作为 semantic result 混入

### Requirement: Existing Languages MUST Keep A Safe Implementation Fallback

Java、TS/JS 与 Rust SHALL 在 semantic implementation provider 不可用时识别明确 implementation declarations，并 MUST 保持 multi-target behavior。

#### Scenario: Java or TypeScript interface has implementations
- **WHEN** 用户对 interface/class name 触发 go-to-implementation
- **THEN** fallback MAY 返回明确 `implements` 或 `extends` declaration
- **AND** candidates MUST 保持 workspace-contained、deduplicated 与 deterministic

#### Scenario: Unsupported language triggers implementation query
- **WHEN** 当前 file language 不支持 semantic 或 fallback implementation lookup
- **THEN** backend MUST 返回可解释 unsupported error
- **AND** frontend MUST NOT crash
