import { describe, expect, it, vi } from 'vitest';
import disabledHandler from './disabled';
import sqliteHandler from './sqlite';
import webdavHandler from './webdav';

const createResponse = () => {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn()
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
};

describe('disabled Vercel handlers', () => {
  it.each([
    ['disabled', disabledHandler],
    ['sqlite', sqliteHandler],
    ['webdav', webdavHandler]
  ])('returns 410 from %s handler', (_name, handler) => {
    const response = createResponse();
    handler({} as never, response as never);

    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.status).toHaveBeenCalledWith(410);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Vercel backend disabled' }));
  });
});
