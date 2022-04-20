# extract name from package.json
PACKAGE_NAME := $(shell awk '/"name":/ {gsub(/[",]/, "", $$2); print $$2}' package.json)
RPM_NAME := $(PACKAGE_NAME)-cockpit
VERSION := $(shell T=$$(git describe 2>/dev/null | awk -f get_git_version.awk) || T=1; echo $$T)
ifeq ($(TEST_OS),)
TEST_OS = centos-9-stream
endif
export TEST_OS
# the test scenario is the subscription-manager branch to test against
TEST_SCENARIO ?= main
TARFILE=$(RPM_NAME)-$(VERSION).tar.xz
NODE_CACHE=$(RPM_NAME)-node-$(VERSION).tar.xz
SPEC=$(RPM_NAME).spec
APPSTREAMFILE=data/org.candlepinproject.subscription_manager.metainfo.xml
DESKTOPFILE=data/subscription-manager-cockpit.desktop
VM_IMAGE=$(CURDIR)/test/images/$(TEST_OS)
SUBMAN_TAR=$(CURDIR)/dist/subscription-manager.tar.gz
SMBEXT_TAR=$(CURDIR)/dist/subscription-manager-build-extra.tar.gz
# stamp file to check if/when npm install ran
NODE_MODULES_TEST=package-lock.json
# one example file in dist/ from webpack to check if that already ran
WEBPACK_TEST=dist/manifest.json
# one example file in src/lib to check if it was already checked out
LIB_TEST=src/lib/cockpit-po-plugin.js
# common arguments for tar, mostly to make the generated tarballs reproducible
TAR_ARGS = --sort=name --mtime "@$(shell git show --no-patch --format='%at')" --mode=go=rX,u+rw,a-s --numeric-owner --owner=0 --group=0

ifeq ($(TEST_SCENARIO),system)
IMAGE_CUSTOMIZE_DEPENDS =
IMAGE_CUSTOMIZE_INSTALL =
else
IMAGE_CUSTOMIZE_DEPENDS = $(SUBMAN_TAR) $(SMBEXT_TAR) test/vm.install-sub-man
IMAGE_CUSTOMIZE_INSTALL = --upload $(SUBMAN_TAR):/var/tmp/ --upload $(SMBEXT_TAR):/var/tmp/ --script $(CURDIR)/test/vm.install-sub-man
endif

all: $(WEBPACK_TEST)

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
		--from-code=UTF-8 $$(find src/ \( -name '*.js' -o -name '*.jsx' \) \! -path 'src/lib/*')

po/$(PACKAGE_NAME).html.pot: $(NODE_MODULES_TEST)
	po/html2po -o $@ $$(find src -name '*.html' \! -path 'src/lib/*')

po/$(PACKAGE_NAME).manifest.pot: $(NODE_MODULES_TEST)
	po/manifest2po src/manifest.json -o $@

po/$(PACKAGE_NAME).metainfo.pot: $(APPSTREAMFILE)
	xgettext --default-domain=$(PACKAGE_NAME) --output=$@ $<

po/$(PACKAGE_NAME).desktop.pot: $(DESKTOPFILE)
	xgettext --default-domain=$(PACKAGE_NAME) --language=Desktop --output=$@ $<

po/$(PACKAGE_NAME).pot: po/$(PACKAGE_NAME).html.pot po/$(PACKAGE_NAME).js.pot po/$(PACKAGE_NAME).manifest.pot po/$(PACKAGE_NAME).metainfo.pot po/$(PACKAGE_NAME).desktop.pot
	msgcat --sort-output --output-file=$@ $^

po/LINGUAS:
	echo $(LINGUAS) | tr ' ' '\n' > $@

# Update translations against current PO template
update-po: po/$(PACKAGE_NAME).pot
	for lang in $(LINGUAS); do \
		msgmerge --output-file=po/$$lang.po po/$$lang.po $<; \
	done

#
# Build/Install/dist
#

%.spec: %.spec.tmpl
	sed -e 's/%{VERSION}/$(VERSION)/g' $< > $@

$(WEBPACK_TEST): $(NODE_MODULES_TEST) $(LIB_TEST) $(shell find src/ -type f) package.json webpack.config.js
	NODE_ENV=$(NODE_ENV) node_modules/.bin/webpack

watch:
	NODE_ENV=$(NODE_ENV) node_modules/.bin/webpack --watch

clean:
	rm -rf dist/
	rm -f $(SPEC)
	rm -f po/LINGUAS

install: $(WEBPACK_TEST) po/LINGUAS
	mkdir -p $(DESTDIR)/usr/share/cockpit/$(PACKAGE_NAME)
	cp -r dist/* $(DESTDIR)/usr/share/cockpit/$(PACKAGE_NAME)
	mkdir -p $(DESTDIR)/usr/share/metainfo/
	msgfmt --xml -d po \
		--template $(APPSTREAMFILE) \
		-o $(DESTDIR)/usr/share/metainfo/$(notdir $(APPSTREAMFILE))
	mkdir -p $(DESTDIR)/usr/share/applications/
	msgfmt --desktop -d po \
		--template $(DESKTOPFILE) \
		-o $(DESTDIR)/usr/share/applications/$(notdir $(DESKTOPFILE))
	mkdir -p $(DESTDIR)/usr/share/icons/
	cp -r data/icons/hicolor $(DESTDIR)/usr/share/icons/

# this requires a built source tree and avoids having to install anything system-wide
devel-install: $(WEBPACK_TEST)
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

# when building a distribution tarball, call webpack with a 'production' environment
# we don't ship node_modules for license and compactness reasons; we ship a
# pre-built dist/ (so it's not necessary) and ship packge-lock.json (so that
# node_modules/ can be reconstructed if necessary)
$(TARFILE): export NODE_ENV=production
$(TARFILE): $(WEBPACK_TEST) $(SPEC)
	if type appstream-util >/dev/null 2>&1; then appstream-util validate-relax --nonet data/*.metainfo.xml; fi
	if type desktop-file-validate >/dev/null 2>&1; then desktop-file-validate data/*.desktop; fi
	touch -r package.json $(NODE_MODULES_TEST)
	touch dist/*
	tar --xz $(TAR_ARGS) -cf $(TARFILE) --transform 's,^,$(RPM_NAME)/,' \
		--exclude $(SPEC).tmpl --exclude node_modules \
		$$(git ls-files) src/lib package-lock.json $(SPEC) dist/

$(NODE_CACHE): $(NODE_MODULES_TEST)
	tar --xz $(TAR_ARGS) -cf $@ node_modules

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
	bots/image-customize --verbose --fresh --memory-mb 2048 \
		--upload $(NODE_CACHE):/var/tmp/ --build $(TARFILE) \
		$(IMAGE_CUSTOMIZE_INSTALL) \
		--script $(CURDIR)/test/vm.install $(TEST_OS)

# convenience target for the above
vm: $(VM_IMAGE)
	echo $(VM_IMAGE)

# convenience target to print the filename of the test image
print-vm:
	echo $(VM_IMAGE)

# convenience target to setup all the bits needed for the integration tests
# without actually running them
prepare-check: $(NODE_MODULES_TEST) $(VM_IMAGE) test/common

# run the browser integration tests;
# this will run all tests/check-* and format them as TAP
check: prepare-check
	test/common/run-tests

# checkout Cockpit's bots for standard test VM images and API to launch them
# must be from main, as only that has current and existing images; but testvm.py API is stable
# support CI testing against a bots change
bots:
	git clone --quiet --reference-if-able $${XDG_CACHE_HOME:-$$HOME/.cache}/cockpit-project/bots https://github.com/cockpit-project/bots.git
	if [ -n "$$COCKPIT_BOTS_REF" ]; then git -C bots fetch --quiet --depth=1 origin "$$COCKPIT_BOTS_REF"; git -C bots checkout --quiet FETCH_HEAD; fi
	@echo "checked out bots/ ref $$(git -C bots rev-parse HEAD)"

# checkout Cockpit's test API; this has no API stability guarantee, so check out a stable tag
# when you start a new project, use the latest release, and update it from time to time
test/common:
	flock Makefile sh -ec '\
	    git fetch --depth=1 https://github.com/cockpit-project/cockpit.git 264; \
	    git checkout --force FETCH_HEAD -- test/common; \
	    git reset test/common'

# checkout Cockpit's PF/React/build library; again this has no API stability guarantee, so check out a stable tag
$(LIB_TEST):
	flock Makefile sh -ec '\
	    git fetch --depth=1 https://github.com/cockpit-project/cockpit.git 253; \
	    git checkout --force FETCH_HEAD -- pkg/lib; \
	    git reset -- pkg/lib'
	mv pkg/lib src/ && rmdir -p pkg

# checkout subscription-manager at the branch we want
subscription-manager:
	git clone --quiet https://github.com/candlepin/subscription-manager.git subscription-manager
	git -C subscription-manager fetch --quiet --depth=1 origin $(TEST_SCENARIO)
	git -C subscription-manager checkout --quiet FETCH_HEAD
	@echo "checked out subscription-manager/ ref $$(git -C subscription-manager rev-parse HEAD)"

$(NODE_MODULES_TEST): package.json
	# if it exists already, npm install won't update it; force that so that we always get up-to-date packages
	rm -f package-lock.json
	# unset NODE_ENV, skips devDependencies otherwise
	env -u NODE_ENV npm install
	env -u NODE_ENV npm prune

.PHONY: all clean install devel-install print-version dist node-cache rpm check vm update-po print-vm devel-uninstall
