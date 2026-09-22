/** Check our internal API facade using TypeScript symbols, including aliases. */
import ts from "typescript";
import path from "node:path";

const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists);
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const facade = program.getSourceFile(path.resolve("lib/api.ts"));
const wrappers = new Map();
const used = new Set();
const visit = (node, callback) => { callback(node); ts.forEachChild(node, child => visit(child, callback)); };
visit(facade, node => {
  if (!ts.isVariableDeclaration(node) || !node.name.getText().endsWith("Api") || !node.initializer || !ts.isObjectLiteralExpression(node.initializer)) return;
  for (const property of node.initializer.properties) {
    if (ts.isPropertyAssignment(property)) wrappers.set(property, `${node.name.getText()}.${property.name.getText()}`);
  }
});
for (const source of program.getSourceFiles()) {
  if (source === facade || source.isDeclarationFile || /[/\\](node_modules|\.next|tests)[/\\]/.test(source.fileName)) continue;
  visit(source, node => {
    let symbol;
    if (ts.isPropertyAccessExpression(node)) symbol = checker.getSymbolAtLocation(node.name);
    else if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
      symbol = checker.getTypeAtLocation(node.expression).getProperty(node.argumentExpression.text);
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      symbol = checker.getTypeAtLocation(node.parent).getProperty((node.propertyName ?? node.name).getText());
    }
    for (const declaration of symbol?.declarations ?? []) used.add(declaration);
  });
}
const unused = [...wrappers].filter(([declaration]) => !used.has(declaration)).map(([, name]) => name);
if (unused.length) {
  console.error(`Unused API wrappers:\n${unused.join("\n")}`);
  process.exitCode = 1;
} else console.log(`All ${wrappers.size} API wrappers have application callers.`);
