#
# Aden dev
#

NODE_ENV ?= production
TESTS=test/integration # test/unit
MOCHA_OPTS=--check-leaks \
	--recursive \
	--full-trace \
	--require "./dev/mocha.interface.js" \
	--ui she-bdd \
	--bail \
	--timeout 25000 \
	--globals addresses \
	--globals __core-js_shared__ \
	--slow 5000 \
	./test/lib/inject.js
VERSION = $(shell node -pe 'require("./package.json").version')

export NODE_ENV

usage:
	@echo ''

	@echo 'Core tasks                       : Description'
	@echo '--------------------             : -----------'
	@echo 'make dev                         : Setup repository for development (install, hooks)'
	@echo 'make test                        : Run tests'
	@echo 'make coverage                    : Create test coverage report to ./coverage'
	@echo 'make mincov                      : Run coverage and then check if minimum coverage is given'
	@echo 'make lint                        : Run the linter (eslint)'
	@echo 'make release                     : Publish version-tag matching package.json'

	@echo ''

	@echo 'Additional tasks                 : Description'
	@echo '--------------------             : -----------'
	@echo 'make report                      : Opening default browser with coverage report.'
	@echo 'make hooks                       : Creates git hooks to run tests before a push (done by make dev)'

	@echo ''

	@echo 'Release tasks                 		: Description'
	@echo '--------------------             : -----------'
	@echo 'make specs                       : Run tests and put the results into the specs file'
	@echo 'make release-patch               : Increment package version 0.0.1 -> 0.0.2 then release'
	@echo 'make release-minor               : Increment package version 0.1.0 -> 0.2.0 then release'
	@echo 'make release-major               : Increment package version 1.0.0 -> 2.0.0 then release'
	@echo 'make prerelease-alpha            : Increment version 0.5.0 -> 0.5.1-alpha.0 -> 0.5.1-alpha.1 ...'
	@echo 'make prerelease-beta             : Increment version 0.5.0 -> 0.5.1-beta.0 -> 0.5.1-beta.1 ...'
	@echo 'make prerelease-rc               : Increment version 0.5.0 -> 0.5.1-rc.0 -> 0.5.1-rc.1 ...'
	@echo '                                   (should use ´make npm-config´ before)'

	@echo ''
# -
help: usage

test:
	@echo 'Checking behaviour for version '$(VERSION)'.'
	@./node_modules/.bin/mocha $(TESTS) $(MOCHA_OPTS) $(MOCHA) \
		--reporter spec
.PHONY: test

report:
	@echo 'Opening default browser with coverage report.'
	@node ./node_modules/.bin/nyc report --reporter=lcov
	@open ./coverage/lcov-report/index.html
.PHONY: report

coverage:
	@echo 'Creating coverage report for version '$(VERSION)'.'
	@node ./node_modules/.bin/nyc \
	./node_modules/.bin/mocha $(TESTS) $(MOCHA_OPTS) $(MOCHA)
.PHONY: coverage

check-coverage:
	@node ./node_modules/.bin/nyc check-coverage --statements 80 --functions 80 --lines 80 --branches 70
.PHONY: check-coverage

mincov: coverage
	@node ./node_modules/.bin/nyc check-coverage --statements 80 --functions 80 --lines 80 --branches 70
.PHONY: mincov

coveralls:
	@node ./node_modules/.bin/nyc report --reporter=lcov
	@cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js
.PHONY: coveralls

specs:
	@echo 'Creating specs file from tests.'
	make mincov > specs
	@echo 'Done.'
.PHONY: specs

lint:
	@node ./node_modules/eslint/bin/eslint.js --env node ./lib/**/*.js ./index.js
	@echo "ESLint done."
.PHONY: lint

hooks:
	@echo "Setting up git hooks."
	cp ./dev/aden.pre-push.sh ./.git/hooks/pre-push
	chmod +x ./.git/hooks/pre-push
.PHONY: hooks

clean:
	@echo "Housekeeping..."
	# rm -rf ./node_modules
	rm -rf ./coverage
	rm -rf ./tmp
	rm -rf ./test/tmp
	rm -rf npm-shrinkwrap.json
	@echo "Clean."
.PHONY: clean

dev: clean hooks lint test mincov
.PHONY: dev

release-patch: NEXT_VERSION = $(shell node -pe 'require("semver").inc("$(VERSION)", "patch")')
release-minor: NEXT_VERSION = $(shell node -pe 'require("semver").inc("$(VERSION)", "minor")')
release-major: NEXT_VERSION = $(shell node -pe 'require("semver").inc("$(VERSION)", "major")')
prerelease-alpha: NEXT_VERSION = $(shell node -pe 'require("semver").inc("$(VERSION)", "prerelease", "alpha")')
prerelease-beta: NEXT_VERSION = $(shell node -pe 'require("semver").inc("$(VERSION)", "prerelease", "beta")')
prerelease-rc: NEXT_VERSION = $(shell node -pe 'require("semver").inc("$(VERSION)", "prerelease", "rc")')
release-patch: release
release-minor: release
release-major: release
prerelease-alpha: release
prerelease-beta: release
prerelease-rc: release

release: clean
	@printf "Current version is $(VERSION). This will publish version $(NEXT_VERSION). Press [enter] to continue." >&2
	@read
	@git-chore "release-$(NEXT_VERSION)"
	@make lint
	@npm shrinkwrap
	@node -e '\
		var j = require("./package.json");\
		j.version = "$(NEXT_VERSION)";\
		var s = JSON.stringify(j, null, 2);\
		require("fs").writeFileSync("./package.json", s);'
	@make specs
	@git commit package.json specs -m 'Version $(NEXT_VERSION)'
	@git tag -a "v$(NEXT_VERSION)" -m "Version $(NEXT_VERSION)"
	git push --tags --no-verify --set-upstream origin chore/release-$(NEXT_VERSION)
	@printf "Press [enter] to publish $(NEXT_VERSION) to NPM." >&2
	@read
	npm publish
	@rm -rf npm-shrinkwrap.json
.PHONY: release release-patch release-minor release-major
