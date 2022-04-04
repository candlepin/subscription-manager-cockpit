# subscription-manager-cockpit

This is the [Cockpit](https://cockpit-project.org/) user interface for
administrating Candlepin subscriptions.

## Technologies

- [subscription-manager](https://github.com/candlepin/subscription-manager)
  for the actual registration and handling of subscriptions
- [insights-client](https://github.com/RedHatInsights/insights-client)
  for optionally registering to
  [Red Hat Insights](https://access.redhat.com/products/red-hat-insights)

# Getting and building the source

Make sure you have `npm` available (usually from your distribution package).
These commands check out the source and build it into the `dist/` directory:

```
git clone https://github.com/candlepin/subscription-manager-cockpit.git
cd subscription-manager-cockpit
make
```

# Installing

`sudo make install` installs the package in `/usr/share/cockpit/`. This depends
on the `dist` target, which generates the distribution tarball.

You can also run `make rpm` to build RPMs for local installation.

In `production` mode, source files are automatically minified and compressed.
Set `NODE_ENV=production` if you want to duplicate this behavior.

# Development instructions

See [HACKING.md](./HACKING.md) for details about how to efficiently change the
code, run, and test it.
