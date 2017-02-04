# PHPMD

VS Code extension for php, using phpmd.

## Config

Default :

	{
		"phpmd.enabled": true,
		"phpmd.validate.executablePath": "/usr/bin/phpmd",
		"phpmd.validate.rulesets": "cleancode,codesize,controversial,design,naming,unusedcode",
		"phpmd.validate.rulesetsFile": ""
	}

## Changes

#### v1.1.3 (2017-01-5)

- Support rulesets config file (by @yeaha).

#### v0.3.1 (2016-03-28)

- Add Composer support. [Issue #8](https://github.com/ly95/vsc.phpmd/issues/8)
