const http = require('http');

const PORT = 3000;

// Utility to parse JSON body from incoming request streams
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  // Set JSON headers and CORS headers for testing flexibility
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle CORS preflight options request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { method, url } = req;
  console.log(`[${new Date().toISOString()}] ${method} ${url}`);

  try {
    // 1. Health check endpoint (for ARIP: Test Connection command)
    if (method === 'GET' && (url === '/health' || url === '/v1/health')) {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', server: 'ARIP Mock Local Engine' }));
      return;
    }

    // 2. Authentication Login endpoint
    if (method === 'POST' && (url === '/auth/login' || url === '/v1/auth/login')) {
      const body = await readRequestBody(req);
      console.log('-> Login request credentials:', body);
      
      // Respond with a dummy JWT and Refresh Token
      res.writeHead(200);
      res.end(JSON.stringify({
        token: 'mock_jwt_access_token_123456789',
        refreshToken: 'mock_jwt_refresh_token_abcdefghi',
        expiresIn: 3600
      }));
      return;
    }

    // 3. Token Refresh endpoint
    if (method === 'POST' && (url === '/auth/refresh' || url === '/v1/auth/refresh')) {
      const body = await readRequestBody(req);
      console.log('-> Token refresh requested:', body);

      res.writeHead(200);
      res.end(JSON.stringify({
        token: 'mock_jwt_access_token_refreshed_987654321',
        refreshToken: 'mock_jwt_refresh_token_abcdefghi'
      }));
      return;
    }

    // 4. Telemetry Batch Ingestion endpoint
    if (method === 'POST' && (url === '/telemetry/batch' || url === '/v1/telemetry/batch')) {
      const authHeader = req.headers['authorization'] || '';
      if (!authHeader.startsWith('Bearer ')) {
        console.warn('! Unauthorized batch request: missing Bearer JWT');
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized credentials required' }));
        return;
      }

      const body = await readRequestBody(req);
      const eventsCount = body.events ? body.events.length : 0;
      
      console.log(`\n=================== RECEIVED TELEMETRY BATCH (${eventsCount} Events) ===================`);
      console.log(`Device ID: ${body.deviceId}`);
      console.log('Events Payload:');
      console.dir(body.events, { depth: null, colors: true });
      console.log('=========================================================================\n');

      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'success',
        processed: eventsCount,
        errors: []
      }));
      return;
    }

    // Endpoint not matched
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint Not Found' }));

  } catch (error) {
    console.error('Error handling request:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`
  🚀 ARIP Mock local server is running!
  Listening on: http://localhost:${PORT}
  
  Set the VS Code setting "arip.backendUrl" to:
  http://localhost:${PORT} (or http://localhost:${PORT}/v1)
  
  Logs will print here in real-time...
  `);
});
