import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

export interface NudgeSettings {
  remindersEnabled: boolean;
  leadMinutes: number;            // how early to remind for timed tasks
  allDayTime: string;             // "HH:mm", when to remind for tasks with no time
  fired: Record<string, string>;  // reminder key -> due date (so we never repeat)
}

export const DEFAULT_SETTINGS: NudgeSettings = {
  remindersEnabled: true,
  leadMinutes: 10,
  allDayTime: "09:00",
  fired: {},
};

// lets the tab talk to your plugin without importing main.ts
export interface SettingsHost extends Plugin {
  settings: NudgeSettings;
  saveSettings(): Promise<void>;
}

export class NudgeSettingTab extends PluginSettingTab {
  constructor(app: App, private host: SettingsHost) {
    super(app, host);
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Enable reminders")
      .addToggle((t) =>
        t.setValue(this.host.settings.remindersEnabled).onChange(async (v) => {
          this.host.settings.remindersEnabled = v;
          await this.host.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Lead time (minutes)")
      .setDesc("How long before a timed task to remind you.")
      .addText((t) =>
        t.setValue(String(this.host.settings.leadMinutes)).onChange(async (v) => {
          const n = parseInt(v, 10);
          if (isNaN(n) || n < 0) return;
          this.host.settings.leadMinutes = n;
          await this.host.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("All-day reminder time")
      .setDesc("When to remind you about tasks that have a date but no time (24-hour HH:mm).")
      .addText((t) =>
        t.setValue(this.host.settings.allDayTime).onChange(async (v) => {
          if (!/^\d{1,2}:\d{2}$/.test(v)) return;
          this.host.settings.allDayTime = v;
          await this.host.saveSettings();
        })
      );
  }
}