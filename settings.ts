import { PluginSettingTab, Setting } from 'obsidian';
import type { App, TextAreaComponent } from 'obsidian';
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

        // 秘密鍵の設定
        const secretKeySetting = new Setting(containerEl)
            .setName('Nostr Secret Key')
            .setDesc('Nostrの秘密鍵（nsec）を入力してください。この値は暗号化して保存されます。')
            .addText(text => {
                text.setPlaceholder('nsec1...')
                    .setValue(this.plugin.getNsec())
                    .inputEl.type = 'password';

                // スタイル調整
                text.inputEl.style.width = '100%';
                text.inputEl.style.minWidth = '300px';
                text.inputEl.style.fontFamily = 'monospace';

                // 入力値の検証とマスク処理
                text.onChange(async (value) => {
                    if (value.startsWith('nsec1') || value === '') {
                        const success = await this.plugin.setNsec(value);
                        if (success) {
                            text.inputEl.style.backgroundColor = '';
                        }
                    } else {
                        text.inputEl.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                    }
                });

                return text;
            });

        // 表示/非表示切り替えボタンを追加
        secretKeySetting.addButton(button => {
            return button
                .setIcon('eye')
                .setTooltip('Show/Hide Secret Key')
                .onClick(() => {
                    const inputEl = secretKeySetting.controlEl.querySelector('input');
                    if (inputEl) {
                        inputEl.type = inputEl.type === 'password' ? 'text' : 'password';
                        button.setIcon(inputEl.type === 'password' ? 'eye' : 'eye-off');
                    }
                });
        });

        // リレーの設定
        new Setting(containerEl)
            .setName('Relays')
            .setDesc('監視するNostrリレー（1行に1つ）')
            .addTextArea(text => {
                // TextAreaのスタイル調整
                const textArea = (text as TextAreaComponent)
                    .setPlaceholder('wss://relay.example.com')
                    .setValue(this.plugin.settings.relays.join('\n'));
                
                // TextAreaの要素を直接スタイリング
                const textAreaEl = textArea.inputEl;
                textAreaEl.style.width = '100%';
                textAreaEl.style.minWidth = '300px';
                textAreaEl.style.height = '100px'; // 約10行分
                textAreaEl.style.fontFamily = 'monospace';
                
                text.onChange(async (value) => {
                    this.plugin.settings.relays = value
                        .split('\n')
                        .map(relay => relay.trim())
                        .filter(relay => relay.length > 0);
                    await this.plugin.saveSettings();
                    
                    // リレーの設定が変更されたら監視を再起動
                    // this.plugin.stopMonitoring();
                    this.plugin.startMonitoring();
                });

                return text;
            });

        // 検索パターンの設定
        new Setting(containerEl)
            .setName('Search Pattern')
            .setDesc('監視するテキストパターン（正規表現）')
            .addText(text => {
                const textEl = text
                    .setPlaceholder('テスト')
                    .setValue(this.plugin.settings.searchPattern);

                // テキスト入力欄のスタイル調整
                textEl.inputEl.style.width = '100%';
                textEl.inputEl.style.minWidth = '300px';
                textEl.inputEl.style.fontFamily = 'monospace';
                text.onChange(async (value) => {
                    try {
                        new RegExp(value);
                        this.plugin.settings.searchPattern = value;
                        await this.plugin.saveSettings();
                        text.inputEl.style.backgroundColor = '';
                    } catch (error) {
                        console.error('Invalid regular expression:', error);
                        // 正規表現が不正な場合、入力欄を赤く
                        textEl.inputEl.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                    }
                });

                return text;
            });
        }
}