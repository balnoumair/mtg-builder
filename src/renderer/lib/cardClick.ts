import type { MouseEvent } from 'react';

/** Preview takes priority over card actions, including nested quantity buttons. */
export function previewOnModifiedClick(event: MouseEvent, onPreview?: () => void) {
  if (!onPreview || (!event.ctrlKey && !event.metaKey)) return;
  event.preventDefault();
  event.stopPropagation();
  onPreview();
}
