import re
from tito.tagger.main import VersionTagger
from tito.common import get_latest_tagged_version


class IncrementalVersionTagger(VersionTagger):
    """
    A specialized version tagger that uses an incremental value for
    upstream versions.
    """

    def _bump_version(self, release=False, zstream=False):
        regex = re.compile(r"^(\d+)(\.[^-]+)?-(\d+)")
        if not release:
            if not hasattr(self, "_use_version"):
                old_version = get_latest_tagged_version(self.project_name)
                if old_version is None:
                    # fallback
                    old_version = "1-1"
                match = regex.match(old_version)
                if match:
                    return str(int(match[1]) + 1) + "-1"
            else:
                return self._use_version + "-1"
        else:
            if not hasattr(self, "_use_release"):
                old_version = get_latest_tagged_version(self.project_name)
                if old_version is None:
                    # fallback
                    old_version = "1-1"
                match = regex.match(old_version)
                if match:
                    return match[1] + match[2] + "-" + str(int(match[3]) + 1)
            else:
                return match[1] + match[2] + "-" + self._use_release
        return super()._bump_version(release, zstream)
