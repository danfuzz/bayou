The Client Environment
======================

### CSS Modules

The client code makes use of "CSS modules" so that our CSS can be broken up into
smaller files. This also gives us the ability to easily control what styles are
active in the DOM, and when.

When the CSS loaded processes a `.css` file it transforms the class names to
globally unique values. This is to avoid naming collisions with other modules.
When you import the CSS module into JavaScript you end up with an object that
maps the class names that were in the CSS file to the unique name.

#### Basic Usage

```css
/* some-component.css input */

.megaheader {
  font-weight: 900;
  color:       black;
}
```

```css
/* some-component.css after going through the CSS loader */

._zalksdjflasjfowi4r39485 {
  font-weight: 900;
  color:       black;
}
```

```javascript
/* some-component.js */

import styles from './some-component.css';

// `megaheader` class now active in the DOM

const header = document.createElement('p');

/*
  header = {
    megaheader: '_zalksdjflasjfowi4r39485'
  }
*/

header.classList.add(styles.megaheader);
document.body.appendChild(header);
```

#### Reference-counted Usage

If the name of the CSS input file ends with `.ucss` (`use()`-able CSS) then it
will not be automatically added to the DOM. Instead, it will rely on
explicit reference counting increments/decrements. If the reference count
is greater than zero then the styles are added to the DOM. If the count
returns to zero then the styles are removed from the DOM.

```css
/* some-component.ucss input */

.selectedBorder {
  border-color: red;
}

.unselectedBorder {
  border-color: black;
}
```

```javascript
/* some-component.js */

import styles from './some-component.ucss';

// Border classes not active in the DOM yet.

export class SomeComponent {
  ...

  lifecycleBegin() {
    // Increment reference count. If count was zero before the call then
    // the style classes are added to the DOM.
    styles.use();
  }

  lifecycleEnd() {
    // Decrement the reference count. If the count is reduced to zero after
    // the call then the style classes are removed from the DOM.
    styles.unuse();
  }
}
```

- - - - - - - - - -

```
Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
Licensed AS IS and WITHOUT WARRANTY under the Apache License,
Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>
```
