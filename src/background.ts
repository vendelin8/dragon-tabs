///<reference types="chrome"/>
import { Render, Row, PopupAction, Load, Restore, Close, Pop, Swap, Remove, Drag } from './api'

type Active = {
	id: number;
	url: string;
}

// const log = console.log;
const keyRows = 'rows', newTabURL = 'chrome://new-tab-page/';
let port: chrome.runtime.Port, rows: Row[] = [], isLoaded = false;
const defActive: Active = {id: 0, url: ''};
let active: Active = defActive;

const RowFromTab = (t: chrome.tabs.Tab, rowIdx: number = -1): Row =>
	({id: t.id, url: t.url??'', title: t.title, favIconUrl: t.favIconUrl,
		index: t.index, rowIdx});

const ActiveFromTab = (t: chrome.tabs.Tab): Active =>
	({id: t.id??0, url: t.url??''});

function readStorage() {
	if (isLoaded) {
		return Promise.resolve();
	}
	return chrome.storage.local.get(keyRows).then((result) => {
		rows = result[keyRows];
		if (!rows) {
			rows = [];
		}
		isLoaded = true;
	});
}

function setStorage() {
	const valueToSet: any = {};
	valueToSet[keyRows] = rows;
	chrome.storage.local.set(valueToSet);
}

function loadLite() {
	return Promise.all([chrome.tabs.query({active: true, lastFocusedWindow: true}), readStorage()]).then((values) => {
		active = ActiveFromTab(values[0][0]);
	});
}

function render() {
	const msg: Render = {rows: rows, activeId: active.id};
	port.postMessage(msg);
}

function removeRow(index: number) {
	if (index == -1) {
		return;
	}
	rows.splice(index, 1);
	setStorage();
}

const indexSort = (a: chrome.tabs.Tab, b: chrome.tabs.Tab) => a.index - b.index;

// Refreshes rows to initialize popup gui with. It merges saved rows with
// active browser tabs in the most natural way of keeping orders.
function load() {
	return Promise.all([chrome.tabs.query({}), readStorage()]).then((values) => {
		// sort browser tabs by index
		const tabs: chrome.tabs.Tab[] = values[0].sort(indexSort);

		// storing active tab to reuse for actions while the popup is open
		const _activeTab = tabs.find((tab) => tab.active)
		active = _activeTab ? ActiveFromTab(_activeTab) : defActive;

		const m: {[url: string]: Row} = {}; // map of browser tabs by url as key
		for (let i: number = 0; i < tabs.length; i++) {
			const t: chrome.tabs.Tab = tabs[i]!;
			m[t.url??''] = RowFromTab(t);
		}

		const is: {[url: string]: Row} = {}; // intersection of rows and browser tabs
		const isList: Row[] = [];
		for (let i: number = 0; i < rows.length; i++) {
			const t = rows[i];
			const url = t.url;
			const t2 = m[url];
			if (t2) {
				is[url] = t2;
				isList.push(t2);
			}
		}

		const newrows = [];
		let listIdx: number = 0, tabIndex: number = 0, isIndex: number = 0;
		let nextIs: Row | undefined;
		if (isList.length > 0) {
			nextIs = isList[0];
		}
		while (listIdx < rows.length || tabIndex < tabs.length) { // merging the two lists
			while (listIdx < rows.length) {
				const t = rows[listIdx];
				listIdx++;
				const tUrl = t.url;
				if (is[tUrl]) { // found intersection
					if (nextIs?.url === tUrl) {
						break;
					}
					// at a later position in the browser, removing
					delete is[tUrl];
					const remIndex = isList.findIndex((t2) => t2.url == tUrl);
					if (remIndex == isList.length - 1) {
						isList.pop();
					} else {
						isList.splice(remIndex, 1);
					}
				}
				delete t.id;
				newrows.push(t);
			}
			while (tabIndex < tabs.length) {
				const tUrl = tabs[tabIndex].url??'';
				const t = m[tUrl];
				delete t.index;
				newrows.push(t);
				tabIndex++;
				if (is[tUrl]) { // found intersection
					break;
				}
			}
			isIndex++;
			if (isList.length > isIndex) {
				nextIs = isList[isIndex];
			} else {
				nextIs = undefined;
			}
		}
		rows = newrows;
		setStorage();
	});
}

function close() {
	let hasChange = false;
	chrome.tabs.remove(rows.filter((row) => row.id && row.id != active.id).map((row) => {
		const tabId = row.id!;
		hasChange = true;
		delete row.id;
		delete row.index;
		return tabId;
	})).then(() => {
		if (hasChange) {
			setStorage();
		}
	});
}

function restore() {
	rows.forEach((row, index) => {
		if (!row.id) {
			chrome.tabs.create({url: row.url, index}).then((t) => {row.id = t.id;});
		}
	});
}

function doSwap(url: string) {
	const oldURL = active.url;
	chrome.tabs.update(active.id, {url});
	return oldURL;
}

// Changes the url of the current tab with the url of the tab at the given index.
function swap(url: string, idx: number) {
	rows[idx].url = active.url;
	doSwap(url);
	active.url = url;
	setStorage();
}

function doPop(row: Row) {
	const oldURL = doSwap(row.url);
	removeRow(rows.findIndex((row2) => row2.url == oldURL));
}

// Changes the url of the current tab with the url of the tab at the given index.
// Also removes the given tab from the storage.
function pop(index: number) {
	if (index > -1) {
		doPop(rows[index]);
		return;
	}
	for (index = rows.length - 1; index > -1; index--) {
		const row = rows[index];
		if (!row.id) {
			doPop(row);
			break;
		}
	}
}

function remove(rowIdx: number) {
	const row = rows[rowIdx];
	if (row.url === active.url) {
		chrome.tabs.update(active.id, {url: newTabURL});
	} else {
		if (row.id) {
			chrome.tabs.remove(row.id);
		}
		removeRow(rowIdx);
	}
	render();
}

function removeActive() {
	const index = rows.findIndex((t) => t.id == active.id);
	chrome.tabs.query({}).then((tabs) => {
		if (tabs.length === 1) {
			chrome.tabs.update(tabs[0]!.id!, {url: newTabURL});
		} else {
			chrome.tabs.remove(active.id);
		}
		removeRow(index);
	});
}

function drag(oldIdx: number, newIdx: number) {
	if (newIdx == oldIdx) {
		return;
	}
	rows.splice(newIdx, 0, rows[oldIdx]);
	removeRow(oldIdx);
	render();
	const row = rows[newIdx]!;
	const rowId = row.id;
	if (!rowId) {
		return;
	}
	// move browser tab to the dragged position
	for (let i: number = newIdx - 1; i > -1; i--) {
		const t2 = rows[i];
		if (t2.index !== undefined) {
			chrome.tabs.move(rowId, {index: t2.index + 1});
			return;
		}
	}
	for (let i: number = newIdx + 1; i < rows.length; i++) {
		const t2 = rows[i];
		if (t2.index !== undefined) {
			chrome.tabs.move(rowId, {index: t2.index});
			return;
		}
	}
}

chrome.runtime.onConnect.addListener((p: chrome.runtime.Port) => {
	if (p.name !== 'popup') {
		return;
	}
	port = p;
	p.onMessage.addListener((pa: PopupAction) => {
		switch (true) {
		case pa instanceof Load:
			load().then(() => {
				render();
			});
			break;
		case pa instanceof Close:
			close();
			break;
		case pa instanceof Restore:
			restore();
			break;
		case pa instanceof Pop:
			pop(pa.rowIdx);
			break;
		case pa instanceof Swap:
			swap(pa.url, pa.rowIdx);
			break;
		case pa instanceof Remove:
			remove(pa.rowIdx);
			break;
		case pa instanceof Drag:
			drag(pa.oldIdx, pa.newIdx);
			break;
		}
	});
});

chrome.commands.onCommand.addListener((command: string) => {
	switch (command) {
	case 'close':
		load().then(() => {
			close();
		});
		break;
	case 'close-tab':
		loadLite().then(() => {
			removeActive();
		});
		break;
	case 'pop-tab':
		loadLite().then(() => {
			pop(-1);
		});
		break;
	}
});