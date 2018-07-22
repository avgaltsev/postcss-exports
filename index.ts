import * as path from "path";

import * as postcss from "postcss";
import {plugin, Transformer, Rule, Declaration, AtRule} from "postcss";

import * as packageJson from "./package.json";

const POSTCSS_PLUGIN: string = packageJson.name;
const POSTCSS_VERSION: string = packageJson.version;

const KEYFRAMES_ATRULE_NAME_PATTERN = /^(?:-[a-z]-)?(?:keyframes)$/;

const CLASS_PATTERN = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\b(?!:(?:mod|global))/g;
const MOD_CLASS_PATTERN = /\.([a-zA-Z_][a-zA-Z0-9_-]*):mod\((["'])?([a-zA-Z_][a-zA-Z0-9_-]*)\2\)/g;
const GLOBAL_CLASS_PATTERN = /\.([a-zA-Z_][a-zA-Z0-9_-]*):global\b/g;

const ANIMATION_DECLARATION_NAME_PATTERN = /^(?:-[a-z]-)?(?:animation|animation-name)$/;
const ANIMATION_DECLARATION_TOKEN_PATTERN = /(?:^|\s)(?:[+-]?\d+(?:s|ms)?|linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\([^)]+\)|step-start|step-end|steps\([^)]+\)|frames\([^)]+\)|infinite|normal|reverse|alternate|alternate-reverse|none|forwards|backwards|both|running|paused)(?=$|\s)/g;

export interface Scope {
	[name: string]: {
		base: string;
		mods?: {
			[name: string]: string;
		};
	};
}

export interface NameGenerator {
	(filePath: string, name: string, modName: string): string;
}

export interface ScopeTaker {
	(scope: Scope): void;
}

export interface PluginOptions {
	generateName?: NameGenerator;
	takeScope?: ScopeTaker;
}

const generateDefaultName: NameGenerator = (filePath, name, modName?) => {
	const fileName = filePath ? path.normalize(path.dirname(filePath) + path.sep + path.basename(filePath, path.extname(filePath))).split(path.sep) : [];

	return [...fileName, name, ...(modName ? [modName] : [])].join("_");
};

const dontTakeScope: ScopeTaker = (scope) => {};

class Processor {
	private scope: Scope = {};

	constructor(private generateName: (name: string, modName?: string) => string) {}

	public processAtRule(atRule: AtRule): void {
		if (atRule.name.match(KEYFRAMES_ATRULE_NAME_PATTERN)) {
			atRule.params = this.processName(atRule.params);
		}
	}

	public processRule(rule: Rule): void {
		rule.selector = rule.selector.replace(CLASS_PATTERN, (match, ...matches) => {
			return "." + this.processName(matches[0]);
		});

		rule.selector = rule.selector.replace(MOD_CLASS_PATTERN, (match, ...matches) => {
			return "." + this.processName(matches[0], matches[2]);
		});

		rule.selector = rule.selector.replace(GLOBAL_CLASS_PATTERN, ".$1");
	}

	public processDeclaration(declaration: Declaration): void {
		if (declaration.prop.match(ANIMATION_DECLARATION_NAME_PATTERN)) {
			const names = declaration.value.split(/\s*,\s*/).map((value) => {
				return value.replace(ANIMATION_DECLARATION_TOKEN_PATTERN, " ").trim();
			});

			declaration.value = names.reduce((result, name) => {
				return result.replace(name, this.processName(name));
			}, declaration.value);
		}
	}

	public getScope() {
		return this.scope;
	}

	private processName(name: string, modName?: string): string {
		this.scope[name] = this.scope[name] || {
			base: this.generateName(name),
		};

		if (modName) {
			this.scope[name].mods = this.scope[name].mods || {};
			this.scope[name].mods[modName] = this.scope[name].mods[modName] || this.generateName(name, modName);

			return this.scope[name].mods[modName];
		}

		return this.scope[name].base;
	}
}

export default plugin<PluginOptions>(POSTCSS_PLUGIN, (pluginOptions = {}) => {
	const generateName: NameGenerator = (typeof pluginOptions.generateName === "function") ? pluginOptions.generateName : generateDefaultName;
	const takeScope: ScopeTaker = (typeof pluginOptions.takeScope === "function") ? pluginOptions.takeScope : dontTakeScope;

	const transformer: Transformer = (root) => {
		const processor = new Processor((name: string, modName?: string): string => {
			return generateName(path.relative(process.cwd(), root.source.input.file), name, modName);
		});

		root.walk((node) => {
			switch (node.type) {
				case "atrule":
					processor.processAtRule(node);
					break;

				case "rule":
					processor.processRule(node);
					break;

				case "decl":
					processor.processDeclaration(node);
					break;
			}
		});

		takeScope(processor.getScope());
	};

	transformer.postcssPlugin = POSTCSS_PLUGIN;
	transformer.postcssVersion = POSTCSS_VERSION;

	return transformer;
});
