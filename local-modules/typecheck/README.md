typecheck
=========

This module consists mostly of utility classes (just static methods), each of
which is dedicated to doing type and content checking for values of a particular
type. In order to disambiguate between these classes and the built-in classes
for the same types, this module prefixes its classes with the capital letter
`T`.

The main method of each type checker class is called `check()`, which always
takes as its first argument the value to check and in some cases accepts
additional options (as documented). These methods always _either_ return a
value of the class's type-in-question _or_ throw an error, as follows:

* If the input value is already of the type in question, that value is returned.

* If the input value isn't of the type in question but the options allow for
  conversion or defaulting, then the return value is the converted /
  defaulted value.

* Otherwise, an error is thrown with a message typically of the form
  "Expected value of type _type_."

In some cases, type checker classes have additional methods which perform
variations of the type check. These are defined in cases where it would be
confusing to overload the semantics of the main `check()` method.

- - - - - - - - - -

```
Copyright 2016-2017 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
