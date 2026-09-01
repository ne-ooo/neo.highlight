const CSS_IDENTIFIER = /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/;
const UNSAFE_CSS_SELECTOR = /[;{}<>\u0000-\u001f\u007f]|\/\*|\*\//;
const CSS_HEX_COLOR = /^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8})$/i;
const CSS_NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond
  blue blueviolet brown burlywood cadetblue chartreuse chocolate coral
  cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray
  darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
  darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey
  darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue
  firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod
  gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon
  lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue
  lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
  mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
  mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
  navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod
  palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum
  powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon
  sandybrown seagreen seashell sienna silver skyblue slateblue slategray
  slategrey snow springgreen steelblue tan teal thistle tomato transparent
  turquoise violet wheat white whitesmoke yellow yellowgreen currentcolor`
    .split(/\s+/),
);
const NUMBER = String.raw`[-+]?(?:\d+(?:\.\d+)?|\.\d+)`;
const NUMBER_OR_PERCENTAGE = `${NUMBER}%?`;
const PERCENTAGE = `${NUMBER}%`;
const HUE = `${NUMBER}(?:deg|grad|rad|turn)?`;
const ALPHA = NUMBER_OR_PERCENTAGE;
const CSS_COLOR_FUNCTIONS = [
  // Modern RGB syntax permits mixed number/percentage channels.
  new RegExp(
    `^rgba?\\(\\s*${NUMBER_OR_PERCENTAGE}\\s+${NUMBER_OR_PERCENTAGE}\\s+${NUMBER_OR_PERCENTAGE}(?:\\s*\\/\\s*${ALPHA})?\\s*\\)$`,
    "i",
  ),
  // Legacy RGB syntax requires three channels of the same type.
  new RegExp(
    `^rgba?\\(\\s*(?:${NUMBER}\\s*,\\s*${NUMBER}\\s*,\\s*${NUMBER}|${PERCENTAGE}\\s*,\\s*${PERCENTAGE}\\s*,\\s*${PERCENTAGE})(?:\\s*,\\s*${ALPHA})?\\s*\\)$`,
    "i",
  ),
  new RegExp(
    `^hsla?\\(\\s*${HUE}\\s+${PERCENTAGE}\\s+${PERCENTAGE}(?:\\s*\\/\\s*${ALPHA})?\\s*\\)$`,
    "i",
  ),
  new RegExp(
    `^hsla?\\(\\s*${HUE}\\s*,\\s*${PERCENTAGE}\\s*,\\s*${PERCENTAGE}(?:\\s*,\\s*${ALPHA})?\\s*\\)$`,
    "i",
  ),
  new RegExp(
    `^hwb\\(\\s*${HUE}\\s+${PERCENTAGE}\\s+${PERCENTAGE}(?:\\s*\\/\\s*${ALPHA})?\\s*\\)$`,
    "i",
  ),
  new RegExp(
    `^(?:lab|oklab)\\(\\s*${NUMBER_OR_PERCENTAGE}\\s+${NUMBER_OR_PERCENTAGE}\\s+${NUMBER_OR_PERCENTAGE}(?:\\s*\\/\\s*${ALPHA})?\\s*\\)$`,
    "i",
  ),
  new RegExp(
    `^(?:lch|oklch)\\(\\s*${NUMBER_OR_PERCENTAGE}\\s+${NUMBER_OR_PERCENTAGE}\\s+${HUE}(?:\\s*\\/\\s*${ALPHA})?\\s*\\)$`,
    "i",
  ),
];

/** Escape text for an HTML text node. */
export function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a value for a quoted HTML attribute. */
export function escapeHTMLAttribute(value: string): string {
  return escapeHTML(value);
}

/**
 * Restrict generated class names and custom-property names to a conservative
 * ASCII CSS identifier subset. This avoids both HTML attribute injection and
 * selector/custom-property injection in generated stylesheets.
 */
export function assertSafeCssIdentifier(value: string, label: string): void {
  if (!CSS_IDENTIFIER.test(value)) {
    throw new TypeError(`${label} must be a safe CSS identifier`);
  }
}

/**
 * Theme fields accept only literal CSS colors. Resource-loading functions,
 * custom properties, calculations, and arbitrary declarations are excluded.
 */
export function assertSafeCssValue(value: string, label: string): void {
  const color = value.trim();
  if (
    !CSS_HEX_COLOR.test(color) &&
    !CSS_NAMED_COLORS.has(color.toLowerCase()) &&
    !isSafeCssColorFunction(color)
  ) {
    throw new TypeError(`${label} must be a safe CSS color value`);
  }
}

/** Return whether a functional color uses the supported CSS grammar. */
export function isSafeCssColorFunction(value: string): boolean {
  return CSS_COLOR_FUNCTIONS.some((pattern) => pattern.test(value));
}

/** Validate a selector fragment before interpolating it into a stylesheet. */
export function assertSafeCssSelector(value: string, label: string): void {
  if (value.length === 0 || UNSAFE_CSS_SELECTOR.test(value)) {
    throw new TypeError(`${label} must be a safe CSS selector`);
  }
}
