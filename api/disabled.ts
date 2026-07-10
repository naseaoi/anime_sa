interface ApiResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ApiResponse;
  json(payload: { error: string; message: string }): ApiResponse;
}

export default function handler(_request: unknown, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store');
  return response.status(410).json({
    error: 'Vercel backend disabled',
    message: 'Use the Node.js or Docker deployment.'
  });
}
