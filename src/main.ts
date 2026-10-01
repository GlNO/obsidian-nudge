import { Notice, Plugin, TFile, debounce, moment, normalizePath } from "obsidian";
import { NudgeSettings, DEFAULT_SETTINGS, NudgeSettingTab } from "./settings";
import { AgendaItem } from "./types";
import { parseLine } from "./parser";
import { nudgeDecorations } from "./decorate";
import { VIEW_TYPE_NUDGE, NudgeView } from "./view";

export default class NudgePlugin extends Plugin {
  settings!: NudgeSettings;
  private lastDay = moment().format("YYYY-MM-DD");
  private cache = new Map<string, AgendaItem[]>();
  private cacheReady: Promise<void> | null = null;
  private vaultWriteQueue: Promise<void> = Promise.resolve();

  async onload() {
    await this.loadSettings();
    await this.migrateInboxToTables();
    this.registerEditorExtension(nudgeDecorations);
    this.addSettingTab(new NudgeSettingTab(this.app, this));

    this.registerView(
  VIEW_TYPE_NUDGE,
  (leaf) =>
    new NudgeView(
      leaf,
      () => this.scanVault(),
      (title, date, time) => this.addTask(title, date, time),
      () => this.trashCompletedTasks(),
      () => this.openInbox(),
      (item) => this.completeTask(item),
      () => ({ ...this.settings.completionHistory })
    )
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
      callback: () => { void this.scanVault(); },
    });

    // live updates: keep the cache current, then redraw open views
    const refreshViews = debounce(() => this.refreshOpenViews(), 1000, true);

    this.registerEvent(
      this.app.metadataCache.on("changed", async (file) => {
        await this.buildCache();      // wait for the first build if it's still running
        await this.updateFile(file);  // re-parse only this file
        refreshViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.cache.delete(file.path);
        refreshViews();
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        this.cache.delete(oldPath);
        if (file instanceof TFile && file.extension === "md") {
          await this.updateFile(file); // re-parse so filePath and id match the new path
        }
        refreshViews();
      })
    );

    // warm the cache after Obsidian finishes loading
    this.app.workspace.onLayoutReady(() => {
      void this.buildCache().then(() => this.refreshOpenViews());
    });

    // reminders + midnight refresh
    this.registerInterval(window.setInterval(() => { void this.tick(); }, 30 * 1000));
  }

  onunload() {}

  async loadSettings() {
    const data = (await this.loadData()) as Partial<NudgeSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    this.settings.fired = { ...(data?.fired ?? {}) };
    this.settings.completionHistory = { ...(data?.completionHistory ?? {}) };
  }


  async saveSettings() {
    await this.saveData(this.settings);
  }

  // ---- cache ----

  private async parseFile(file: TFile): Promise<AgendaItem[]> {
    try {
      const text = await this.app.vault.cachedRead(file);
      const items: AgendaItem[] = [];
      text.split(/\r?\n/).forEach((lineText, index) => {
        const item = parseLine(lineText, file.path, index);
        if (item) items.push(item);
      });
      return items;
    } catch {
      return []; // file vanished mid-read, so treat it as empty
    }
  }

  private async updateFile(file: TFile) {
    this.cache.set(file.path, await this.parseFile(file));
  }

  // builds the cache once; every caller shares the same promise
  private buildCache(): Promise<void> {
    if (!this.cacheReady) {
      this.cacheReady = (async () => {
        for (const file of this.app.vault.getMarkdownFiles()) {
          await this.updateFile(file);
        }
      })();
    }
    return this.cacheReady;
  }

  async scanVault(): Promise<AgendaItem[]> {
    await this.buildCache();
    return Array.from(this.cache.values()).flat();
  }

  private enqueueVaultWrite<T>(operation: () => Promise<T>): Promise<T> {
    const write = this.vaultWriteQueue.then(operation, operation);
    this.vaultWriteQueue = write.then(() => undefined, () => undefined);
    return write;
  }

  private async openInbox() {
    return this.enqueueVaultWrite(async () => {
      const inbox = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.inboxPath));
      if (!(inbox instanceof TFile)) return;
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(inbox);
    });
  }

  private async migrateInboxToTables() {
    const inbox = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.inboxPath));
    if (!(inbox instanceof TFile)) return;

    const text = await this.app.vault.cachedRead(inbox);
    if (text.includes("| Task | Due | Time | Completed |")) return;

    const items = text
      .split(/\r?\n/)
      .map((line, index) => parseLine(line, inbox.path, index))
      .filter((item): item is AgendaItem => item !== null);
    if (items.length === 0) return;

    const row = (item: AgendaItem) =>
      `| ${item.title.replace(/\|/g, "\\|")} | ${item.date} | ${item.time ?? ""} | ${item.completedOn ?? ""} |`;
    const active = items.filter((item) => !item.done);
    const completed = items.filter((item) => item.done);
    const lines = [
      "# Tasks",
      "",
      "| Task | Due | Time | Completed |",
      "| --- | --- | --- | --- |",
      ...active.map(row),
    ];
    if (completed.length > 0) {
      lines.push("", "---", "", "## Completed", "", "| Task | Due | Time | Completed |", "| --- | --- | --- | --- |", ...completed.map(row));
    }
    await this.app.vault.modify(inbox, `${lines.join("\n")}\n`);
  }

  private async completeTask(item: AgendaItem) {
    return this.enqueueVaultWrite(async () => {
      const inboxPath = normalizePath(this.settings.inboxPath);
      const source = this.app.vault.getAbstractFileByPath(item.filePath);
      if (!(source instanceof TFile)) return;

      const sourceText = await this.app.vault.cachedRead(source);
      const sourceLines = sourceText.split("\n");
      const current = sourceLines[item.line]?.replace(/\r$/, "");
      const parsed = current ? parseLine(current, item.filePath, item.line) : null;
      if (!parsed || parsed.done || parsed.title !== item.title || parsed.date !== item.date) return;

      const completedLine = `| ${item.title.replace(/\|/g, "\\|")} | ${item.date} | ${item.time ?? ""} | ${moment().format("YYYY-MM-DD")} |`;

      const inbox = this.app.vault.getAbstractFileByPath(inboxPath);
      if (!(inbox instanceof TFile)) return;

      if (source.path !== inboxPath) {
        const inboxText = await this.app.vault.cachedRead(inbox);
        await this.app.vault.modify(inbox, this.appendCompletedRow(inboxText, completedLine));
        await this.app.vault.modify(source, sourceLines.filter((_, index) => index !== item.line).join("\n"));
      } else {
        const activeText = sourceLines.filter((_, index) => index !== item.line).join("\n");
        await this.app.vault.modify(inbox, this.appendCompletedRow(activeText, completedLine));
      }

      if (source instanceof TFile && source.path !== inboxPath) await this.updateFile(source);
      if (inbox instanceof TFile) await this.updateFile(inbox);
    });
  }

  private appendCompletedRow(text: string, row: string): string {
    const completedHeader = "## Completed";
    if (text.includes(completedHeader)) return `${text.endsWith("\n") ? text : `${text}\n`}${row}\n`;
    return `${text.endsWith("\n") ? text : `${text}\n`}\n---\n\n${completedHeader}\n\n| Task | Due | Time | Completed |\n| --- | --- | --- | --- |\n${row}\n`;
  }

  private appendActiveRow(text: string, row: string): string {
    const completedStart = text.search(/\n---\s*\n\s*## Completed\s*\n/);
    if (completedStart === -1) return `${text.endsWith("\n") ? text : `${text}\n`}${row}\n`;
    const beforeCompleted = text.slice(0, completedStart);
    return `${beforeCompleted}${beforeCompleted.endsWith("\n") ? "" : "\n"}${row}\n${text.slice(completedStart)}`;
  }

  async addTask(title: string, date: string, time?: string) {
    return this.enqueueVaultWrite(async () => {
      const path = normalizePath(this.settings.inboxPath);
      const line = `| ${title.replace(/\|/g, "\\|")} | ${date} | ${time ?? ""} |  |`;

      // make sure the folder exists
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
        await this.app.vault.createFolder(dir);
      }

      let file: TFile;
      const existing = this.app.vault.getAbstractFileByPath(path);

      if (existing instanceof TFile) {
        file = existing;
        await this.app.vault.process(file, (data) =>
          data.trim() === ""
            ? `# Tasks\n\n| Task | Due | Time | Completed |\n| --- | --- | --- | --- |\n${line}\n`
            : data.includes("| Task | Due | Time | Completed |")
              ? this.appendActiveRow(data, line)
              : `${data.endsWith("\n") ? data : `${data}\n`}\n# Tasks\n\n| Task | Due | Time | Completed |\n| --- | --- | --- | --- |\n${line}\n`
        );
      } else {
        file = await this.app.vault.create(
          path,
          `# Tasks\n\n| Task | Due | Time | Completed |\n| --- | --- | --- | --- |\n${line}\n`
        );
      }

      await this.updateFile(file); // refresh the cache right away
    });
}

  async trashCompletedTasks(): Promise<number> {
    return this.enqueueVaultWrite(async () => {
      const items = await this.scanVault();
      const completedByFile = new Map<string, Set<number>>();

      for (const item of items) {
        if (!item.done) continue;
        const lines = completedByFile.get(item.filePath) ?? new Set<number>();
        lines.add(item.line);
        completedByFile.set(item.filePath, lines);
        if (item.completedOn) {
          this.settings.completionHistory[item.completedOn] =
            (this.settings.completionHistory[item.completedOn] ?? 0) + 1;
        }
      }

      let removed = 0;
      await Promise.all(Array.from(completedByFile, async ([path, linesToRemove]) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return;

        await this.app.vault.process(file, (data) => {
          const lines = data.split("\n");
          removed += linesToRemove.size;
          return lines.filter((_, index) => !linesToRemove.has(index)).join("\n");
        });
        await this.updateFile(file);
      }));

      if (removed > 0) await this.saveSettings();

      return removed;
    });
  }

  // ---- views ----

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_NUDGE)[0];

    if (!leaf) {
      leaf = workspace.getRightLeaf(false)!;
      await leaf.setViewState({ type: VIEW_TYPE_NUDGE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }

  refreshOpenViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_NUDGE).forEach((leaf) => {
      if (leaf.view instanceof NudgeView) void leaf.view.refresh();
    });
  }

  // ---- reminders ----

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
