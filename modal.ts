import { Modal, App, Setting } from 'obsidian';

export class NostrPostModal extends Modal {
    private content: string = '';
    private onSubmit: (content: string) => void;

    constructor(app: App, onSubmit: (content: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'New Nostr Post' });

        // 投稿内容入力エリア
        new Setting(contentEl)
            .setName('Content')
            .addTextArea(text => {
                text.setPlaceholder('What\'s on your mind?')
                    .setValue(this.content)
                    .onChange(value => {
                        this.content = value;
                    });

                // テキストエリアのスタイル調整
                const textEl = text.inputEl;
                textEl.style.width = '100%';
                textEl.style.height = '150px';
                textEl.style.minHeight = '150px';
                textEl.style.marginBottom = '1em';
                
                return text;
            });

        // 文字数カウンター
        const counterEl = contentEl.createEl('div', { 
            text: '0 characters',
            cls: 'nostr-post-counter'
        });
        counterEl.style.textAlign = 'right';
        counterEl.style.marginBottom = '1em';
        counterEl.style.color = 'var(--text-muted)';

        // 文字数カウントの更新
        const updateCounter = (text: string) => {
            counterEl.textContent = `${text.length} characters`;
        };

        // テキストエリアのイベントリスナー
        const textarea = contentEl.querySelector('textarea');
        if (textarea) {
            textarea.addEventListener('input', (e) => {
                const target = e.target as HTMLTextAreaElement;
                updateCounter(target.value);
            });
        }

        // ボタンコンテナ
        const buttonContainer = contentEl.createEl('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'flex-end';
        buttonContainer.style.gap = '10px';

        // キャンセルボタン
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.addEventListener('click', () => this.close());

        // 投稿ボタン
        const submitButton = buttonContainer.createEl('button', {
            text: 'Post',
            cls: 'mod-cta'
        });
        submitButton.addEventListener('click', async () => {
            if (this.content.trim()) {
                await this.onSubmit(this.content);
                this.close();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}