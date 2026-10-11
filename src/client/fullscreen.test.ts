// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { setupFullscreen } from "./fullscreen.ts";

// A minimal stand-in for Document -- jsdom doesn't implement the Fullscreen
// API itself, and fullscreenElement is a getter-only property on the real
// thing, so a plain fake is easier to drive than patching jsdom's Document.
function fakeDoc(supportsFullscreen: boolean) {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    documentElement: {
      requestFullscreen: supportsFullscreen ? vi.fn().mockResolvedValue(undefined) : undefined,
    },
    fullscreenElement: null as unknown,
    exitFullscreen: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type: string, listener: () => void) => {
      (listeners[type] ??= []).push(listener);
    },
    fire(type: string): void {
      for (const listener of listeners[type] ?? []) listener();
    },
  };
}

function newButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.hidden = true;
  return button;
}

it("stays hidden when the browser has no Fullscreen API", () => {
  const doc = fakeDoc(false);
  const button = newButton();
  setupFullscreen(button, doc as unknown as Document);
  expect(button.hidden).toBe(true);
});

it("reveals the button and requests fullscreen on click", () => {
  const doc = fakeDoc(true);
  const button = newButton();
  setupFullscreen(button, doc as unknown as Document);
  expect(button.hidden).toBe(false);

  button.click();
  expect(doc.documentElement.requestFullscreen).toHaveBeenCalledOnce();
  expect(doc.exitFullscreen).not.toHaveBeenCalled();
});

it("exits fullscreen on click when already fullscreen", () => {
  const doc = fakeDoc(true);
  doc.fullscreenElement = {}; // any truthy value stands in for an element
  const button = newButton();
  setupFullscreen(button, doc as unknown as Document);

  button.click();
  expect(doc.exitFullscreen).toHaveBeenCalledOnce();
  expect(doc.documentElement.requestFullscreen).not.toHaveBeenCalled();
});

it("relabels the button as fullscreen state changes", () => {
  const doc = fakeDoc(true);
  const button = newButton();
  setupFullscreen(button, doc as unknown as Document);

  doc.fullscreenElement = {};
  doc.fire("fullscreenchange");
  expect(button.textContent).toBe("Exit fullscreen");

  doc.fullscreenElement = null;
  doc.fire("fullscreenchange");
  expect(button.textContent).toBe("Fullscreen");
});
