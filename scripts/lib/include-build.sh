#
# Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License,
# Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
#
# Script library (to include via `.`) containing common build system logic.
#

# Set up `bayouLibDir` to be the directory where this file resides. The
# following is similar to the usual script-dir-finding boilerplate, except we
# start with `${BASH_SOURCE[0]}` which is the currently-executing file and not
# `$0` which is the main invoked file.
function init-bayou-lib-dir {
    local newp p="${BASH_SOURCE[0]}"

    while newp="$(readlink "$p")"; do
        [[ ${newp} =~ ^/ ]] && p="${newp}" || p="$(dirname "$p")/${newp}"
    done

    bayouLibDir="$(cd "$(dirname "$p")"; /bin/pwd -P)"
}
init-bayou-lib-dir

# Helper for `check-build-dependencies` which validates one dependency.
function check-dependency {
    local name="$1"
    local versionCmd="$2"
    local match="$3"

    # Extract just the command name, and verify that it exists at all.

    local cmdName=''
    if [[ ${versionCmd} =~ ^([^ ]+) ]]; then
        cmdName="${BASH_REMATCH[1]}"
    else
        # **Note:* This indicates a bug in this script, not a problem with the
        # environment.
        echo "Could not determine commmand name for ${name}." 1>&2
        exit 1
    fi

    if ! which "${cmdName}" >/dev/null 2>&1; then
        echo "Missing required command for ${name}: ${cmdName}" 1>&2
        exit 1
    fi

    local version="$(${versionCmd} 2>&1)"
    if ! grep -q -e "${match}" <<< "${version}"; then
        echo "Unsupported version of ${name}: ${version}" 1>&2
        exit 1
    fi
}

# Checks the versions of our various expected-installed dependencies, notably
# including Node and npm.
function check-build-dependencies {
    check-dependency 'Node' 'node --version' '^v1[01]\.'
    check-dependency 'npm' 'npm --version' '^[56]\.'
    check-dependency 'jq' 'jq --version' '^jq-1\.[56]'
    check-dependency 'rsync' 'rsync --version' '.' # No actual version check.
}

# Helper for `local-module-names` which finds package (node module) directories
# under the given directory. It prints the partial path to each such found
# directory.
function find-package-directories {
    local dir="$1"

    # Parens to preserve original CWD. `awk` command to strip the leading `./`
    # and trailing `/package.json` from the results of the `find` command.
    (cd "${dir}"; find . -type f -name package.json) \
        | awk '{ gsub(/^\.\/|\/package\.json$/, ""); print $0; }' \
        | sort
}

# Gets a list of all the local module names. The output is a series of lines,
# one per module. This only works after module sources have been copied to the
# `out` directory.
function local-module-names {
    if [[ ! (-d ${modulesDir} && -r ${modulesDir}) ]]; then
        echo "Cannot read modules directory: ${modulesDir}" 1>&2
        return 1
    fi

    find-package-directories "${modulesDir}"
}

# Gets (prints out) the name of the directory under `out` where modules for
# npm publication get written. This only works after `set-up-out` has been run
# or `outDir` is set up via other means.
function publish-dir {
    echo "${outDir}/for-publication"
}

# Gets a list of all the names of modules that are ready for publishing. This
# only works after `build-npm-modules` has been run.
function publishable-module-names {
    local publishDir="$(publish-dir)"

    if [[ ! (-d ${publishDir} && -r ${publishDir}) ]]; then
        echo "Cannot read publishable module directory: ${publishDir}" 1>&2
        return 1
    fi

    find-package-directories "${publishDir}"
}

# Calls `rsync` so as to do an all-local (not actually remote) "archive" copy
# (preserving permissions, modtimes, etc.).
#
# **Note:** We use `rsync` and not `cp` (even though this is a totally local
# operation) because it has well-defined behavior when copying a tree on top of
# another tree and also knows how to create directories as needed.
#
# **Note:** Trailing slashes on source directory names are significant to
# `rsync`. This is salient at some of the use sites.
function rsync-archive {
    # **Note:** We use checksum-based checking, because the default time-and-
    # size method is counterproductive. Specifically, a time-and-size check will
    # cause a failure to copy when two non-identical files happen to match in
    # both size and timestamp, which does happen in practice specifically when
    # running a build on a freshly checked-out source tree, wherein many many
    # files have the same timestamps, which means that only the sizes come into
    # play for the comparisons. And it's very easy to have a file size
    # coincidence.)
    #
    # **Note:** An earlier version of this code used `--ignore-times` instead
    # of `--checksum`. The former worked equally well for this use case, except
    # because it would always write the target files (even if identical), it
    # would take significantly more time in the no-op case. (Specifically, some
    # virus checkers can seriously degrade write performance.)
    rsync --archive --checksum "$@"
}

# Sets up the build output directory, including cleaning it out or creating it,
# as necessary. This also sets `finalDir` and `modulesDir` relative to the
# output directory. See `out-dir-setup` in this directory for details on the
# arguments which can be passed here.
function set-up-out {
    outDir="$(${bayouLibDir}/out-dir-setup "$@")"
    if (( $? != 0 )); then
        return 1
    fi

    # Where the final built artifacts go.
    finalDir="${outDir}/final"

    # Where local module source directories go as an intermediate build step.
    modulesDir="${outDir}/local-modules"
}
