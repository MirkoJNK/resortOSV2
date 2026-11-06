const fs = require('node:fs');
const crypto = require('node:crypto');
const postcss = require('postcss');

/**
 * Ordered CSS declaration tree, omitting comments and formatting trivia only.
 * Duplicated selectors and declaration order are deliberately preserved because
 * they affect the cascade and therefore the visual design.
 */
function semanticTree(node) {
  return (node.nodes || []).flatMap((child) => {
    if (child.type === 'comment') return [];
    if (child.type === 'decl') {
      return [['decl', child.prop, child.value, !!child.important]];
    }
    if (child.type === 'rule') {
      return [['rule', child.selector.replace(/\s+/g, ' ').trim(), semanticTree(child)]];
    }
    if (child.type === 'atrule') {
      return [['atrule', child.name, child.params.replace(/\s+/g, ' ').trim(), semanticTree(child)]];
    }
    throw new Error(`Unexpected CSS node: ${child.type}`);
  });
}

function cssSemanticHash(file) {
  const tree = semanticTree(postcss.parse(fs.readFileSync(file, 'utf8'), { from: file }));
  return crypto.createHash('sha256').update(JSON.stringify(tree)).digest('hex');
}

module.exports = { cssSemanticHash, semanticTree };
