/**
 * The real WanderCraft 14, mirroring playwandercraft.com/creators.
 *
 * Each entry feeds the creator card (image + name + role + platform pills)
 * and the multi-platform live-status dashboard.
 *
 * Fields:
 *   id              slug used in DOM hooks and bio URLs (playwandercraft.com/{id}-bio)
 *   name            display name as shown on the card
 *   role            'FOUNDER' | 'HEAD ADMIN' | 'CREATIVE WANDERER'
 *   mcUsername      Minecraft IGN for skin renderer
 *   twitchUsername  Twitch handle for live polling (decapi.me, no auth needed).
 *                   Set to null when the creator doesn't have a Twitch channel.
 *   youtubeHandle   YouTube channel handle WITHOUT the leading @ (e.g. 'SenseiTalon').
 *                   Used for the channel link. Set to null if they're not on YT.
 *   tiktokHandle    TikTok handle WITHOUT the leading @. Same idea.
 *   youtubeChannelId The UCxxxxxxxx channel ID (NOT the @handle). Used by the
 *                   YouTube RSS feed builder (scripts/build-youtube-feed.mjs)
 *                   to pull the creator's latest videos for the Content
 *                   Dashboard. Find a creator's ID in YouTube Studio →
 *                   Settings → Channel, or via commentpicker.com.
 *                   Set to null to skip pulling videos for that creator.
 *   emote           hover pose name; mapped through EMOTE_POSE_MAP in creatorCard.js
 *
 * Order matches the playwandercraft page: Founders → Head Admin → Creative Wanderers.
 *
 * Handles below are confirmed from the URLs Derek provided. Where a creator
 * doesn't have a channel on a given platform, the field is null and the
 * dashboard hides the pill for that platform automatically.
 */

export const CREATORS = [
  { id: 'senseitalon',  name: 'SenseiTalon',  role: 'FOUNDER',           mcUsername: 'SenseiTalon',  twitchUsername: 'SenseiTalon',           youtubeHandle: 'SenseiTalon', youtubeChannelId: 'UCg969guBVdvlhqzegxPS_tg', tiktokHandle: 'senseitalon_' },
  { id: 'jvshua',       name: 'Jvshua',       role: 'FOUNDER',           mcUsername: 'Jvshua',       twitchUsername: 'jvshualp',     youtubeHandle: 'JvshuaLP', youtubeChannelId: 'UCiHb4WsIO4NFa_2K-dHFfHg', tiktokHandle: 'jvshualp' },
  { id: 'moosted',      name: 'Moosted',      role: 'HEAD ADMIN',        mcUsername: 'Moosted',      twitchUsername: null,           youtubeHandle: null, youtubeChannelId: null, tiktokHandle: null },
  { id: 'K4MPY',        name: 'K4MPY',        role: 'CREATIVE WANDERER', mcUsername: 'K4MPY',        twitchUsername: 'k4mpy',        youtubeHandle: 'K4MPY', youtubeChannelId: 'UCqUgEGSb-Dy2UO8HKojAdDQ', tiktokHandle: 'k4mpyy' },
  { id: 'skertpert',    name: 'skertpert',    role: 'CREATIVE WANDERER', mcUsername: 'skertpert',    twitchUsername: 'skertpert',    youtubeHandle: 'SkertPertt', youtubeChannelId: 'UCJYEH8KAavDDgJfuC9UYDtg', tiktokHandle: 'skertpertt' },
  { id: 'sklump',       name: 'Sklump',       role: 'CREATIVE WANDERER', mcUsername: 'Sklump',       twitchUsername: 'sklump_',      youtubeHandle: 'Sklump', youtubeChannelId: 'UCnoDpA_FqyXaGhzJTFuahOw', tiktokHandle: 'sklump_' },
  { id: 'suuko',        name: 'Suuko',        role: 'CREATIVE WANDERER', mcUsername: 'Suuk0oo',        twitchUsername: null,           youtubeHandle: 'suuko.liv3e', youtubeChannelId: null, tiktokHandle: 'suuko_0' },
  { id: 'xkurosaki',    name: 'xKurosaki',    role: 'CREATIVE WANDERER', mcUsername: 'xKurosaki',    twitchUsername: 'xkurosakiii',  youtubeHandle: 'xkurosakiiii', youtubeChannelId: 'UC4UnbBZU53YCGVBrJZrK9Nw', tiktokHandle: 'xkurosaki' },
  { id: 'zuttz',        name: 'zuttz',        role: 'CREATIVE WANDERER', mcUsername: 'zuttz',        twitchUsername: 'zuuttz',       youtubeHandle: 'zuuttz', youtubeChannelId: 'UCMahYnvRPawRRFFMn4HTWdA', tiktokHandle: 'zuuttz' },
  { id: 'its-k0da',     name: 'its_k0da',     role: 'CREATIVE WANDERER', mcUsername: '_kodaaa_',     twitchUsername: 'its_k0da',     youtubeHandle: 'Its_kodaaa', youtubeChannelId: 'UCumRMH_DIUsTCbnEXI2s3Fg', tiktokHandle: 'its_k0da' },
  { id: 'mossymads',    name: 'MossyMads',    role: 'CREATIVE WANDERER', mcUsername: 'MossyMads',    twitchUsername: 'mossymadsmc',  youtubeHandle: 'MossyMads', youtubeChannelId: 'UCXtqffBwTEmk1ia39TzKnNg', tiktokHandle: 'mossymadsmc' },
  { id: 'maplenate',    name: 'MapleNate',    role: 'CREATIVE WANDERER', mcUsername: 'MapleNate',    twitchUsername: 'maplenateyt',  youtubeHandle: 'MapleNate', youtubeChannelId: 'UCyxRfpWd5MZ7N7ToButHxyg', tiktokHandle: 'maplenateyt' },
  { id: 'shashadivine', name: 'shashadivine', role: 'CREATIVE WANDERER', mcUsername: 'shashadivine', twitchUsername: 'shasha_divine', youtubeHandle: 'ShashaDivine', youtubeChannelId: 'UCZb73SS4E_j6qUI7qDqHM0w', tiktokHandle: 'shashadivine' },
  { id: 'creetchrampage', name: 'CreetchRampage', role: 'CREATIVE WANDERER', mcUsername: 'CreetchRampage', twitchUsername: 'creetchrampage', youtubeHandle: 'CreetchRampage', youtubeChannelId: 'UCqqV91BEDr_0hj9wH0T03fw', tiktokHandle: 'creetchrampage' },
];

/** Role display: keys are the canonical role strings, values style hooks. */
export const ROLE_VARIANTS = {
  'FOUNDER':           'founder',
  'HEAD ADMIN':        'head-admin',
  'CREATIVE WANDERER': 'creative',
};

/** Look up a creator by id. Returns undefined if no match. */
export function getCreator(id) {
  return CREATORS.find((c) => c.id === id);
}
