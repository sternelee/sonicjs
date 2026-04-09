# Fix #762: Migration ID 029 Reused Across Versions

## Overview
Migration ID `029` was reassigned from "Ai Search Plugin" to "Add Forms System" between SonicJS releases. Users upgrading from older versions have `029` marked as applied (for AI Search), so the forms migration is skipped, causing cascading failures for migrations `030` and `033` which depend on the `forms` and `form_submissions` tables.

## Requirements
- [x] Add auto-detection for migration 029 (forms tables) in `autoDetectAppliedMigrations()`
- [x] If 029 is marked as applied but `forms` table doesn't exist, remove it so it re-runs (same pattern as migration 011)
- [x] Improve error messaging in admin API to include per-migration failure details
- [x] Add unit tests for the new detection logic

## Technical Approach

### Architecture
This follows the existing pattern used for migration `011` (managed column detection), which already handles the case where a migration is marked as applied but its artifacts don't exist. We extend this pattern to migration `029`.

### File Changes
| File | Action | Description |
|------|--------|-------------|
| `packages/core/src/services/migrations.ts` | Modify | Add 029 auto-detection with existence check (like 011 pattern) |
| `packages/core/src/routes/admin-api.ts` | Modify | Include per-migration error details in response |
| `packages/core/src/services/migrations.test.ts` | Create/Modify | Unit tests for new detection logic |

### Database Changes
None — this only changes detection logic, not schema.

## Implementation Steps
1. Add forms table auto-detection for migration 029 in `autoDetectAppliedMigrations()` using the same bidirectional pattern as migration 011
2. Improve admin API error response to include specific migration failure details
3. Write unit tests
4. Run existing tests to verify no regressions

## Testing Strategy

### Unit Tests
- Migration 029 marked as applied + forms table exists → keep as applied
- Migration 029 marked as applied + forms table missing → remove, mark as pending
- Migration 029 not applied + forms table exists → mark as applied
- Migration 029 not applied + forms table missing → leave as pending

## Approval
- [ ] Plan reviewed and approved by user
