// @vitest-environment jsdom
import { expect, it } from "vitest";
import { showSetPasswordDialog } from "../src/client/passwordDialog.ts";

// A themed stand-in for a native prompt(), the same reasoning as
// src/client/dialog.ts's showDialog -- an OS-chrome prompt() would break
// out of the game's own visual frame. Separate from showDialog itself
// since it needs an input field and a cancel path neither alert nor
// confirm shapes carry.
function newElements() {
  const overlay = document.createElement("div");
  overlay.hidden = true;
  const input = document.createElement("input");
  const confirmButton = document.createElement("button");
  const cancelButton = document.createElement("button");
  const errorEl = document.createElement("p");
  return { overlay, input, confirmButton, cancelButton, errorEl };
}

it("shows the overlay with the input focused and empty", () => {
  const elements = newElements();
  void showSetPasswordDialog(elements);

  expect(elements.overlay.hidden).toBe(false);
  expect(elements.input.value).toBe("");
});

it("resolves with the typed password on confirm", async () => {
  const elements = newElements();
  const result = showSetPasswordDialog(elements);

  elements.input.value = "mysecret";
  elements.confirmButton.click();

  expect(await result).toBe("mysecret");
  expect(elements.overlay.hidden).toBe(true);
});

it("resolves null on cancel, without clearing what was typed", async () => {
  const elements = newElements();
  const result = showSetPasswordDialog(elements);

  elements.input.value = "abandoned";
  elements.cancelButton.click();

  expect(await result).toBeNull();
  expect(elements.overlay.hidden).toBe(true);
});

it("shows an error message instead of closing when given a blank password", async () => {
  const elements = newElements();
  const result = showSetPasswordDialog(elements);

  elements.input.value = "";
  elements.confirmButton.click();

  expect(elements.overlay.hidden).toBe(false); // still open
  expect(elements.errorEl.textContent).toMatch(/password/i);

  elements.input.value = "nowfilled";
  elements.confirmButton.click();
  expect(await result).toBe("nowfilled");
});

it("clears any previous error once reopened", () => {
  const elements = newElements();
  elements.errorEl.textContent = "leftover from a previous attempt";

  void showSetPasswordDialog(elements);

  expect(elements.errorEl.textContent).toBe("");
});

it("closes on Escape the same as cancel", async () => {
  const elements = newElements();
  const result = showSetPasswordDialog(elements);

  elements.input.value = "abandoned";
  elements.overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

  expect(await result).toBeNull();
  expect(elements.overlay.hidden).toBe(true);
});
