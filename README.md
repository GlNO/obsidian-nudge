# Nudge

### A focused task agenda for Obsidian.

**Nudge** collects dated tasks from your vault, organizes them by urgency, provides optional reminders, and stores everything locally in Markdown.

> 🐛 **A little heads-up:** This is my first Obsidian plugin, so expect a few bugs along the way!
> If you run into something that doesn't seem right, feel free to open an issue and let me know. Cheers!

---

## ✨ Features

* 📋 Dedicated agenda view for:

  * Overdue tasks
  * Today's tasks
  * Tomorrow's tasks
  * Upcoming tasks
  * Completed tasks
* ➕ Add tasks directly from the Nudge view
* 🔎 Scan all Markdown notes in your vault
* ✅ Mark tasks as completed from the agenda
* 🔥 Completion activity heatmap
* 📖 Open tasks in their source note
* ⚡ Live updates when notes change
* ⚙️ Configurable inbox note and reminder timing
* 🔒 Local-only storage with no external services

---

## 📝 Task Syntax

Nudge recognizes Markdown checklist items containing a due-date token.

### All-day task

```markdown
- [ ] Review project notes @2026-10-05
```

### Timed task

```markdown
- [ ] Team meeting @2026-10-06 14:30
```

A task may also be marked complete with a completion date:

```markdown
- [x] Review project notes @2026-10-05 done:2026-10-04
```

---

## 📥 Inbox

Tasks created from the Nudge agenda are saved in the configured inbox note as a Markdown table.

### Example

```markdown
# Tasks

| Task | Due | Time | Completed |
| --- | --- | --- | --- |
| Review project notes | 2026-10-05 | | |
| Team meeting | 2026-10-06 | 14:30 | |
```

Completed tasks are moved to a separate **Completed** section.

Existing inbox tasks are migrated to this table format automatically when required.

The default inbox note is:

```text
Nudge_Inbox.md
```

---

## 🚀 Getting Started

1. Install and enable Nudge.
2. Open the command palette and run **Open Nudge agenda**, or click the Nudge calendar icon in the ribbon.
3. Enter a task title.
4. Select a due date and optional time.
5. Select the **+** button or press `Enter`.
6. Tasks from other Markdown notes are included automatically when they use the supported checklist syntax.

---

## ⌨️ Commands

| Command                         | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| **Open Nudge agenda**           | Open the Nudge agenda view.                            |
| **Scan vault for agenda items** | Scan the vault and log the number of recognized tasks. |

---

## ⚙️ Settings

Nudge provides the following settings:

| Setting                   | Description                                                    |
| ------------------------- | -------------------------------------------------------------- |
| **Enable reminders**      | Enable or disable task reminders.                              |
| **Lead time (minutes)**   | How long before a timed task to show its reminder.             |
| **All-day reminder time** | The time used for tasks without a specific time.               |
| **Inbox note**            | The Markdown note where tasks added from the agenda are saved. |

The default inbox note is `Nudge_Inbox.md`.

---

## ✅ Completing Tasks

Select the check button beside an active task to complete it.

Tasks from other notes are copied to the inbox's **Completed** section and removed from their original location.

Tasks already stored in the inbox are moved to its **Completed** section.

Completed tasks can be expanded from the agenda.

The trash button permanently removes completed tasks from their notes.

---

## 📦 Installation

### Community Plugins

1. Open **Settings → Community plugins**.
2. Search for **Nudge**.
3. Install and enable the plugin.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create this folder in your vault:

```text
.obsidian/plugins/obsidian-nudge/
```

3. Copy the downloaded files into that folder.
4. Reload Obsidian.
5. Enable **Nudge** in **Settings → Community plugins**.

---

## 🛠️ Development

### Requirements

* Node.js 18 or newer
* npm

### Install dependencies

```bash
npm install
```

### Development build

Run the development build in watch mode:

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

The compiled plugin entry point is `main.js`.

---

## 🔒 Privacy

Nudge operates locally inside your Obsidian vault.

It does not require:

* An account
* A cloud service
* Telemetry
* External network requests

---

## 💡 Inspiration

Nudge was inspired by the calendar and activity visualization concepts of **[Heatmap Calendar](https://github.com/Richardsl/heatmap-calendar-obsidian)** by **Richardsl**.

The project served as inspiration for Nudge's completion activity heatmap and helped shape some of its visual ideas.

Nudge is an independent project and is not affiliated with or endorsed by the Heatmap Calendar project.



