import {
  buildPoliticsAiMessages,
  gatewayEndpoint,
  isCanonicalPoliticsAiCard,
  parseAllowedUserIds,
  parseDefaultPublishableKey,
  parseGatewayAnswer,
  parsePoliticsAiRequest,
  POLITICS_AI_MAX_TOKENS,
  type PoliticsAiEffort,
  type PoliticsAiMode,
  RequestValidationError,
  resolveGatewayRouting,
} from "../_shared/politics-ai.ts";

interface DenoRuntime {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
}

interface QuotaRow {
  allowed: boolean;
  minute_count: number;
  daily_count: number;
  retry_after_seconds: number;
}

const denoRuntime =
  (globalThis as typeof globalThis & { Deno: DenoRuntime }).Deno;
const ALLOWED_ORIGINS = new Set([
  "https://ganlin770.github.io",
  "http://127.0.0.1:4174",
  "http://localhost:4174",
]);
const MAX_BODY_BYTES = 32_768;
const MAX_UPSTREAM_BYTES = 131_072;
const TIMEOUT_BY_EFFORT: Record<PoliticsAiEffort, number> = {
  low: 45_000,
  high: 75_000,
  max: 110_000,
};

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function jsonResponse(
  origin: string,
  status: number,
  body: Record<string, unknown>,
  headers?: HeadersInit,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(origin ? corsHeaders(origin) : { "Vary": "Origin" }),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function errorResponse(
  origin: string,
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
) {
  return jsonResponse(origin, status, { code, message }, headers);
}

function env(name: string) {
  return denoRuntime.env.get(name)?.trim() || "";
}

function validServerApiKey(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.length <= 8_192 && !/\s/.test(normalized) ? normalized : "";
}

function supabasePublishableKey() {
  const legacy = validServerApiKey(env("SUPABASE_ANON_KEY")) ||
    validServerApiKey(env("SUPABASE_PUBLISHABLE_KEY"));
  if (legacy) return legacy;
  return validServerApiKey(
    parseDefaultPublishableKey(env("SUPABASE_PUBLISHABLE_KEYS")),
  );
}

function validAuthorization(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() || "";
  if (
    authorization.length > 4_096 ||
    !/^Bearer\s+[A-Za-z0-9._~-]+$/i.test(authorization)
  ) return "";
  return authorization;
}

async function readJsonBody(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) {
    throw new RequestValidationError();
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new RequestValidationError();
  }
  const raw = await readLimitedText(request.body, MAX_BODY_BYTES);
  if (!raw) {
    throw new RequestValidationError();
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new RequestValidationError();
  }
}

async function readLimitedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
) {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new RequestValidationError();
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(combined);
  } catch {
    throw new RequestValidationError();
  }
}

async function authenticatedUserId(
  supabaseUrl: string,
  supabaseApiKey: string,
  authorization: string,
) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: { apikey: supabaseApiKey, authorization },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null) as unknown;
  if (
    !body || typeof body !== "object" || !("id" in body) ||
    typeof body.id !== "string"
  ) return null;
  return body.id;
}

async function claimQuota(
  supabaseUrl: string,
  supabaseApiKey: string,
  authorization: string,
  requestId: string,
  mode: PoliticsAiMode,
  effort: PoliticsAiEffort,
) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/politics_claim_ai_quota`,
    {
      method: "POST",
      headers: {
        apikey: supabaseApiKey,
        authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_request_id: requestId,
        p_mode: mode,
        p_effort: effort,
      }),
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error("quota service unavailable");
  const rows = await response.json().catch(() => null) as unknown;
  if (!Array.isArray(rows) || !rows[0] || typeof rows[0] !== "object") {
    throw new Error("quota service unavailable");
  }
  const row = rows[0] as Partial<QuotaRow>;
  if (typeof row.allowed !== "boolean") {
    throw new Error("quota service unavailable");
  }
  return {
    allowed: row.allowed,
    retryAfterSeconds: Math.max(
      1,
      Math.min(86_400, Number(row.retry_after_seconds) || 1),
    ),
  };
}

async function handleRequest(request: Request) {
  const origin = request.headers.get("origin") || "";
  if (!ALLOWED_ORIGINS.has(origin)) {
    return errorResponse(
      "",
      403,
      "origin_forbidden",
      "当前来源不允许访问 AI 服务。",
    );
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return errorResponse(
      origin,
      405,
      "method_not_allowed",
      "仅支持 POST 请求。",
      { Allow: "POST, OPTIONS" },
    );
  }

  const authorization = validAuthorization(request);
  if (!authorization) {
    return errorResponse(
      origin,
      401,
      "auth_required",
      "请先登录后使用 AI 讲解。",
    );
  }

  const supabaseUrl = env("SUPABASE_URL").replace(/\/+$/, "");
  const supabaseApiKey = supabasePublishableKey();
  const gatewayUrl = env("POLITICS_AI_GATEWAY_URL");
  const gatewayKey = env("POLITICS_AI_GATEWAY_KEY");
  const configuredModel = env("POLITICS_AI_MODEL") || "kimi-k3";
  const allowedUserIds = parseAllowedUserIds(
    env("POLITICS_AI_ALLOWED_USER_IDS"),
  );
  if (
    !supabaseUrl || !supabaseApiKey || !gatewayUrl || !gatewayKey ||
    !/^https:\/\//.test(supabaseUrl) || allowedUserIds.size === 0
  ) {
    return errorResponse(
      origin,
      503,
      "service_unavailable",
      "AI 服务尚未完成安全配置。",
    );
  }
  if (!/^[A-Za-z0-9._:/-]{1,120}$/.test(configuredModel)) {
    return errorResponse(
      origin,
      503,
      "service_unavailable",
      "AI 服务尚未完成安全配置。",
    );
  }

  let input;
  try {
    input = parsePoliticsAiRequest(await readJsonBody(request));
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return errorResponse(
        origin,
        400,
        "invalid_request",
        "请求内容不完整或超出长度限制。",
      );
    }
    return errorResponse(origin, 400, "invalid_request", "请求内容无法解析。");
  }

  let userId: string | null;
  try {
    userId = await authenticatedUserId(
      supabaseUrl,
      supabaseApiKey,
      authorization,
    );
  } catch {
    return errorResponse(
      origin,
      503,
      "service_unavailable",
      "登录状态暂时无法验证，请稍后重试。",
    );
  }
  if (!userId) {
    return errorResponse(
      origin,
      401,
      "auth_required",
      "登录已失效，请重新登录。",
    );
  }
  if (!allowedUserIds.has(userId)) {
    return errorResponse(
      origin,
      403,
      "access_denied",
      "当前账号未开通 AI 使用权限。",
    );
  }

  if (!(await isCanonicalPoliticsAiCard(input.card))) {
    return errorResponse(
      origin,
      400,
      "invalid_request",
      "当前卡片版本无法核验，请刷新页面后重试。",
    );
  }

  const requestId = crypto.randomUUID();
  try {
    const quota = await claimQuota(
      supabaseUrl,
      supabaseApiKey,
      authorization,
      requestId,
      input.mode,
      input.effort,
    );
    if (!quota.allowed) {
      return errorResponse(
        origin,
        429,
        "quota_exceeded",
        "AI 使用较频繁，请稍后再试。",
        { "Retry-After": String(quota.retryAfterSeconds) },
      );
    }
  } catch {
    return errorResponse(
      origin,
      503,
      "service_unavailable",
      "AI 配额服务暂时不可用，请稍后重试。",
    );
  }

  let endpoint: string;
  try {
    endpoint = gatewayEndpoint(gatewayUrl);
  } catch {
    return errorResponse(
      origin,
      503,
      "service_unavailable",
      "AI 服务尚未完成安全配置。",
    );
  }

  const startedAt = Date.now();
  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: configuredModel,
        messages: buildPoliticsAiMessages(input),
        reasoning_effort: input.effort,
        max_tokens: POLITICS_AI_MAX_TOKENS[input.effort],
        stream: false,
      }),
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(TIMEOUT_BY_EFFORT[input.effort]),
      ]),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return errorResponse(
          origin,
          429,
          "upstream_unavailable",
          "AI 服务当前繁忙，请稍后重试。",
        );
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return errorResponse(
          origin,
          503,
          "service_unavailable",
          "AI 服务鉴权配置异常。",
        );
      }
      return errorResponse(
        origin,
        502,
        "upstream_unavailable",
        "AI 暂时未能完成回答，请重试。",
      );
    }

    const gatewayBody = JSON.parse(
      await readLimitedText(upstream.body, MAX_UPSTREAM_BYTES),
    ) as unknown;
    const parsed = parseGatewayAnswer(gatewayBody);
    const rawFallbackModel =
      upstream.headers.get("x-ganlin-fallback-model")?.trim() || "";
    const rawFallbackFrom =
      upstream.headers.get("x-ganlin-fallback-from")?.trim() || "";
    const routing = resolveGatewayRouting(
      configuredModel,
      parsed.model,
      rawFallbackModel,
      rawFallbackFrom,
    );
    return jsonResponse(origin, 200, {
      requestId,
      cardId: input.card.id,
      effort: input.effort,
      model: routing.model,
      answer: parsed.answer,
      ...(routing.fallbackFrom ? { fallbackFrom: routing.fallbackFrom } : {}),
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (request.signal.aborted) {
      return errorResponse(
        origin,
        499,
        "request_aborted",
        "本次 AI 请求已取消。",
      );
    }
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return errorResponse(
        origin,
        504,
        "upstream_timeout",
        "AI 思考超时，请重试或降低思考档位。",
      );
    }
    return errorResponse(
      origin,
      502,
      "upstream_unavailable",
      "AI 暂时未能完成回答，请重试。",
    );
  }
}

denoRuntime.serve(handleRequest);
