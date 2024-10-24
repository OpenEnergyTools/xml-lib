/** Intent to `parent.insertBefore(node, reference)` */
export type Insert = {
  parent: Node;
  node: Node;
  reference: Node | null;
};

/** Intent to remove a `node` from its `ownerDocument` */
export type Remove = {
  node: Node;
};

/** Intent to set the `textContent` of `element` */
export type SetTextContent = {
  element: Element;
  textContent: string;
};

/** Intent to set or remove (if `null`) `attributes`(-`NS`) on `element` */
export type SetAttributes = {
  element: Element;
  attributes: Partial<Record<string, string | null>>;
  attributesNS: Partial<Record<string, Partial<Record<string, string | null>>>>;
};

/** Intent to change some XMLDocuments */
export type EditV2 =
  | Insert
  | SetAttributes
  | SetTextContent
  | Remove
  | EditV2[];

export function isComplex(edit: EditV2): edit is EditV2[] {
  return edit instanceof Array;
}

export function isSetTextContent(edit: EditV2): edit is SetTextContent {
  return "element" in edit && "textContent" in edit;
}

export function isRemove(edit: EditV2): edit is Remove {
  return (
    (edit as Insert).parent === undefined && (edit as Remove).node !== undefined
  );
}

export function isSetAttributes(edit: EditV2): edit is SetAttributes {
  return "element" in edit && "attributesNS" in edit && "attributes" in edit;
}

export function isInsert(edit: EditV2): edit is Insert {
  return (
    (edit as Insert).parent !== undefined &&
    (edit as Insert).node !== undefined &&
    (edit as Insert).reference !== undefined
  );
}
