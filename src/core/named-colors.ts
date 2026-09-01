// CSS Color 4 named colors: https://drafts.csswg.org/css-color-4/#named-colors
const COLOR_NAMES = "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" ");
const COLOR_HEX = "f0f8fffaebd700ffff7fffd4f0fffff5f5dcffe4c4000000ffebcd0000ff8a2be2a52a2adeb8875f9ea07fff00d2691eff7f506495edfff8dcdc143c00ffff00008b008b8bb8860ba9a9a9006400a9a9a9bdb76b8b008b556b2fff8c009932cc8b0000e9967a8fbc8f483d8b2f4f4f2f4f4f00ced19400d3ff149300bfff6969696969691e90ffb22222fffaf0228b22ff00ffdcdcdcf8f8ffffd700daa520808080008000adff2f808080f0fff0ff69b4cd5c5c4b0082fffff0f0e68ce6e6fafff0f57cfc00fffacdadd8e6f08080e0fffffafad2d3d3d390ee90d3d3d3ffb6c1ffa07a20b2aa87cefa778899778899b0c4deffffe000ff0032cd32faf0e6ff00ff80000066cdaa0000cdba55d39370db3cb3717b68ee00fa9a48d1ccc71585191970f5fffaffe4e1ffe4b5ffdead000080fdf5e68080006b8e23ffa500ff4500da70d6eee8aa98fb98afeeeedb7093ffefd5ffdab9cd853fffc0cbdda0ddb0e0e6800080663399ff0000bc8f8f4169e18b4513fa8072f4a4602e8b57fff5eea0522dc0c0c087ceeb6a5acd708090708090fffafa00ff7f4682b4d2b48c008080d8bfd8ff634740e0d0ee82eef5deb3fffffff5f5f5ffff009acd32";

const NAMED_COLORS = new Map(
  COLOR_NAMES.map((name, index) => {
    const offset = index * 6;
    const hex = COLOR_HEX.slice(offset, offset + 6);
    return [
      name,
      [
        Number.parseInt(hex.slice(0, 2), 16),
        Number.parseInt(hex.slice(2, 4), 16),
        Number.parseInt(hex.slice(4, 6), 16),
      ] as const,
    ];
  }),
);

export function getNamedColor(
  name: string,
): readonly [number, number, number] | undefined {
  return NAMED_COLORS.get(name);
}
