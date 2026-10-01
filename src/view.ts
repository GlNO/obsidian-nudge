import { ItemView, WorkspaceLeaf, TFile, Notice, moment, setIcon } from "obsidian";
import { AgendaItem } from "./types";

export const VIEW_TYPE_NUDGE = "nudge-agenda-view";

// Keep the stored task date format separate from the format shown to people.
const FMT = "YYYY-MM-DD";
const DISPLAY_DATE_FMT = "MM-DD-YYYY";

export class NudgeView extends ItemView {
  private items: AgendaItem[] = [];
  private completionHistory: Record<string, number> = {};
  private draft = { title: "", date: moment().format(FMT), time: "" };
  private completedExpanded = false;

  constructor(
    leaf: WorkspaceLeaf,
    private scan: () => Promise<AgendaItem[]>,
    private add: (title: string, date: string, time?: string) => Promise<void>,
    private trashCompleted: () => Promise<number>,
    private openCompleted: () => Promise<void>,
    private complete: (item: AgendaItem) => Promise<void>,
    private getCompletionHistory: () => Record<string, number>,
    private getTimeFormat: () => "12-hour" | "24-hour"
  ) {
    super(leaf);
  }

  getViewType() { return VIEW_TYPE_NUDGE; }
  getDisplayText() { return "Nudge"; }
  getIcon() { return "calendar-check"; }

  async onOpen() {
    await this.refresh();
  }

  async refresh() {
    this.items = await this.scan();   // slow part first
    this.completionHistory = this.getCompletionHistory();
    this.render();                    // then draw, with no awaits
  }

  private render(animate = false) {
    const el = this.contentEl;
    el.empty();
    el.addClass("nudge-view");

    this.renderTop(el);

    const body = el.createDiv({ cls: "nudge-body" });
    if (animate) body.addClass("is-entering");

    const layout = body.createDiv({ cls: "nudge-dashboard" });
    const agenda = layout.createDiv({ cls: "nudge-agenda-panel" });
    const activity = layout.createDiv({ cls: "nudge-activity-panel" });

    this.renderAddForm(agenda);
    this.renderAgenda(agenda);
    this.renderHeatmap(activity);
  }

  // ---------- top bar ----------

  private renderTop(el: HTMLElement) {
    const top = el.createDiv({ cls: "nudge-top" });
    const title = top.createDiv({ cls: "nudge-view-title" });
    setIcon(title.createSpan({ cls: "nudge-view-title-icon" }), "list-checks");
    title.createSpan({ text: "Agenda" });

    const refresh = top.createEl("button", {
      cls: "nudge-icon-btn",
      attr: { "aria-label": "Refresh" },
    });
    setIcon(refresh, "refresh-cw");
    refresh.addEventListener("click", () => { void this.refresh(); });
  }

  // ---------- add form ----------

  private renderAddForm(el: HTMLElement) {
    const form = el.createDiv({ cls: "nudge-add" });
    const titleRow = form.createDiv({ cls: "nudge-add-title-row" });

    const title = titleRow.createEl("input", {
      type: "text",
      placeholder: "Add a task or reminder…",
      cls: "nudge-add-title",
    });
    title.value = this.draft.title;
    title.addEventListener("input", () => (this.draft.title = title.value));

    const addBtn = titleRow.createEl("button", { cls: "nudge-add-btn" });
    setIcon(addBtn.createSpan({ cls: "nudge-add-icon" }), "plus");
  

    const row = form.createDiv({ cls: "nudge-add-row" });

    const dateControl = row.createDiv({ cls: "nudge-date-control" });
    dateControl.createSpan({ cls: "nudge-control-label"});
    const date = dateControl.createEl("input", {
      type: "date",
      cls: "nudge-chip-input",
      attr: { "aria-label": "Due date" },
    });
    date.value = this.draft.date;
    date.addEventListener("input", () => (this.draft.date = date.value));
    date.addEventListener("click", () => date.showPicker?.());

    const timeControl = row.createDiv({ cls: "nudge-time-control" });
    timeControl.createSpan({ cls: "nudge-control-label", text: "Time" });
    const time = timeControl.createEl("input", {
      type: "time",
      cls: "nudge-chip-input",
      attr: {
        step: "300",
        "aria-label": "Due time",
        lang: this.getTimeFormat() === "12-hour" ? "en-US" : "en-GB",
      },
    });
    time.value = this.draft.time;
    time.addEventListener("input", () => (this.draft.time = time.value));
    time.addEventListener("click", () => time.showPicker?.());

    const submit = async () => {
      const text = this.draft.title.replace(/\s+/g, " ").trim();
      if (!text) {
        new Notice("Nudge: enter a title first.");
        return;
      }
      const dueDate = moment(this.draft.date, FMT, true);
      if (!dueDate.isValid()) {
        new Notice("Nudge: select a valid date.");
        return;
      }

      await this.add(text, dueDate.format(FMT), this.draft.time || undefined);
      this.draft.title = "";
      this.draft.time = "";           // keep the date for quick consecutive adds
      await this.refresh();

      // jump straight back into the box for rapid entry
      this.contentEl.querySelector<HTMLInputElement>(".nudge-add-title")?.focus();
    };

    addBtn.addEventListener("click", () => { void submit(); });
    title.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void submit();
    });
  }

  // ---------- agenda ----------

  private renderAgenda(el: HTMLElement) {
    const items = this.items
      .filter((i) => !i.done)
      .sort((a, b) =>
        `${a.date} ${a.time ?? "00:00"}`.localeCompare(`${b.date} ${b.time ?? "00:00"}`)
      );
    const completed = this.items
      .filter((i) => i.done)
      .sort((a, b) => (b.completedOn ?? "").localeCompare(a.completedOn ?? ""));

    const today = moment().format(FMT);
    const tomorrow = moment().add(1, "day").format(FMT);

    const groups: [string, AgendaItem[]][] = [
      ["Overdue", items.filter((i) => i.date < today)],
      ["Today", items.filter((i) => i.date === today)],
      ["Tomorrow", items.filter((i) => i.date === tomorrow)],
      ["Upcoming", items.filter((i) => i.date > tomorrow)],
      ["Completed", completed],
    ];

    const chipFor = (name: string, item: AgendaItem): string => {
      const displayTime = item.time
        ? moment(item.time, "HH:mm", true).format(this.getTimeFormat() === "12-hour" ? "h:mm A" : "HH:mm")
        : undefined;
      if (name === "Overdue") {
        const late = moment(today, FMT).diff(moment(item.date, FMT), "days");
        return `${late}d late`;
      }
      if (name === "Today" || name === "Tomorrow") return displayTime ?? "All day";
      if (name === "Completed") {
        return item.completedOn
          ? `Done ${moment(item.completedOn, FMT).format(DISPLAY_DATE_FMT)}`
          : "Completed";
      }
      return moment(item.date, FMT).format(DISPLAY_DATE_FMT) + (displayTime ? ` · ${displayTime}` : "");
    };

    let shown = 0;
    for (const [name, list] of groups) {
      if (list.length === 0 && name !== "Completed") continue;
      shown += list.length;

      const group = el.createDiv({ cls: `nudge-group is-${name.toLowerCase()}` });
      const head = group.createDiv({ cls: "nudge-group-title" });
      const groupName = head.createSpan({ text: name });
      if (name === "Completed") {
        groupName.addClass("is-clickable");
        groupName.setAttr("title", "Open completed tasks");
        groupName.addEventListener("click", () => { void this.openCompleted(); });
      }
      head.createSpan({ cls: "nudge-count", text: String(list.length) });

      if (name === "Completed") {
        const actions = head.createDiv({ cls: "nudge-completed-actions" });
        const toggle = actions.createEl("button", {
          cls: "nudge-completed-action",
          attr: { "aria-label": this.completedExpanded ? "Collapse completed tasks" : "Show completed tasks" },
        });
        setIcon(toggle, this.completedExpanded ? "chevron-down" : "chevron-right");
        toggle.addEventListener("click", () => {
          this.completedExpanded = !this.completedExpanded;
          this.render();
        });

        const trash = actions.createEl("button", {
          cls: "nudge-completed-action is-danger",
          attr: { "aria-label": "Delete all completed tasks" },
        });
        setIcon(trash, "trash-2");
        trash.addEventListener("click", () => {
          void (async () => {
            const confirmed = window.confirm(
              `Delete ${list.length} completed ${list.length === 1 ? "task" : "tasks"} from their notes? This cannot be undone.`,
            );
            if (!confirmed) return;

            const removed = await this.trashCompleted();
            new Notice(`Nudge: deleted ${removed} completed ${removed === 1 ? "task" : "tasks"}.`);
            await this.refresh();
          })();
        });

        if (!this.completedExpanded) continue;
      }

      for (const item of list) {
        const row = group.createDiv({ cls: "nudge-item" });
        if (item.done) row.addClass("is-completed");
        row.setAttr("title", item.filePath);

        const check = row.createEl("button", {
          cls: "nudge-check",
          attr: { "aria-label": item.done ? "Completed" : "Mark as done" },
        });
        setIcon(check, "check");
        if (item.done) {
          check.addClass("is-done");
          check.disabled = true;
        } else {
          check.addEventListener("click", (e) => {
            e.stopPropagation();        // don't also open the note
            check.disabled = true;
            row.addClass("is-completing");
            window.setTimeout(() => { void this.completeItem(item); }, 260); // let the animation play
          });
        }

        row.createSpan({ cls: "nudge-title", text: item.title });

        const chip = row.createSpan({ cls: "nudge-chip", text: chipFor(name, item) });
        if (name === "Overdue") chip.addClass("is-overdue");
        if (name === "Today") chip.addClass("is-today");

        row.addEventListener("click", () => { void this.openItem(item); });
      }
    }

    if (shown === 0) {
      const empty = el.createDiv({ cls: "nudge-empty" });
      setIcon(empty.createDiv({ cls: "nudge-empty-icon" }), "calendar-check");
      empty.createDiv({ cls: "nudge-empty-title", text: "You're all caught up" });
      empty.createDiv({ cls: "nudge-empty-sub", text: "Add a task above to get started." });
    }
  }

  // ---------- heatmap ----------

  private renderHeatmap(el: HTMLElement) {
    const WEEKS = 12;

    // count completions per day
    const counts = new Map<string, number>();
    for (const [date, count] of Object.entries(this.completionHistory)) {
      counts.set(date, count);
    }
    for (const item of this.items) {
      if (!item.completedOn) continue;
      counts.set(item.completedOn, (counts.get(item.completedOn) ?? 0) + 1);
    }

    const today = moment().startOf("day");
    const start = today.clone().startOf("isoWeek").subtract(WEEKS - 1, "weeks");

    const max = Math.max(1, ...Array.from(counts.values()));
    const level = (n: number) => (n === 0 ? 0 : Math.ceil((n / max) * 4));

    const section = el.createDiv({ cls: "nudge-activity-section" });
    const heading = section.createDiv({ cls: "nudge-section-heading" });
    setIcon(heading.createSpan({ cls: "nudge-section-heading-icon" }), "flame");
    heading.createSpan({ text: "Activity" });

    const card = section.createDiv({ cls: "nudge-card" });
    const calendar = card.createDiv({ cls: "nudge-calendar" });
    const months = calendar.createDiv({ cls: "nudge-months" });
    const calendarGrid = calendar.createDiv({ cls: "nudge-calendar-grid" });
    const weekdays = calendarGrid.createDiv({ cls: "nudge-weekdays" });
    const grid = calendarGrid.createDiv({ cls: "nudge-heatmap" });

    ["Mon", "", "Wed", "", "Fri", "", ""].forEach((label) =>
      weekdays.createDiv({ text: label })
    );

    let previousMonth = "";
    for (let w = 0; w < WEEKS; w++) {
      // Use the middle of a week for its label. This keeps months that begin
      // mid-week (for example, October 1) from being hidden by September's Monday.
      const weekMidpoint = start.clone().add(w, "weeks").add(3, "days");
      const month = weekMidpoint.format("MMM");
      if (month !== previousMonth) {
        const monthLabel = months.createSpan({
          text: month,
          attr: { style: `grid-column: ${w + 1};` },
        });
        if (w >= WEEKS - 2) monthLabel.addClass("is-last-month");
        previousMonth = month;
      }
    }

    for (let w = 0; w < WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const day = start.clone().add(w * 7 + d, "days");
        const cell = grid.createDiv({ cls: "nudge-cell" });

        if (day.isAfter(today)) {
          cell.addClass("is-future");
          continue;
        }

        const key = day.format(FMT);
        const count = counts.get(key) ?? 0;
        cell.addClass(`level-${level(count)}`);
        if (day.isSame(today, "day")) cell.addClass("is-today");
        const completionText = count === 0
          ? `No tasks completed on ${day.format("MMM Do")}`
          : `${count} ${count === 1 ? "Task" : "Tasks"} Completed on ${day.format("MMM Do")}`;
        cell.setAttr(
          "title",
          completionText
        );
      }
    }

    const legend = card.createDiv({ cls: "nudge-legend" });
    legend.createSpan({ text: "Less" });
    for (let l = 0; l <= 4; l++) {
      legend.createDiv({ cls: `nudge-cell level-${l}` });
    }
    legend.createSpan({ text: "More" });
  }

  // ---------- actions ----------

  private async openItem(item: AgendaItem) {
    const file = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { eState: { line: item.line } });
  }

  private async completeItem(item: AgendaItem) {
    const file = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!(file instanceof TFile)) return;

    const today = moment().format(FMT);
    await this.complete(item);
    item.done = true;
    item.completedOn = today;
    this.items = this.items.filter((current) => current.id !== item.id);
    this.render();                    // redraw from memory, no rescan
  }
}
