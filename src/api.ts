export type Row = {
	id?: number | undefined;
	url: string;
	title?: string | undefined;
	favIconUrl?: string | undefined;
	index?: number | undefined;
	rowIdx: number;
}

export class Load {};
export class Restore {};
export class Close {};

export class Pop {
	rowIdx: number;

	constructor(rowIdx: number) {
		this.rowIdx = rowIdx;
	}
}

export class Swap {
	url: string;
	rowIdx: number;

	constructor(url: string, rowIdx: number) {
		this.url = url;
		this.rowIdx = rowIdx;
	}
}

export class Remove {
	rowIdx: number;

	constructor(rowIdx: number) {
		this.rowIdx = rowIdx;
	}
}

export class Drag {
	oldIdx: number;
	newIdx: number;

	constructor(oldIdx: number, newIdx: number) {
		this.oldIdx = oldIdx;
		this.newIdx = newIdx;
	}
}

export type PopupAction = Load | Restore | Close | Pop | Swap | Remove | Drag;

export type Render = {
	rows: Row[],
	activeId: number
}
