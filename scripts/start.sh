#!/bin/bash
#
# Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License,
# Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
#
# Starts the product, building it first if sitting in a clean directory. See
# `--help` for more info.
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

# Directory for the built output.
outDir=''

# Perform a build?
doBuild=0

# Options to pass when building.
buildOpts=()

while (( $# != 0 )); do
    opt="$1"
    if [[ ${opt} == '--' ]]; then
        shift
        break
    elif [[ ${opt} == '--build' ]]; then
        doBuild=1
    elif [[ ${opt} == '--clean' ]]; then
        doBuild=1
        buildOpts+=("${opt}")
    elif [[    ${opt} == '--help'
            || ${opt} == '-h' ]]; then
        showHelp=1
    elif [[ ${opt} =~ ^--out=(.*) ]]; then
        outDir="${BASH_REMATCH[1]}"
    elif [[ ${opt} =~ ^--overlay=(.*) ]]; then
        buildOpts+=("${opt}")
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
    echo "${progName} [--build|--clean] [--out=<dir>] [--overlay=<dir>]"
    echo '  Run the project, optionally building first.'
    echo '  --build          Do an incremental build.'
    echo '  --clean          Do a clean build.'
    echo '  --out=<dir>      Find (and place) build output in directory <dir>.'
    echo '  --overlay=<dir>  Find overlay source in directory <dir>.'
    echo ''
    echo "${progName} [--help | -h]"
    echo "  Display this message."
    exit ${argError}
fi


#
# Main script
#

if [[ ${outDir} == '' ]]; then
    # Default output directory.
    outDir="${baseDir}/out"
fi

if (( ${doBuild} )); then
    buildOpts+=(--out="${outDir}")
    "${progDir}/build.sh" "${buildOpts[@]}" \
    || exit 1
elif [[ ! -d "${outDir}/server" ]]; then
    echo 'No build to run!' 1>&2
    exit 1
fi

cd "${outDir}/server"
npm start -- --dev
