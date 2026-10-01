# Nudge

Nudge is a focused task agenda for Obsidian. It collects dated tasks from your vault, organizes them by urgency, provides reminders, and stores everything locally in Markdown.

## Features

- Dedicated agenda view for overdue, today's, tomorrow's, upcoming, and completed tasks
- Add tasks directly from the Nudge view
- Scan all Markdown notes in your vault
- Support for timed and all-day tasks
- Optional desktop notifications for upcoming tasks
- Mark tasks as completed from the agenda
- Completion activity heatmap
- Open tasks in their source note
- Live updates when notes change
- Configurable inbox note and reminder timing
- Local-only storage with no external services

## Task syntax

Nudge recognizes Markdown checklist items containing a due-date token:

```markdown
- [ ] Review project notes @2026-10-05
- [ ] Team meeting @2026-10-06 14:30

A task may also be marked complete with a completion date:
- [x] Review project notes @2026-10-05 done:2026-10-04

Inbox format
Tasks created from the Nudge agenda are saved in the configured inbox note as a Markdown table:

# Tasks

| Task | Due | Time | Completed |
| --- | --- | --- | --- |
| Review project notes | 2026-10-05 |  |  |
| Team meeting | 2026-10-06 | 14:30 |  |

Completed tasks are moved to a separate Completed section.

Existing inbox tasks are migrated to this table format automatically when required.

Getting started
Install and enable Nudge.
Open the command palette and run Open Nudge agenda, or click the Nudge calendar icon in the ribbon.
Enter a task title.
Select a due date and optional time.
Select the plus button or press Enter.
Tasks from other Markdown notes are included automatically when they use the supported checklist syntax.

Tasks from other Markdown notes are included automatically when they use the supported checklist syntax.

Commands
Open Nudge agenda: Open the Nudge agenda view.
Scan vault for agenda items: Scan the vault and log the number of recognized tasks.
Settings
Nudge provides the following settings:

Enable reminders: Enable or disable task reminders.
Lead time (minutes): How long before a timed task to show its reminder.
All-day reminder time: The time used for tasks without a specific time.
Inbox note: The Markdown note where tasks added from the agenda are saved.
The default inbox note is Nudge_Inbox.md.

Completing tasks
Select the check button beside an active task to complete it.

Tasks from other notes are copied to the inbox's completed section and removed from their original location. Tasks already stored in the inbox are moved to its completed section.

Completed tasks can be expanded from the agenda. The trash button permanently removes completed tasks from their notes.

Installation
Community plugins
Open Settings → Community plugins.
Search for Nudge.
Install and enable the plugin.
Manual installation
Download main.js, manifest.json, and styles.css from the latest release.

Create this folder in your vault:

.obsidian/plugins/obsidian-nudge/

Copy the downloaded files into that folder.

Reload Obsidian.

Enable Nudge in Settings → Community plugins.

Development
Requirements:

Node.js 18 or newer
npm
Install dependencies:
npm install