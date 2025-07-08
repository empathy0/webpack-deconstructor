#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class WebpackDeconstructor {
    constructor(inputFile, outputDir = 'reconstructed') {
        this.inputFile = inputFile;
        this.outputDir = outputDir;
        this.modules = new Map();
        this.dependencies = new Map();
    }

    /**
     * Main entry point for deconstruction
     */
    async deconstruct() {
        try {
            console.log(`🔍 Reading webpack bundle: ${this.inputFile}`);
            const bundleContent = await this.readBundle();
            
            console.log('📦 Parsing webpack modules...');
            this.parseModules(bundleContent);
            
            console.log(`📁 Creating output directory: ${this.outputDir}`);
            this.createOutputDirectory();
            
            console.log('🔄 Processing modules and transforming code...');
            await this.processModules();
            
            console.log('✅ Webpack bundle successfully deconstructed!');
            console.log(`📂 Reconstructed files available in: ${this.outputDir}`);
            
        } catch (error) {
            console.error('❌ Error during deconstruction:', error.message);
            process.exit(1);
        }
    }

    /**
     * Read the webpack bundle file
     */
    async readBundle() {
        try {
            return fs.readFileSync(this.inputFile, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read bundle file: ${error.message}`);
        }
    }

    /**
     * Parse webpack modules from the bundle
     */
    parseModules(bundleContent) {
        // Find the module map - typically starts with /******/ ({
        const moduleMapStart = bundleContent.indexOf('/******/ ({');
        
        if (moduleMapStart === -1) {
            throw new Error('Could not find webpack module map in bundle');
        }

        // Extract the module map section
        const moduleMapSection = bundleContent.substring(moduleMapStart);

        // Extract individual modules using pattern:
        // /***/ "./path/to/module":
        // followed by any lines and then
        // /***/ (function(module, __webpack_exports__, __webpack_require__) {
        // ... module content ...
        // /***/ }),
        
        const moduleRegex = /\/\*\*\*\/ "([^"]+)":\s*[\s\S]*?\/\*\*\*\/ \(function\(([^)]*)\) \{\s*([\s\S]*?)\n\/\*\*\*\/ \}\),?\s*(?=\/\*\*\*\/ "|$)/g;
        
        let match;
        let moduleCount = 0;
        
        while ((match = moduleRegex.exec(moduleMapSection)) !== null) {
            const [, modulePath, params, moduleContent] = match;
            
            // Only process application modules (exclude node_modules)
            if (!modulePath.startsWith('./node_modules/')) {
                this.modules.set(modulePath, {
                    path: modulePath,
                    params: params.split(',').map(p => p.trim()),
                    content: moduleContent.trim(),
                    dependencies: []
                });
                moduleCount++;
            }
        }

        console.log(`📊 Found ${moduleCount} application modules (excluding node_modules)`);
        
        if (moduleCount === 0) {
            throw new Error('No application modules found. The bundle format might be different than expected.');
        }
    }

    /**
     * Create output directory structure
     */
    createOutputDirectory() {
        if (fs.existsSync(this.outputDir)) {
            // Clean existing directory
            fs.rmSync(this.outputDir, { recursive: true, force: true });
        }
        fs.mkdirSync(this.outputDir, { recursive: true });
    }

    /**
     * Process all modules and write reconstructed files
     */
    async processModules() {
        for (const [modulePath, moduleData] of this.modules) {
            await this.processModule(modulePath, moduleData);
        }
    }

    /**
     * Process individual module
     */
    async processModule(modulePath, moduleData) {
        try {
            // Clean the module path (remove ./ prefix)
            const cleanPath = modulePath.replace(/^\.\//, '');
            const outputPath = path.join(this.outputDir, cleanPath);
            
            // Create directory structure
            const dirPath = path.dirname(outputPath);
            fs.mkdirSync(dirPath, { recursive: true });
            
            // Transform the module content
            const transformedContent = this.transformModuleContent(moduleData.content, modulePath);
            
            // Write the file
            fs.writeFileSync(outputPath, transformedContent, 'utf8');
            console.log(`📝 Created: ${cleanPath}`);
            
        } catch (error) {
            console.error(`❌ Error processing module ${modulePath}:`, error.message);
        }
    }

    /**
     * Transform webpack module content back to standard ES6
     */
    transformModuleContent(content, currentModulePath) {
        let transformed = content;

        // Remove webpack boilerplate
        transformed = this.removeWebpackBoilerplate(transformed);
        
        // Transform imports
        transformed = this.transformImports(transformed, currentModulePath);
        
        // Transform exports
        transformed = this.transformExports(transformed);
        
        // Clean up remaining webpack artifacts
        transformed = this.cleanupWebpackArtifacts(transformed);
        
        return transformed.trim();
    }

    /**
     * Remove webpack boilerplate code
     */
    removeWebpackBoilerplate(content) {
        let cleaned = content;
        
        // Remove "use strict" if present at the beginning
        cleaned = cleaned.replace(/^"use strict";\s*\n?/, '');
        
        // Remove __webpack_require__.r(__webpack_exports__);
        cleaned = cleaned.replace(/__webpack_require__\.r\(__webpack_exports__\);\s*\n?/g, '');
        
        return cleaned;
    }

    /**
     * Transform webpack imports to ES6 imports
     */
    transformImports(content, currentModulePath) {
        let transformed = content;
        const imports = [];
        
        // Pattern for harmony imports with comments
        const harmonyImportRegex = /\/\* harmony import \*\/ var ([^=]+) = __webpack_require__\(\/\*! ([^*]+) \*\/ "([^"]+)"\);?\s*\n?/g;
        
        let match;
        while ((match = harmonyImportRegex.exec(content)) !== null) {
            const [fullMatch, varName, originalPath, webpackPath] = match;
            
            // Calculate relative path from current module to imported module
            const relativePath = this.calculateRelativePath(currentModulePath, webpackPath);
            
            // Determine import type based on variable name patterns
            const importStatement = this.generateImportStatement(varName.trim(), relativePath);
            
            if (importStatement) {
                imports.push(importStatement);
                // Remove the original webpack import
                transformed = transformed.replace(fullMatch, '');
            }
        }

        // Handle default imports (commonjs modules)
        const defaultImportRegex = /\/\* harmony import \*\/ var ([^=]+)___default = \/\*#__PURE__\*\/__webpack_require__\.n\(([^)]+)\);\s*\n?/g;
        
        while ((match = defaultImportRegex.exec(content)) !== null) {
            const [fullMatch, varName, importVar] = match;
            // This indicates a default import from CommonJS module
            transformed = transformed.replace(fullMatch, '');
        }

        // Replace usage of webpack import variables with clean names
        transformed = this.replaceImportUsage(transformed);

        // Add imports at the beginning
        if (imports.length > 0) {
            transformed = imports.join('\n') + '\n\n' + transformed;
        }

        return transformed;
    }

    /**
     * Calculate relative path between two webpack module paths
     */
    calculateRelativePath(fromPath, toPath) {
        // Remove ./ prefix from both paths
        const cleanFromPath = fromPath.replace(/^\.\//, '');
        const cleanToPath = toPath.replace(/^\.\//, '');
        
        const fromDir = path.dirname(cleanFromPath);
        const toFile = cleanToPath;
        
        const relativePath = path.relative(fromDir, toFile);
        
        // Ensure relative path starts with ./ or ../
        if (!relativePath.startsWith('.')) {
            return './' + relativePath;
        }
        
        return relativePath;
    }

    /**
     * Generate ES6 import statement based on variable name patterns
     */
    generateImportStatement(varName, relativePath) {
        // Remove file extension for cleaner imports
        const cleanPath = relativePath.replace(/\.(ts|js)$/, '');
        
        // Common patterns for different import types
        if (varName.includes('__WEBPACK_IMPORTED_MODULE_')) {
            // Extract the actual imported name from the variable
            // Pattern: var _SignalBinding__WEBPACK_IMPORTED_MODULE_0__
            const nameMatch = varName.match(/^_(.+?)__WEBPACK_IMPORTED_MODULE_\d+__$/);
            if (nameMatch) {
                const importName = nameMatch[1];
                
                // Check if it looks like a default import (typically PascalCase single word)
                if (/^[A-Z][a-zA-Z0-9]*$/.test(importName) && !importName.includes('_')) {
                    return `import ${importName} from '${cleanPath}';`;
                } else {
                    // Named import - convert underscore to original name
                    const cleanImportName = importName.replace(/_/g, '');
                    return `import { ${cleanImportName} } from '${cleanPath}';`;
                }
            }
        }
        
        // Fallback: try to extract meaningful name
        const fallbackMatch = varName.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (fallbackMatch) {
            return `import { ${fallbackMatch[1]} } from '${cleanPath}';`;
        }
        
        return null;
    }

    /**
     * Replace webpack import variable usage with clean names
     */
    replaceImportUsage(content) {
        let cleaned = content;
        
        // Replace webpack variable usage: _SignalBinding__WEBPACK_IMPORTED_MODULE_0__["SignalBinding"]
        // with just: SignalBinding
        const usageRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*__WEBPACK_IMPORTED_MODULE_\d+__)\["([^"]+)"\]/g;
        cleaned = cleaned.replace(usageRegex, '$2');
        
        // Replace default imports: _moduleName__WEBPACK_IMPORTED_MODULE_0___default
        const defaultUsageRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)___default/g;
        cleaned = cleaned.replace(defaultUsageRegex, (match, varName) => {
            const nameMatch = varName.match(/^_(.+?)__WEBPACK_IMPORTED_MODULE_\d+$/);
            return nameMatch ? nameMatch[1] : varName;
        });

        // Replace direct module variable usage: _ModuleName__WEBPACK_IMPORTED_MODULE_0__
        const directUsageRegex = /_([a-zA-Z_$][a-zA-Z0-9_$]*)__WEBPACK_IMPORTED_MODULE_\d+__/g;
        cleaned = cleaned.replace(directUsageRegex, '$1');

        return cleaned;
    }

    /**
     * Transform webpack exports to ES6 exports
     */
    transformExports(content) {
        let transformed = content;
        
        // Transform harmony export bindings
        // __webpack_require__.d(__webpack_exports__, "FontLoader", function() { return FontLoader; });
        const exportBindingRegex = /__webpack_require__\.d\(__webpack_exports__,\s*"([^"]+)",\s*function\(\)\s*\{\s*return\s+([^;]+);\s*\}\);\s*\n?/g;
        
        const exports = [];
        let match;
        
        while ((match = exportBindingRegex.exec(content)) !== null) {
            const [fullMatch, exportName, exportValue] = match;
            
            // Check if this is a class, function, or variable being exported
            const exportStatement = this.generateExportStatement(exportName, exportValue, transformed);
            if (exportStatement) {
                exports.push(exportStatement);
            }
            
            // Remove the webpack export
            transformed = transformed.replace(fullMatch, '');
        }

        // Handle module.exports for CommonJS modules
        const moduleExportsRegex = /module\.exports\s*=\s*([^;]+);?\s*\n?/g;
        while ((match = moduleExportsRegex.exec(content)) !== null) {
            const [fullMatch, exportValue] = match;
            exports.push(`export default ${exportValue};`);
            transformed = transformed.replace(fullMatch, '');
        }

        // Apply export statements by modifying class/function declarations
        transformed = this.applyExportStatements(transformed, exports);

        return transformed;
    }

    /**
     * Generate appropriate export statement
     */
    generateExportStatement(exportName, exportValue, content) {
        // Check if the export value is a class, function, or variable
        const classRegex = new RegExp(`class\\s+${exportValue}\\s*\\{`, 'g');
        const functionRegex = new RegExp(`function\\s+${exportValue}\\s*\\(`, 'g');
        const constRegex = new RegExp(`const\\s+${exportValue}\\s*=`, 'g');
        const letRegex = new RegExp(`let\\s+${exportValue}\\s*=`, 'g');
        const varRegex = new RegExp(`var\\s+${exportValue}\\s*=`, 'g');

        if (classRegex.test(content)) {
            return { type: 'class', name: exportValue };
        } else if (functionRegex.test(content)) {
            return { type: 'function', name: exportValue };
        } else if (constRegex.test(content) || letRegex.test(content) || varRegex.test(content)) {
            return { type: 'variable', name: exportValue };
        }

        return { type: 'variable', name: exportValue };
    }

    /**
     * Apply export statements to declarations
     */
    applyExportStatements(content, exports) {
        let transformed = content;

        for (const exportInfo of exports) {
            if (typeof exportInfo === 'string') {
                // Direct export statement
                transformed += '\n' + exportInfo;
                continue;
            }

            const { type, name } = exportInfo;

            switch (type) {
                case 'class':
                    const classRegex = new RegExp(`class\\s+${name}\\s*\\{`, 'g');
                    transformed = transformed.replace(classRegex, `export class ${name} {`);
                    break;
                
                case 'function':
                    const functionRegex = new RegExp(`function\\s+${name}\\s*\\(`, 'g');
                    transformed = transformed.replace(functionRegex, `export function ${name}(`);
                    break;
                
                case 'variable':
                    // For variables, add export statement at the end
                    transformed += `\nexport { ${name} };`;
                    break;
            }
        }

        return transformed;
    }

    /**
     * Clean up remaining webpack artifacts
     */
    cleanupWebpackArtifacts(content) {
        let cleaned = content;

        // Remove any remaining __webpack_require__ calls that weren't transformed
        cleaned = cleaned.replace(/__webpack_require__\([^)]+\)/g, '');
        
        // Remove harmony export comments
        cleaned = cleaned.replace(/\/\* harmony export \([^)]+\) \*\/\s*/g, '');
        
        // Remove webpack module comments
        cleaned = cleaned.replace(/\/\*!\s*[^*]*\s*\*\//g, '');
        
        // Remove empty lines (more than 2 consecutive)
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        // Remove trailing whitespace from lines
        cleaned = cleaned.replace(/[ \t]+$/gm, '');

        return cleaned;
    }
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('❌ Usage: node webpack-deconstructor.js <path-to-bundle.js> [output-directory]');
        console.error('   Example: node webpack-deconstructor.js ./dist/main.js ./reconstructed');
        process.exit(1);
    }

    const inputFile = args[0];
    const outputDir = args[1] || 'reconstructed';

    // Validate input file exists
    if (!fs.existsSync(inputFile)) {
        console.error(`❌ Input file not found: ${inputFile}`);
        process.exit(1);
    }

    console.log('🚀 Webpack Deconstructor Starting...');
    console.log(`📥 Input: ${inputFile}`);
    console.log(`📤 Output: ${outputDir}`);
    console.log('─'.repeat(50));

    const deconstructor = new WebpackDeconstructor(inputFile, outputDir);
    await deconstructor.deconstruct();
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = WebpackDeconstructor; 