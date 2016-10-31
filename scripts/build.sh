#!/bin/bash
#
# Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License,
# Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
#
# Builds the product. See `--help` for details.
#

# Set `progName` to the program name, `progDir` to its directory, and `baseDir`
# to `progDir`'s directory. Follows symlinks.
function init-prog {
    local newp p="$0"

    while newp="$(readlink "$p")"; do
    [[ ${newp} =~ ^/ ]] && p="${newp}" || p="$(dirname "$p")/${newp}"
    done

    progName="${p##*/}"
    progDir="$(cd "$(dirname "$p")"; /bin/pwd -P)"
    baseDir="$(cd "${progDir}/.."; /bin/pwd -P)"
}
init-prog


#
# Parse options.
#

# Error during argument processing?
argError=0

# Need help?
showHelp=0

# Clean build?
clean=0

# Overlay source directory, if any.
overlayDir=''

# Directory for the built output.
outDir=''

while (( $# != 0 )); do
    opt="$1"
    if [[ ${opt} == '--' ]]; then
        shift
        break
    elif [[ ${opt} == '--clean' ]]; then
        clean=1
    elif [[    ${opt} == '--help'
            || ${opt} == '-h' ]]; then
        showHelp=1
    elif [[ ${opt} =~ ^--out=(.*) ]]; then
        outDir="${BASH_REMATCH[1]}"
    elif [[ ${opt} =~ ^--overlay=(.*) ]]; then
        overlayDir="${BASH_REMATCH[1]}"
    elif [[ ${opt} =~ ^- ]]; then
        echo "Unknown option: ${opt}" 1>&2
        argError=1
        break
    else
        break
    fi
    shift
done
unset opt

if (( ${showHelp} || ${argError} )); then
    echo 'Usage:'
    echo ''
    echo "${progName} [--clean] [--out=<dir>] [--overlay=<dir>]"
    echo '  Build the project.'
    echo '  --clean          Start from a clean build.'
    echo '  --out=<dir>      Place output in directory <dir>.'
    echo '  --overlay=<dir>  Find overlay source in directory <dir>.'
    echo ''
    echo "${progName} [--help | -h]"
    echo "  Display this message."
    exit ${argError}
fi

#
# Helper functions
#

# Sets up the output directory, including cleaning it out or creating it, as
# necessary.
function set-up-out {
    if [[ ${outDir} == '' ]]; then
        # Default output directory.
        outDir="${baseDir}/out"
    fi

    if [[ -e ${outDir} ]]; then
        if [[ ! -d ${outDir} ]]; then
            echo "Not a directory: ${outDir}" 1>&2
            return 1
        elif (( ${clean} )); then
            # Note: Order of this test wrt the last one is intentional: We don't
            # want to blow away a non-directory.
            rm -rf "${outDir}" || return 1
            mkdir "${outDir}" || return 1
        fi
    else
        mkdir -p "${outDir}" || return 1
    fi

    # Make it absolute.
    outDir="$(cd ${outDir}; /bin/pwd -P)"
}

# Gets a list of all the local module names. The output is a series of
# lines, one per module.
function local-module-names {
    find "${baseDir}/local-modules" -type d -mindepth 1 -maxdepth 1 \
        | sed -e 's!.*\/!!g'
}

# Copies a directory from the given partial source path to the given partial
# path under the output directory. Includes both base and overlay files.
function copy-into-out {
    local fromDir="$1"
    local toDir="$2"

    # We use `rsync` (even though this is a totally local operation) because it
    # has well-defined behavior when copying a tree on top of another tree and
    # also knows how to create directories as needed. Note that the trailing
    # slash on the source directory is significant to `rsync` semantics.
    rsync --archive --delete --exclude='node_modules/' \
        "${baseDir}/${fromDir}/" "${outDir}/${toDir}/"

    if [[ ${overlayDir} != '' && -e "${overlayDir}/${fromDir}" ]]; then
        rsync --archive "${overlayDir}/${fromDir}/" "${outDir}/${toDir}/"
    fi
}

# Copies the `local-modules` (Node modules whose sources live entirely locally
# to this project, as opposed to being published via npm) into the given output
# directory.
function copy-local-modules-into-out {
    local toDir="$1"
    rsync --archive --delete "${baseDir}/local-modules" "${outDir}/${toDir}/"

    if [[ (${overlayDir} != '') && -e "${overlayDir}/local-modules" ]]; then
        rsync --archive "${overlayDir}/local-modules" "${outDir}/${toDir}/"
    fi
}

# Copies the server and client source directories into `out`, including the
# overlay contents (if specified).
function copy-sources {
    # The `server` files ultimately go through an additional build step (hence
    # the change in directory name), though some of the files are used as-is.
    copy-into-out 'server' 'server-src' || return 1
    copy-local-modules-into-out 'server-src' || return 1

    # The `client` files are used as-is by the server (because it serves the
    # static assets directly and also knows how to (re)build the JavaScript
    # bundle).
    copy-into-out 'client' 'client' || return 1
    copy-local-modules-into-out 'client' || return 1
}

# Builds the server code. This builds from `server-src` into `server`. The
# JS files in the former are treated as modern ECMAScript, which are processed
# by Babel.
function build-server {
    local fromDir="${outDir}/server-src"
    local toDir="${outDir}/server"

    mkdir -p "${toDir}"

    # We get Babel by virtue of its modules being listed as dependencies in the
    # server `package.json`, so the first thing we need to do is copy over that
    # file and get `npm` to fluff it out. See above about `rsync` rationale.
    rsync --archive "${fromDir}/package.json" "${toDir}"
    (cd "${toDir}"; npm install) || return 1

    # We are somewhat at the mercy of what's published via npm, and in fact
    # some modules that we use occasionally have bugs in their published
    # versions. This script patches them in situ.
    "${progDir}/fix-modules.sh" "${baseDir}/etc/module-overlay" "${toDir}" \
        || return 1

    # Run Babel on all of the local source files, storing them next to the
    # imported and patched modules. We symlink the output `node_modules` back to
    # the source directory, because Babel wants to find presets (and related
    # dependencies) relative to the source.
    if [[ ! -e "${fromDir}/node_modules" ]]; then
        ln -s "${toDir}/node_modules" "${fromDir}"
    fi
    "${fromDir}/node_modules/.bin/babel" --no-babelrc --copy-files \
        --ignore 'node_modules' \
        --presets 'es2015,es2016,es2017' --source-maps true \
        --out-dir "${toDir}" "${fromDir}" \
        || return 1

    # Symlink all the local modules back into `node_modules`, so that the
    # Node module resolver will find them.
    local m modPath
    for m in $(local-module-names); do
        modPath="${toDir}/node_modules/${m}"
        if [[ ! -e "${modPath}" ]]; then
            ln -s "../local-modules/${m}" "${modPath}"
        fi
    done
}

# Builds the client code.
function build-client {
    local toDir="${outDir}/client"

    (cd "${toDir}"; npm install) || return 1

    # See comment on `fix-modules` call in `build-server`, above.
    "${progDir}/fix-modules.sh" "${baseDir}/etc/module-overlay" "${toDir}" \
        || return 1
}

# Records information about source directories (so dev mode knows where to find
# things). **Note:** This is consumed both by shell and JS code.
function write-build-info {
    (
        printf $'sourceDir=\'%s\'\n' "${baseDir}"
        printf $'overlayDir=\'%s\'\n' "${overlayDir}"
    ) > "${outDir}/build-info.txt"
}


#
# Main script
#

echo 'Building...'

(
    set-up-out && copy-sources && build-server && build-client \
    && write-build-info
) || exit 1

echo 'Done!'
