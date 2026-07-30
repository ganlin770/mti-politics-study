export const OPEN_AUTH_DIALOG_EVENT = 'politics-lab:open-auth-dialog';

export function openAuthDialog() {
  window.dispatchEvent(new Event(OPEN_AUTH_DIALOG_EVENT));
}
