// An in-page stand-in for the browser's own alert()/confirm() -- those
// render as native OS chrome, which breaks out of the game's own visual
// frame. Used for "name already taken" (alert-style, one button) and
// "already playing elsewhere, take over?" (confirm-style, two buttons).

export interface DialogElements {
  overlay: HTMLElement;
  message: HTMLElement;
  confirmButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
}

export function showDialog(elements: DialogElements, message: string, kind: "alert" | "confirm"): Promise<boolean> {
  const { overlay, message: messageEl, confirmButton, cancelButton } = elements;
  messageEl.textContent = message;
  cancelButton.hidden = kind === "alert";
  overlay.hidden = false;
  // Cancel for a confirm (a no-op default, same as dismissing it any other
  // way); the lone confirm button for an alert, since there's nothing else
  // on it Escape could mean.
  (kind === "alert" ? confirmButton : cancelButton).focus();

  return new Promise((resolve) => {
    function cleanup(result: boolean): void {
      overlay.hidden = true;
      confirmButton.removeEventListener("click", onConfirm);
      cancelButton.removeEventListener("click", onCancel);
      overlay.removeEventListener("keydown", onKeydown);
      resolve(result);
    }
    function onConfirm(): void {
      cleanup(true);
    }
    function onCancel(): void {
      cleanup(false);
    }
    function onKeydown(e: Event): void {
      if ((e as KeyboardEvent).key === "Escape") (kind === "alert" ? onConfirm : onCancel)();
    }
    confirmButton.addEventListener("click", onConfirm);
    cancelButton.addEventListener("click", onCancel);
    overlay.addEventListener("keydown", onKeydown);
  });
}
