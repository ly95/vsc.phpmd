'use strict';

/// TODO: To use i18n framework

import * as util from 'util';

import {HashMap} from './utils/types';

export let useLang = 'en_US';
export const enableLangs = [
	'en_US'
];

export function use(lang: string) {
	if (enableLangs.indexOf(lang) == -1) {
		throw new Error(`${lang} is not supported lang.`);
	}
	useLang = lang;
}

export interface ILangSet {
	[key: string]: string;
	no_executable: string;
	unable_locate: string;
};

export type ILangSets = HashMap<ILangSet>;

export const langSets: ILangSets = {
	'en_US': {
		no_executable: 'No such phpmd executable: %s',
		unable_locate: 'Unable to locate phpmd. Please add phpmd in your global or project local using composer.'
	}
}

function swapJsonKeyValues(val: HashMap<string>) {
	const result: HashMap<string> = {};
	for (let k in val) {
		if (val.hasOwnProperty(k)) {
			result[val[k]] = k;
		}
	}

	return result;
}
const enLangMap = swapJsonKeyValues(langSets['en_US']);

export function getLang(key: string) {
	return langSets[useLang][key];
}

export function getLangSet() {
	return langSets[useLang];
}

export function getLangEN(msg: string) {
	return langSets[useLang][enLangMap[msg]];
}

export const __ = getLangEN;

export const format = util.format;
