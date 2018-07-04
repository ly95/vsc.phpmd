'use strict';

import * as path from 'path';

import { workspace, Disposable, ExtensionContext, window } from 'vscode';
import { LanguageClient, LanguageClientOptions, SettingMonitor, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: ExtensionContext) {

    let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
    let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    }

    if (process.platform === 'win32') {
        window.showErrorMessage("The phpmd is not supported on Windows yet.");
        return;
	}

    let clientOptions: LanguageClientOptions = {
        documentSelector: ['php'],
        synchronize: {
            configurationSection: 'phpmd',
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    }

    let disposable = new LanguageClient('phpmd', serverOptions, clientOptions).start();
    context.subscriptions.push(disposable);
}