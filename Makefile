# extract name from package.json
PACKAGE_NAME := $(shell awk '/"name":/ {gsub(/[",]/, "", $$2); print $$2}' package.json)
RPM_NAME := $(PACKAGE_NAME)-cockpit
VERSION := $(shell T=$$(git describe 2>/dev/null) || T=1; echo $$T | tr '-' '.')
ifeq ($(TEST_OS),)
TEST_OS = centos-9-stream
endif
export TEST_OS
SUBSCRIPTION_MANAGER_BRANCH ?= main
ifneq ($(TEST_SCENARIO),devel)
# the test scenario is the subscription-manager branch to test against
SUBSCRIPTION_MANAGER_BRANCH = $(TEST_SCENARIO)
endif
TARFILE=$(RPM_NAME)-$(VERSION).tar.xz
NODE_CACHE=$(RPM_NAME)-node-$(VERSION).tar.xz
SPEC=$(RPM_NAME).spec
PREFIX ?= /usr/local
APPSTREAMFILE=data/org.candlepinproject.subscription_manager.metainfo.xml
DESKTOPFILE=data/subscription-manager-cockpit.desktop
VM_IMAGE=$(CURDIR)/test/images/$(TEST_OS)
SUBMAN_TAR=$(CURDIR)/dist/subscription-manager.tar.gz
SMBEXT_TAR=$(CURDIR)/dist/subscription-manager-build-extra.tar.gz
# stamp file to check for node_modules/
NODE_MODULES_TEST=package-lock.json
# build.js ran in non-watch mode
DIST_TEST=runtime-npm-modules.txt
# one example file in pkg/lib to check if it was already checked out
COCKPIT_REPO_STAMP=pkg/lib/cockpit-po-plugin.js
# common arguments for tar, mostly to make the generated tarballs reproducible
TAR_ARGS = --sort=name --mtime "@$(shell git show --no-patch --format='%at')" --mode=go=rX,u+rw,a-s --numeric-owner --owner=0 --group=0

# when TEST_SCENARIO contains branch of subscription-manager use it,
# otherwise use the packaged version in the tested distribution
ifneq ($(filter-out devel system,$(TEST_SCENARIO)),)
IMAGE_CUSTOMIZE_DEPENDS = $(SUBMAN_TAR) $(SMBEXT_TAR) test/vm.install-sub-man
IMAGE_CUSTOMIZE_INSTALL = --upload $(SUBMAN_TAR):/var/tmp/ --upload $(SMBEXT_TAR):/var/tmp/ --script $(CURDIR)/test/vm.install-sub-man
else
IMAGE_CUSTOMIZE_DEPENDS =
IMAGE_CUSTOMIZE_INSTALL = --no-network
endif

ifeq ($(TEST_COVERAGE),yes)
RUN_TESTS_OPTIONS+=--coverage
NODE_ENV=development
endif

all: $(DIST_TEST)

# checkout common files from Cockpit repository required to build this project;
# this has no API stability guarantee, so check out a stable tag when you start
# a new project, use the latest release, and update it from time to time
COCKPIT_REPO_FILES = \
	pkg/lib \
	test/common \
	tools/node-modules \
	$(NULL)

COCKPIT_REPO_URL = https://github.com/cockpit-project/cockpit.git
COCKPIT_REPO_COMMIT = eceba97aae742fc4c7de86d6da6f8fdf422d642d # 367

$(COCKPIT_REPO_FILES): $(COCKPIT_REPO_STAMP)
COCKPIT_REPO_TREE = '$(strip $(COCKPIT_REPO_COMMIT))^{tree}'
$(COCKPIT_REPO_STAMP): Makefile
	@git rev-list --quiet --objects $(COCKPIT_REPO_TREE) -- 2>/dev/null || \
	    git fetch --no-tags --no-write-fetch-head --depth=1 $(COCKPIT_REPO_URL) $(COCKPIT_REPO_COMMIT)
	git archive $(COCKPIT_REPO_TREE) -- $(COCKPIT_REPO_FILES) | tar x

#
# i18n
#

LINGUAS=$(basename $(notdir $(wildcard po/*.po)))

po/$(PACKAGE_NAME).js.pot:
	xgettext --default-domain=$(PACKAGE_NAME) --output=$@ --language=C --keyword= \
		--keyword=_:1,1t --keyword=_:1c,2,2t --keyword=C_:1c,2 \
		--keyword=N_ --keyword=NC_:1c,2 \
		--keyword=gettext:1,1t --keyword=gettext:1c,2,2t \
		--keyword=ngettext:1,2,3t --keyword=ngettext:1c,2,3,4t \
		--keyword=gettextCatalog.getString:1,3c --keyword=gettextCatalog.getPlural:2,3,4c \
		--from-code=UTF-8 $$(find src/ -name '*.js' -o -name '*.jsx')

po/$(PACKAGE_NAME).html.pot: $(NODE_MODULES_TEST) $(COCKPIT_REPO_STAMP)
	pkg/lib/html2po -o $@ $$(find src -name '*.html')

po/$(PACKAGE_NAME).manifest.pot: $(NODE_MODULES_TEST) $(COCKPIT_REPO_STAMP)
	pkg/lib/manifest2po -o $@ src/manifest.json

po/$(PACKAGE_NAME).metainfo.pot: $(APPSTREAMFILE)
	xgettext --default-domain=$(PACKAGE_NAME) --output=$@ $<

po/$(PACKAGE_NAME).desktop.pot: $(DESKTOPFILE)
	xgettext --default-domain=$(PACKAGE_NAME) --language=Desktop --output=$@ $<

po/$(PACKAGE_NAME).pot: po/$(PACKAGE_NAME).html.pot po/$(PACKAGE_NAME).js.pot po/$(PACKAGE_NAME).manifest.pot po/$(PACKAGE_NAME).metainfo.pot po/$(PACKAGE_NAME).desktop.pot
	msgcat --sort-output --output-file=$@ $^

po/LINGUAS:
	echo $(LINGUAS) | tr ' ' '\n' > $@

#
# Build/Install/dist
#

$(SPEC): packaging/$(SPEC).in $(NODE_MODULES_TEST)
	provides=$$(awk '{print "Provides: bundled(npm(" $$1 ")) = " $$2}' runtime-npm-modules.txt); \
	awk -v p="$$provides" '{gsub(/%{VERSION}/, "$(VERSION)"); $(SUB_NODE_ENV) gsub(/%{NPM_PROVIDES}/, p)}1' $< > $@

$(DIST_TEST): $(COCKPIT_REPO_STAMP) $(shell find src/ -type f) package.json build.js
	$(MAKE) package-lock.json && NODE_ENV=$(NODE_ENV) ./build.js

watch: $(NODE_MODULES_TEST) $(COCKPIT_REPO_STAMP)
	NODE_ENV=$(NODE_ENV) node build.js --watch

clean:
	rm -rf dist/
	rm -f $(SPEC)
	rm -f po/LINGUAS
	rm -f metafile.json runtime-npm-modules.txt

clean-all:
	git clean -fdx

install: $(DIST_TEST) po/LINGUAS
	mkdir -p $(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)
	cp -r dist/* $(DESTDIR)$(PREFIX)/share/cockpit/$(PACKAGE_NAME)
	mkdir -p $(DESTDIR)$(PREFIX)/share/metainfo/
	msgfmt --xml -d po \
		--template $(APPSTREAMFILE) \
		-o $(DESTDIR)$(PREFIX)/share/metainfo/$(notdir $(APPSTREAMFILE))
	mkdir -p $(DESTDIR)$(PREFIX)/share/applications/
	msgfmt --desktop -d po \
		--template $(DESKTOPFILE) \
		-o $(DESTDIR)$(PREFIX)/share/applications/$(notdir $(DESKTOPFILE))
	mkdir -p $(DESTDIR)$(PREFIX)/share/icons/
	cp -r data/icons/hicolor $(DESTDIR)$(PREFIX)/share/icons/

# this requires a built source tree and avoids having to install anything system-wide
devel-install: $(DIST_TEST)
	mkdir -p ~/.local/share/cockpit
	ln -s `pwd`/dist ~/.local/share/cockpit/$(PACKAGE_NAME)

# assumes that there was symlink set up using the above devel-install target,
# and removes it
devel-uninstall:
	rm -f ~/.local/share/cockpit/$(PACKAGE_NAME)

print-version:
	@echo "$(VERSION)"

dist: $(TARFILE)
	@ls -1 $(TARFILE)

# when building a distribution tarball, call build.js with a 'production' environment by default
# we don't ship node_modules for license and compactness reasons; we ship a
# pre-built dist/ (so it's not necessary) and ship packge-lock.json (so that
# node_modules/ can be reconstructed if necessary)
$(TARFILE): export NODE_ENV ?= production
$(TARFILE): $(DIST_TEST) $(SPEC)
	if type appstream-util >/dev/null 2>&1; then appstream-util validate-relax --nonet data/*.metainfo.xml; fi
	if type desktop-file-validate >/dev/null 2>&1; then desktop-file-validate data/*.desktop; fi
	tar --xz $(TAR_ARGS) -cf $(TARFILE) --transform 's,^,$(RPM_NAME)/,' \
		--exclude packaging/$(SPEC).in --exclude test/reference \
		$$(git ls-files | grep -v node_modules) \
		$(COCKPIT_REPO_FILES) $(NODE_MODULES_TEST) $(DIST_TEST) $(SPEC) \
		dist/

$(NODE_CACHE): $(NODE_MODULES_TEST)
	tools/node-modules runtime-tar $(NODE_CACHE)

node-cache: $(NODE_CACHE)

# convenience target for developers
srpm: $(TARFILE) $(NODE_CACHE) $(SPEC)
	rpmbuild -bs \
	  --define "_sourcedir `pwd`" \
	  --define "_srcrpmdir `pwd`" \
	  $(SPEC)

# convenience target for developers
rpm: $(TARFILE) $(NODE_CACHE) $(SPEC)
	mkdir -p "`pwd`/output"
	mkdir -p "`pwd`/rpmbuild"
	mkdir -p "`pwd`/build"
	rpmbuild -bb \
	  --define "_sourcedir `pwd`" \
	  --define "_specdir `pwd`" \
	  --define "_builddir `pwd`/rpmbuild" \
	  --define "_srcrpmdir `pwd`" \
	  --define "_rpmdir `pwd`/output" \
	  --define "_buildrootdir `pwd`/build" \
	  $(SPEC)
	find `pwd`/output -name '*.rpm' -printf '%f\n' -exec mv {} . \;
	rm -r "`pwd`/rpmbuild"
	rm -r "`pwd`/output" "`pwd`/build"

$(SUBMAN_TAR): subscription-manager
	cd subscription-manager && \
	fn=$$(python3 ./setup.py --fullname); \
	python3 ./setup.py sdist && \
	mv dist/$$fn.tar.gz $(SUBMAN_TAR)

$(SMBEXT_TAR): subscription-manager
	tar czf $(SMBEXT_TAR) --transform 's,data/icons,src/subscription_manager/gui/data/icons,' subscription-manager/build_ext data/icons/hicolor

# build a VM with locally built distro pkgs installed
# disable networking, VM images have mock/pbuilder with the common build dependencies pre-installed
$(VM_IMAGE): $(NODE_CACHE) $(TARFILE) bots test/vm.install $(IMAGE_CUSTOMIZE_DEPENDS)
	test/candlepin-container
	bots/image-customize --fresh --memory-mb 2048 \
		--upload $(NODE_CACHE):/var/tmp/ --build $(TARFILE) \
		--upload test/candlepin-img.tar:/var/tmp/ \
		--upload test/run-candlepin:/root/ \
		$(IMAGE_CUSTOMIZE_INSTALL) \
		--script $(CURDIR)/test/vm.install $(TEST_OS)

# convenience target for the above
vm: $(VM_IMAGE)
	@echo $(VM_IMAGE)

# convenience target to print the filename of the test image
print-vm:
	@echo $(VM_IMAGE)

codecheck: test/common $(NODE_MODULES_TEST)
	test/common/static-code

# convenience target to setup all the bits needed for the integration tests
# without actually running them
prepare-check: $(NODE_MODULES_TEST) $(VM_IMAGE) test/common test/reference

# run the browser integration tests;
# this will run all tests/check-* and format them as TAP.
# Because the candlepin container uses a lot of available memory in the nondestructive VM
# we bump the memory limit to 2048MB
check: prepare-check
	test/common/run-tests --nondestructive-memory-mb 2048 ${RUN_TESTS_OPTIONS}

# checkout Cockpit's bots for standard test VM images and API to launch them
# must be from main, as only that has current and existing images; but testvm.py API is stable
# support CI testing against a bots change
bots: $(COCKPIT_REPO_STAMP)
	test/common/make-bots

# checkout subscription-manager at the branch we want
subscription-manager:
	git clone --quiet https://github.com/candlepin/subscription-manager.git subscription-manager
	git -C subscription-manager fetch --quiet --depth=1 origin $(SUBSCRIPTION_MANAGER_BRANCH)
	git -C subscription-manager checkout --quiet FETCH_HEAD
	@echo "checked out subscription-manager/ ref $$(git -C subscription-manager rev-parse HEAD)"

test/reference: test/common
	test/common/pixel-tests pull

FORCE:
package-lock.json: FORCE $(COCKPIT_REPO_STAMP)
	tools/node-modules make_package_lock_json

.PHONY: all clean install devel-install devel-uninstall print-version dist node-cache rpm prepare-check check vm print-vm
