@bayou/doc-id-default
========================

Default definitions of syntax for all the kinds of IDs used by the system. This
is separate from `config-*-default`, because non-default configured
implementations might still want to use these &mdash; quite reasonable &mdash;
definitions.

That said, note that the class `DefaultDocStore` is _not_ appropriate for
production use, because it treats "valid ID syntax" the same as "actually valid
and existing ID." This is only appropriate for development and testing
configurations.
