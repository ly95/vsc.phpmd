'use strict';

import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import * as logger from './logger';
import * as langsets from './langsets';

function canResolveJsonPath(o: any, ...keys: string[]): boolean {
	let obj = o;
	for (let key of keys) {
		if (!o[key]) return false;
		o = o[key];
	}

	return true;
}

export function checkExecutable(executablePath: string): Thenable<boolean> {
	return new Promise<boolean>((resolve, reject) => {
		cp.exec(`${executablePath} --version`, (error, stdout, stderr) => {
			if (error) {
				resolve(false);
			}

			resolve(true);
		});
	});
}

export function checkComposerExecutable(rootPath: string): Thenable<string | boolean> {
	return new Promise<string | boolean>((resolve, reject) => {
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
	return new Promise<string>((resolve, reject) => {
		let resPathP: Thenable<string>;

		if (executablePath !== undefined) {
			resPathP = checkExecutable(executablePath)
				.then(b => new Promise<string>((resolve2, reject2) => {
					if (b) {
						resolve2(executablePath);
					} else {
						const noexecStr = langsets.format(
							langsets.getLangSet().no_executable,
							executablePath
						);
						reject2(noexecStr);
					}
				}));
		} else {
			resPathP = checkComposerExecutable(rootPath).then(r => {
				if (typeof r === 'string') {
					return r;
				} else {
					return 'phpmd';
				}
			})
				.then(pathName => checkExecutable(pathName)
					.then(b => new Promise<string>((resolve2, reject2) => {
						if (b) {
							resolve2(pathName);
						} else {
							reject2(langsets.getLangSet().unable_locate);
						}
					}))
				);
		}

		resolve(resPathP);
	});
}
