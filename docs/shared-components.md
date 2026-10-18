# Shared components

Trevor's rule: the same feature in two places is one shared component. Before building a
control, layout or helper, look here first. If what you need is close but not quite, extend
the shared one (a prop, a snippet) instead of copying it.

## Where things live

| Folder                        | What goes there                                                             |
| ----------------------------- | --------------------------------------------------------------------------- |
| `src/lib/core`                | Pure TypeScript rules and data, with Vitest tests. No Svelte or DOM.        |
| `src/lib/ui/primitives`       | Controls with no game knowledge. Features never import `@ark-ui/*`.         |
| `src/lib/ui/layout`           | Page structure: `Page`, `PageSection`.                                      |
| `src/lib/ui/builder`          | The parts every builder page shares (Script builder, Character builder).    |
| `src/lib/ui/share`            | The share screen (code, QR, link).                                          |
| `src/lib/ui/*.ts`             | Helpers with no game knowledge: `stored.ts`, `download.ts`, `clipboard.ts`. |
| `src/lib/features/characters` | Anything that draws a character or reminder.                                |

## The shared pieces

| Job                                                 | Use                                                                                                                                   | Enforced by                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A page reached from the sidebar                     | `ui/layout/Page.svelte` (title, actions, subtitle, toolbar, side)                                                                     | review                                 |
| A section of a page                                 | `ui/layout/PageSection.svelte`                                                                                                        | review                                 |
| A labelled text field, one line or several          | `ui/primitives/TextField.svelte`                                                                                                      | `grim/text-field`                      |
| A search box                                        | `ui/primitives/SearchField.svelte`                                                                                                    | `grim/text-field`                      |
| A list of short texts with add and remove           | `ui/primitives/TextListField.svelte`                                                                                                  | review                                 |
| The clear X on a field                              | `ui/primitives/ClearableField.svelte` (TextField has it)                                                                              | `grim/clearable-field`                 |
| One choice among a few                              | `ui/primitives/Select.svelte`                                                                                                         | `grim/dropdown-choice`                 |
| Cancel and Confirm in a modal                       | `ui/primitives/ModalActions.svelte`                                                                                                   | `grim/modal-actions`                   |
| A modal or full-screen panel                        | `ui/primitives/Dialog.svelte`; `full` and `max` scroll their content under the header (`scroll={false}` for content that pans itself) | `e2e/dialog-scroll.e2e.ts`             |
| A confirmation                                      | `ui/primitives/ConfirmDialog.svelte`                                                                                                  | `grim/confirm-dialog`                  |
| Delete, remove, clear                               | `ui/primitives/DeleteButton.svelte`                                                                                                   | `grim/delete-button`                   |
| A number with − and +                               | `ui/primitives/Stepper.svelte`                                                                                                        | review                                 |
| A count beside a heading                            | `ui/primitives/CountBadge.svelte`                                                                                                     | review                                 |
| A builder's title-row tools (open, download, clear) | `ui/builder/BuilderTools.svelte`                                                                                                      | review                                 |
| A builder's Save and Save as new                    | `ui/builder/BuilderSave.svelte`                                                                                                       | review                                 |
| A builder's "Open a saved …" list                   | `ui/builder/OpenSavedDialog.svelte`                                                                                                   | review                                 |
| A table                                             | `ui/table/DataTable.svelte`                                                                                                           | review                                 |
| A character name                                    | `features/characters/CharacterBadge.svelte`                                                                                           | `grim/names-as-badges`                 |
| A reminder name                                     | `features/characters/ReminderToken.svelte`                                                                                            | `grim/names-as-badges`                 |
| An entry headed by a character                      | `features/characters/CharacterEntry.svelte`                                                                                           | review                                 |
| A character picker                                  | `features/characters/CharacterPicker.svelte`                                                                                          | review                                 |
| A day or vote timer                                 | `features/day/DayTimer.svelte`                                                                                                        | review                                 |
| A script's details                                  | `features/scripts/ScriptView.svelte`                                                                                                  | review                                 |
| Reading and writing localStorage                    | `ui/stored.ts` (`readStored`, `writeStored`, `readParsed`, `readStoredText`, `writeStoredText`)                                       | `no-restricted-globals` (localStorage) |
| Copying text, with its toast                        | `ui/clipboard.ts` (`copyText`)                                                                                                        | review                                 |
| A share screen (code, QR, link, Copy, Share)        | `ui/share/SharePanel.svelte`                                                                                                          | review                                 |
| A seat named in a sentence ("Seat 3 (Alex)")        | `features/game/seat-label.ts` (`seatLabel`)                                                                                           | review                                 |
| Saving a file to the device                         | `ui/download.ts` (`downloadJson`, `downloadFile`, `fileNameFor`)                                                                      | review                                 |
| Pixel sizes                                         | `var(--u)` and tokens                                                                                                                 | `npm run lint:px`                      |
| Colours                                             | theme tokens                                                                                                                          | `npm run lint:colors`                  |

## Lists that only shrink

Some lints start with a list of files written before the lint (for example
`LOCAL_STORAGE_TODO` in `eslint.config.js`). Move a file onto the shared piece and take it off
the list. Never add a file to one.

## Still to share

The open items, with owners, are in the project's component review
(`component-review/consolidation-plan.md` in the shared project files).
