import * as path from "path";

import * as postcss from "postcss";
import {Transformer, plugin} from "postcss";

import {name, version} from "./package.json";

const POSTCSS_PLUGIN = name;
const POSTCSS_VERSION = version;

const SCOPE_PATTERN = /^(?:[a-zA-Z_][a-zA-Z0-9_-]*)?$/;

const CLASS_PATTERN = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\b(?!:(?:mod|global))/g;
const MOD_CLASS_PATTERN = /\.([a-zA-Z_][a-zA-Z0-9_-]*):mod\((["'])?([a-zA-Z_][a-zA-Z0-9_-]*)\2\)/g;
const GLOBAL_CLASS_PATTERN = /\.([a-zA-Z_][a-zA-Z0-9_-]*):global\b/g;

export interface Scope {
	[name: string]: {
		base?: string;
		mods?: {
			[name: string]: string;
		};
	};
}

export interface Scopes {
	[name: string]: Scope;
}

export interface Exports {
	scopes: Scopes;
	defaultScope: Scope;
}

export interface Cache {
	[name: string]: string;
}

export interface Context {
	exports: Exports;
	cache: Cache;
}

export interface NameGenerator {
	(filePath?: string, scopeName?: string, className?: string, modName?: string): string;
}

export interface ExportsTaker {
	(exports: Exports): void;
}

export interface PluginOptions {
	generateName?: NameGenerator;
	takeExports?: ExportsTaker;
}

const getName = (cacheKey: string, context: Context, generateName: () => string) => {
	if (!context.cache[cacheKey]) {
		context.cache[cacheKey] = generateName();
	}

	return context.cache[cacheKey];
};

const processScope = (atRule: postcss.AtRule, context: Context, generateName: (scopeName: string, className: string, modName?: string) => string) => {
	const scopeName = atRule.params;

	let scope: Scope;

	if (scopeName) {
		context.exports.scopes[scopeName] = context.exports.scopes[scopeName] || {};
		scope = context.exports.scopes[scopeName];
	} else {
		scope = context.exports.defaultScope;
	}

	atRule.walkRules((atRule, index) => {
		atRule.selector = atRule.selector.replace(CLASS_PATTERN, (match, ...matches) => {
			const className = matches[0];
			const cacheKey = [scopeName, className].join(".");

			scope[className] = scope[className] || {};
			scope[className].base = getName(cacheKey, context, () => {
				return generateName(scopeName, className);
			});

			return `.${scope[className].base}`;
		});

		atRule.selector = atRule.selector.replace(MOD_CLASS_PATTERN, (match, ...matches) => {
			const className: string = matches[0];
			const modName: string = matches[2];
			const cacheKey = [scopeName, className, modName].join(".");

			scope[className] = scope[className] || {};
			scope[className].mods = scope[className].mods || {};
			scope[className].mods[modName] = getName(cacheKey, context, () => {
				return generateName(scopeName, className, modName);
			});

			return `.${scope[className].mods[modName]}`;
		});

		atRule.selector = atRule.selector.replace(GLOBAL_CLASS_PATTERN, ".$1");
	});

	return atRule.nodes;
};

const generateDefaultName: NameGenerator = (filePath, scopeName, className, modName) => {
	const fileName = filePath ? [...path.dirname(filePath).split(path.sep), path.basename(filePath, path.extname(filePath))] : [];

	return [...fileName, scopeName, className, modName].join("_");
};

const dontTakeExports: ExportsTaker = (exports) => {};

export default plugin<PluginOptions>(POSTCSS_PLUGIN, (pluginOptions = {}) => {
	const generateName: NameGenerator = (typeof pluginOptions.generateName === "function") ? pluginOptions.generateName : generateDefaultName;
	const takeExports: ExportsTaker = (typeof pluginOptions.takeExports === "function") ? pluginOptions.takeExports : dontTakeExports;

	const transformer: Transformer = (root) => {
		const context: Context = {
			exports: {
				scopes: {},
				defaultScope: {},
			},

			cache: {},
		};

		root.walkAtRules("scope", (atRule) => {
			if (atRule.params.match(SCOPE_PATTERN)) {
				atRule.replaceWith(...processScope(atRule, context, (scopeName, className, modName) => {
					return generateName(path.relative(process.cwd(), root.source.input.file), scopeName, className, modName);
				}));
			}
		});

		takeExports(context.exports);
	};

	transformer.postcssPlugin = POSTCSS_PLUGIN;
	transformer.postcssVersion = POSTCSS_VERSION;

	return transformer;
});
