# Webpack Deconstructor

A Node.js script that deconstructs Webpack-bundled JavaScript files and reconstructs the original source code and directory structure.

## Features

- 🔍 **Automatic Module Detection**: Finds and parses webpack modules from bundled files
- 📁 **Directory Recreation**: Reconstructs the original project directory structure
- 🔄 **Import/Export Transformation**: Converts webpack's `__webpack_require__` back to ES6 imports/exports
- 🧹 **Code Cleanup**: Removes webpack boilerplate and artifacts
- 📊 **Progress Tracking**: Shows detailed progress during deconstruction
- 🎯 **Smart Filtering**: Excludes `node_modules` and focuses on application code

## Installation

1. Clone or download this repository
2. Make the script executable (Unix/Linux/macOS):
   ```bash
   chmod +x webpack-deconstructor.js
   ```

## Usage

### Basic Usage

```bash
node webpack-deconstructor.js <path-to-bundle.js> [output-directory]
```

### Examples

```bash
# Deconstruct a bundle to default 'reconstructed' directory
node webpack-deconstructor.js ./dist/main.js

# Deconstruct to a specific directory
node webpack-deconstructor.js ./build/app.bundle.js ./output

# Using the provided test file
node webpack-deconstructor.js ./reference-built-site/build/js/main.js ./reconstructed-app
```

### Command Line Options

- `<path-to-bundle.js>` (required): Path to the webpack-bundled JavaScript file
- `[output-directory]` (optional): Output directory for reconstructed files (default: `reconstructed`)

## How It Works

### 1. Bundle Parsing
The script reads the webpack bundle and identifies the module map structure:
```javascript
/******/ ({
/***/ "./app/src/Main.ts":
/***/ (function(module, __webpack_exports__, __webpack_require__) {
    // Module content here...
/***/ }),
```

### 2. Module Extraction
- Extracts each module's path, parameters, and content
- Filters out `node_modules` to focus on application code
- Builds a map of all application modules

### 3. Import/Export Transformation

**Before (Webpack):**
```javascript
/* harmony import */ var _data_Globals__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./data/Globals */ "./app/src/data/Globals.ts");
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Main", function() { return Main; });

class Main {
    constructor() {
        _data_Globals__WEBPACK_IMPORTED_MODULE_0__["Globals"].init();
    }
}
```

**After (ES6):**
```javascript
import { Globals } from './data/Globals';

export class Main {
    constructor() {
        Globals.init();
    }
}
```

### 4. Directory Recreation
- Creates the original directory structure based on module paths
- Places each reconstructed file in its correct location

## Supported Webpack Patterns

- ✅ Harmony imports (`/* harmony import */`)
- ✅ Harmony exports (`/* harmony export (binding) */`)
- ✅ Default imports (`__webpack_require__.n()`)
- ✅ Named imports and exports
- ✅ Class exports
- ✅ Function exports
- ✅ Variable exports
- ✅ CommonJS exports (`module.exports`)

## Example Output

```
🚀 Webpack Deconstructor Starting...
📥 Input: ./reference-built-site/build/js/main.js
📤 Output: ./reconstructed-app
──────────────────────────────────────────────────
🔍 Reading webpack bundle: ./reference-built-site/build/js/main.js
📦 Parsing webpack modules...
📊 Found 45 application modules (excluding node_modules)
📁 Creating output directory: ./reconstructed-app
🔄 Processing modules and transforming code...
📝 Created: app/lib/com/akella/normalize-wheel.js
📝 Created: app/lib/com/hellomonday/loaders/FontLoader.ts
📝 Created: app/lib/com/hellomonday/signals/Signal.ts
📝 Created: app/src/Main.ts
📝 Created: app/src/controllers/ScrollController.ts
... (more files)
✅ Webpack bundle successfully deconstructed!
📂 Reconstructed files available in: ./reconstructed-app
```

## Limitations

- **Source Maps**: This tool reconstructs code structure but cannot restore original variable names that were minified
- **Webpack Versions**: Tested with Webpack 4.x and 5.x bundle formats
- **Dynamic Imports**: Currently doesn't handle dynamic `import()` statements
- **Complex Transformations**: Advanced webpack transformations may not be perfectly reversed

## Error Handling

The script includes comprehensive error handling:
- ❌ File not found errors
- ❌ Invalid bundle format detection
- ❌ Module parsing failures
- ❌ File system permission errors

## Contributing

Feel free to submit issues and enhancement requests! The script can be extended to handle additional webpack patterns and bundle formats.

## License

MIT License - see LICENSE file for details.

## Technical Details

### Regex Patterns Used

- **Module Detection**: `/\/\*\*\*\/ "([^"]+)":\s*\/\*![^*]*\*\/\s*\/\*\*\*\/ \(function\(([^)]*)\) \{([\s\S]*?)\n\/\*\*\*\* \}\),?/g`
- **Harmony Imports**: `/\/\* harmony import \*\/ var ([^=]+) = __webpack_require__\(\/\*! ([^*]+) \*\/ "([^"]+)"\);?/g`
- **Export Bindings**: `/__webpack_require__\.d\(__webpack_exports__,\s*"([^"]+)",\s*function\(\)\s*\{\s*return\s+([^;]+);\s*\}\);?/g`

### Module Processing Pipeline

1. **Boilerplate Removal**: Strips webpack-specific code
2. **Import Processing**: Converts `__webpack_require__` to ES6 imports
3. **Export Processing**: Converts webpack exports to ES6 exports
4. **Usage Replacement**: Updates variable names to clean references
5. **Artifact Cleanup**: Removes remaining webpack comments and artifacts

## FAQ

**Q: Will this restore my original source code exactly?**
A: It will restore the structure and logic, but not original variable names if the code was minified.

**Q: Does it work with all webpack versions?**
A: Tested with Webpack 4.x and 5.x. Older versions might need adjustments.

**Q: Can it handle TypeScript files?**
A: Yes, it preserves TypeScript file extensions and syntax.

**Q: What about CSS and other assets?**
A: This tool focuses on JavaScript/TypeScript modules. CSS and other assets in the bundle are not processed. 