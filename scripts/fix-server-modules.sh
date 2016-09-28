#!/bin/bash
#
# Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License,
# Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
#
# "Manually" tweak some code in imported modules, to fix bugs.

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

# This is already fixed in `master` in the `ts-loader` module, but as of this
# writing it has not yet been published to npm. See
# <https://github.com/TypeStrong/ts-loader/pull/202> for details.
badText='path\.dirname\(configFilePath\)'
goodText='path.dirname(configFilePath || "")'
file="${baseDir}/server/node_modules/ts-loader/index.js"
if grep --quiet -E "${badText}" "${file}"; then
    sed -i '~' -E "s/${badText}/${goodText}/g" "${file}"
    if [[ "$(diff --brief "${file}" "${file}~")" == '' ]]; then
        echo 'Upstream seems to have been fixed! Huzzah!' 1>&2
        echo 'Now remove this from `fix-things.sh` to get going again.' 1>&2
        exit 1
    fi
fi
