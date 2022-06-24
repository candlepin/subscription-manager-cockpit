# Hacking on subscription-manager-cockpit

The commands here assume you're in the top level of the subscription-manager-cockpit
git repository checkout.

## Running out of git checkout

For development, you usually want to run your module straight out of the git
tree. To do that, run `make devel-install`, which links your checkout to the
location were cockpit-bridge looks for packages. If you prefer to do
this manually:

```
mkdir -p ~/.local/share/cockpit
ln -s `pwd`/dist ~/.local/share/cockpit/subscription-manager
```

After changing the code and running `make` again, reload the Cockpit page in
your browser.

You can also use
[watch mode](https://webpack.js.org/guides/development/#using-watch-mode) to
automatically update the webpack on every code change with

    $ npm run watch

or

    $ make watch

When developing against a virtual machine, webpack can also automatically upload
the code changes by setting the `RSYNC` environment variable to
the remote hostname.

    $ RSYNC=c make watch

To "uninstall" the locally installed version, run `make devel-uninstall`, or
remove manually the symlink:

    rm ~/.local/share/cockpit/subscription-manager

# Running eslint

subscription-manager-cockpit uses [ESLint](https://eslint.org/) to automatically check
JavaScript code style in `.js` and `.jsx` files.

The linter is executed within every build as a webpack preloader.

For developer convenience, the ESLint can be started explicitly by:

    $ npm run eslint

Violations of some rules can be fixed automatically by:

    $ npm run eslint:fix

Rules configuration can be found in the `.eslintrc.json` file.

# Running tests locally

Run `make check` to build an RPM, install it into a standard Cockpit test VM
(centos-9-stream by default), and run the test/check-application integration test on
it. This uses Cockpit's Chrome DevTools Protocol based browser tests, through a
Python API abstraction. Note that this API is not guaranteed to be stable, so
if you run into failures and don't want to adjust tests, consider checking out
Cockpit's test/common from a tag instead of main (see the `test/common`
target in `Makefile`).

After the test VM is prepared, you can manually run the test without rebuilding
the VM, possibly with extra options for tracing and halting on test failures
(for interactive debugging):

    TEST_OS=centos-9-stream test/check-subscriptions -tvs

It is possible to setup the test environment without running the tests:

    TEST_OS=centos-9-stream make prepare-check

You can also run the test against a different Cockpit image, for example:

    TEST_OS=fedora-36 make check

In addition to `TEST_OS`, `Makefile` supports also `TEST_SCENARIO` to specify
which branch of subscription-manager.git to test. If not specified, it defaults
to `main`. The special value `system` means that subscription-manager is tested
as available in the test image, without trying to manually build it from its
repository.

Please see [Cockpit's test documentation](https://github.com/cockpit-project/cockpit/blob/main/test/README.md)
for details how to run against existing VMs, interactive browser window,
interacting with the test VM, and more.

# Tagging and creating release

When you want to tag current state of repository, then you can use `tito`
CLI tool for this purpose. It is highly recommended to remove generated
file `subscription-manager-cockpit.spec` file before tagging repository with
`tito tag`, because we use template file `subscription-manager-cockpit.spec.tmpl`
and `subscription-manager-cockpit.spec` is in `.gitignore` file. The tito tool
just do not like this conflict. Thus it is recommended to remove .spec file with
`make clean`. Then it is possible to run

    tito tag

We would like to use incremental versioning of our cockpit plugin, but if you
have to specify minor version, then you can use following command:

    tito tag --use-version=<X>.<Y>

When repository is tagged, then it is possible to create SRPM using:

    VERSION=X make srpm

or

    VERSION=X.Y make srpm

When SRPM is generated then it is possible to use `centpkg` or `fedpkg` CLI tool
for creating release.

# Git repositories for distributions

* CentOS Stream: https://gitlab.com/redhat/centos-stream/rpms/subscription-manager-cockpit
* Fedora: https://src.fedoraproject.org/rpms/subscription-manager-cockpit
