/**
 * Generates an echo reply for the customer support chat.
 *
 * @param {string} text - User message text
 * @param {Object|null} user - User object { id, name, email } or null for guest
 * @returns {string}
 */
export function getReply(text, user) {
  if (user && user.name) {
    return `Hi ${user.name}, you said: ${text}`;
  }
  return `Hi guest, you said: ${text}`;
}
