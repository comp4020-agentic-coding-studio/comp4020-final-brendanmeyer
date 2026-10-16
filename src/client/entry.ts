// The name/colour entry screen (planning.md section 2: colour is chosen
// "on the name-entry screen"). DOM glue, not business logic -- the server
// is the actual authority on name validity and colour availability
// (claimName/reserve), this just collects a visitor's preference.

import { PLAYER_COLORS } from "../shared/palette.js";
import { getStoredColor, getStoredName, getStoredToken } from "./net.js";

export interface EntryResult {
  name: string;
  color: number;
  password: string;
}

export interface EntryElements {
  nameInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  swatchContainer: HTMLElement;
  playButton: HTMLButtonElement;
}

export function collectEntry(elements: EntryElements): Promise<EntryResult> {
  const { nameInput, passwordInput, swatchContainer, playButton } = elements;
  let selected = getStoredColor() ?? 0;
  nameInput.value = getStoredName() ?? "";
  // Never persisted or pre-filled, unlike name/colour -- it's only ever
  // needed when retrieving a name from a device that doesn't already hold
  // its reconnect token, so there's nothing to usefully remember here.
  passwordInput.value = "";
  // A stored token means this browser already *is* that identity -- the
  // password field exists only to retrieve one from a device that isn't,
  // so once a token's already held it has nothing left to do here.
  passwordInput.hidden = getStoredToken() !== undefined;

  const buttons = PLAYER_COLORS.map((hex, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.style.background = hex;
    button.setAttribute("aria-label", `Colour ${index + 1}`);
    if (index === selected) button.style.outline = "2px solid white";
    button.addEventListener("click", () => {
      selected = index;
      buttons.forEach((b) => (b.style.outline = ""));
      button.style.outline = "2px solid white";
    });
    swatchContainer.appendChild(button);
    return button;
  });

  // Deliberately doesn't hide the entry overlay itself -- the hello sent in
  // response to this can still come back "already taken" or "already
  // playing elsewhere", which needs to be shown on this screen, not over a
  // game the visitor never actually entered. The caller hides the overlay
  // once a real identity is confirmed.
  return new Promise((resolve) => {
    playButton.addEventListener("click", () => {
      resolve({ name: nameInput.value, color: selected, password: passwordInput.value });
    });
  });
}
