export function capitalizeFirstLetter(word: string): string {
  return word[0].toUpperCase() + word.slice(1);
}

export function isAlphaNumeric(value: string): boolean {
  const regex = /^[a-z0-9_]+$/i;
  return regex.test(value);
}

