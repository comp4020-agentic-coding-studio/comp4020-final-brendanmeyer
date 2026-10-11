// @vitest-environment jsdom
import { expect, it } from "vitest";
import { showDialog } from "../src/client/dialog.ts";

function newElements() {
  const overlay = document.createElement("div");
  overlay.hidden = true;
  const message = document.createElement("p");
  const confirmButton = document.createElement("button");
  const cancelButton = document.createElement("button");
  return { overlay, message, confirmButton, cancelButton };
}

it("shows the message and only the confirm button for an alert, resolving true on click", async () => {
  const elements = newElements();
  const result = showDialog(elements, "That name is already taken -- pick another.", "alert");

  expect(elements.overlay.hidden).toBe(false);
  expect(elements.message.textContent).toBe("That name is already taken -- pick another.");
  expect(elements.cancelButton.hidden).toBe(true);

  elements.confirmButton.click();
  expect(await result).toBe(true);
  expect(elements.overlay.hidden).toBe(true);
});

it("shows both buttons for a confirm, resolving true on confirm", async () => {
  const elements = newElements();
  const result = showDialog(elements, "Take over and play here instead?", "confirm");

  expect(elements.cancelButton.hidden).toBe(false);

  elements.confirmButton.click();
  expect(await result).toBe(true);
});

it("resolves false when a confirm dialog is cancelled", async () => {
  const elements = newElements();
  const result = showDialog(elements, "Take over and play here instead?", "confirm");

  elements.cancelButton.click();
  expect(await result).toBe(false);
  expect(elements.overlay.hidden).toBe(true);
});

it("ignores a second click once resolved", async () => {
  const elements = newElements();
  const result = showDialog(elements, "message", "confirm");

  elements.confirmButton.click();
  elements.cancelButton.click(); // after resolution -- must not change the outcome
  expect(await result).toBe(true);
});
