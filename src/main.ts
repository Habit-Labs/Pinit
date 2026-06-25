import { EventRef, Menu, Plugin, TFile } from 'obsidian';
import { clearDecorations, decoratePinnedItems } from './dom-decorator';
import { folderPathOf, PinManager } from './pin-manager';
import { installSortPatch } from './sort-patcher';
import { FileExplorerView } from './types';

export default class PinitPlugin extends Plugin {
	pinManager!: PinManager;
	private sortUninstaller: (() => void) | null = null;
	private retryRef: EventRef | null = null;

	async onload(): Promise<void> {
		this.pinManager = new PinManager(this);
		await this.pinManager.init();

		// Install the sort patch once the file explorer is really loaded. In Obsidian 1.7+
		// the explorer view can be deferred at onLayoutReady, so we retry until it's ready.
		this.app.workspace.onLayoutReady(() => void this.ensureSortPatch());

		// `file-menu` fires for BOTH the sidebar right-click and the note's three-dots menu.
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFile) this.addPinMenuItems(menu, file);
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				void this.pinManager.handleRename(oldPath, file.path).then(() => this.refreshExplorer());
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				void this.pinManager.handleDelete(file.path).then(() => this.refreshExplorer());
			})
		);

		this.registerCommands();
	}

	onunload(): void {
		this.stopRetry();
		if (this.sortUninstaller) {
			this.sortUninstaller();
			this.sortUninstaller = null;
		}
		this.forEachExplorer((view) => {
			clearDecorations(view);
			view.requestSort();
		});
	}

	/** Reload pin state if data.json changes underneath us (e.g. Obsidian Sync). */
	onExternalSettingsChange(): void {
		void this.pinManager.init().then(() => this.refreshExplorer());
	}

	// --- menu ---------------------------------------------------------------

	private addPinMenuItems(menu: Menu, file: TFile): void {
		if (!this.pinManager.isPinned(file.path)) {
			menu.addItem((item) =>
				item
					.setTitle('Pin to top')
					.setIcon('pin')
					.setSection('action')
					.onClick(() => this.mutate(() => this.pinManager.pin(file.path)))
			);
			return;
		}

		menu.addItem((item) =>
			item
				.setTitle('Unpin')
				.setIcon('pin-off')
				.setSection('action')
				.onClick(() => this.mutate(() => this.pinManager.unpin(file.path)))
		);

		const idx = this.pinManager.getPinIndex(file.path);
		const count = this.pinManager.getPinCount(folderPathOf(file.path));

		if (idx > 0) {
			menu.addItem((item) =>
				item
					.setTitle('Pin above')
					.setIcon('arrow-up')
					.setSection('action')
					.onClick(() => this.mutate(() => this.pinManager.moveUp(file.path)))
			);
		}
		if (idx < count - 1) {
			menu.addItem((item) =>
				item
					.setTitle('Pin below')
					.setIcon('arrow-down')
					.setSection('action')
					.onClick(() => this.mutate(() => this.pinManager.moveDown(file.path)))
			);
		}
	}

	// --- commands -----------------------------------------------------------

	private registerCommands(): void {
		const activePinnable = () => {
			const file = this.app.workspace.getActiveFile();
			return file instanceof TFile ? file : null;
		};

		this.addCommand({
			id: 'pin-note',
			name: 'Pin current note to top',
			checkCallback: (checking) => {
				const file = activePinnable();
				if (!file || this.pinManager.isPinned(file.path)) return false;
				if (!checking) this.mutate(() => this.pinManager.pin(file.path));
				return true;
			},
		});

		this.addCommand({
			id: 'unpin-note',
			name: 'Unpin current note',
			checkCallback: (checking) => {
				const file = activePinnable();
				if (!file || !this.pinManager.isPinned(file.path)) return false;
				if (!checking) this.mutate(() => this.pinManager.unpin(file.path));
				return true;
			},
		});

		this.addCommand({
			id: 'move-pin-up',
			name: 'Move pinned note up',
			checkCallback: (checking) => {
				const file = activePinnable();
				if (!file || this.pinManager.getPinIndex(file.path) <= 0) return false;
				if (!checking) this.mutate(() => this.pinManager.moveUp(file.path));
				return true;
			},
		});

		this.addCommand({
			id: 'move-pin-down',
			name: 'Move pinned note down',
			checkCallback: (checking) => {
				const file = activePinnable();
				if (!file) return false;
				const idx = this.pinManager.getPinIndex(file.path);
				const count = this.pinManager.getPinCount(folderPathOf(file.path));
				if (idx < 0 || idx >= count - 1) return false;
				if (!checking) this.mutate(() => this.pinManager.moveDown(file.path));
				return true;
			},
		});
	}

	// --- patch lifecycle ----------------------------------------------------

	/**
	 * Install the sort patch, loading the deferred explorer view if needed. If the explorer
	 * isn't available yet (closed, or still deferred), retry on the next layout-change and
	 * self-deregister once installed. Idempotent — never double-installs.
	 */
	private async ensureSortPatch(): Promise<void> {
		if (this.sortUninstaller) return;

		this.sortUninstaller = await installSortPatch(this, this.pinManager);
		if (this.sortUninstaller) {
			this.stopRetry();
			this.refreshExplorer();
			return;
		}

		if (!this.retryRef) {
			this.retryRef = this.app.workspace.on('layout-change', () => void this.ensureSortPatch());
			this.registerEvent(this.retryRef);
		}
	}

	private stopRetry(): void {
		if (this.retryRef) {
			this.app.workspace.offref(this.retryRef);
			this.retryRef = null;
		}
	}

	// --- helpers ------------------------------------------------------------

	private mutate(op: () => Promise<void>): void {
		void op().then(() => this.refreshExplorer());
	}

	private refreshExplorer(): void {
		this.forEachExplorer((view) => {
			view.requestSort();
			decoratePinnedItems(view, this.pinManager);
		});
	}

	private forEachExplorer(fn: (view: FileExplorerView) => void): void {
		for (const leaf of this.app.workspace.getLeavesOfType('file-explorer')) {
			fn(leaf.view as FileExplorerView);
		}
	}
}
