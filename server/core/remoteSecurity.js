import net from 'net';
import dns from 'node:dns';
import { Agent as UndiciAgent } from 'undici';

const isPrivateIpv4 = (host) => {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  if (parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return parts[0] === 192 && parts[1] === 168;
};

const isPrivateIpv6 = (host) => {
  const value = host.toLowerCase();
  return value === '::1' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd');
};

export const isBlockedRemoteHost = (hostname) => {
  const value = String(hostname || '').trim().replace(/\.$/, '').toLowerCase();
  if (!value) return true;
  if (value === 'localhost' || value.endsWith('.localhost') || value.endsWith('.local')) return true;
  const ipVersion = net.isIP(value);
  if (ipVersion === 4) return isPrivateIpv4(value);
  if (ipVersion === 6) return isPrivateIpv6(value);
  return false;
};

const safeDnsLookup = (hostname, optionsValue, callback) => {
  const options = typeof optionsValue === 'number' ? { family: optionsValue } : (optionsValue || {});
  dns.lookup(hostname, {
    all: true,
    family: options.family || 0,
    hints: options.hints,
    verbatim: options.verbatim
  }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses || addresses.length === 0) return callback(new Error('No DNS records'));
    for (const address of addresses) {
      if (isBlockedRemoteHost(address.address)) return callback(new Error(`Blocked private address: ${address.address}`));
    }
    if (options.all) return callback(null, addresses.map((item) => ({ address: item.address, family: item.family })));
    const first = addresses[0];
    return callback(null, first.address, first.family);
  });
};

export const safeFetchAgent = new UndiciAgent({
  connect: { lookup: safeDnsLookup }
});
