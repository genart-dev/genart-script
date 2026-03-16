# @genart-dev/genart-script

Compiler and runtime for **GenArt Script** (`.gs`) — a minimal scripting language for generative art. Part of the [genart.dev](https://genart.dev) platform.

GenArt Script is designed to be both human-playful and AI token-efficient. It compiles to JavaScript and runs on any canvas via the GenArt renderer adapter in [`@genart-dev/core`](https://github.com/genart-dev/core).

## Install

```bash
npm install @genart-dev/genart-script
```

## Quick Example

```
param count 200 range:10..500 step:10
color bg #0d1117

frame:
  bg $bg
  loop count:
    x = rnd(w)
    y = rnd(h)
    r = 2 + noise(x * 0.01, y * 0.01, t) * 20
    circle x y r:r fill:white.30

post:
  bloom(0.3)
  vignette(0.4)
```

## Usage

### Compiler

```typescript
import { compile } from "@genart-dev/genart-script";

const result = compile(`
  bg #1a1a2e
  circle w/2 h/2 r:100 fill:coral
`);

if (result.ok) {
  console.log(result.code);    // compiled JavaScript
  console.log(result.params);  // extracted param declarations
  console.log(result.colors);  // extracted color declarations
  console.log(result.layers);  // extracted layer declarations
} else {
  console.error(result.errors); // [{ line, col, message }]
}
```

### Runtime (for renderer adapters)

```typescript
import { buildGlobals } from "@genart-dev/genart-script/runtime";

const globals = buildGlobals(ctx, params, colors, seed);
// Inject globals into compiled code via new Function(...)
```

## Language Reference

### Drawing Primitives

```
bg coral                                    // fill background
circle x y r:20 fill:red stroke:#000 2      // circle
rect x y w:100 h:50 fill:blue rx:8          // rectangle (rounded)
line x1 y1 x2 y2 stroke:white 2            // line
dot x y fill:coral                          // single pixel
arc x y r:50 start:0 end:3.14 fill:red      // arc
poly points fill:green stroke:black         // polygon from flat [x,y,...] array
path "M0 0 L100 100" stroke:black 1         // SVG path
text "hello" x y size:24 fill:white         // text
```

### Color

```
fill:red                    // named color
fill:#ff0000                // hex
fill:white.50               // alpha shorthand (50%)
fill:linear(#000, #fff)     // linear gradient
fill:radial(#fff, #000)     // radial gradient
```

### Blocks & Execution Model

```
// Static — runs once
bg black
circle w/2 h/2 r:100 fill:coral

// Animation loop
frame:
  bg black
  circle w/2 h/2 r:sin(t)*50+60 fill:coral

// One-time async setup
once:
  font = await loadFont("MyFont", "font.woff2")

// Post-processing
post:
  bloom(0.3)
  vignette(0.4)
  chromatic_aberration(3)
```

### Parameters & Colors

```
param count 100 range:10..500 step:10 label:"Particle Count"
param speed 1.5 range:0.1..5 step:0.1
color bg #1a1a2e label:"Background"
color accent #ff6b6b
```

Parameters and colors become globals in the script AND are extracted into the `.genart` file for UI controls.

### Control Flow

```
if x > 100:
  circle x y r:5 fill:red
else:
  circle x y r:5 fill:blue

loop 50:
  circle rnd(w) rnd(h) r:5 fill:white     // implicit `i` variable

for x in 0..w step:20:
  line x 0 x h stroke:white.10

for i, v in arr:
  circle v.x v.y r:5 fill:coral
```

### Functions & Lambdas

```
fn wobble x y:
  return sin(x * 0.1 + t) * y

// Lambda
pts = loop 100 =>
  return vec(rnd(w), rnd(h))

// Implicit `it` variable
arr.map(it * 2)
arr.filter(it > 0.5)
```

### Transforms

```
at w/2 h/2:                  // translate
  rotate t:                   // rotate
    rect -25 -25 w:50 h:50 fill:coral

scale 2:                      // scale
  circle 0 0 r:10 fill:red

blend multiply:               // composite mode
  rect 0 0 w:w h:h fill:blue
```

### Interactivity

```
// Frame globals: mouseX, mouseY, mouseDown, pmouseX, pmouseY,
//                touchX, touchY, touches (array of {id,x,y}),
//                prev (previous frame ImageData)

frame:
  circle mouseX mouseY r:10 fill:white

  // Draw previous frame with fade for trails
  if prev:
    draw prev 0 0 alpha:0.95

on click:
  circle mouseX mouseY r:20 fill:coral

on key "r":
  bg black
```

### Offscreen Buffers

```
buf = buffer(w, h)
into buf:
  bg black
  circle w/2 h/2 r:100 fill:coral

draw buf 0 0 alpha:0.5 blend:screen
```

### Images & Fonts

```
once:
  img = load("photo.jpg")
  font = await loadFont("Mono", "mono.woff2")

frame:
  draw img 0 0 w:w h:h tint:coral
  text "hello" w/2 h/2 font:font size:48 align:center fill:white
```

### Standard Library

```
use easing    // ease_in, ease_out, ease_in_out, ease_cubic, elastic, bounce
use shapes    // star(x,y,n,r,ir?), hexagon(x,y,r), arrow(x,y,angle,size)
use palettes  // nord[], solarized[], pastel[], earth[]
```

### Plugin Layers

```
layer "terrain:sky" "noon" opacity:0.8 blend:"multiply" name:"Sky"
layer "terrain:mountains" "alpine"
layer "particles:glow" "fireflies" visible:false
```

Layers are extracted at compile time — they don't emit code but populate `CompileResult.layers`.

### Post-Processing Effects

All effects are function calls inside `post:` blocks.

| Effect | Signature | Description |
|--------|-----------|-------------|
| `vignette` | `(strength=0.5)` | Radial edge darkening |
| `grain` | `(amount=0.15)` | Film grain overlay |
| `grade` | `(contrast, saturation, brightness, hue)` | Color grading |
| `blur` | `(radius)` | Gaussian blur |
| `scanlines` | `(opacity=0.15)` | CRT scanline overlay |
| `pixelate` | `(blockSize)` | Pixel mosaic |
| `bloom` | `(strength=0.5, radius=8)` | Glow bloom |
| `chromatic_aberration` | `(amount=3, quality?)` | RGB channel offset |
| `distort` | `(type="wave", amount=10, quality?)` | Pixel displacement (wave/ripple/noise) |
| `dither` | `(strength=0.5)` | Bayer ordered dithering |
| `halftone` | `(dotSize=4, angle=0.3)` | Dot screen effect |

Effects with `quality?` accept `"auto"` (default), `"high"` (always full pixel ops), or `"fast"` (skip or approximate).

### Built-in Globals

| Global | Description |
|--------|-------------|
| `w`, `h` | Canvas dimensions |
| `t` | Elapsed time (seconds) |
| `frame` | Frame counter |
| `fps` | Frames per second (60) |
| `rnd(n)`, `rnd(a, b)` | Seeded random number |
| `rndInt(n)` | Seeded random integer |
| `noise(x, y?, z?)` | Perlin noise |
| `PI`, `TWO_PI`, `HALF_PI` | Math constants |
| `lerp`, `clamp`, `map`, `dist` | Math utilities |
| `sin`, `cos`, `tan`, `atan2`, `sqrt`, `abs`, `floor`, `ceil`, `round`, `min`, `max`, `pow`, `log`, `exp` | Math functions |
| `pick(arr)` | Random array element |
| `shuffle(arr)` | Shuffle array |
| `vec(x, y)` | 2D vector with `.add .sub .mult .mag .norm .dot .angle` |
| `buffer(w, h)` | Create offscreen canvas |
| `load(url)` | Load image |
| `loadFont(family, url)` | Load font (async) |
| `measure(text, size?, family?)` | Measure text dimensions |

## Exports

### `@genart-dev/genart-script` (compiler)

```typescript
compile(source: string): CompileResult
tokenize(source: string): Token[]
parse(tokens: Token[]): Program
codegen(program: Program): CompileResult
```

### `@genart-dev/genart-script/runtime`

```typescript
buildGlobals(ctx, params, colors, seed): RuntimeGlobals
vec(x, y): Vec
```

## Architecture

```
source string
  → tokenize()    Lexical analysis + indentation tracking
  → parse()       Recursive descent → AST
  → codegen()     AST → JavaScript + extracted params/colors/layers
```

The compiler is hand-written (no parser generators), zero-dependency, and produces standalone JavaScript that runs in any canvas context. The runtime library provides seeded PRNG, noise, math utilities, color helpers, and post-processing effects.

## License

MIT
