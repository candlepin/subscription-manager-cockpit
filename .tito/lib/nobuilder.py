from tito.builder.main import Builder
from tito.common import error_out


class NoBuilder(Builder):
    """
    Builder that does not allow building, pointing to the Makefile targets
    for equivalent results.
    """
    def run(self, options):
        error_out(
            "Using 'tito build' is not supported in this repository; "
            "use Makefile targets instead for artifacts for the current git "
            "version:\n"
            "- 'make dist' to get a distribution tarball\n"
            "- 'make srpm' to create a src.rpm file\n"
            "- 'make rpm' to build RPM packages"
        )
