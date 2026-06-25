import { around } from 'monkey-around';
import { Plugin, TFolder } from 'obsidian';
import { PinManager } from './pin-manager';
import { FileExplorerItem, FileExplorerView } from './types';

/**
 * Reorder a folder's already-sorted items so pinned files come first, in pin order,
 * followed by the remaining items in their original (native or other-plugin) sort order.
 * Stale pins (paths no longer present in the folder) are silently skipped.
 *
 * NOTE: getSortedFolderItems returns file-explorer TREE ITEMS (`fileItems[path]` values),
 * not TAbstractFile. The real path lives at `item.file.path`.
 */
export function reorderWithPins(
	items: FileExplorerItem[],
	folderPath: string,
	pinManager: PinManager
): FileExplorerItem[] {
	const pinnedPaths = pinManager.getPinnedPaths(folderPath);
	if (pinnedPaths.length === 0) return items;

	const byPath = new Map<string, FileExplorerItem>();
	for (const item of items) byPath.set(item.file.path, item);

	const pinned: FileExplorerItem[] = [];
	for (const p of pinnedPaths) {
		const item = byPath.get(p);
		if (item) {
			pinned.push(item);
			byPath.delete(p);
		}
	}
	if (pinned.length === 0) return items;

	const rest = items.filter((item) => byPath.has(item.file.path));
	return [...pinned, ...rest];
}

/**
 * Monkey-patch the file explorer view's getSortedFolderItems so pinned items float to the
 * top of every folder. Patches the prototype (shared by all file-explorer leaves), so a
 * single install covers every open explorer. Returns an uninstaller for onunload().
 *
 * Obsidian 1.7+ uses deferred views: at onLayoutReady the file-explorer leaf's `view` may be
 * a placeholder lacking getSortedFolderItems. We force it to load first so we patch the real
 * FileExplorerView class. Returns null if the explorer isn't available yet (caller retries).
 */
export async function installSortPatch(
	plugin: Plugin,
	pinManager: PinManager
): Promise<(() => void) | null> {
	const leaf = plugin.app.workspace.getLeavesOfType('file-explorer')[0];
	if (!leaf) return null;

	// Materialize a deferred view so leaf.view is the real FileExplorerView.
	if (leaf.isDeferred) await leaf.loadIfDeferred();

	const view = leaf.view as FileExplorerView | undefined;
	if (!view || typeof view.getSortedFolderItems !== 'function') return null;

	// The class prototype is untyped at runtime; cast to the known shape so the
	// patched method is fully typed (no `any` leaking into the review scanner).
	const proto = Object.getPrototypeOf(view) as FileExplorerView;

	type SortFn = (this: FileExplorerView, folder: TFolder) => FileExplorerItem[];
	const uninstaller = around(proto, {
		getSortedFolderItems(original: SortFn): SortFn {
			return function (this: FileExplorerView, folder: TFolder): FileExplorerItem[] {
				const result: FileExplorerItem[] = original.call(this, folder);
				return reorderWithPins(result, folder.path, pinManager);
			};
		},
	});

	return uninstaller;
}
