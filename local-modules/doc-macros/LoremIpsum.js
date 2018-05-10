import { UtilityClass } from 'util-common';

export default class LoremIpsum extends UtilityClass {
  /**
   * Produces lorem ipsum text of a given type and length based on a single
   * argument (such as might be produced from the macro faciity).
   *
   * The argument is an integer count followed by a 'c', 'p', or 'w'.
   * e.g. `75c`, `50w`, `5p` depending on whether the caller wants a specific
   * number of characters, words, or paragraphs, respectively.
   *
   * @param {string} [arg=''] The two arguments for generation (count and type)
   *  combined into a single string.
   * @returns {string} Lorem ipsum text of the specified length.
   */
  static generate(arg='') {
    const argregex = /^([0-9]+)(c|p|w)$/;
    const match = arg.match(argregex);
    let type = 'w';
    let count = 50;

    if (match) {
      count = parseInt(match[1]);
      type = match[2];
    }

    switch (type) {
      case 'c': return LoremIpsum.characters(count);
      case 'p': return LoremIpsum.paragraphs(count);
      case 'w': return LoremIpsum.words(count);
    }

    // It should be impossible to get here, but just in case...
    return '';
  }

  /**
   * Produces Lorem Ipsum text comprised of a specific number of characters.
   *
   * @param {Int} numCharacters The number of characters to produce in the
   *  output. If `numCharacters` is negative, or zero, then an empty string
   *  is returned.
   * @returns {String} Lorem Ipsum text of the requested length.
   */
  static characters(numCharacters) {
    if (numCharacters < 1) {
      return '';
    }

    let output = '';
    let remainingCharacters = numCharacters;
    let lineIndex = 0;

    while (remainingCharacters > 0) {
      const loremLine = LOREM_TEXT[lineIndex];
      const loremLineLength = loremLine.length;
      const numCharactersToAdd = Math.min(loremLineLength, remainingCharacters);

      output = output + loremLine.substr(0, numCharactersToAdd);

      remainingCharacters -= numCharactersToAdd;
      lineIndex = (lineIndex + 1) % LOREM_TEXT.length;
    }

    return output;
  }

  /**
   * Produces Lorem Ipsum text comprised of a specific number of words.
   *
   * @param {Int} numWords The number of words to produce in the
   *  output. If `numWords` is negative, or zero, then an empty string
   *  is returned.
   * @returns {String} Lorem Ipsum text of the requested length.
   */
  static words(numWords) {
    if (numWords < 1) {
      return '';
    }

    const wordsArray = [];
    let remainingWords = numWords;
    let lineIndex = 0;

    while (remainingWords > 0) {
      const loremLine = LOREM_TEXT[lineIndex];
      const lineWords = loremLine.split(' ');
      const numWordsToAdd = Math.min(lineWords.length, remainingWords);

      wordsArray.push(...lineWords.slice(0, numWordsToAdd));

      remainingWords -= numWordsToAdd;
      lineIndex = (lineIndex + 1) % LOREM_TEXT.length;
    }

    return wordsArray.join(' ');
  }

  /**
   * Produces Lorem Ipsum text comprised of a specific number of paragraphs.
   *
   * @param {Int} numParagraphs The number of paragraphs to produce in the
   *  output. If `numParagraphs` is negative, or zero, then an empty string
   *  is returned.
   * @returns {String} Lorem Ipsum text of the requested length.
   */
  static paragraphs(numParagraphs) {
    if (numParagraphs < 1) {
      return '';
    }

    const paragraphsArray = [];
    let paragraphsRemaining = numParagraphs;
    let lineIndex = 0;

    while (paragraphsRemaining > 0) {
      paragraphsArray.push(LOREM_TEXT[lineIndex]);

      paragraphsRemaining--;
      lineIndex = (lineIndex + 1) % LOREM_TEXT.length;
    }

    return paragraphsArray.join('\n\n');
  }
}

const LOREM_TEXT = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas vitae consectetur purus. Morbi tempor ante quis turpis condimentum tristique. Donec lobortis vestibulum ante sed mattis. Integer congue dolor et finibus euismod. Donec consequat ex vel condimentum bibendum. Vivamus porttitor ipsum placerat erat porttitor tristique. Quisque nec rhoncus ex. Suspendisse efficitur sagittis mi eu egestas. Praesent dapibus, elit nec vehicula finibus, mi arcu dictum nulla, non hendrerit purus quam vel diam. Donec et dignissim orci. Donec ut velit lacus. Aliquam varius in lacus sodales euismod. Sed placerat elit semper, faucibus dolor et, laoreet urna.',
  'Aenean id lobortis ipsum. Nulla felis metus, malesuada pellentesque neque vel, commodo tincidunt metus. Sed mollis dui a sollicitudin tristique. Fusce sit amet lectus accumsan, fermentum lacus ac, sodales elit. Fusce facilisis efficitur lorem, sed elementum felis. Aenean sagittis lorem porta, consectetur leo ut, congue velit. Etiam feugiat vel purus eget dapibus. Cras eu semper leo, at laoreet augue.',
  'Curabitur suscipit ultrices nisi, ac rhoncus risus hendrerit pellentesque. Vestibulum ex nisi, lobortis a risus quis, sagittis viverra mauris. Quisque dolor libero, ullamcorper eget nisi id, tristique ullamcorper nibh. Morbi aliquam dolor nec risus bibendum, in bibendum dui pellentesque. Nulla facilisi. Phasellus pretium erat et dictum tincidunt. Mauris sit amet ipsum auctor, condimentum ante ut, malesuada mauris. Curabitur vitae gravida tellus, et aliquet diam. Nulla commodo lectus lacus, ut mollis elit commodo ac. Pellentesque nunc nisl, porttitor vel fringilla pellentesque, ultricies nec augue. Mauris ullamcorper est non sollicitudin malesuada. Integer auctor, eros quis congue eleifend, dui elit hendrerit erat, non commodo justo ligula ut arcu. Donec egestas eu lacus ac luctus. Sed a finibus lacus, sed imperdiet mi. Nulla ultricies elit sit amet mollis bibendum.',
  'Nullam sit amet malesuada ante. Ut non arcu eget risus posuere condimentum. Ut vulputate dolor nec facilisis elementum. Donec maximus euismod velit quis vestibulum. Ut et massa sed erat interdum vestibulum. Fusce mi erat, dignissim at semper nec, lobortis ornare sapien. Duis eget semper nulla. Proin mi velit, accumsan ut mauris sed, venenatis commodo dui. Cras id sapien accumsan, tempus massa sit amet, aliquam mi. Integer leo arcu, lobortis ac congue vitae, commodo nec elit. Integer at ipsum a ex iaculis pellentesque. Sed iaculis vestibulum ligula eu pulvinar. Aliquam erat volutpat. Donec tincidunt convallis orci, id mattis arcu pharetra vitae.',
  'Nam eros felis, porta a neque vel, lobortis pretium metus. Ut ex felis, pretium vitae elementum vel, elementum sit amet velit. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Praesent hendrerit vitae tellus nec convallis. Phasellus eleifend, ante placerat ornare luctus, nibh orci fermentum purus, a aliquam ipsum quam ac velit. Aenean sed hendrerit lorem. Aenean leo neque, facilisis a lorem ut, ultricies rhoncus lectus. Fusce porta fringilla ipsum eget varius. Maecenas id sagittis nisl. Nullam accumsan ante at nunc ultrices sollicitudin. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Ut fringilla, nulla vitae euismod aliquet, nunc libero tempor metus, molestie lacinia risus lorem nec nulla. Pellentesque varius viverra mi. Duis ut dolor leo. Sed interdum luctus tincidunt. In sed elementum libero, eu bibendum ex.',
  'Morbi bibendum molestie felis, non sagittis justo sollicitudin ut. Pellentesque in egestas massa. In rutrum tortor id purus pretium, quis consectetur ante varius. Aliquam elementum leo at arcu posuere, quis scelerisque erat faucibus. Vivamus a aliquet enim. In quis enim at neque mollis vestibulum. Nunc euismod lacinia est vitae hendrerit.',
  'In nec urna sit amet leo feugiat vehicula vel sed nunc. Nunc blandit tincidunt lacinia. Proin tortor urna, facilisis a ex sed, vehicula vestibulum neque. Morbi neque mi, placerat quis mollis non, rhoncus consequat diam. Etiam sed purus in lorem tempor consequat sit amet id turpis. Praesent posuere placerat sem in porta. Donec aliquam vestibulum dolor, sit amet bibendum nunc malesuada nec. Aliquam malesuada augue sit amet dui aliquam, ullamcorper volutpat nisl dapibus. Vestibulum consequat nisl nec nisi tincidunt, at euismod tortor tempor. Aliquam non mauris eget justo volutpat maximus eu fermentum ante. Donec eget nisi aliquet, eleifend arcu sed, maximus dui.',
  'Phasellus faucibus pellentesque blandit. Pellentesque dictum augue at gravida iaculis. Nulla facilisi. Aenean sit amet ligula dapibus, vestibulum metus ut, mattis ex. Donec iaculis, neque id imperdiet auctor, arcu risus blandit risus, non rhoncus magna metus quis diam. In eu orci vitae leo fermentum lacinia eu at enim. Maecenas dictum ex eget est finibus varius. Cras consectetur suscipit diam, ultrices hendrerit turpis ornare et. Interdum et malesuada fames ac ante ipsum primis in faucibus.',
  'Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Ut volutpat ligula id ipsum dapibus, at cursus felis rhoncus. Etiam nulla justo, pellentesque non massa ac, porttitor vestibulum tellus. Praesent congue, felis lacinia auctor imperdiet, lectus orci facilisis massa, in venenatis massa quam ut nulla. Fusce bibendum ligula leo, vitae laoreet dolor tincidunt at. Morbi lobortis fermentum ante vel blandit. Nulla vitae enim ut eros sagittis aliquet nec a sapien. Aenean mollis posuere lectus, ut bibendum eros accumsan quis. Integer bibendum tristique vehicula. Vestibulum odio elit, faucibus vel malesuada vel, blandit a purus. Pellentesque eget molestie nulla, convallis tristique risus. Quisque ac nibh cursus, euismod lacus at, condimentum diam. Praesent sagittis, tellus tempus bibendum mattis, neque erat interdum purus, sit amet placerat quam urna quis libero. Morbi sagittis diam eget fermentum porta.',
  'Nam a lobortis lorem. Donec pretium convallis ligula, ac pellentesque magna facilisis at. Donec eget justo fermentum, rutrum lectus in, bibendum neque. Ut dictum quam vehicula tortor faucibus, eget iaculis mi ultrices. Ut malesuada ipsum nec ante fermentum faucibus. Ut nibh sapien, semper ut neque ut, rhoncus condimentum ex. Nulla suscipit ligula elit, vitae lobortis dolor euismod gravida.'
];
