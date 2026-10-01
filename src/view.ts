import { ItemView, WorkspaceLeaf, TFile, Notice, moment } from "obsidian";
import { AgendaItem } from "./types";
import { parseLine } from "./parser";

export const VIEW_TYPE_NUDGE = "nudge-agenda-view";

type TabId = "agenda" | "heatmap";

export class NudgeView extends ItemView {
  private activeTab: TabId = "agenda";
  private items: AgendaItem[] = [];

  constructor(
    leaf: WorkspaceLeaf,
    private scan: () => Promise<AgendaItem[]>
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
    this.render();                    // then draw, with no awaits
  }

  private render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("nudge-view");

    this.renderTabs(el);

    if (this.activeTab === "agenda") this.renderAgenda(el);
    else this.renderHeatmap(el);
  }

  private renderTabs(el: HTMLElement) {
    const bar = el.createDiv({ cls: "nudge-tabs" });

    const tabs: [TabId, string][] = [
      ["agenda", "Agenda"],
      ["heatmap", "Heatmap"],
    ];

    for (const [id, label] of tabs) {
      const tab = bar.createEl("button", { text: label, cls: "nudge-tab" });
      if (id === this.activeTab) tab.addClass("is-active");
      tab.addEventListener("click", () => {
        this.activeTab = id;
        this.render();                // no rescan needed
      });
    }

    const btn = bar.createEl("button", { text: "Refresh", cls: "nudge-refresh" });
    btn.addEventListener("click", () => this.refresh());
  }

  private renderAgenda(el: HTMLElement) {
    const items = this.items
      .filter((i) => !i.done)
      .sort((a, b) =>
        `${a.date} ${a.time ?? "00:00"}`.localeCompare(`${b.date} ${b.time ?? "00:00"}`)
      );

    const today = moment().format("YYYY-MM-DD");
    const tomorrow = moment().add(1, "day").format("YYYY-MM-DD");

    const groups: [string, AgendaItem[]][] = [
      ["Overdue", items.filter((i) => i.date < today)],
      ["Today", items.filter((i) => i.date === today)],
      ["Tomorrow", items.filter((i) => i.date === tomorrow)],
      ["Upcoming", items.filter((i) => i.date > tomorrow)],
    ];

    let shown = 0;
    for (const [name, list] of groups) {
      if (list.length === 0) continue;
      shown += list.length;

      el.createEl("h5", { text: `${name} (${list.length})` });
      for (const item of list) {
        const row = el.createDiv({ cls: "nudge-item" });

        const cb = row.createEl("input", { type: "checkbox" });
        cb.addEventListener("click", (e) => e.stopPropagation()); // don't also open the note
        cb.addEventListener("change", () => this.completeItem(item));

        row.createSpan({
          cls: "nudge-when",
          text: name === "Today" || name === "Tomorrow" ? item.time ?? "" : item.date,
        });
        row.createSpan({ text: item.title });
        row.addEventListener("click", () => this.openItem(item));
      }
    }

    if (shown === 0) el.createEl("p", { text: "Nothing coming up." });
  }

  private renderHeatmap(el: HTMLElement) {
  const WEEKS = 18; // a sidebar is narrow, so keep this modest

  // 1. count completions per day
  const counts = new Map<string, number>();
  for (const item of this.items) {
    if (!item.completedOn) continue;
    counts.set(item.completedOn, (counts.get(item.completedOn) ?? 0) + 1);
  }

  // 2. the date range: WEEKS columns, each starting on a Monday
  const today = moment().startOf("day");
  const start = today.clone().startOf("isoWeek").subtract(WEEKS - 1, "weeks");

  // 3. map a count to a shade, 0 (none) to 4 (most)
  const max = Math.max(1, ...Array.from(counts.values()));
  const level = (n: number) => (n === 0 ? 0 : Math.ceil((n / max) * 4));

  const summary = el.createEl("p", { cls: "nudge-heatmap-summary" });
  const grid = el.createDiv({ cls: "nudge-heatmap" });

  let total = 0;
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const day = start.clone().add(w * 7 + d, "days");
      const cell = grid.createDiv({ cls: "nudge-cell" });

      // days later this week still take up a grid slot, but stay invisible
      if (day.isAfter(today)) {
        cell.addClass("is-future");
        continue;
      }

      const key = day.format("YYYY-MM-DD");
      const count = counts.get(key) ?? 0;
      total += count;

      cell.addClass(`level-${level(count)}`);
      cell.setAttr("title", `${key}: ${count} completed`);
    }
  }

  summary.setText(`${total} completed in the last ${WEEKS} weeks`);

  // legend
  const legend = el.createDiv({ cls: "nudge-legend" });
  legend.createSpan({ text: "Less" });
  for (let l = 0; l <= 4; l++) {
    legend.createDiv({ cls: `nudge-cell level-${l}` });
  }
  legend.createSpan({ text: "More" });
}

  private async openItem(item: AgendaItem) {
    const file = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { eState: { line: item.line } });
  }

  private async completeItem(item: AgendaItem) {
    const file = this.app.vault.getAbstractFileByPath(item.filePath);
    if (!(file instanceof TFile)) return;

    const today = moment().format("YYYY-MM-DD");
    let changed = false;

    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const current = lines[item.line];

      // re-parse the line to make sure it's still the same open task
      const parsed =
        current === undefined
          ? null
          : parseLine(current.replace(/\r$/, ""), item.filePath, item.line);

      if (!parsed || parsed.done || parsed.title !== item.title || parsed.date !== item.date) {
        return data; // the note changed since the scan, so leave it alone
      }

      lines[item.line] = current
        .replace(/^(\s*[-*]\s+)\[ \]/, "$1[x]")
        .replace(/(\r?)$/, ` done:${today}$1`);

      changed = true;
      return lines.join("\n");
    });

    if (!changed) new Notice("Nudge: that task changed in the note, so it was left as is.");
    await this.refresh();
  }
}