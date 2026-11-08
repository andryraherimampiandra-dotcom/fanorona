const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so Metro sees changes in the engine + ai packages.
config.watchFolders = [workspaceRoot];

// Let Metro resolve from the app's node_modules and the workspace root's node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Avoid picking up stray copies deeper in the tree.
config.resolver.disableHierarchicalLookup = true;

// The engine + ai packages use TS-native `./foo.js` imports that reference
// source files ending in .ts. Metro doesn't do the TS extension fallback that
// tsc + vitest do, so strip the `.js` suffix before resolving.
const baseResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const cleaned =
    moduleName.endsWith(".js") && (moduleName.startsWith(".") || moduleName.startsWith("/"))
      ? moduleName.slice(0, -3)
      : moduleName;
  return baseResolve
    ? baseResolve(context, cleaned, platform)
    : context.resolveRequest(context, cleaned, platform);
};

module.exports = config;
