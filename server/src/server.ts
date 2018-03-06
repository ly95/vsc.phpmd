'use strict';

import {
	IPCMessageReader, IPCMessageWriter, createConnection,
	IConnection, TextDocuments, TextDocument,
	Diagnostic, DiagnosticSeverity, InitializeResult, Files
} from 'vscode-languageserver';
import * as logger from './logger';
import * as langsets from './langsets';
import { resolveExecPath } from './detector';
import * as cp from 'child_process';

langsets.use('en_US');

interface Settings {
	phpmd: {
		maxNumberOfProblems: number;
		enabled: boolean,
		validate: {
			executablePath: string,
			rulesets: string,
			rulesetsFile: string
		}
	}
}

const PhpmdRulesets = [
	'cleancode',
	'codesize',
	'controversial',
	'design',
	'naming',
	'unusedcode'
];

let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents: TextDocuments = new TextDocuments();
let workspaceRoot: string;
let maxNumberOfProblems: number;
let executablePath: string = undefined;
let executablePathSetting: string;
let rulesets: string;
let rulesetsFile: string;
let enabled: boolean;

let matchExpression = /([a-zA-Z_\/\.]+):(\d+)	(.*)/;
let reportFormat = 'text';

logger.configure(connection);
documents.listen(connection);

connection.onInitialize((params): InitializeResult => {
	workspaceRoot = params.rootPath || undefined;
	return {
		capabilities: {
			textDocumentSync: documents.syncKind
		}
	}
});

documents.onDidChangeContent((change) => {
	validatePhpDocument(change.document);
});

connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;

	maxNumberOfProblems = settings.phpmd.maxNumberOfProblems || 100;
	executablePathSetting = settings.phpmd.validate.executablePath;

	enabled = settings.phpmd.enabled;

	rulesets = settings.phpmd.validate.rulesets;
	rulesetsFile = settings.phpmd.validate.rulesetsFile;

	if (rulesetsFile.length > 0) {
		rulesets = rulesetsFile;
	} else {
		var temp: string[] = [];
		if ((rulesets || '').length > 0) {
			rulesets.split(',').forEach((elem) => {
				if (PhpmdRulesets.indexOf(elem) >= 0) {
					temp.push(elem);
				}
			});
		}
		rulesets = (temp.length > 0 ? temp : PhpmdRulesets).join(',');
	}

	documents.all().forEach(validatePhpDocument);
});

connection.listen();

function parserResponse(line: string) {
	let matches = line.match(matchExpression);
	if (matches) {
		let line_no = parseInt(matches[2]) - 1;
		return {
			severity: DiagnosticSeverity.Error,
			range: {
				start: { line: line_no, character: 0 },
				end: { line: line_no, character: Number.MAX_VALUE }
			},
			message: "PHPMD: " + matches[3]
		};
	}
	return null;
}

function resolveExecutablePath(): Thenable<void> {
	const defaultExecPath = executablePathSetting == ''
		? undefined
		: executablePathSetting
		;

	return resolveExecPath(workspaceRoot, defaultExecPath)
		.then(execCommandName => {
			executablePath = execCommandName;
		}, error => {
			logger.error(error);
		});
}

function validatePhpDocument(textDocument: TextDocument): void {

	if (!enabled) {
		return;
	}

	let response = '';
	let diagnostics: Diagnostic[] = [];

	let args = [
		Files.uriToFilePath(textDocument.uri),
		reportFormat,
		rulesets
	];

	new Promise<string>((resolve) => {
		resolve(resolveExecutablePath().then(() => executablePath));
	}).then(execPath => {
		let exec = cp.spawn(execPath, args);

		exec.stdout.on('data', (data: Buffer) => {

			if (maxNumberOfProblems && diagnostics.length > maxNumberOfProblems) {
				return;
			}

			response += data.toString();
			do {
				let lines = response.split("\n");
				let line = lines.shift();
				if (lines.length) {
					response = lines.join("\n");
				} else {
					response = '';
					break;
				}
				if (!line.length) {
					continue;
				}
				let error = parserResponse(line);
				if (error === null) {
					break;
				}
				diagnostics.push(error);
			} while (true);
		});

		exec.stderr.on('data', (data: Buffer) => {
			connection.console.error("phpmd: " + data.toString());
		});

		exec.on('close', (code: number) => {
			// PHPMD's command line tool currently defines three different exit codes.
			// 0, This exit code indicates that everything worked as expected. This means there was no error/exception and PHPMD hasn't detected any rule violation in the code under test.
			// 1, This exit code indicates that an error/exception occured which has interrupted PHPMD during execution.
			// 2, This exit code means that PHPMD has processed the code under test without the occurence of an error/exception, but it has detected rule violations in the analyzed source code.
			if (code > 0) {
				connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
			}
		});
	}, e => {
		connection.console.error("phpmd: " + e);
	}).catch((error) => {
		console.log(error);
	});
}
