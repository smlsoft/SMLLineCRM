import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';
const API_KEY = process.env.API_KEY ?? '';

async function proxy(req: NextRequest, path: string): Promise<NextResponse> {
  const url = new URL(`/api/v1/${path}`, BACKEND_URL);
  // Forward query params
  req.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  };

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.text()
    : undefined;

  const res = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

type Params = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function POST(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function PUT(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function DELETE(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
export async function PATCH(req: NextRequest, { params }: Params) {
  const { path } = await params;
  return proxy(req, path.join('/'));
}
