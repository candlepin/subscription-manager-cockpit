BEGIN {
  FS = "-"
}

{
  start = 3
  if ($3 == "cockpit")
    ++start
  version = $start
  ++start
  # skip the revision, if present
  ++start
}

END {
  if (start > NF) {
    # on a tag, so print the version as it is (revision excluded)
    printf "%s", version
  } else {
    # not on a tag: print the version with the git information suffixed
    # with a caret, so it will sort greater that the <version>-N tags
    printf "%s^", version
    for (i = start; i <= NF; i++) {
      if (i > start) {
        printf ".", $i;
      }
      printf "%s", $i;
    }
  }
}
