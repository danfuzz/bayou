#!/bin/bash
#
# Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License,
# Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
#
# Build the server and client submodules.

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

cd "${baseDir}/server"
npm install || exit 1

cd "${baseDir}/client"
npm install || exit 1
