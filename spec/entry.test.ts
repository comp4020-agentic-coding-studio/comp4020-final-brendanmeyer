// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { collectEntry } from "../src/client/entry.ts";

// Mirrors net.ts's own TOKEN_KEY -- a stored token is exactly what makes a
// returning visitor "already logged in": the password field only exists to
// retrieve a name from a device that doesn't already hold its token, so
// once one's already stored there's nothing for it to do here.
const TOKEN_KEY = "collective-snake-token";

function newElements() {
  const nameInput = document.createElement("input");
  const passwordInput = document.createElement("input");
  const swatchContainer = document.createElement("div");
  const playButton = document.createElement("button");
  return { nameInput, passwordInput, swatchContainer, playButton };
}

beforeEach(() => {
  localStorage.clear();
});

it("shows the password field for a fresh visitor with no stored identity", () => {
  const elements = newElements();
  void collectEntry(elements);

  expect(elements.passwordInput.hidden).toBe(false);
});

it("hides the password field once this browser already holds a reconnect token", () => {
  localStorage.setItem(TOKEN_KEY, "some-existing-token");
  const elements = newElements();
  void collectEntry(elements);

  expect(elements.passwordInput.hidden).toBe(true);
});
