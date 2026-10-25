// The app's idea of "today": the device's clock. Everything asks here, so it can't drift apart.

export function today() {
  return new Date();
}
