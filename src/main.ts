import { Notice, Plugin, debounce, moment } from "obsidian";
import { NudgeSettings, DEFAULT_SETTINGS, NudgeSettingTab } from "./settings";
import { AgendaItem } from "./types";
import { parseLine } from "./parser";
import { VIEW_TYPE_NUDGE, NudgeView } from "./view";

export default class NudgePlugin extends Plugin {
  settings!: NudgeSettings;
  private lastDay = moment().format("YYYY-MM-DD");

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new NudgeSettingTab(this.app, this));

    this.registerView(
      VIEW_TYPE_NUDGE,
      (leaf) => new NudgeView(leaf, () => this.scanVault())
    );

    this.addRibbonIcon("calendar-check", "Open Nudge", () => this.activateView());

    this.addCommand({
      id: "open-nudge-view",
      name: "Open Nudge agenda",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "scan-vault",
      name: "Scan vault for agenda items",
      callback: async () => {
        const items = await this.scanVault();
        console.log(`Found ${items.length} items`, items);
      },
    });

    // live updates
    const refreshViews = debounce(() => this.refreshOpenViews(), 1000, true);
    this.registerEvent(this.app.metadataCache.on("changed", refreshViews));
    this.registerEvent(this.app.vault.on("delete", refreshViews));
    this.registerEvent(this.app.vault.on("rename", refreshViews));

    // reminders + midnight refresh
    this.registerInterval(window.setInterval(() => this.tick(), 30 * 1000));
  }

  onunload() {}

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    this.settings.fired = { ...(data?.fired ?? {}) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async scanVault(): Promise<AgendaItem[]> {
    const items: AgendaItem[] = [];

    for (const file of this.app.vault.getMarkdownFiles()) {
      const text = await this.app.vault.cachedRead(file);
      const lines = text.split(/\r?\n/);

      lines.forEach((lineText, index) => {
        const item = parseLine(lineText, file.path, index);
        if (item) items.push(item);
      });
    }

    return items;
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_NUDGE)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: VIEW_TYPE_NUDGE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  refreshOpenViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_NUDGE).forEach((leaf) => {
      if (leaf.view instanceof NudgeView) leaf.view.refresh();
    });
  }

  async tick() {
    const day = moment().format("YYYY-MM-DD");
    if (day !== this.lastDay) {
      this.lastDay = day;
      this.refreshOpenViews();
    }
    await this.checkReminders();
  }

  async checkReminders() {
    const s = this.settings;
    if (!s.remindersEnabled) return;

    const now = moment();
    const items = await this.scanVault();
    let changed = false;

    for (const item of items) {
      if (item.done) continue;

      const hasTime = !!item.time;
      const due = moment(`${item.date} ${item.time ?? s.allDayTime}`, "YYYY-MM-DD HH:mm");
      const remindAt = hasTime ? due.clone().subtract(s.leadMinutes, "minutes") : due.clone();
      const windowEnd = hasTime ? due.clone().add(60, "minutes") : due.clone().endOf("day");

      if (now.isBefore(remindAt) || now.isAfter(windowEnd)) continue;

      const key = `${item.filePath}|${item.title}|${item.date}|${item.time ?? ""}`;
      if (s.fired[key]) continue;

      new Notice(`Nudge: ${item.title}${hasTime ? ` (${item.time})` : ""}`, 10000);
      s.fired[key] = item.date;
      changed = true;
    }

    // forget entries older than a week
    const cutoff = moment().subtract(7, "days").format("YYYY-MM-DD");
    for (const [k, date] of Object.entries(s.fired)) {
      if (date < cutoff) {
        delete s.fired[k];
        changed = true;
      }
    }

    if (changed) await this.saveSettings();
  }
}