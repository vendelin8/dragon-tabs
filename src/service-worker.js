// const log = console.log;
const keyRows = 'rows', newTabURL = 'chrome://new-tab-page/';
let port, rows, active;

function readStorage() {
	if (rows) {
		return Promise.resolve();
	}
	return chrome.storage.local.get(keyRows).then((result) => {
		rows = result[keyRows];
		if (!rows) {
			rows = [];
		}
	});
}

function setStorage() {
	const valueToSet = {};
	valueToSet[keyRows] = rows;
	chrome.storage.local.set(valueToSet);
}

function loadLite() {
	return Promise.all([chrome.tabs.query({active: true, lastFocusedWindow: true}), readStorage()]).then((values) => {
		active = values[0][0];
	});
}

function render() {
	port.postMessage({urls: rows, activeId: active.id});
}

function removeRow(index) {
	if (index == -1) {
		return;
	}
	rows.splice(index, 1);
	setStorage();
}

const indexSort = (a, b) => a.index - b.index;

// Refreshes rows to initialize popup gui with. It merges saved rows with
// active browser tabs in the most natural way of keeping orders.
function load() {
	return Promise.all([chrome.tabs.query({}), readStorage()]).then((values) => {
		// sort browser tabs by index
		const tabs = values[0].sort(indexSort);

		// storing active tab to reuse for actions while the popup is open
		active = tabs.find((tab) => tab.active);

		const m = {}; // map of browser tabs by url as key
		for (let i = 0; i < tabs.length; i++) {
			const t = tabs[i];
			m[t.url] = {id: t.id, url: t.url, title: t.title, favIconUrl: t.favIconUrl, index: i};
		}

		const is = {}; // intersection of rows and browser tabs
		const isList = [];
		for (let i = 0; i < rows.length; i++) {
			const t = rows[i];
			const url = t.url;
			const t2 = m[url];
			if (t2) {
				is[url] = t2;
				isList.push(t2);
			}
		}
		isList.sort((a, b) => a.index - b.index);

		const newrows = [];
		let listIdx = 0, tabIndex = 0, isIndex = 0;
		let nextIs;
		if (isList.length > 0) {
			nextIs = isList[0];
		}
		while (listIdx < rows.length || tabIndex < tabs.length) { // merging the two lists
			while (listIdx < rows.length) {
				const t = rows[listIdx];
				listIdx++;
				const tUrl = t.url;
				if (is[tUrl]) { // found intersection
					if (nextIs && nextIs.url == tUrl) {
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
				const tUrl = tabs[tabIndex].url;
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
				nextIs = null;
			}
		}
		rows = newrows;
		setStorage();
	});
}

function close() {
	chrome.tabs.remove(rows.filter((row) => row.id && row.id != active.id).map((row) => {
		const tabId = row.id;
		delete row.id;
		setStorage();
		return tabId;
	}));
}

function restore() {
	rows.forEach((row, index) => {
		if (!row.id) {
			chrome.tabs.create({url: row.url, index}).then((t) => {row.id = t.id;});
		}
	});
}

function doSwap(url) {
	const oldURL = active.url;
	chrome.tabs.update(active.id, {url});
	return oldURL;
}

// Changes the url of the current tab with the url of the tab at the given index.
function swap(url, index) {
	rows[index].url = active.url;
	doSwap(url);
	active.url = url;
	setStorage();
}

function doPop(row) {
	const oldURL = doSwap(row.url);
	removeRow(rows.findIndex((row2) => row2.url == oldURL));
}

// Changes the url of the current tab with the url of the tab at the given index.
// Also removes the given tab from the storage.
function pop(index) {
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

function remove(index) {
	const row = rows[index];
	if (row.url === active.url) {
		chrome.tabs.update(row.id, {url: newTabURL});
	} else {
		if (row.id) {
			chrome.tabs.remove(row.id);
		}
		removeRow(index);
	}
	render();
}

function removeActive() {
	const index = rows.findIndex((t) => t.id == active.id);
	chrome.tabs.query({}).then((tabs) => {
		if (tabs.length === 1) {
			chrome.tabs.update(tabs[0].id, {url: newTabURL});
		} else {
			chrome.tabs.remove(active.id);
		}
		removeRow(index);
	});
}

function drag(oldIndex, newIndex) {
	if (newIndex == oldIndex) {
		return;
	}
	rows.splice(newIndex, 0, rows[oldIndex]);
	removeRow(oldIndex);
	render();
	const row = rows[newIndex];
	if (!row.id) {
		return;
	}
	for (let i = newIndex - 1; i > -1; i--) {
		const t2 = rows[i];
		if (t2.id) {
			chrome.tabs.move(row.id, {index: newIndex});
			return;
		}
	}
	for (let i = newIndex + 1; i < rows.length; i++) {
		const t2 = rows[i];
		if (t2.id) {
			chrome.tabs.move(row.id, {index: t2.index});
			return;
		}
	}
}

chrome.runtime.onConnect.addListener((p) => {
	if (p.name !== 'popup') {
		return;
	}
	port = p;
	p.onMessage.addListener((msg) => {
		switch (msg.action) {
		case 'load':
			load().then(() => {
				render();
			});
			break;
		case 'close':
			close(msg.url);
			break;
		case 'restore':
			restore();
			break;
		case 'pop':
			pop(msg.index);
			break;
		case 'swap':
			swap(msg.url, msg.index);
			break;
		case 'remove':
			remove(msg.index);
			break;
		case 'drag':
			drag(msg.oldIndex, msg.newIndex);
			break;
		}
	});
});

chrome.commands.onCommand.addListener((command) => {
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