// A themed stand-in for the browser's own prompt() -- the same reasoning as
// dialog.ts's showDialog for alert()/confirm(): native OS chrome breaks out
// of the game's own visual frame. Separate module rather than reusing
// showDialog directly, since this needs an input field and an inline
// validation error, neither of which the plain alert/confirm shapes carry.

export interface PasswordDialogElements {
  overlay: HTMLElement;
  input: HTMLInputElement;
  confirmButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  errorEl: HTMLElement;
}

// Resolves the typed password on confirm, or null on cancel. A blank
// password shows an inline error and keeps the dialog open rather than
// resolving at all -- setPassword's own server-side refusal for a blank
// password (spec/password.test.ts) is mirrored here so the attempt never
// has to leave the browser to be told it was empty.
export function showSetPasswordDialog(elements: PasswordDialogElements): Promise<string | null> {
  const { overlay, input, confirmButton, cancelButton, errorEl } = elements;
  errorEl.textContent = "";
  input.value = "";
  overlay.hidden = false;
  input.focus();

  return new Promise((resolve) => {
    function cleanup(result: string | null): void {
      overlay.hidden = true;
      confirmButton.removeEventListener("click", onConfirm);
      cancelButton.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onConfirm(): void {
      if (!input.value) {
        errorEl.textContent = "Enter a password first.";
        return;
      }
      cleanup(input.value);
    }
    function onCancel(): void {
      cleanup(null);
    }
    confirmButton.addEventListener("click", onConfirm);
    cancelButton.addEventListener("click", onCancel);
  });
}
