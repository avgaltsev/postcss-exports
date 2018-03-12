# postcss-exports

Alternative CSS modules implementation.

## Usage

### Syntax

All class names are scoped globally and not exported outside by default. To export them you should define a scope. Scopes can be named and default.

```css
.myGlobalClass {
	color: red;
}

@scope {
	.myClass {
		color: red;
	}
}

@scope myScope {
	.myClass {
		color: red;
	}
}
```

You can reference global class names using pseudoclass `:global`.

```css
@scope {
	.myGlobalClass:global .myClass {
		color: red;
	}
}
```

You also can reference scoped class names using pseudoclass `:scoped` with scope name or without parameters to reference a default scope.

```css
@scope {
	.myClass:scoped("myScope") .myClass {
		color: red;
	}
}

@scope myScope {
	.myClass:scoped .myClass {
		color: red;
	}
}
```

It is possible to define any number of class modifiers using pseudoclass `:mod`.

```css
@scope {
	.myClass {
		color: red;
	}

	.myClass:mod("bold") {
		font-weight: bold;
	}
}
```

### Example

```css
.article {
	color: black;
}

@scope {
	.article:global .link {
		color: blue;
	}

	.article:global .link:mod("dotted") {
		text-decoration-style: dotted;
	}
}

@scope citate {
	.link {
		color: red;
	}
}
```

This example will produce the following output (using default class name generator).

```css
.article {
	color: black;
}

.article ._filename__link_ {
	color: blue;
}

.article ._filename__link_dotted {
	text-decoration-style: dotted;
}
```

Exported data will look like this.

```json
{
	"scopes": {},
	"defaultScope": {
		"link": {
			"base": "_filename__link_",
			"mods": {
				"dotted": "_filename__link_dotted"
			}
		}
	}
}
```

As there is no practical reasons to use this plugin without importing its results to JS, it's intended to use in conjunction with some bundlers via plugins.
