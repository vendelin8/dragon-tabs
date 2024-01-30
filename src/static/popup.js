// const log = console.log;
const icon = chrome.runtime.getURL('../icons/32.png');
const container = document.querySelector('.container');
var sortable, rows, activeId;
const port = chrome.runtime.connect({name: 'popup'});

port.onMessage.addListener(function(msg) {
	rows = msg.urls;
	activeId = msg.activeId;
	container.textContent = '';
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const tabId = row.id;
		const isActive = tabId === activeId;
		const url = row.url;

		const rowDiv = createElement('div', 'row', container, null, {'title': url, 'index': i});
		createElement('div', 'move', rowDiv, {'textContent': '☰'});
		createElement('img', 'fav', rowDiv, {'src': row.favIconUrl || icon});
		if (tabId) {
			createElement('span', 'link', rowDiv, {'textContent': row.title || url});
		} else {
			createElement('a', 'link', rowDiv, {'href': url, 'textContent': row.title || url, 'target': '_blank'});
		}

		if (!isActive && !tabId) {
			createElement('div', 'swap', rowDiv).addEventListener('click', function (e) {
				port.postMessage({action: 'swap', url: rowURL(e), index: rowIndex(e)});
				window.close();
			});
		}

		createElement('div', isActive ? 'new' : 'delete', rowDiv).addEventListener('click', function (e) {
			port.postMessage({action: 'remove', index: rowIndex(e)});
		});

		if (!isActive && !tabId) {
			createElement('div', 'pop', rowDiv).addEventListener('click', function (e) {
				port.postMessage({action: 'pop', index: rowIndex(e)});
				window.close();
			});
		}
	}
	sortable = Sortable.create(container, {
		'animation': 150,
		'onUpdate': (e) => {
			let item = e.item;
			if (item) {
				port.postMessage({action: 'drag', 'oldIndex': e.oldIndex, 'newIndex': e.newIndex});
			}
		}
	});
});

function rowURL(e) {
	return e.target.parentNode.getAttribute('title');
}

function rowIndex(e) {
	return parseInt(e.target.parentNode.getAttribute('index'));
}

function createElement(elType, cls, parent, props, attrs) {
	const el = document.createElement(elType);
	el.setAttribute('class', cls);
	parent.appendChild(el);
	if (props) {
		for (const [key, value] of Object.entries(props)) {
			el[key] = value;
		}
	}
	if (attrs) {
		for (const [key, value] of Object.entries(attrs)) {
			el.setAttribute(key, value);
		}
	}
	return el;
}

port.postMessage({action: 'load'});

document.querySelector('.close').addEventListener('click', function (e) {
	port.postMessage({action: 'close'});
	window.close();
});

document.querySelector('.restore').addEventListener('click', function (e) {
	port.postMessage({action: 'restore'});
	window.close();
});
