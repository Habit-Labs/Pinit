import { PinManager } from './pin-manager';
import { FileExplorerView } from './types';

const PINNED_CLASS = 'pinit-pinned';

/**
 * Toggle the pinned CSS class across all rendered file-explorer items. Class-based
 * decoration is idempotent and survives Obsidian's virtual-DOM reconciliation, unlike
 * manually inserted icon nodes (which get orphaned or duplicated on re-render).
 */
export function decoratePinnedItems(view: FileExplorerView, pinManager: PinManager): void {
	const items = view.fileItems;
	if (!items) return;
	for (const path of Object.keys(items)) {
		const el = items[path]?.el;
		if (!el) continue;
		el.toggleClass(PINNED_CLASS, pinManager.isPinned(path));
	}
}

/** Remove all decoration. Called on unload so disabling the plugin leaves no trace. */
export function clearDecorations(view: FileExplorerView): void {
	const items = view.fileItems;
	if (!items) return;
	for (const path of Object.keys(items)) {
		items[path]?.el?.removeClass(PINNED_CLASS);
	}
}
