import { Plugin, Notice } from 'obsidian';
import { SimplePool } from "nostr-tools";
import type { Filter, Event } from "nostr-tools";
import 'websocket-polyfill';
import { NostrSettingsTab } from 'settings';

interface NostrClientSettings {
    relays: string[];
    searchPattern: string;
	encryptedNsec?: string;
}

const DEFAULT_SETTINGS: NostrClientSettings = {
    relays: [
        'wss://kojira.io',
        'wss://yabu.me',
        'wss://relay-jp.shino3.net',
    ],
    searchPattern: "ちんちん",
	encryptedNsec: undefined
};

export default class NostrClientPlugin extends Plugin {
    settings: NostrClientSettings;
    pool: SimplePool;
	currentNsec = ''; // 復号化された現在の秘密鍵

	async onload() {
        await this.loadSettings();
		// 秘密鍵の復号化
		if (this.settings.encryptedNsec) {
			try {
				this.currentNsec = await this.decryptNsec(this.settings.encryptedNsec);
			} catch (error) {
				console.error('Failed to decrypt nsec:', error);
				this.currentNsec = '';
			}
		}
        this.pool = new SimplePool();
		this.addSettingTab(new NostrSettingsTab(this.app, this));

        // プラグインが有効化されたときにNostrの監視を開始
        this.startMonitoring();

        // プラグインが無効化されたときのクリーンアップを登録
        this.register(() => {
            this.pool.close(this.settings.relays);
        });
    }

    async loadSettings() {
        const settings =  await this.loadData();
		console.log(settings);
        this.settings = {
            relays: settings?.relays || DEFAULT_SETTINGS.relays,
            searchPattern: settings?.searchPattern || DEFAULT_SETTINGS.searchPattern,
            encryptedNsec: settings?.encryptedNsec
        };
        console.log('Settings loaded:', { ...this.settings, encryptedNsec: '***' });
	}

    async saveSettings() {
        await this.saveData(this.settings);
		console.log('Settings saved:', { ...this.settings, encryptedNsec: '***' });

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
			const regexp = new RegExp(this.settings.searchPattern)
            if (regexp.test(content)) {
                // 投稿者の公開鍵を短縮形式で表示
                const authorShort = `${event.pubkey.substring(0, 6)}...`;

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

	// 秘密鍵の暗号化
	async encryptNsec(nsec: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(nsec);

		// ランダムな初期化ベクトル（IV）を生成
		const iv = crypto.getRandomValues(new Uint8Array(12));

		// 暗号化キーを生成（この例ではデバイスIDを使用）
		const keyMaterial = await crypto.subtle.importKey(
			'raw',
			encoder.encode("meow"),
			'PBKDF2',
			false,
			['deriveBits', 'deriveKey']
		);

		const key = await crypto.subtle.deriveKey(
			{
				name: 'PBKDF2',
				salt: encoder.encode('nostr-monitor-salt'),
				iterations: 100000,
				hash: 'SHA-256'
			},
			keyMaterial,
			{ name: 'AES-GCM', length: 256 },
			false,
			['encrypt', 'decrypt']
		);

		const encryptedData = await crypto.subtle.encrypt(
			{
				name: 'AES-GCM',
				iv: iv
			},
			key,
			data
		);

		// IV と暗号化データを結合して Base64 エンコード
		const encryptedArray = new Uint8Array(iv.length + encryptedData.byteLength);
		encryptedArray.set(iv);
		encryptedArray.set(new Uint8Array(encryptedData), iv.length);

		return btoa(String.fromCharCode(...encryptedArray));
	}

	// 秘密鍵の復号化
	async decryptNsec(encrypted: string): Promise<string> {
		try {
			const encryptedData = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
			const iv = encryptedData.slice(0, 12);
			const data = encryptedData.slice(12);

			const keyMaterial = await crypto.subtle.importKey(
				'raw',
				new TextEncoder().encode("meow"),
				'PBKDF2',
				false,
				['deriveBits', 'deriveKey']
			);

			const key = await crypto.subtle.deriveKey(
				{
					name: 'PBKDF2',
					salt: new TextEncoder().encode('nostr-monitor-salt'),
					iterations: 100000,
					hash: 'SHA-256'
				},
				keyMaterial,
				{ name: 'AES-GCM', length: 256 },
				false,
				['encrypt', 'decrypt']
			);

			const decryptedData = await crypto.subtle.decrypt(
				{
					name: 'AES-GCM',
					iv: iv
				},
				key,
				data
			);

			return new TextDecoder().decode(decryptedData);
		} catch (error) {
			console.error('Decryption failed:', error);
			return '';
		}
	}
	// 秘密鍵の設定（暗号化して保存）
	async setNsec(nsec: string) {
		if (nsec) {
			try {
				this.settings.encryptedNsec = await this.encryptNsec(nsec);
				this.currentNsec = nsec;
			} catch (error) {
				console.error('Failed to encrypt nsec:', error);
				new Notice('Failed to save secret key');
				return false;
			}
		} else {
			this.settings.encryptedNsec = undefined;
			this.currentNsec = '';
		}
		await this.saveSettings();
		return true;
	}

	// 現在の秘密鍵を取得
	getNsec(): string {
		return this.currentNsec;
	}
}