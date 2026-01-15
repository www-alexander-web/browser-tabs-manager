export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

export function makeToastId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

