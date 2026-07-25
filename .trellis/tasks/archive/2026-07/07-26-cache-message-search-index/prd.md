# Cache Message Search Index

## Goal

实现 OpenSpec change `cache-message-search-index`：相同 immutable message snapshot 跨 query 复用索引，并预存 normalized text。

## Requirements

- Weak snapshot cache 自动随 snapshot identity 失效
- 保持 substring matching、score、snippet、result identity 不变
- 不新增 dependency、持久化或 root state

## Acceptance Criteria

- [ ] 相同 snapshot 返回同一 index reference
- [ ] 新 snapshot 重建并反映新增、编辑、删除
- [ ] Focused tests、lint、typecheck、OpenSpec strict validation 通过

## Technical Notes

唯一关联 OpenSpec change：`cache-message-search-index`。
