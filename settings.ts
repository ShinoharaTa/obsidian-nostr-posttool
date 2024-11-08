import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type NostrClientPlugin from './main';

export class NostrSettingsTab extends PluginSettingTab {
    plugin: NostrClientPlugin;

    constructor(app: App, plugin: NostrClientPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Nostr Client Settings' });

        // リレーの設定
        new Setting(containerEl)
            .setName('Relays')
            .setDesc('監視するNostrリレー（1行に1つ）')
            .addTextArea(text => text
                .setPlaceholder('wss://relay.example.com')
                .setValue(this.plugin.settings.relays.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.relays = value
                        .split('\n')
                        .map(relay => relay.trim())
                        .filter(relay => relay.length > 0);
                    await this.plugin.saveSettings();
                    
                    // リレーの設定が変更されたら監視を再起動
                    this.plugin.startMonitoring();
                }));

        // 検索パターンの設定
        new Setting(containerEl)
            .setName('Search Pattern')
            .setDesc('監視するテキストパターン（正規表現）')
            .addText(text => text
                .setPlaceholder('テスト')
                .setValue(this.plugin.settings.searchPattern.source)
                .onChange(async (value) => {
                    try {
                        this.plugin.settings.searchPattern = new RegExp(value);
                        await this.plugin.saveSettings();
                    } catch (error) {
                        console.error('Invalid regular expression:', error);
                    }
                }));
    }
}