#!/usr/bin/env node

const WebpackDeconstructor = require('./webpack-deconstructor');

async function example() {
    console.log('🚀 Webpack Deconstructor Example');
    console.log('─'.repeat(40));
    
    // Example usage as a module
    const deconstructor = new WebpackDeconstructor(
        './reference-built-site/build/js/main.js',
        './example-output'
    );
    
    try {
        await deconstructor.deconstruct();
        console.log('\n✅ Example completed successfully!');
        console.log('📂 Check ./example-output for reconstructed files');
    } catch (error) {
        console.error('❌ Example failed:', error.message);
    }
}

// Run example if called directly
if (require.main === module) {
    example();
} 