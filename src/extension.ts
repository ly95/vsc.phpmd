/**
 * VS Code extension for php, using phpmd.
 *
 *
 * Licensed under The MIT License
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Yang Lin <linyang95#aol.com>
 * @link          http://github.com/ly95/vsc.phpmd
 * @license       http://www.opensource.org/licenses/mit-license.php MIT License
 */
import * as vscode from 'vscode';
import * as cp from 'child_process';

enum RunMode {
	onSave,
	onType
};

enum ReportFormat {
	xml,
	text,
	html
};

enum Ruleset {
	cleancode,
	codesize,
	controversial,
	design,
	naming,
	unusedcode
};

let Rulesets: string = "cleancode,codesize,controversial,design,naming,unusedcode";

/**
 * PHPMD
 */
class PHPMD {
	listener: vscode.Disposable;
	runMode: RunMode;
	rulesets: Array<string>;
	executable: string;
	delayerHandler: number;
	reportFormat = 'text';
	matchExpression = /([a-zA-Z_\/\.]+):(\d+)	(.*)/;
	diagnosticCollection: any;
	enabled: boolean;

	constructor() {
		this.init();
	}

	dispose() {
		this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
	}

	init() {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection("phpmd");

		let section = vscode.workspace.getConfiguration("phpmd");
		this.enabled = section.get('enabled', true);

		this.runMode = section.get("validate.run_mode", RunMode.onSave);
		this.executable = section.get("validate.executablePath", null);

		let rulesets = section.get("validate.rulesets", Rulesets);
		this.rulesets = new Array;

		let tmp = rulesets.split(",");
		for (let i = 0; i < tmp.length; i++) {
			let element = tmp[i].trim();
			if (rulesets.indexOf(element) !== -1) {
				this.rulesets.push(element);
			}
		}
	}

	activate(context: vscode.ExtensionContext) {
		if (!this.enabled) {
			return;
		}
		if (this.listener) {
			this.listener.dispose();
		}
		if (this.runMode === RunMode.onType) {
			this.listener = vscode.workspace.onDidChangeTextDocument((e) => {
				this.doValidate(e.document);
			});
		} else {
			this.listener = vscode.workspace.onDidSaveTextDocument((e) => {
				this.doValidate(e);
			});
		}
		context.subscriptions.push(this);
	}

	doValidate(document: vscode.TextDocument) {
		let _this = this;
		if (document.isDirty || document.isUntitled) {
			return;
		}
		if (document.languageId !== 'php') {
			vscode.window.showInformationMessage("Only php files can be validate by phpmd.");
			return;
		}

		let executablePath = this.executable || "phpmd";
		let args = [];

		args.push(document.uri.path);
		args.push(this.reportFormat);
		args.push(this.rulesets.join(","));

		if (this.delayerHandler) {
			clearTimeout(this.delayerHandler);
		}
		this.delayerHandler = setTimeout(function(executablePath: string, args: Array<string>) {
			let options = {
				'timeout': 60000
			};
			let commands = executablePath + " " + args.join(" ");
			cp.exec(commands, options, function(error, stdout, stderr) {
				let result = stdout.toString();
				let diagnostics = [];
				result.split("\n").forEach(element => {
					let diagnostic = _this.parser(element);
					if (diagnostic) {
						diagnostics.push(diagnostic);
					}
				});
				_this.diagnosticCollection.set(document.uri, diagnostics);
			});
		}, 500, executablePath, args);
	}

	parser(line: string) {
		let matches = line.match(this.matchExpression);
		// console.log(matches);
		if (matches) {
			let message = "PHPMD: " + matches[3];
			let line_no = parseInt(matches[2]) - 1;
			let diagnostic = new vscode.Diagnostic(new vscode.Range(line_no, 0, line_no, Number.MAX_VALUE), message);
			return diagnostic;
		}
		return null;
	}
}

export function activate(context: vscode.ExtensionContext) {
	let phpmd = new PHPMD();
	phpmd.activate(context);
}