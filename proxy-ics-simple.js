// Simple proxy server for ICS calendar import (bypasses CORS)
// Run with: node proxy-ics-simple.js
// Then the app can call: http://localhost:3001/proxy-ics?url=...

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = 3001;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Only handle GET requests to /proxy-ics
  if (req.method !== 'GET' || !req.url.startsWith('/proxy-ics')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }
  
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url parameter');
      return;
    }
    
    console.log(`[PROXY] Fetching: ${targetUrl}`);
    
    // Use https for https URLs, http for http URLs
    const client = targetUrl.startsWith('https') ? https : http;
    
    client.get(targetUrl, (proxyRes) => {
      // Forward status code
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'text/calendar',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Pipe the response
      proxyRes.pipe(res);
    }).on('error', (err) => {
      console.error('[PROXY] Error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Proxy Error: ${err.message}`);
    });
    
  } catch (error) {
    console.error('[PROXY] Error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Error: ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`✅ ICS Proxy server running on http://localhost:${PORT}`);
  console.log(`   Usage: http://localhost:${PORT}/proxy-ics?url=YOUR_ICS_URL`);
});

