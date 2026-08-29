export function ticketPrefix(source: string): string {
  const letter = source.replace(/[^a-zA-Z]/g, "").charAt(0);
  return (letter || "Q").toUpperCase();
}

export function formatTicketNumber(source: string, tokenNumber: number): string {
  return `${ticketPrefix(source)}-${String(tokenNumber).padStart(3, "0")}`;
}
