@bayou/doc-id-default
========================

Default definitions of syntax for all the kinds of IDs used by the system. This
is separate from `config-*-default`, for a couple reasons:

* Non-default configured implementations might still want to use these &mdash;
  quite reasonable &mdash; definitions.

* `data-store-local` needs these definitions. Though it's part of the default
  configuration, it can be used in other configurations too, and if that's done,
  we don't want to force the (rest of the) default configuration code to also be
  pulled in.
