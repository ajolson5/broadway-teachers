const { put, get } = require('@vercel/blob');

const BLOB_PATHNAME = 'content.json';

const DEFAULT_CONTENT = {
  assignments: {
    tag: 'This Sunday',
    rows: [
      { duty: 'Preside / conduct', assigned: 'Bro. Carver', note: 'Quorum adviser' },
      { duty: 'Opening prayer', assigned: 'Ethan', note: '—' },
      { duty: 'Prepare sacrament', assigned: 'Mason, Jake', note: 'Arrive 8:45' },
      { duty: 'Pass sacrament', assigned: 'Tyler, Caleb, Ben', note: 'Rotate rows' },
      { duty: 'Lesson / teaching', assigned: 'Ethan', note: 'Topic: ministering' },
      { duty: 'Closing prayer', assigned: 'Caleb', note: '—' }
    ]
  },
  reading: {
    tag: 'Come, Follow Me',
    reference: "Sample reference — confirm this week's actual assignment",
    title: 'Doctrine & Covenants 84',
    verse: '…seek not the things of this world but seek ye first to build up the kingdom of God…',
    question: 'Discussion question: what does it look like to hold the priesthood "in remembrance" this week?'
  },
  skills: {
    tag: 'Quorum goals',
    items: [
      { status: 'done', title: 'Prepare & pass the sacrament reverently', note: 'Practiced Sept 2 — most of quorum comfortable now' },
      { status: 'doing', title: 'Teach a 10-minute gospel lesson', note: 'Ethan going this week, Mason next' },
      { status: 'doing', title: 'Plan & lead a quorum activity', note: 'Caleb planning the Sept 16 service prep night' },
      { status: 'todo', title: 'Have a ministering conversation', note: 'Not started' }
    ]
  },
  projects: {
    tag: 'Ongoing',
    items: [
      { status: 'active', title: 'Widow lawn care rotation', note: 'Weekly mowing for Sis. Hargrove — Jake & Tyler on rotation through October.' },
      { status: 'planning', title: 'Food pantry drive', note: 'Collecting canned goods at the Sept 16 activity for the ward pantry shelf.' },
      { status: 'done', title: 'Eagle project support', note: 'Quorum helped Ben finish his trail-marker project in August.' }
    ]
  },
  updatedAt: null
};

async function readContent() {
  try {
    const result = await get(BLOB_PATHNAME, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      useCache: false
    });
    if (!result || result.statusCode !== 200) return DEFAULT_CONTENT;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (err) {
    return DEFAULT_CONTENT;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const content = await readContent();
    return res.status(200).json(content);
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const { code, content } = body || {};

    if (code !== process.env.EDIT_CODE) {
      return res.status(401).json({ ok: false, error: 'Incorrect code' });
    }

    if (!content) {
      // Verify-only request, used to unlock the edit UI without saving anything.
      return res.status(200).json({ ok: true });
    }

    const payload = JSON.stringify({ ...content, updatedAt: new Date().toISOString() });
    await put(BLOB_PATHNAME, payload, {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
