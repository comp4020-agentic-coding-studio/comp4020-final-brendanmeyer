// The name/colour entry screen (planning.md section 2: colour is chosen
// "on the name-entry screen"). DOM glue, not business logic -- the server
// is the actual authority on name validity and colour availability
// (claimName/reserve), this just collects a visitor's preference.

import { PLAYER_COLORS } from "../shared/palette.js";
import { getStoredColor, getStoredName } from "./net.js";

export interface EntryResult {
  name: string;
  color: number;
}

export interface EntryElements {
  overlay: HTMLElement;
  nameInput: HTMLInputElement;
  swatchContainer: HTMLElement;
  playButton: HTMLButtonElement;
}

export function collectEntry(elements: EntryElements): Promise<EntryResult> {
  const { overlay, nameInput, swatchContainer, playButton } = elements;
  let selected = getStoredColor() ?? 0;
  nameInput.value = getStoredName() ?? "";

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

  return new Promise((resolve) => {
    playButton.addEventListener("click", () => {
      overlay.hidden = true;
      resolve({ name: nameInput.value, color: selected });
    });
  });
}
