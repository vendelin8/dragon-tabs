///<reference types="chrome"/>
import { Render, Row, PopupAction, Load, Restore, Close, Pop, Swap, Remove, Drag } from './models'
import Sortable from 'sortablejs';

// const log = console.log;
const icon = chrome.runtime.getURL('../icons/32.png');
const container = document.querySelector<HTMLElement>('.container')!;
var sortable: Sortable;
var rows: Row[] = [];
var activeId: number = 0;
const port = chrome.runtime.connect({name: 'popup'});

const rowURL = (e: Event): string => (<Element>(<Element>e.target).parentNode).getAttribute('title')!;
const rowIdx = (e: Event) => parseInt((<Element>(<Element>e.target).parentNode).getAttribute('rowIdx')!);

function createElement(elType: string, cls: string, parent: HTMLElement, attrs?: {[key: string]: string}): HTMLElement {
	const el = document.createElement(elType);
	el.setAttribute('class', cls);
	if (attrs) {
		for (let key in attrs) {
			el.setAttribute(key, attrs[key]);
		};
	}
	parent.appendChild(el);
	return el;
}

function postMessage(msg: PopupAction) {
	port.postMessage(msg);
}

port.onMessage.addListener(function(msg: Render) {
	container.textContent = '';
	activeId = msg.activeId;
	if (activeId == -1) {
		createElement('div', 'warn', container).textContent = 'Doesn\'t work in incognito mode';
		return;
	}
	rows = msg.rows;
	for (let i: number = 0; i < rows.length; i++) {
		const row = rows[i];
		const tabId = row.id;
		const isActive = tabId === activeId;
		const url = row.url;

		const rowDiv = createElement('div', 'row', container, {'title': url, 'rowIdx': i.toString()});
		createElement('div', 'move', rowDiv).textContent = '☰';
		(createElement('img', 'fav', rowDiv) as HTMLImageElement).src = row.favIconUrl || icon;
		if (tabId) {
			createElement('span', 'link', rowDiv).textContent = row.title || url;
		} else {
			const aLink = createElement('a', 'link', rowDiv) as HTMLAnchorElement;
			aLink.href = url;
			aLink.textContent = row.title || url;
			aLink.target = '_blank';
		}

		if (!isActive && !tabId) {
			createElement('div', 'swap', rowDiv).addEventListener('click', function (e) {
				postMessage(new Swap(rowURL(e), rowIdx(e)));
				window.close();
			});
		}

		createElement('div', isActive ? 'new' : 'delete', rowDiv).addEventListener('click', function (e) {
			postMessage(new Remove(rowIdx(e)));
		});

		if (!isActive && !tabId) {
			createElement('div', 'pop', rowDiv).addEventListener('click', function (e) {
				postMessage(new Pop(rowIdx(e)));
				window.close();
			});
		}
	}
	sortable = new Sortable(container, {
		'animation': 150,
		'onUpdate': (e) => {
			if (e.oldIndex !== undefined && e.newIndex !== undefined) {
				postMessage(new Drag(e.oldIndex, e.newIndex));
			}
		}
	});
});

postMessage(new Load());

document.querySelector<HTMLElement>('.close')!.addEventListener('click', function (e) {
	postMessage(new Close());
	window.close();
});

document.querySelector<HTMLElement>('.restore')!.addEventListener('click', function (e) {
	postMessage(new Restore());
	window.close();
});
