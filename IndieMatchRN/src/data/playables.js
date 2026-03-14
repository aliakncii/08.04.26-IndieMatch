// src/data/playables.js
// RN equivalent of the web app's src/config.js
// Thumbnails are bundled with require() for use with <Image> components.
// Playable HTML files are served from the document directory after first-launch copy.

export const playables = [
  {
    id: 'p1',
    localPath: 'p1/index.html',  // relative path inside assets/playables/
    gameName: 'Block Blast',
    title: 'Block Blast — Classic Puzzle',
    publisher: 'Hungry Studio',
    creator: 'hungrystudio',
    storeUrl: 'https://apps.apple.com/us/app/block-blast/id1617391485',
    thumbnail: require('../../assets/thumbnails/block-blast.png'),
    likes: '8.2M',
    comments: '54K',
    reposts: '21K',
  },
  {
    id: 'p2',
    localPath: 'p2/index.html',
    gameName: 'Royal Match',
    title: 'Royal Match — Match 3 Adventure',
    publisher: 'Dream Games',
    creator: 'dreamgames',
    storeUrl: 'https://apps.apple.com/us/app/royal-match/id1482155847',
    thumbnail: require('../../assets/thumbnails/royal-match.png'),
    likes: '5.1M',
    comments: '31K',
    reposts: '14K',
  },
  {
    id: 'p4',
    localPath: 'p4/index.html',
    gameName: 'Neon Dodger',
    title: 'Neon Dodger — Survive the Grid',
    publisher: 'Indie Dev',
    creator: 'indiedev',
    storeUrl: 'https://apps.apple.com/us/app/neon-dodger-fake-link',
    thumbnail: require('../../assets/thumbnails/neon-dodger.png'),
    likes: '320K',
    comments: '8.4K',
    reposts: '2.1K',
  },
];
