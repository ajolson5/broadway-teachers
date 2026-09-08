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
    tag: 'FSY Guide & Magazine',
    items: [
      {
        title: 'FSY Guide — Chapter 9: You Are Blessed by Priesthood Keys and Authority',
        url: 'https://www.churchofjesuschrist.org/study/ftsoy/2026/09?lang=eng',
        note: "This month's chapter, studied on Fast Sunday (Sept 6)."
      },
      {
        title: 'Week 2 Lesson — Learn more about the restoration of the priesthood',
        url: 'https://www.churchofjesuschrist.org/study/ftsoy/2026/09?lang=eng',
        note: 'From the September FSY magazine, for this Sunday (Sept 13).'
      }
    ]
  },
  challenges: {
    tag: 'This Week',
    items: [
      { text: 'Work with your parents to find and study your line of authority. Maybe consider printing it out for safe keeping.' },
      { text: 'Have your parents order the free FSY magazine subscription or locate it on phone to be able to study during the week.' },
      { text: 'Bring your FSY guide and FSY magazine (for the current month) to church, or bring a device that has access to the Gospel Library App.' },
      { text: "Complete This Week's Reading to come to class prepared (~30 minutes)." }
    ]
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
