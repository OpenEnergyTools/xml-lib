import {
  Arbitrary,
  array,
  constant,
  constantFrom,
  dictionary,
  object as objectArbitrary,
  oneof,
  record,
  string as stringArbitrary,
  tuple,
  webUrl,
} from "fast-check";

import {
  EditV2,
  Insert,
  Remove,
  SetAttributes,
  SetTextContent,
} from "./handleEdit.js";

export const xmlAttributeName =
  /^(?!xml|Xml|xMl|xmL|XMl|xML|XmL|XML)[A-Za-z_][A-Za-z0-9-_.]*(:[A-Za-z_][A-Za-z0-9-_.]*)?$/;

export function descendants(parent: Element | XMLDocument): Node[] {
  return (Array.from(parent.childNodes) as Node[]).concat(
    ...Array.from(parent.children).map((child) => descendants(child)),
  );
}

export const sclDocString = `<?xml version="1.0" encoding="UTF-8"?>
    <SCL version="2007" revision="B" xmlns="http://www.iec.ch/61850/2003/SCL" xmlns:ens1="http://example.org/somePreexistingExtensionNamespace">
    <Substation name="A1" desc="test substation"></Substation>
  </SCL>`;
const testDocStrings = [
  sclDocString,
  `<?xml version="1.0" encoding="UTF-8"?>
    <testDoc1>
  <element1 property1="value1" property2="value2">SomeText</element1>
  <element2 property2="value2" property3="value3"><!--AComment--></element2>
  <element3 property3="value3" property1="value1">
    <subelement1 property1="value1" property2="value2">SomeMoreText</subelement1>
    <subelement2 property2="value2" property3="value3"><!----></subelement2>
    <subelement3 property3="value3" property1="value1"></subelement3>
  </element3>
  </testDoc1>`,
  `<?xml version="1.0" encoding="UTF-8"?>
    <testDoc2>
  <element1 property1="value1" property2="value2">SomeText</element1>
  <element2 property2="value2" property3="value3"><!--AComment--></element2>
  <element3 property3="value3" property1="value1">
    <subelement1 property1="value1" property2="value2">SomeMoreText</subelement1>
    <subelement2 property2="value2" property3="value3"><!----></subelement2>
    <subelement3 property3="value3" property1="value1"></subelement3>
  </element3>
  </testDoc2>`,
];

export type TestDoc = { doc: XMLDocument; nodes: Node[] };
export const testDocs = tuple(
  constantFrom(...testDocStrings),
  constantFrom(...testDocStrings),
)
  .map((strs) =>
    strs.map((str) => new DOMParser().parseFromString(str, "application/xml")),
  )
  .map((docs) =>
    docs.map((doc) => ({ doc, nodes: descendants(doc).concat([doc]) })),
  ) as Arbitrary<[TestDoc, TestDoc]>;

export function remove(nodes: Node[]): Arbitrary<Remove> {
  const node = oneof(
    { arbitrary: constantFrom(...nodes), weight: nodes.length },
    testDocs.chain((docs) => constantFrom(...docs.map((d) => d.doc))),
  );
  return record({ node });
}

export function insert(nodes: Node[]): Arbitrary<Insert> {
  const references = (nodes as (Node | null)[]).concat([null]);
  const parent = constantFrom(...nodes);
  const node = constantFrom(...nodes);
  const reference = constantFrom(...references);
  return record({ parent, node, reference });
}

export function setTextContent(nodes: Node[]): Arbitrary<SetTextContent> {
  const element = <Arbitrary<Element>>(
    constantFrom(...nodes.filter((nd) => nd.nodeType === Node.ELEMENT_NODE))
  );
  const textContent = stringArbitrary();

  return record({ element, textContent });
}

export function setAttribute(nodes: Node[]): Arbitrary<SetAttributes> {
  const element = <Arbitrary<Element>>(
    constantFrom(...nodes.filter((nd) => nd.nodeType === Node.ELEMENT_NODE))
  );
  const attributes = dictionary(
    stringArbitrary(),
    oneof(stringArbitrary(), constant(null)),
  );
  // object() instead of nested dictionary() necessary for performance reasons
  const attributesNS = objectArbitrary({
    key: webUrl(),
    values: [stringArbitrary(), constant(null)],
    maxDepth: 1,
  }).map(
    (aNS) =>
      Object.fromEntries(
        Object.entries(aNS).filter(
          ([_, attrs]) => attrs && !(typeof attrs === "string"),
        ),
      ) as Partial<Record<string, Partial<Record<string, string | null>>>>,
  );
  return record({ element, attributes, attributesNS });
}

export function complexEdit(nodes: Node[]): Arbitrary<EditV2[]> {
  return array(simpleEdit(nodes));
}

export function simpleEdit(
  nodes: Node[],
): Arbitrary<Insert | SetAttributes | Remove | SetTextContent> {
  return oneof(
    remove(nodes),
    insert(nodes),
    setAttribute(nodes),
    setTextContent(nodes),
  );
}

export function edit(nodes: Node[]): Arbitrary<EditV2> {
  return oneof({ arbitrary: simpleEdit(nodes), weight: 2 }, complexEdit(nodes));
}

/** A series of arbitrary edits that allow us to test undo and redo */
export type UndoRedoTestCase = {
  doc1: XMLDocument;
  doc2: XMLDocument;
  edits: EditV2[];
};

export function undoRedoTestCases(
  testDoc1: TestDoc,
  testDoc2: TestDoc,
): Arbitrary<UndoRedoTestCase> {
  const nodes = testDoc1.nodes.concat(testDoc2.nodes);
  return record({
    doc1: constant(testDoc1.doc),
    doc2: constant(testDoc2.doc),
    edits: array(edit(nodes)),
  });
}

export function isParentNode(node: Node): node is ParentNode {
  return (
    node instanceof Element ||
    node instanceof Document ||
    node instanceof DocumentFragment
  );
}

export function isParentOf(parent: Node, node: Node | null) {
  return (
    isParentNode(parent) &&
    (node === null || Array.from(parent.childNodes).includes(node as ChildNode))
  );
}

export function isValidInsert({ parent, node, reference }: Insert) {
  return (
    node !== reference &&
    isParentOf(parent, reference) &&
    !node.contains(parent) &&
    ![Node.DOCUMENT_NODE, Node.DOCUMENT_TYPE_NODE].some(
      (nodeType) => node.nodeType === nodeType,
    ) &&
    !(
      parent instanceof Document &&
      (parent.documentElement || !(node instanceof Element))
    )
  );
}
