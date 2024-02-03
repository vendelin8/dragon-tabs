export type Row = {
	id?: number | undefined;
	url: string;
	title?: string | undefined;
	favIconUrl?: string | undefined;
	index?: number | undefined;
	rowIdx: number;
}

export interface PopupAction {
	kind: string;
}

export class Load implements PopupAction {
	kind = 'load';
};

export class Restore implements PopupAction {
	kind = 'restore';
};

export class Close implements PopupAction {
	kind = 'close';
};

export class Pop implements PopupAction {
	kind = 'pop';
	rowIdx: number;

	constructor(rowIdx: number) {
		this.rowIdx = rowIdx;
	}
}

export class Swap implements PopupAction {
	kind = 'swap';
	url: string;
	rowIdx: number;

	constructor(url: string, rowIdx: number) {
		this.url = url;
		this.rowIdx = rowIdx;
	}
}

export class Remove implements PopupAction {
	kind = 'remove';
	rowIdx: number;

	constructor(rowIdx: number) {
		this.rowIdx = rowIdx;
	}
}

export class Drag implements PopupAction {
	kind = 'drag';
	oldIdx: number;
	newIdx: number;

	constructor(oldIdx: number, newIdx: number) {
		this.oldIdx = oldIdx;
		this.newIdx = newIdx;
	}
}

export type Render = {
	rows: Row[];
	activeId: number;
}
