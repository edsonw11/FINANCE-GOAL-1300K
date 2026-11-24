// ESLint (flat config). Correctness rules only: the code keeps its compact style (see ADR-0005), so no stylistic rules.
import js from '@eslint/js';
import globals from 'globals';
export default [
  {ignores:['dist/**','vendor/**','node_modules/**','tests/.*.html','docs/**']},
  js.configs.recommended,
  // the app: ES modules in the browser
  {files:['src/**/*.js'],languageOptions:{ecmaVersion:2022,sourceType:'module',globals:{...globals.browser}},
    rules:{'no-unused-vars':['error',{args:'none',caughtErrors:'none'}],eqeqeq:['error','smart'],'no-empty':['error',{allowEmptyCatch:true}],'no-implicit-globals':'error'}},
  // the rules (domain) never touch the page (core/dom.js is the DOM helper, so core is not restricted)
  {files:['src/domain/**/*.js'],
    rules:{'no-restricted-globals':['error',...['document','window','navigator','alert','confirm','prompt'].map(name=>({name,message:'domain/core have no DOM: keep it in src/ui'}))]}},
  // tests, tools and the build helpers: CommonJS on Node, some files run in the browser page under test
  {files:['tests/**/*.js','tools/**/*.cjs'],languageOptions:{ecmaVersion:2022,sourceType:'commonjs',globals:{...globals.node,...globals.browser}},
    rules:{'no-unused-vars':['error',{args:'none',caughtErrors:'none'}]}},
  {files:['**/*.mjs'],languageOptions:{sourceType:'module',globals:{...globals.node}}},
];
