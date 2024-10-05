import { LitElement } from "lit";
import { state } from "lit/decorators.js";

import { EditEventV2 } from "./edit-event-v2.js";

import { EditV2, handleEdit } from "./handleEdit.js";

import { EditEvent } from "./edit-event.js";
import { convertEdit } from "./convertEditToEditV2.js";

export type LogEntry = {
  undo: EditV2;
  redo: EditV2;
  title?: string;
};

export class Editor extends LitElement {
  @state()
  history: LogEntry[] = [];

  @state()
  editCount = -1;

  @state()
  get last(): number {
    return this.editCount - 1;
  }

  @state()
  get canUndo(): boolean {
    return this.last >= 0;
  }

  @state()
  get canRedo(): boolean {
    return this.editCount < this.history.length;
  }

  /** The set of `XMLDocument`s currently loaded */
  @state()
  docs: Record<string, XMLDocument> = {};

  squashUndo(undoEdits: EditV2): EditV2 {
    const lastHistory = this.history[this.last];
    if (!lastHistory) return undoEdits;

    const lastUndo = lastHistory.undo;
    if (lastUndo instanceof Array && undoEdits instanceof Array)
      return [...undoEdits, ...lastUndo];

    if (lastUndo instanceof Array && !(undoEdits instanceof Array))
      return [undoEdits, ...lastUndo];

    if (!(lastUndo instanceof Array) && undoEdits instanceof Array)
      return [...undoEdits, lastUndo];

    return [undoEdits, lastUndo];
  }

  squashRedo(edits: EditV2): EditV2 {
    const lastHistory = this.history[this.last];
    if (!lastHistory) return edits;

    const lastRedo = lastHistory.redo;
    if (lastRedo instanceof Array && edits instanceof Array)
      return [...lastRedo, ...edits];

    if (lastRedo instanceof Array && !(edits instanceof Array))
      return [...lastRedo, edits];

    if (!(lastRedo instanceof Array) && edits instanceof Array)
      return [lastRedo, ...edits];

    return [lastRedo, edits];
  }

  handleSquashedEdits(edit: EditV2, title?: string): void {
    const squashedUndo = this.squashUndo(handleEdit(edit));
    const squashedRedo = this.squashRedo(edit);

    this.history.pop();

    this.history = [
      ...this.history,
      { undo: squashedUndo, redo: squashedRedo, title },
    ];
    this.editCount = this.history.length;
  }

  handleEditEvent(event: EditEventV2) {
    const { edit, title } = event.detail;

    const squash = !!event.detail.squash;
    if (squash) {
      this.handleSquashedEdits(edit, title);
      return;
    }

    // create new array on each edit
    this.history = [
      ...this.history,
      { undo: handleEdit(edit), redo: edit, title },
    ];
    this.editCount = this.history.length;
  }

  handleEditEventV1(event: EditEvent) {
    const edit = event.detail;
    const editV2 = convertEdit(edit);
    // create new array on each edit
    this.history = [
      ...this.history,
      { undo: handleEdit(editV2), redo: editV2 },
    ];
    this.editCount = this.history.length;
  }

  /** Undo the last `n` [[Edit]]s committed */
  undo(n = 1) {
    if (!this.canUndo || n < 1) return;
    handleEdit(this.history[this.last!].undo);
    this.editCount -= 1;
    if (n > 1) this.undo(n - 1);
  }

  /** Redo the last `n` [[Edit]]s that have been undone */
  redo(n = 1) {
    if (!this.canRedo || n < 1) return;
    handleEdit(this.history[this.editCount].redo);
    this.editCount += 1;
    if (n > 1) this.redo(n - 1);
  }

  constructor() {
    super();

    this.addEventListener("oscd-edit", (event) =>
      this.handleEditEventV1(event)
    );

    this.addEventListener("oscd-edit-v2", (event) =>
      this.handleEditEvent(event)
    );
  }
}
