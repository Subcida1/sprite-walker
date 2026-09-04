// Parses raw chat messages into structured command objects
function parseCommand(message, username) {
  const trimmed = message.trim();
  if (!trimmed.startsWith('!')) return null;

  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).map(arg => arg.trim().toLowerCase());

  switch (cmd) {
    case 'join':
      const mcUser = args.length > 0 ? args[0] : username;
      return { type: 'JOIN', user: username.toLowerCase(), mcUser };
    case 'leave':
      return { type: 'LEAVE', user: username.toLowerCase() };
    case 'wave':
      return { type: 'WAVE', user: username.toLowerCase() };
    case 'dance':
      return { type: 'DANCE', user: username.toLowerCase() };
    case 'taunt':
      return { type: 'TAUNT', user: username.toLowerCase() };
    case 'left':
      return { type: 'LEFT', user: username.toLowerCase() };
    case 'right':
      return { type: 'RIGHT', user: username.toLowerCase() };
    case 'attack': {
      let target = args.length > 0 ? args[0] : 'nearest';
      if (target.startsWith('@')) target = target.slice(1);
      return { type: 'ATTACK', user: username.toLowerCase(), target };
    }
    case 'ai':
      // Spawns a special AI target user with default Steve skin
      return { type: 'AI_SPAWN', user: username.toLowerCase() };
    case 'slime':
      return { type: 'SLIME_SPAWN', user: username.toLowerCase() };
    case 'creeper':
      return { type: 'CREEPER_SPAWN', user: username.toLowerCase() };
    default:
      return null;
  }
}

module.exports = { parseCommand };