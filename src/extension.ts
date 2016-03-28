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
import * as fs from 'fs';
import * as path from 'path';

/// Now, vscode is non support i18n.
/// So, I was hard coding...
/// TODO: add i18n-node dependencies and use.
const LANG_SETS = {
    'en_US': {
        "no_executable": "Unable to locate phpmd. Please add phpmd to your global path."
    }
};
const NOW_LANG = 'en_US';

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

function showErrorMsg(msg: string): void {
    vscode.window.showErrorMessage(`phpmd: ${msg}`);
}

function canResolveJsonPath(o: any, ...keys: string[]): boolean {
    let obj = o;
    for (let key of keys) {
        if (o[key]) {
            o = o[key];
        } else {
            return false;
        }
    }

    return true;
}

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
    diagnosticCollection: vscode.DiagnosticCollection;
    enabled: boolean;
    tmpStr = "";

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

        // Not support now.
        // this.runMode = section.get("validate.run_mode", RunMode.onSave);
        this.runMode = RunMode.onSave;
        this.executable = section.get("validate.executablePath", null);

        let rulesets = section.get("validate.rulesets", Rulesets);
        if (!rulesets) {
            rulesets = Rulesets;
        }
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
                // Todo
                // this.doValidate(e.document);
            });
        } else {
            this.listener = vscode.workspace.onDidSaveTextDocument((e) => {
                this.doValidate(e);
            });
        }

        vscode.workspace.onDidCloseTextDocument((e) => {
            this.diagnosticCollection.delete(e.uri);
        });

        context.subscriptions.push(this);
    }

    static executablePath() {
        if (vscode.workspace.rootPath) {
            const rootPath = vscode.workspace.rootPath;
            const composerConfPath = path.join(rootPath, 'composer.json');
            if (fs.existsSync(composerConfPath)) {
                const composerConf = JSON.parse(fs.readFileSync(composerConfPath, 'utf-8'));

                if (canResolveJsonPath(composerConf, 'require', 'phpmd/phpmd')
                    || canResolveJsonPath(composerConf, 'require-dev', 'phpmd/phpmd')
                ) {
                    const composerPhpmdPath = path.join(rootPath, 'vendor', 'bin', 'phpmd');

                    if (fs.existsSync(composerPhpmdPath)) {
                        return composerPhpmdPath;
                    }
                }
            }
        }

        return 'phpmd';
    }

    doValidate(document: vscode.TextDocument) {
        if (document.languageId !== 'php') {
            // vscode.window.showInformationMessage("Only php files can be validate by phpmd.");
            return;
        }

        if (this.delayerHandler) {
            clearTimeout(this.delayerHandler);
        }

        this.delayerHandler = setTimeout((document: vscode.TextDocument) => {
            const executablePath = this.executable || PHPMD.executablePath();
            let args = [];

            args.push(document.fileName);
            args.push(this.reportFormat);
            args.push(this.rulesets.join(","));

            let diagnostics = new Array;

            const check_executable = cp.exec(`${executablePath} --version`, (error, stdout, stderr) => {
                if (error) {
                    showErrorMsg(LANG_SETS[NOW_LANG]["no_executable"]);
                } else {
                    let exec = cp.spawn(executablePath, args);

                    exec.stdout.on('data', (data: Buffer) => {
                        let result = data.toString();
                        // console.log('stdout: ' + result);
                        this.tmpStr += result;
                        do {
                            let lines = this.tmpStr.split("\n");
                            let line = lines.shift();
                            if (lines.length) {
                                this.tmpStr = lines.join("\n");
                            } else {
                                this.tmpStr = "";
                                break;
                            }
                            if (!line.length) {
                                continue;
                            }
                            let diagnostic = this.parser(line);
                            if (diagnostic === null) {
                                break;
                            }
                            diagnostics.push(diagnostic);
                        } while (true);
                    });
					
                    // exec.stderr.on('data', (data: Buffer) => {
                    // 	console.log('stderr: ' + data);
                    // });
                    exec.on('close', (code: number) => {
                        // PHPMD's command line tool currently defines three different exit codes.
                        // 0, This exit code indicates that everything worked as expected. This means there was no error/exception and PHPMD hasn't detected any rule violation in the code under test.
                        // 1, This exit code indicates that an error/exception occured which has interrupted PHPMD during execution.
                        // 2, This exit code means that PHPMD has processed the code under test without the occurence of an error/exception, but it has detected rule violations in the analyzed source code.
                        // console.log('close: ' + code);
                        if (code > 0) {
                            // console.log("diagnostics.length " + diagnostics.length);
                            this.diagnosticCollection.set(document.uri, diagnostics);
                        } else {
                            this.diagnosticCollection.delete(document.uri);
                        }
                    });
                }
            });
        }, 1000, document);
    }

    parser(line: string) {
        let matches = line.match(this.matchExpression);
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