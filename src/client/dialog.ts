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

  return new Promise((resolve) => {
    function cleanup(result: boolean): void {
      overlay.hidden = true;
      confirmButton.removeEventListener("click", onConfirm);
      cancelButton.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onConfirm(): void {
      cleanup(true);
    }
    function onCancel(): void {
      cleanup(false);
    }
    confirmButton.addEventListener("click", onConfirm);
    cancelButton.addEventListener("click", onCancel);
  });
}
