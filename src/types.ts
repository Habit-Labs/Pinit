import { TAbstractFile, TFolder, View } from 'obsidian';

/** Persisted plugin data. Maps a folder path to an ordered list of pinned file paths. */
export interface PinData {
	/**
	 * folderPath -> ordered array of pinned file paths within that folder.
	 * The root folder uses the key "/" (Obsidian's convention for the vault root TFolder.path).
	 */
	pins: Record<string, string[]>;
}

export const DEFAULT_PIN_DATA: PinData = {
	pins: {},
};

/**
 * Undocumented internal shape of the file explorer view.
 *
 * These members are NOT part of Obsidian's public `obsidian.d.ts` API. They exist on the
 * internal `FileExplorerView` class at runtime and have been stable since Obsidian 0.15.0.
 * Used by obsidian-custom-sort, obsidian-bartender, and many other file-explorer plugins.
 * Declared here purely for our own type safety; they do not affect Obsidian's runtime.
 */
export interface FileExplorerView extends View {
	fileItems: Record<string, FileExplorerItem>;
	requestSort(): void;
	/** Returns file-explorer tree items (with `.file`), NOT TAbstractFile. */
	getSortedFolderItems(folder: TFolder): FileExplorerItem[];
}

export interface FileExplorerItem {
	el: HTMLElement;
	file: TAbstractFile;
	selfEl?: HTMLElement;
	innerEl?: HTMLElement;
}
