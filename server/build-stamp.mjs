// Written after every successful build so `npm run host` can skip rebuilding unchanged sources.
// Kept outside dist/ so it is never served or packaged.
export const BUILD_STAMP = "node_modules/.tmp/taleforge-build-stamp";
