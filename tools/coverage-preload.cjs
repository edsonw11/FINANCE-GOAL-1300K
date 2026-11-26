/**
 * tools/coverage-preload.cjs
 * Responsibility: used only by tools/coverage.cjs (node --require). The unit harness cuts the `import` and `export` words out of each module before it runs the
 * module in a vm context, so V8's coverage offsets no longer match the file on disk. This replaces the cut with blanks of the same length: the code that runs is the
 * same, but every offset is the one in the real file. The harness and the build are not touched.
 */
const path=require('path');
const mg=require(path.join(process.cwd(),'tools','module-graph.cjs'));
const blank=s=>s.replace(/[^\n]/g,' ');
mg.stripModule=code=>code
  .replace(/^import\s*\{([^}]*)\}\s*from\s*'([^']+)';[ \t]*$/gm,blank)
  .replace(/^export\s+/gm,blank);
