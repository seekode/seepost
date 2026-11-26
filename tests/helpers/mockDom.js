/**
 * Mini DOM en mémoire pour tester les exercices DOM dans Node (même principe que curriculum.test.js).
 */
export function createMockDomForLevel(level) {
  const byId = new Map();

  class MockNode {
    constructor(id, textContent = '') {
      this.id = id;
      this.textContent = textContent;
      this.parentNode = null;
      this.children = [];
    }
    appendChild(child) {
      if (!child || !(child instanceof MockNode)) {
        throw new TypeError("Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'.");
      }
      if (child.parentNode) {
        child.parentNode.children = child.parentNode.children.filter((c) => c !== child);
      }
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    contains(node) {
      if (node === this) return true;
      return this.children.some((c) => c.contains(node));
    }
  }

  const tapis = new MockNode('zone-colis-tapis');
  byId.set(tapis.id, tapis);

  for (const p of level.domParcels || []) {
    const node = new MockNode(p.id, p.simpleText || `${p.label} ${p.value}`);
    tapis.appendChild(node);
    byId.set(node.id, node);
  }
  for (const t of level.domTargets || []) {
    const node = new MockNode(t.id, '');
    byId.set(node.id, node);
  }

  return {
    getElementById(id) {
      return byId.get(id) || null;
    }
  };
}
