#
# Copyright 2016-2018 the Bayou Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License,
# Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
#
# Script library (to include via `.`) containing common build system logic.
# This assumes that `baseDir` and `progDir` have been set up using the usual
# boilerplate.
#

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
    check-dependency 'Node' 'node --version' '^v\([89]\|10\)\.'
    check-dependency 'npm' 'npm --version' '^[56]\.'
    check-dependency 'jq' 'jq --version' '^jq-1\.'
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
        | awk '{ gsub(/^\.\/|\/package\.json$/, ""); print $0; }'
}

# Gets a list of all the local module names. The output is a series of lines,
# one per module. This only works after module sources have been copied to the
# `out` directory.
function local-module-names {
    find-package-directories "${modulesDir}"
}

# Sets up the build output directory, including cleaning it out or creating it,
# as necessary. This also sets `finalDir` and `modulesDir` relative to the
# output directory. See `out-dir-setup` in this directory for details on the
# arguments which can be passed here.
function set-up-out {
    outDir="$(${progDir}/lib/out-dir-setup "$@")"
    if (( $? != 0 )); then
        return 1
    fi

    # Where the final built artifacts go.
    finalDir="${outDir}/final"

    # Where local module source directories go as an intermediate build step.
    modulesDir="${outDir}/local-modules"
}
