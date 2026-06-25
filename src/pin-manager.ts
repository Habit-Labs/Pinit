import { Plugin } from 'obsidian';
import { DEFAULT_PIN_DATA, PinData } from './types';

/**
 * Derive the parent folder path from a file path, matching Obsidian's convention
 * where the vault root TFolder has path "/".
 *
 *   "a/b/note.md" -> "a/b"
 *   "note.md"     -> "/"
 */
export function folderPathOf(filePath: string): string {
	const idx = filePath.lastIndexOf('/');
	return idx === -1 ? '/' : filePath.slice(0, idx);
}

/**
 * Owns all pin state and its persistence to data.json. Pure data layer — no DOM,
 * no file-explorer view access. Every mutation persists immediately.
 */
export class PinManager {
	private data: PinData = structuredClone(DEFAULT_PIN_DATA);

	constructor(private plugin: Plugin) {}

	async init(): Promise<void> {
		const loaded = (await this.plugin.loadData()) as Partial<PinData> | null;
		this.data = {
			pins: loaded?.pins && typeof loaded.pins === 'object' ? loaded.pins : {},
		};
	}

	private async save(): Promise<void> {
		await this.plugin.saveData(this.data);
	}

	/** Pins for a folder, in display order. Returns a copy. */
	getPinnedPaths(folderPath: string): string[] {
		return [...(this.data.pins[folderPath] ?? [])];
	}

	getPinCount(folderPath: string): number {
		return this.data.pins[folderPath]?.length ?? 0;
	}

	isPinned(filePath: string): boolean {
		return (this.data.pins[folderPathOf(filePath)] ?? []).includes(filePath);
	}

	/** Index within the folder's pin list, or -1 if not pinned. */
	getPinIndex(filePath: string): number {
		return (this.data.pins[folderPathOf(filePath)] ?? []).indexOf(filePath);
	}

	async pin(filePath: string): Promise<void> {
		const folder = folderPathOf(filePath);
		const list = this.data.pins[folder] ?? (this.data.pins[folder] = []);
		if (!list.includes(filePath)) {
			list.push(filePath);
			await this.save();
		}
	}

	async unpin(filePath: string): Promise<void> {
		const folder = folderPathOf(filePath);
		const list = this.data.pins[folder];
		if (!list) return;
		const i = list.indexOf(filePath);
		if (i === -1) return;
		list.splice(i, 1);
		if (list.length === 0) delete this.data.pins[folder];
		await this.save();
	}

	async moveUp(filePath: string): Promise<void> {
		await this.swap(filePath, -1);
	}

	async moveDown(filePath: string): Promise<void> {
		await this.swap(filePath, 1);
	}

	private async swap(filePath: string, delta: number): Promise<void> {
		const folder = folderPathOf(filePath);
		const list = this.data.pins[folder];
		if (!list) return;
		const i = list.indexOf(filePath);
		const j = i + delta;
		if (i === -1 || j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
		await this.save();
	}

	/**
	 * Reconcile pin state after a vault rename/move.
	 *  - Same folder (rename): replace the old path with the new one, preserving position.
	 *  - Different folder (move): drop the pin; the user re-pins intentionally in the new location.
	 *  - Folder rename: Obsidian renames the folder and its children. Rewrite affected folder
	 *    keys and pinned paths whose prefix changed.
	 */
	async handleRename(oldPath: string, newPath: string): Promise<void> {
		let changed = false;

		// Folder rename: any pin key or pinned path under oldPath/ migrates to newPath/.
		const oldPrefix = oldPath + '/';
		const newPrefix = newPath + '/';
		for (const key of Object.keys(this.data.pins)) {
			const keyMoved = key === oldPath || key.startsWith(oldPrefix);
			if (keyMoved) {
				const newKey = key === oldPath ? newPath : newPrefix + key.slice(oldPrefix.length);
				const remapped = this.data.pins[key].map((p) =>
					p.startsWith(oldPrefix) ? newPrefix + p.slice(oldPrefix.length) : p
				);
				delete this.data.pins[key];
				this.data.pins[newKey] = remapped;
				changed = true;
			}
		}

		// File rename/move.
		const oldFolder = folderPathOf(oldPath);
		const newFolder = folderPathOf(newPath);
		const list = this.data.pins[oldFolder];
		if (list) {
			const i = list.indexOf(oldPath);
			if (i !== -1) {
				if (oldFolder === newFolder) {
					list[i] = newPath; // pure rename, keep position
				} else {
					list.splice(i, 1); // moved to another folder -> unpin
					if (list.length === 0) delete this.data.pins[oldFolder];
				}
				changed = true;
			}
		}

		if (changed) await this.save();
	}

	async handleDelete(path: string): Promise<void> {
		let changed = false;

		// If a folder was deleted, drop its key and any descendant folder keys.
		const prefix = path + '/';
		for (const key of Object.keys(this.data.pins)) {
			if (key === path || key.startsWith(prefix)) {
				delete this.data.pins[key];
				changed = true;
			}
		}

		// If a file was deleted, remove it from its folder's pin list.
		const folder = folderPathOf(path);
		const list = this.data.pins[folder];
		if (list) {
			const i = list.indexOf(path);
			if (i !== -1) {
				list.splice(i, 1);
				if (list.length === 0) delete this.data.pins[folder];
				changed = true;
			}
		}

		if (changed) await this.save();
	}
}
