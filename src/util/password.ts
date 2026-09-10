export interface PasswordValidity {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export function checkPassword(p: string): PasswordValidity {
  return {
    length: p.length >= 8,
    uppercase: /[A-Z]/.test(p),
    lowercase: /[a-z]/.test(p),
    number: /[0-9]/.test(p),
    special: /[^A-Za-z0-9]/.test(p),
  };
}

export function isPasswordValid(validity: PasswordValidity): boolean {
  return (
    validity.length &&
    validity.uppercase &&
    validity.lowercase &&
    validity.number &&
    validity.special
  );
}
