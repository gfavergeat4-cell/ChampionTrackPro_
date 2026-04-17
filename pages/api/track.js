export default async function handler(req, res) {
  const { email } = req.query;
  if (email && email.includes('@')) {
    try {
      await fetch(`https://api.champtrackpro.com/webhook/click-tracking?email=${encodeURIComponent(email)}&ts=${Date.now()}`);
    } catch(e) {}
  }
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store');
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.status(200).send(pixel);
}
