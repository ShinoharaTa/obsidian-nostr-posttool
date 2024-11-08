import { Plugin, Notice } from 'obsidian';
import { SimplePool } from "nostr-tools";
import type { Filter, Event } from "nostr-tools";
import 'websocket-polyfill';

interface NostrMonitorSettings {
    relays: string[];
    searchPattern: RegExp;
}

const DEFAULT_SETTINGS: NostrMonitorSettings = {
    relays: [
        'wss://kojira.io',
        'wss://yabu.me',
        'wss://relay-jp.shino3.net',
    ],
    searchPattern: /ちんちん/
};

export default class NostrMonitorPlugin extends Plugin {
    settings: NostrMonitorSettings;
    pool: SimplePool;

    async onload() {
        await this.loadSettings();
        this.pool = new SimplePool();
        // プラグインが有効化されたときにNostrの監視を開始
        this.startMonitoring();

        // プラグインが無効化されたときのクリーンアップを登録
        this.register(() => {
            this.pool.close(this.settings.relays);
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    startMonitoring() {
        console.log('Nostr監視を開始します...');

        // 監視するイベントのフィルター設定
        const filter: Filter = {
            kinds: [1], // テキストノートのみを対象とする
            since: Math.floor(Date.now() / 1000) // 現在時刻以降のイベントのみ
        };

        // 各リレーからのイベントを購読
        const sub = this.pool.sub(this.settings.relays, [filter]);
		sub.on('event', (event: Event) => {
            this.handleNostrEvent(event);
        });

        sub.on('eose', () => {
            console.log('EOSE - 全リレーからの初期データ取得完了');
        });
    }

    handleNostrEvent(event: Event) {
        try {
            const content = event.content;
            
            // 「テスト」という単語が含まれているかチェック
            if (this.settings.searchPattern.test(content)) {
                // 投稿者の公開鍵を短縮形式で表示
                const authorShort = event.pubkey.substring(0, 6) + '...';
                
                // 通知を表示
                new Notice(`🔔 新しいNostrメッセージ\nAuthor: ${authorShort}\nContent: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
                
                // コンソールにも記録
                console.log('Nostrイベント検知:', {
                    author: event.pubkey,
                    content: content,
                    timestamp: new Date(event.created_at * 1000).toISOString()
                });
            }
        } catch (error) {
            console.error('イベント処理中にエラーが発生しました:', error);
        }
    }
}