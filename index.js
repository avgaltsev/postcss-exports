let path = require("path");

let postcss = require("postcss");

let scopePattern = /^(?:[a-zA-Z_][a-zA-Z0-9_-]*)?$/;

let classPattern = /\.([a-zA-Z_][a-zA-Z0-9_-]*)\b(?!:(?:mod|global))/g;
let modClassPattern = /\.([a-zA-Z_][a-zA-Z0-9_-]*):mod\((["'])?([a-zA-Z_][a-zA-Z0-9_-]*)\2\)/g;
let globalClassPattern = /\.([a-zA-Z_][a-zA-Z0-9_-]*):global\b/g;

function getName(cacheKey, context, generateName) {
	if (!context.cache[cacheKey]) {
		context.cache[cacheKey] = generateName();
	}

	return context.cache[cacheKey];
}

function processScope(atRule, context, generateName) {
	let scopeName = atRule.params;

	let scope;

	if (scopeName) {
		context.exports.scopes[scopeName] = context.exports.scopes[scopeName] || {};
		scope = context.exports.scopes[scopeName];
	} else {
		scope = context.exports.defaultScope;
	}

	atRule.walkRules(function (rule) {
		rule.selector = rule.selector.replace(classPattern, function (match, ...matches) {
			let className = matches[0];
			let cacheKey = [scopeName, className].join(" ");

			scope[className] = scope[className] || {};
			scope[className].base = getName(cacheKey, context, function () {
				return generateName(scopeName, className, null, "");
			});

			return `.${scope[className].base}`;
		});

		rule.selector = rule.selector.replace(modClassPattern, function (match, ...matches) {
			let className = matches[0];
			let modName = matches[2];
			let cacheKey = [scopeName, className, modName].join(" ");

			scope[className] = scope[className] || {};
			scope[className].mods = scope[className].mods || {};
			scope[className].mods[modName] = getName(cacheKey, context, function () {
				return generateName(scopeName, className, modName, "");
			});

			return `.${scope[className].mods[modName]}`;
		});

		rule.selector = rule.selector.replace(globalClassPattern, ".$1");
	});

	return atRule.nodes;
}

function generateDefaultName(filePath, scopeName, className, modName, css) {
	let fileName = filePath ? [
		...path.dirname(filePath).split(path.sep),
		path.basename(filePath, path.extname(filePath))
	] : [];

	return [...fileName, scopeName, className, modName].join("_");
}

module.exports = postcss.plugin("postcss-exports", function (options = {}) {
	let generateName = (typeof options.generateName === "function") ? options.generateName : generateDefaultName;

	let takeExports = (typeof options.takeExports === "function") ? options.takeExports : function () {};

	return function (root, result) {
		let context = {
			exports: {
				scopes: {},
				defaultScope: {}
			},

			cache: {}
		};

		root.walkAtRules(function (atRule) {
			if (atRule.name === "scope") {
				if (atRule.params.match(scopePattern)) {
					atRule.replaceWith(...processScope(atRule, context, function (...parameters) {
						return generateName(path.relative(process.cwd(), root.source.input.file), ...parameters);
					}));
				}
			}
		});

		takeExports(context.exports);
	};
});
