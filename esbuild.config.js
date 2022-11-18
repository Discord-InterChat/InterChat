const esbuild = require('esbuild');

// Automatically exclude all node_modules from the bundled version

const { nodeExternalsPlugin } = require('esbuild-node-externals');

const config = {
	entryPoints: ['./src/index.ts'],
	outdir: 'build/',
	bundle: true,
	minify: true,
	treeShaking: true,
	platform: 'node',
	sourcemap: true,
	plugins: [nodeExternalsPlugin()],
};

if (process.env.WATCH) {
	console.log('Watching Files for changes...');
	config.watch = true;
	config.minify = false;
}

esbuild.build(config).catch(() => process.exit(1));
