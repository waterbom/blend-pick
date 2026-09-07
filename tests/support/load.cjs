const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(file, mocks = {}, cache = new Map(), sourceReader = f => fs.readFileSync(path.join(root, f), 'utf8')) {
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(sourceReader(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: file }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (['@/lib/db', '@/lib/db-shop'].includes(name)) throw Error('Production database access blocked in tests');
    if (name.startsWith('@/')) {
      const local = ['.ts', '.tsx'].map(ext => name.slice(2) + ext).find(f => fs.existsSync(path.join(root, f)));
      if (!local) throw Error('Missing local dependency: ' + name);
      return load(local, mocks, cache, sourceReader);
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
module.exports = { load, root };
