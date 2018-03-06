'use strict';

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as langsets from './langsets';

function canResolveJsonPath(o: any, ...keys: string[]): boolean {
	for (let key of keys) {
		if (!o[key]) return false;
		o = o[key];
	}

	return true;
}

export function checkComposerExecutable(rootPath: string): Thenable<string | boolean> {
	return new Promise<string | boolean>((resolve) => {
		const composerConfPath = path.join(rootPath, 'composer.json');

		if (fs.existsSync(composerConfPath)) {
			const composerConf = JSON.parse(fs.readFileSync(composerConfPath, 'utf-8'));
			const pkgName = 'phpmd/phpmd';

			if (canResolveJsonPath(composerConf, 'require', pkgName)
				|| canResolveJsonPath(composerConf, 'require-dev', pkgName)
			) {
				const composerPhpmdPath = path.join(rootPath, 'vendor', 'bin', 'phpmd');

				if (fs.existsSync(composerPhpmdPath)) {
					resolve(composerPhpmdPath);
				}
			}
		}

		resolve(false);
	});
}

export function resolveExecPath(rootPath: string, executablePath?: string): Thenable<string> {
	return new Promise<string>((resolve) => {
		if (executablePath !== undefined) {
			return resolve(executablePath);
		} else if (rootPath !== undefined) {
			return checkComposerExecutable(rootPath).then(r => {
				resolve(typeof r === 'string' ? r : 'phpmd');
			})
		}
		resolve("phpmd")
	}).then(r => {
		return new Promise<string>((resolve, reject) => {
			cp.exec(`${r} --version`, (error) => {
				if (error) {
					reject(langsets.getLangSet().unable_locate);
				} else {
					resolve(r);
				}
			});
		});
	}).catch();

}
