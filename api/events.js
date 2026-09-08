const ical = require('node-ical');
const { put, get } = require('@vercel/blob');

const CACHE_PATHNAME = 'events-cache.json';
const WINDOW_BACK_DAYS = 45;
const WINDOW_FORWARD_DAYS = 90;

function plainValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && 'val' in v) return String(v.val || '');
  return String(v);
}

// Google's ICS export can carry a description as a bare URL, as raw HTML
// (e.g. `<a href="...">...</a>`), or as plain text. Pull any link out into
// its own field so the site can render a real "Open link" button instead of
// showing HTML soup.
function extractLink(rawText) {
  const text = plainValue(rawText);
  if (!text) return { description: '', url: '' };

  const anchorMatch = text.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (anchorMatch) {
    const url = anchorMatch[1].trim();
    const rest = text.replace(anchorMatch[0], '').replace(/<[^>]+>/g, '').trim();
    return { description: rest, url };
  }

  const trimmed = text.replace(/<[^>]+>/g, '').trim();
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return { description: '', url: trimmed };
  }

  return { description: trimmed, url: '' };
}

function toEventRecord(uid, summary, description, location, start, end, isAllDay) {
  const { description: cleanDescription, url } = extractLink(description);
  return {
    id: uid,
    summary: plainValue(summary) || '(untitled event)',
    description: cleanDescription,
    location: plainValue(location),
    url,
    start: start.toISOString(),
    end: (end || start).toISOString(),
    allDay: !!isAllDay
  };
}

function collectEvents(parsed, windowStart, windowEnd) {
  const out = [];
  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== 'VEVENT' || !item.start) continue;

    if (item.rrule) {
      let instances = [];
      try {
        instances = ical.expandRecurringEvent(item, { from: windowStart, to: windowEnd });
      } catch (err) {
        instances = [];
      }
      for (const inst of instances) {
        out.push(toEventRecord(
          item.uid + '::' + inst.start.toISOString(),
          inst.summary != null ? inst.summary : item.summary,
          item.description,
          item.location,
          inst.start,
          inst.end,
          inst.isFullDay
        ));
      }
      continue;
    }

    if (item.start < windowStart || item.start > windowEnd) continue;
    out.push(toEventRecord(
      item.uid,
      item.summary,
      item.description,
      item.location,
      item.start,
      item.end,
      item.datetype === 'date' || item.start.dateOnly
    ));
  }
  out.sort((a, b) => new Date(a.start) - new Date(b.start));
  return out;
}

async function readCache() {
  try {
    const result = await get(CACHE_PATHNAME, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      useCache: false
    });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

async function writeCache(payload) {
  try {
    await put(CACHE_PATHNAME, JSON.stringify(payload), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
  } catch (err) {
    // Best-effort cache; a failure here shouldn't break a successful live fetch.
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const icsUrl = process.env.CALENDAR_ICS_URL;
  if (!icsUrl) {
    return res.status(500).json({ error: 'CALENDAR_ICS_URL is not configured' });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_BACK_DAYS * 86400000);
  const windowEnd = new Date(now.getTime() + WINDOW_FORWARD_DAYS * 86400000);

  try {
    const parsed = await ical.async.fromURL(icsUrl);
    const events = collectEvents(parsed, windowStart, windowEnd);
    const calendarName = (parsed.vcalendar && parsed.vcalendar['WR-CALNAME']) || 'Teachers Quorum Activities';
    const payload = { calendarName, syncedAt: now.toISOString(), events, live: true };
    await writeCache(payload);
    return res.status(200).json(payload);
  } catch (err) {
    const cached = await readCache();
    if (cached) {
      return res.status(200).json({ ...cached, live: false });
    }
    return res.status(502).json({ error: 'Could not reach the calendar, and no cached copy is available.' });
  }
};
