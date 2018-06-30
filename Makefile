#
# Aden dev
#

usage:
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
help: usage

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

release: 
	@printf "Current version is $(VERSION). This will create version $(NEXT_VERSION). Press [enter] to continue." >&2
	@read
	@git-chore "release-$(NEXT_VERSION)"
	@node -e '\
		var j = require("./package.json");\
		j.version = "$(NEXT_VERSION)";\
		var s = JSON.stringify(j, null, 2);\
		require("fs").writeFileSync("./package.json", s);'
	@git commit package.json -m 'Version $(NEXT_VERSION)'
	@git tag -a "v$(NEXT_VERSION)" -m "Version $(NEXT_VERSION)"
	# git push --tags --no-verify --set-upstream origin chore/release-$(NEXT_VERSION)
.PHONY: release release-patch release-minor release-major
