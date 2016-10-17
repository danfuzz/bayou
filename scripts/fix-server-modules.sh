#!/bin/bash
#
# Copyright 2016 the Quillex Authors (Dan Bornstein et alia).
# Licensed AS IS and WITHOUT WARRANTY under the Apache License,
# Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
#
# "Manually" tweak some code in imported modules, to fix bugs.

# Expected to point at the base `server` directory.
dir="$1"

# As of this writing, there are no patches that need to be made. After the
# `exit` is an example of a patch that has since been fixed, which might help
# serve as a template for future patches.
exit

# This is already fixed in `master` in the `ts-loader` module, but as of this
# writing it has not yet been published to npm. See
# <https://github.com/TypeStrong/ts-loader/pull/202> for details.
badText='path\.dirname\(configFilePath\)'
goodText='path.dirname(configFilePath || "")'
file="${dir}/node_modules/ts-loader/index.js"
if [[ ! -e "${file}~" ]]; then
    sed -i '~' -E "s/${badText}/${goodText}/g" "${file}"
    if [[ "$(diff --brief "${file}" "${file}~")" == '' ]]; then
        echo 'Upstream seems to have been fixed! Huzzah!' 1>&2
        echo 'Now remove this from `fix-server-modules.sh` to get going again.' 1>&2
        exit 1
    fi
fi
