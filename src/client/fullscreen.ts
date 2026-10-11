// Touch controls are cramped under a mobile browser's address and toolbar
// chrome; fullscreen reclaims that space. The button stays hidden until we
// know the Fullscreen API exists (older iOS Safari has none for an element
// other than <video>).
export function setupFullscreen(button: HTMLButtonElement, doc: Document = document): void {
  if (!doc.documentElement.requestFullscreen) return;

  button.hidden = false;
  button.addEventListener("click", () => {
    if (doc.fullscreenElement) {
      doc.exitFullscreen();
    } else {
      doc.documentElement.requestFullscreen().catch(() => {});
    }
  });
  doc.addEventListener("fullscreenchange", () => {
    button.textContent = doc.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
  });
}
