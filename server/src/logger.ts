'use strict';

import {
	IConnection
} from "vscode-languageserver";

let connection: IConnection = undefined;

const showMsgPrefix = 'phpmd';

export function configure(con: IConnection) {
	connection = con;
}

function checkConfigure() {
	if (connection === undefined) {
		throw new Error(`Logger must be initialized to use.`);
	}
	return connection !== undefined;
}

export function error(msg: string) {
	checkConfigure();
	connection.window.showErrorMessage(`${showMsgPrefix}: ${msg}`);
}

export function warn(msg: string) {
	checkConfigure();
	connection.window.showWarningMessage(`${showMsgPrefix}: ${msg}`);
}

export function info(msg: string) {
	checkConfigure();
	connection.window.showInformationMessage(`${showMsgPrefix}: ${msg}`);
}

export function log(msg: string) {
	checkConfigure();
	connection.console.log(`${showMsgPrefix}: ${msg}`);
}
