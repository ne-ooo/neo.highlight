/* -------------------------------------------------------------------------------------------------
 * Benchmark Fixtures — Realistic code samples in JS, Python, and HTML
 *
 * Each language has 3 sizes:
 *   - small  (~100 chars)
 *   - medium (~1KB)
 *   - large  (~10KB)
 * -----------------------------------------------------------------------------------------------*/

// ---------------------------------------------------------------------------
// JavaScript
// ---------------------------------------------------------------------------

export const JS_SMALL = `const greet = (name) => \`Hello, \${name}!\`;
console.log(greet("world"));`;

export const JS_MEDIUM = `/**
 * EventEmitter — A lightweight publish/subscribe implementation.
 * Supports typed events, once listeners, and wildcard patterns.
 */
class EventEmitter {
  #listeners = new Map();
  #maxListeners = 10;

  constructor(options = {}) {
    this.#maxListeners = options.maxListeners ?? 10;
  }

  on(event, listener) {
    if (typeof listener !== "function") {
      throw new TypeError(\`Listener must be a function, got \${typeof listener}\`);
    }

    const listeners = this.#listeners.get(event) ?? [];
    if (listeners.length >= this.#maxListeners) {
      console.warn(\`MaxListenersExceeded: \${event} has \${listeners.length} listeners\`);
    }
    listeners.push(listener);
    this.#listeners.set(event, listeners);
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      listener.apply(this, args);
    };
    wrapper._original = listener;
    return this.on(event, wrapper);
  }

  off(event, listener) {
    const listeners = this.#listeners.get(event);
    if (!listeners) return this;

    const index = listeners.findIndex(
      (fn) => fn === listener || fn._original === listener,
    );
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    if (listeners.length === 0) {
      this.#listeners.delete(event);
    }
    return this;
  }

  emit(event, ...args) {
    const listeners = this.#listeners.get(event);
    if (!listeners || listeners.length === 0) return false;

    for (const listener of [...listeners]) {
      try {
        listener.apply(this, args);
      } catch (err) {
        console.error(\`Error in listener for "\${event}":\`, err);
      }
    }
    return true;
  }

  listenerCount(event) {
    return this.#listeners.get(event)?.length ?? 0;
  }

  removeAllListeners(event) {
    if (event !== undefined) {
      this.#listeners.delete(event);
    } else {
      this.#listeners.clear();
    }
    return this;
  }
}

// Usage
const emitter = new EventEmitter({ maxListeners: 5 });

emitter.on("data", (chunk) => {
  const size = chunk.byteLength ?? chunk.length;
  console.log(\`Received \${size} bytes\`);
});

emitter.once("end", () => {
  console.log("Stream finished");
});

const MAGIC_NUMBER = 0xFF_FF;
const isValid = /^[a-zA-Z_$][\\w$]*$/.test("hello");
const ratio = 3.14159e2;
`;

export const JS_LARGE = `/**
 * Router — A high-performance HTTP router with radix tree matching.
 * Supports path parameters, wildcards, middleware, and typed handlers.
 */

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
const PARAM_REGEX = /^:([a-zA-Z_][a-zA-Z0-9_]*)$/;
const WILDCARD = "*";

class RouteNode {
  #children = new Map();
  #paramChild = null;
  #wildcardChild = null;
  #handlers = new Map();
  #middleware = [];

  constructor(segment = "") {
    this.segment = segment;
  }

  insert(segments, method, handler, middleware = []) {
    if (segments.length === 0) {
      this.#handlers.set(method, handler);
      this.#middleware.push(...middleware);
      return;
    }

    const [current, ...rest] = segments;

    if (current === WILDCARD) {
      if (!this.#wildcardChild) {
        this.#wildcardChild = new RouteNode(WILDCARD);
      }
      this.#wildcardChild.insert(rest, method, handler, middleware);
      return;
    }

    const paramMatch = PARAM_REGEX.exec(current);
    if (paramMatch) {
      if (!this.#paramChild) {
        this.#paramChild = new RouteNode(paramMatch[1]);
      }
      this.#paramChild.insert(rest, method, handler, middleware);
      return;
    }

    let child = this.#children.get(current);
    if (!child) {
      child = new RouteNode(current);
      this.#children.set(current, child);
    }
    child.insert(rest, method, handler, middleware);
  }

  find(segments, method, params = {}) {
    if (segments.length === 0) {
      const handler = this.#handlers.get(method);
      if (handler) {
        return { handler, params, middleware: [...this.#middleware] };
      }
      return null;
    }

    const [current, ...rest] = segments;

    // Exact match first (fastest path)
    const exactChild = this.#children.get(current);
    if (exactChild) {
      const result = exactChild.find(rest, method, params);
      if (result) return result;
    }

    // Parameter match
    if (this.#paramChild) {
      const paramResult = this.#paramChild.find(rest, method, {
        ...params,
        [this.#paramChild.segment]: current,
      });
      if (paramResult) return paramResult;
    }

    // Wildcard match (last resort)
    if (this.#wildcardChild) {
      const wildcardResult = this.#wildcardChild.find([], method, {
        ...params,
        "*": segments.join("/"),
      });
      if (wildcardResult) return wildcardResult;
    }

    return null;
  }
}

class Router {
  #root = new RouteNode();
  #globalMiddleware = [];
  #notFoundHandler = null;
  #errorHandler = null;

  use(...middleware) {
    for (const mw of middleware) {
      if (typeof mw !== "function") {
        throw new TypeError(\`Middleware must be a function, got \${typeof mw}\`);
      }
    }
    this.#globalMiddleware.push(...middleware);
    return this;
  }

  #addRoute(method, path, ...handlers) {
    if (typeof path !== "string" || !path.startsWith("/")) {
      throw new Error(\`Invalid path: "\${path}". Paths must start with "/"\`);
    }

    const segments = path.split("/").filter(Boolean);
    const handler = handlers.pop();
    const middleware = handlers;

    if (typeof handler !== "function") {
      throw new TypeError("Route handler must be a function");
    }

    this.#root.insert(segments, method, handler, middleware);
    return this;
  }

  get(path, ...handlers) { return this.#addRoute("GET", path, ...handlers); }
  post(path, ...handlers) { return this.#addRoute("POST", path, ...handlers); }
  put(path, ...handlers) { return this.#addRoute("PUT", path, ...handlers); }
  delete(path, ...handlers) { return this.#addRoute("DELETE", path, ...handlers); }
  patch(path, ...handlers) { return this.#addRoute("PATCH", path, ...handlers); }

  async handle(request) {
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const method = request.method.toUpperCase();

    const match = this.#root.find(segments, method);

    if (!match) {
      if (this.#notFoundHandler) {
        return this.#notFoundHandler(request);
      }
      return new Response("Not Found", { status: 404 });
    }

    const { handler, params, middleware } = match;
    const allMiddleware = [...this.#globalMiddleware, ...middleware];

    const context = {
      request,
      params,
      query: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(request.headers),
      url,
    };

    try {
      // Execute middleware chain
      for (const mw of allMiddleware) {
        const result = await mw(context);
        if (result instanceof Response) return result;
      }

      const result = await handler(context);

      if (result instanceof Response) return result;
      if (typeof result === "string") {
        return new Response(result, {
          headers: { "Content-Type": "text/plain" },
        });
      }
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      if (this.#errorHandler) {
        return this.#errorHandler(err, context);
      }
      console.error("Unhandled route error:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  onNotFound(handler) {
    this.#notFoundHandler = handler;
    return this;
  }

  onError(handler) {
    this.#errorHandler = handler;
    return this;
  }
}

// --- Middleware ---

function cors(options = {}) {
  const {
    origin = "*",
    methods = HTTP_METHODS,
    headers = ["Content-Type", "Authorization"],
    credentials = false,
    maxAge = 86400,
  } = options;

  return async (ctx) => {
    const requestOrigin = ctx.headers["origin"] ?? "";

    const allowedOrigin =
      typeof origin === "function" ? await origin(requestOrigin) : origin;

    if (ctx.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": methods.join(", "),
          "Access-Control-Allow-Headers": headers.join(", "),
          "Access-Control-Max-Age": String(maxAge),
          ...(credentials && { "Access-Control-Allow-Credentials": "true" }),
        },
      });
    }
  };
}

function rateLimit(options = {}) {
  const {
    windowMs = 60_000,
    max = 100,
    message = "Too Many Requests",
    keyGenerator = (ctx) => ctx.headers["x-forwarded-for"] ?? "unknown",
  } = options;

  const hits = new Map();
  const CLEANUP_INTERVAL = 60_000;

  // Periodic cleanup to prevent memory leaks
  let lastCleanup = Date.now();

  return async (ctx) => {
    const now = Date.now();

    // Cleanup old entries periodically
    if (now - lastCleanup > CLEANUP_INTERVAL) {
      for (const [key, entry] of hits) {
        if (now - entry.start > windowMs) {
          hits.delete(key);
        }
      }
      lastCleanup = now;
    }

    const key = keyGenerator(ctx);
    const entry = hits.get(key) ?? { count: 0, start: now };

    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }

    entry.count++;
    hits.set(key, entry);

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
      return new Response(message, {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((entry.start + windowMs) / 1000)),
        },
      });
    }
  };
}

function logger() {
  return async (ctx) => {
    const start = performance.now();
    const method = ctx.request.method;
    const path = ctx.url.pathname;

    console.log(\`--> \${method} \${path}\`);

    // Continue to handler, then log after
    setTimeout(() => {
      const ms = (performance.now() - start).toFixed(2);
      console.log(\`<-- \${method} \${path} \${ms}ms\`);
    }, 0);
  };
}

// --- Application ---

const router = new Router();

router.use(
  cors({ origin: "https://example.com", credentials: true }),
  rateLimit({ max: 200, windowMs: 120_000 }),
  logger(),
);

router.get("/", () => ({ message: "Hello, World!", timestamp: Date.now() }));

router.get("/users/:id", async (ctx) => {
  const userId = parseInt(ctx.params.id, 10);
  if (Number.isNaN(userId) || userId <= 0) {
    return new Response(JSON.stringify({ error: "Invalid user ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { id: userId, name: \`User #\${userId}\`, active: true };
});

router.post("/users", async (ctx) => {
  const body = await ctx.request.json();
  const { name, email } = body;

  if (!name || !email) {
    return new Response(
      JSON.stringify({ error: "Name and email are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const id = Math.floor(Math.random() * 1_000_000);
  return { id, name, email, createdAt: new Date().toISOString() };
});

router.get("/health", () => ({
  status: "ok",
  uptime: process.uptime(),
  memory: process.memoryUsage(),
  version: "1.0.0",
}));

router.get("/files/*", (ctx) => {
  const filePath = ctx.params["*"];
  return { file: filePath, exists: true };
});

router.onNotFound(() => {
  return new Response(
    JSON.stringify({ error: "Route not found", code: "NOT_FOUND" }),
    { status: 404, headers: { "Content-Type": "application/json" } },
  );
});

router.onError((err, ctx) => {
  console.error(\`Error handling \${ctx.request.method} \${ctx.url.pathname}:\`, err);
  return new Response(
    JSON.stringify({ error: "Internal server error", code: "INTERNAL_ERROR" }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );
});

export { Router, cors, rateLimit, logger };
`;

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

export const PYTHON_SMALL = `def greet(name: str) -> str:
    return f"Hello, {name}!"

print(greet("world"))`;

export const PYTHON_MEDIUM = `"""
Task queue — A lightweight async task processor with retry support.
Supports priority queues, dead-letter handling, and concurrency limits.
"""

import asyncio
import time
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class TaskResult:
    task_id: str
    status: TaskStatus
    result: Any = None
    error: str | None = None
    duration_ms: float = 0.0
    attempts: int = 0


@dataclass(order=True)
class Task:
    priority: int
    task_id: str = field(compare=False)
    fn: Callable[..., Awaitable[Any]] = field(compare=False)
    args: tuple = field(default_factory=tuple, compare=False)
    kwargs: dict = field(default_factory=dict, compare=False)
    max_retries: int = field(default=3, compare=False)
    retry_delay: float = field(default=1.0, compare=False)


class TaskQueue:
    def __init__(self, concurrency: int = 4, max_queue_size: int = 1000):
        self._queue: asyncio.PriorityQueue[Task] = asyncio.PriorityQueue(
            maxsize=max_queue_size,
        )
        self._concurrency = concurrency
        self._results: dict[str, TaskResult] = {}
        self._workers: list[asyncio.Task] = []
        self._running = False
        self._processed = 0

    async def enqueue(
        self,
        task_id: str,
        fn: Callable[..., Awaitable[Any]],
        *args: Any,
        priority: int = 0,
        max_retries: int = 3,
        **kwargs: Any,
    ) -> None:
        task = Task(
            priority=priority,
            task_id=task_id,
            fn=fn,
            args=args,
            kwargs=kwargs,
            max_retries=max_retries,
        )
        await self._queue.put(task)
        logger.info(f"Enqueued task {task_id} with priority {priority}")

    async def _worker(self, worker_id: int) -> None:
        while self._running:
            try:
                task = await asyncio.wait_for(
                    self._queue.get(), timeout=1.0,
                )
            except asyncio.TimeoutError:
                continue

            result = await self._execute(task, worker_id)
            self._results[task.task_id] = result
            self._processed += 1
            self._queue.task_done()

    async def _execute(self, task: Task, worker_id: int) -> TaskResult:
        for attempt in range(1, task.max_retries + 1):
            start = time.perf_counter()
            try:
                result = await task.fn(*task.args, **task.kwargs)
                duration = (time.perf_counter() - start) * 1000
                logger.info(
                    f"Worker {worker_id}: Task {task.task_id} "
                    f"completed in {duration:.2f}ms"
                )
                return TaskResult(
                    task_id=task.task_id,
                    status=TaskStatus.COMPLETED,
                    result=result,
                    duration_ms=duration,
                    attempts=attempt,
                )
            except Exception as exc:
                duration = (time.perf_counter() - start) * 1000
                logger.warning(
                    f"Worker {worker_id}: Task {task.task_id} "
                    f"failed (attempt {attempt}/{task.max_retries}): {exc}"
                )
                if attempt < task.max_retries:
                    await asyncio.sleep(task.retry_delay * attempt)

        return TaskResult(
            task_id=task.task_id,
            status=TaskStatus.FAILED,
            error="Max retries exceeded",
            duration_ms=duration,
            attempts=task.max_retries,
        )

    async def start(self) -> None:
        self._running = True
        self._workers = [
            asyncio.create_task(self._worker(i))
            for i in range(self._concurrency)
        ]
        logger.info(f"Started {self._concurrency} workers")

    async def stop(self) -> None:
        self._running = False
        await asyncio.gather(*self._workers, return_exceptions=True)
        logger.info(f"Stopped. Processed {self._processed} tasks")

    def get_result(self, task_id: str) -> TaskResult | None:
        return self._results.get(task_id)

    @property
    def pending_count(self) -> int:
        return self._queue.qsize()

    @property
    def processed_count(self) -> int:
        return self._processed
`;

export const PYTHON_LARGE = `"""
HTTP Framework — A minimal async web framework with routing and middleware.
Designed for high performance with zero external dependencies.
"""

import asyncio
import json
import re
import time
import logging
import traceback
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import (
    Any,
    Awaitable,
    Callable,
    Protocol,
    TypeVar,
    runtime_checkable,
)
from urllib.parse import parse_qs, urlparse
from http import HTTPStatus

logger = logging.getLogger(__name__)

T = TypeVar("T")


class HttpMethod(Enum):
    GET = auto()
    POST = auto()
    PUT = auto()
    DELETE = auto()
    PATCH = auto()
    HEAD = auto()
    OPTIONS = auto()


@dataclass
class Headers:
    _data: dict[str, list[str]] = field(default_factory=dict)

    def get(self, key: str, default: str | None = None) -> str | None:
        values = self._data.get(key.lower())
        return values[0] if values else default

    def get_all(self, key: str) -> list[str]:
        return self._data.get(key.lower(), [])

    def set(self, key: str, value: str) -> None:
        self._data[key.lower()] = [value]

    def append(self, key: str, value: str) -> None:
        self._data.setdefault(key.lower(), []).append(value)

    def __contains__(self, key: str) -> bool:
        return key.lower() in self._data

    def items(self):
        for key, values in self._data.items():
            for value in values:
                yield key, value


@dataclass
class Request:
    method: HttpMethod
    path: str
    headers: Headers
    query: dict[str, list[str]]
    body: bytes = b""
    params: dict[str, str] = field(default_factory=dict)
    state: dict[str, Any] = field(default_factory=dict)

    @property
    def content_type(self) -> str | None:
        return self.headers.get("content-type")

    async def json(self) -> Any:
        if not self.body:
            raise ValueError("Request body is empty")
        return json.loads(self.body.decode("utf-8"))

    async def text(self) -> str:
        return self.body.decode("utf-8")

    @property
    def is_json(self) -> bool:
        ct = self.content_type
        return ct is not None and "application/json" in ct


@dataclass
class Response:
    status: int = 200
    headers: Headers = field(default_factory=Headers)
    body: bytes = b""

    @classmethod
    def json(cls, data: Any, status: int = 200) -> "Response":
        body = json.dumps(data, default=str).encode("utf-8")
        resp = cls(status=status, body=body)
        resp.headers.set("content-type", "application/json; charset=utf-8")
        resp.headers.set("content-length", str(len(body)))
        return resp

    @classmethod
    def text(cls, text: str, status: int = 200) -> "Response":
        body = text.encode("utf-8")
        resp = cls(status=status, body=body)
        resp.headers.set("content-type", "text/plain; charset=utf-8")
        resp.headers.set("content-length", str(len(body)))
        return resp

    @classmethod
    def html(cls, html: str, status: int = 200) -> "Response":
        body = html.encode("utf-8")
        resp = cls(status=status, body=body)
        resp.headers.set("content-type", "text/html; charset=utf-8")
        resp.headers.set("content-length", str(len(body)))
        return resp

    @classmethod
    def redirect(cls, url: str, permanent: bool = False) -> "Response":
        status = 301 if permanent else 302
        resp = cls(status=status)
        resp.headers.set("location", url)
        return resp

    @classmethod
    def error(cls, message: str, status: int = 500) -> "Response":
        return cls.json({"error": message, "status": status}, status=status)


# Middleware type
MiddlewareFunc = Callable[
    [Request, Callable[[Request], Awaitable[Response]]],
    Awaitable[Response],
]


@runtime_checkable
class Middleware(Protocol):
    async def __call__(
        self,
        request: Request,
        next_handler: Callable[[Request], Awaitable[Response]],
    ) -> Response: ...


@dataclass
class RouteEntry:
    method: HttpMethod
    pattern: re.Pattern[str]
    handler: Callable[[Request], Awaitable[Response]]
    param_names: list[str]
    middleware: list[MiddlewareFunc] = field(default_factory=list)

    def match(self, path: str) -> dict[str, str] | None:
        m = self.pattern.match(path)
        if not m:
            return None
        return {
            name: m.group(name)
            for name in self.param_names
        }


class Router:
    def __init__(self, prefix: str = ""):
        self._routes: list[RouteEntry] = []
        self._prefix = prefix.rstrip("/")
        self._middleware: list[MiddlewareFunc] = []
        self._sub_routers: list[Router] = []

    def _compile_path(self, path: str) -> tuple[re.Pattern[str], list[str]]:
        param_names: list[str] = []
        regex_parts: list[str] = []
        full_path = self._prefix + path

        for segment in full_path.split("/"):
            if not segment:
                continue
            if segment.startswith(":"):
                name = segment[1:]
                param_names.append(name)
                regex_parts.append(f"(?P<{name}>[^/]+)")
            elif segment == "*":
                param_names.append("wildcard")
                regex_parts.append("(?P<wildcard>.*)")
            else:
                regex_parts.append(re.escape(segment))

        pattern = re.compile("^/" + "/".join(regex_parts) + "$")
        return pattern, param_names

    def _add_route(
        self,
        method: HttpMethod,
        path: str,
        handler: Callable[[Request], Awaitable[Response]],
        middleware: list[MiddlewareFunc] | None = None,
    ) -> None:
        pattern, param_names = self._compile_path(path)
        entry = RouteEntry(
            method=method,
            pattern=pattern,
            handler=handler,
            param_names=param_names,
            middleware=middleware or [],
        )
        self._routes.append(entry)

    def get(self, path: str, middleware: list[MiddlewareFunc] | None = None):
        def decorator(fn):
            self._add_route(HttpMethod.GET, path, fn, middleware)
            return fn
        return decorator

    def post(self, path: str, middleware: list[MiddlewareFunc] | None = None):
        def decorator(fn):
            self._add_route(HttpMethod.POST, path, fn, middleware)
            return fn
        return decorator

    def put(self, path: str, middleware: list[MiddlewareFunc] | None = None):
        def decorator(fn):
            self._add_route(HttpMethod.PUT, path, fn, middleware)
            return fn
        return decorator

    def delete(self, path: str, middleware: list[MiddlewareFunc] | None = None):
        def decorator(fn):
            self._add_route(HttpMethod.DELETE, path, fn, middleware)
            return fn
        return decorator

    def use(self, *middleware: MiddlewareFunc) -> None:
        self._middleware.extend(middleware)

    def include(self, router: "Router") -> None:
        self._sub_routers.append(router)

    def _collect_routes(self) -> list[RouteEntry]:
        routes = list(self._routes)
        for sub in self._sub_routers:
            routes.extend(sub._collect_routes())
        return routes


class Application:
    def __init__(self, debug: bool = False):
        self._router = Router()
        self._middleware: list[MiddlewareFunc] = []
        self._error_handler: Callable | None = None
        self._startup_hooks: list[Callable] = []
        self._shutdown_hooks: list[Callable] = []
        self._debug = debug

    @property
    def router(self) -> Router:
        return self._router

    def use(self, *middleware: MiddlewareFunc) -> None:
        self._middleware.extend(middleware)

    def on_startup(self, fn: Callable) -> Callable:
        self._startup_hooks.append(fn)
        return fn

    def on_shutdown(self, fn: Callable) -> Callable:
        self._shutdown_hooks.append(fn)
        return fn

    def on_error(self, fn: Callable) -> Callable:
        self._error_handler = fn
        return fn

    async def _handle_request(self, request: Request) -> Response:
        routes = self._router._collect_routes()

        for route in routes:
            if route.method != request.method:
                continue
            params = route.match(request.path)
            if params is not None:
                request.params = params
                all_mw = [
                    *self._middleware,
                    *self._router._middleware,
                    *route.middleware,
                ]
                handler = route.handler
                return await self._run_middleware(request, handler, all_mw)

        return Response.json(
            {"error": "Not Found", "path": request.path},
            status=404,
        )

    async def _run_middleware(
        self,
        request: Request,
        handler: Callable[[Request], Awaitable[Response]],
        middleware: list[MiddlewareFunc],
    ) -> Response:
        if not middleware:
            return await handler(request)

        mw = middleware[0]
        remaining = middleware[1:]

        async def next_handler(req: Request) -> Response:
            return await self._run_middleware(req, handler, remaining)

        return await mw(request, next_handler)

    async def handle(self, raw_request: dict) -> Response:
        try:
            parsed = urlparse(raw_request.get("path", "/"))
            query = parse_qs(parsed.query)

            headers = Headers()
            for key, value in raw_request.get("headers", {}).items():
                headers.set(key, value)

            request = Request(
                method=HttpMethod[raw_request.get("method", "GET").upper()],
                path=parsed.path,
                headers=headers,
                query=query,
                body=raw_request.get("body", b""),
            )

            return await self._handle_request(request)

        except Exception as exc:
            logger.error(f"Request handling error: {exc}")
            if self._debug:
                tb = traceback.format_exc()
                return Response.json(
                    {"error": str(exc), "traceback": tb},
                    status=500,
                )
            if self._error_handler:
                return await self._error_handler(exc)
            return Response.error("Internal Server Error")


# --- Built-in Middleware ---

async def cors_middleware(
    request: Request,
    next_handler: Callable[[Request], Awaitable[Response]],
) -> Response:
    response = await next_handler(request)
    response.headers.set("access-control-allow-origin", "*")
    response.headers.set(
        "access-control-allow-methods",
        "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    )
    response.headers.set(
        "access-control-allow-headers",
        "Content-Type, Authorization",
    )
    return response


def rate_limiter(
    max_requests: int = 100,
    window_seconds: int = 60,
) -> MiddlewareFunc:
    counters: dict[str, list[float]] = {}

    async def middleware(
        request: Request,
        next_handler: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        ip = request.headers.get("x-forwarded-for", "127.0.0.1")
        now = time.time()
        window_start = now - window_seconds

        if ip not in counters:
            counters[ip] = []

        # Remove expired entries
        counters[ip] = [t for t in counters[ip] if t > window_start]

        if len(counters[ip]) >= max_requests:
            return Response.json(
                {"error": "Rate limit exceeded"},
                status=429,
            )

        counters[ip].append(now)
        return await next_handler(request)

    return middleware


async def timing_middleware(
    request: Request,
    next_handler: Callable[[Request], Awaitable[Response]],
) -> Response:
    start = time.perf_counter()
    response = await next_handler(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers.set("x-response-time", f"{duration_ms:.2f}ms")
    logger.info(
        f"{request.method.name} {request.path} -> "
        f"{response.status} ({duration_ms:.2f}ms)"
    )
    return response


# --- Example Application ---

app = Application(debug=True)
app.use(cors_middleware, timing_middleware, rate_limiter(max_requests=200))

users_router = Router(prefix="/api/users")


@users_router.get("/")
async def list_users(request: Request) -> Response:
    page = int(request.query.get("page", ["1"])[0])
    per_page = int(request.query.get("per_page", ["20"])[0])
    users = [
        {"id": i, "name": f"User {i}", "active": i % 3 != 0}
        for i in range((page - 1) * per_page + 1, page * per_page + 1)
    ]
    return Response.json({
        "users": users,
        "page": page,
        "per_page": per_page,
        "total": 1000,
    })


@users_router.get("/:id")
async def get_user(request: Request) -> Response:
    user_id = int(request.params["id"])
    if user_id <= 0:
        return Response.json({"error": "Invalid user ID"}, status=400)
    return Response.json({
        "id": user_id,
        "name": f"User {user_id}",
        "email": f"user{user_id}@example.com",
        "created_at": "2025-01-15T10:30:00Z",
    })


@users_router.post("/")
async def create_user(request: Request) -> Response:
    if not request.is_json:
        return Response.json(
            {"error": "Content-Type must be application/json"},
            status=415,
        )
    data = await request.json()
    name = data.get("name")
    email = data.get("email")

    if not name or not email:
        return Response.json(
            {"error": "name and email are required"},
            status=422,
        )

    EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\\.[a-zA-Z0-9-.]+$"
    if not re.match(EMAIL_REGEX, email):
        return Response.json(
            {"error": "Invalid email format"},
            status=422,
        )

    return Response.json(
        {"id": 42, "name": name, "email": email},
        status=201,
    )


@users_router.delete("/:id")
async def delete_user(request: Request) -> Response:
    user_id = int(request.params["id"])
    logger.info(f"Deleting user {user_id}")
    return Response.json({"deleted": True, "id": user_id})


app.router.include(users_router)

health_router = Router(prefix="/api")


@health_router.get("/health")
async def health_check(request: Request) -> Response:
    return Response.json({
        "status": "healthy",
        "version": "1.0.0",
        "uptime_seconds": time.monotonic(),
    })


@health_router.get("/metrics")
async def metrics(request: Request) -> Response:
    import resource
    usage = resource.getrusage(resource.RUSAGE_SELF)
    return Response.json({
        "cpu_user_time": usage.ru_utime,
        "cpu_system_time": usage.ru_stime,
        "max_rss_kb": usage.ru_maxrss,
        "page_faults": usage.ru_majflt,
    })


app.router.include(health_router)


@app.on_error
async def handle_error(exc: Exception) -> Response:
    logger.error(f"Unhandled error: {exc}")
    return Response.error("Something went wrong")


@app.on_startup
async def on_startup():
    logger.info("Application starting up...")


@app.on_shutdown
async def on_shutdown():
    logger.info("Application shutting down...")
`;

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

export const HTML_SMALL = `<!DOCTYPE html>
<html lang="en">
<head><title>Hello</title></head>
<body><h1>Hello, world!</h1></body>
</html>`;

export const HTML_MEDIUM = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="A modern dashboard for analytics and reporting" />
  <title>Dashboard &mdash; Analytics</title>
  <link rel="stylesheet" href="/assets/css/main.css" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    :root {
      --color-primary: #3b82f6;
      --color-bg: #f8fafc;
      --radius: 8px;
    }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--color-bg);
    }
  </style>
</head>
<body>
  <header class="header" role="banner">
    <nav class="nav" aria-label="Main navigation">
      <a href="/" class="logo">
        <img src="/logo.svg" alt="Company Logo" width="120" height="40" />
      </a>
      <ul class="nav-links">
        <li><a href="/dashboard" class="active">Dashboard</a></li>
        <li><a href="/reports">Reports</a></li>
        <li><a href="/settings">Settings</a></li>
      </ul>
      <button type="button" class="btn btn-primary" id="new-report">
        New Report
      </button>
    </nav>
  </header>

  <main class="main-content" role="main">
    <section class="stats-grid" aria-label="Key metrics">
      <div class="stat-card">
        <h3 class="stat-title">Total Users</h3>
        <p class="stat-value" data-metric="users">12,847</p>
        <span class="stat-change positive">+14.2%</span>
      </div>
      <div class="stat-card">
        <h3 class="stat-title">Revenue</h3>
        <p class="stat-value" data-metric="revenue">$48,295</p>
        <span class="stat-change positive">+8.7%</span>
      </div>
      <div class="stat-card">
        <h3 class="stat-title">Bounce Rate</h3>
        <p class="stat-value" data-metric="bounce">32.4%</p>
        <span class="stat-change negative">&minus;2.1%</span>
      </div>
    </section>

    <!-- Chart container rendered by JS -->
    <div id="chart-container" data-chart-type="line" data-period="30d"></div>

    <table class="data-table" aria-label="Recent activity">
      <thead>
        <tr>
          <th scope="col">User</th>
          <th scope="col">Action</th>
          <th scope="col">Date</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody id="activity-body">
        <tr>
          <td>Alice Johnson</td>
          <td>Created report</td>
          <td><time datetime="2026-02-20">Feb 20, 2026</time></td>
          <td><span class="badge success">Complete</span></td>
        </tr>
        <tr>
          <td>Bob Smith</td>
          <td>Updated settings</td>
          <td><time datetime="2026-02-19">Feb 19, 2026</time></td>
          <td><span class="badge warning">Pending</span></td>
        </tr>
      </tbody>
    </table>
  </main>

  <footer class="footer" role="contentinfo">
    <p>&copy; 2026 Company Inc. All rights reserved.</p>
    <p>Built with <a href="https://example.com">Example Framework</a></p>
  </footer>

  <script type="module" src="/assets/js/app.js"></script>
</body>
</html>
`;

export const HTML_LARGE = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Comprehensive e-commerce storefront with product catalog, cart, and checkout" />
  <meta name="author" content="Neo Commerce" />
  <meta property="og:title" content="Neo Commerce &mdash; Modern Shopping" />
  <meta property="og:description" content="Shop the latest products with lightning-fast checkout" />
  <meta property="og:image" content="https://example.com/og-image.jpg" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <title>Neo Commerce &mdash; Shop</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://cdn.example.com" crossorigin />
  <link rel="stylesheet" href="/assets/css/reset.css" />
  <link rel="stylesheet" href="/assets/css/main.css" />
  <link rel="stylesheet" href="/assets/css/components.css" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <style>
    :root {
      --color-primary: #6366f1;
      --color-primary-hover: #4f46e5;
      --color-secondary: #f59e0b;
      --color-success: #10b981;
      --color-danger: #ef4444;
      --color-text: #1e293b;
      --color-text-muted: #64748b;
      --color-bg: #ffffff;
      --color-bg-alt: #f8fafc;
      --color-border: #e2e8f0;
      --font-sans: "Inter", system-ui, -apple-system, sans-serif;
      --font-mono: "JetBrains Mono", ui-monospace, monospace;
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-sans);
      color: var(--color-text);
      background: var(--color-bg);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <!-- Skip to main content for accessibility -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <!-- Announcement Banner -->
  <div class="announcement-bar" role="alert" aria-live="polite">
    <p>Free shipping on orders over $50! Use code <strong>SHIP50</strong> at checkout. &rarr;</p>
    <button type="button" class="announcement-close" aria-label="Dismiss announcement">&times;</button>
  </div>

  <!-- Header -->
  <header class="header" role="banner">
    <div class="header-inner container">
      <a href="/" class="logo" aria-label="Neo Commerce home">
        <svg width="140" height="36" viewBox="0 0 140 36" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
          <rect width="36" height="36" rx="8" fill="var(--color-primary)" />
          <text x="44" y="26" font-size="20" font-weight="700" fill="currentColor">Neo Commerce</text>
        </svg>
      </a>

      <nav class="main-nav" aria-label="Main navigation">
        <ul class="nav-list">
          <li class="nav-item">
            <a href="/products" class="nav-link">Products</a>
            <div class="mega-menu" role="menu">
              <div class="mega-menu-section">
                <h4 class="mega-menu-title">Categories</h4>
                <ul>
                  <li><a href="/products/electronics" role="menuitem">Electronics</a></li>
                  <li><a href="/products/clothing" role="menuitem">Clothing</a></li>
                  <li><a href="/products/home-garden" role="menuitem">Home &amp; Garden</a></li>
                  <li><a href="/products/sports" role="menuitem">Sports</a></li>
                  <li><a href="/products/books" role="menuitem">Books</a></li>
                </ul>
              </div>
              <div class="mega-menu-section">
                <h4 class="mega-menu-title">Featured</h4>
                <ul>
                  <li><a href="/products/new-arrivals" role="menuitem">New Arrivals</a></li>
                  <li><a href="/products/best-sellers" role="menuitem">Best Sellers</a></li>
                  <li><a href="/products/sale" role="menuitem">Sale &mdash; Up to 60% off</a></li>
                </ul>
              </div>
            </div>
          </li>
          <li class="nav-item"><a href="/deals" class="nav-link">Deals</a></li>
          <li class="nav-item"><a href="/brands" class="nav-link">Brands</a></li>
          <li class="nav-item"><a href="/blog" class="nav-link">Blog</a></li>
        </ul>
      </nav>

      <div class="header-actions">
        <form class="search-form" role="search" action="/search" method="GET">
          <label for="search-input" class="sr-only">Search products</label>
          <input
            type="search"
            id="search-input"
            name="q"
            placeholder="Search products..."
            autocomplete="off"
            aria-describedby="search-hint"
          />
          <span id="search-hint" class="sr-only">Type at least 2 characters to search</span>
          <button type="submit" aria-label="Submit search">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M9 17A8 8 0 109 1a8 8 0 000 16zM19 19l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </form>

        <a href="/account" class="icon-link" aria-label="My account">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" />
            <path d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="currentColor" stroke-width="2" />
          </svg>
        </a>

        <button type="button" class="cart-btn" aria-label="Shopping cart, 3 items" data-cart-count="3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" stroke-width="2" />
            <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" />
            <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" stroke-width="2" />
          </svg>
          <span class="cart-badge">3</span>
        </button>

        <button type="button" class="mobile-menu-btn" aria-label="Open menu" aria-expanded="false">
          <span class="hamburger"></span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main id="main-content" class="main" role="main">
    <!-- Hero Section -->
    <section class="hero" aria-label="Featured promotion">
      <div class="container hero-grid">
        <div class="hero-content">
          <span class="hero-badge">New Season</span>
          <h1 class="hero-title">Spring Collection 2026</h1>
          <p class="hero-text">
            Discover our curated selection of premium products designed for the modern lifestyle.
            Quality materials, thoughtful design, and sustainable practices.
          </p>
          <div class="hero-actions">
            <a href="/products/new-arrivals" class="btn btn-primary btn-lg">Shop New Arrivals</a>
            <a href="/lookbook" class="btn btn-outline btn-lg">View Lookbook</a>
          </div>
        </div>
        <div class="hero-media">
          <picture>
            <source media="(min-width: 1024px)" srcset="/images/hero-lg.avif" type="image/avif" />
            <source media="(min-width: 1024px)" srcset="/images/hero-lg.webp" type="image/webp" />
            <source media="(min-width: 640px)" srcset="/images/hero-md.webp" type="image/webp" />
            <img src="/images/hero-sm.jpg" alt="Spring collection showcase" width="800" height="600" loading="eager" fetchpriority="high" />
          </picture>
        </div>
      </div>
    </section>

    <!-- Product Grid -->
    <section class="products-section" aria-label="Featured products">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Trending Now</h2>
          <div class="filter-bar" role="toolbar" aria-label="Product filters">
            <button type="button" class="filter-btn active" data-filter="all">All</button>
            <button type="button" class="filter-btn" data-filter="electronics">Electronics</button>
            <button type="button" class="filter-btn" data-filter="clothing">Clothing</button>
            <button type="button" class="filter-btn" data-filter="accessories">Accessories</button>
          </div>
        </div>

        <div class="product-grid" id="product-grid" role="list">
          <!-- Product Card 1 -->
          <article class="product-card" role="listitem" data-product-id="101" data-category="electronics">
            <a href="/products/wireless-headphones" class="product-link">
              <div class="product-image-wrapper">
                <img
                  src="/images/products/headphones-400.webp"
                  srcset="/images/products/headphones-400.webp 400w, /images/products/headphones-800.webp 800w"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  alt="Wireless noise-canceling headphones in matte black"
                  width="400"
                  height="400"
                  loading="lazy"
                />
                <span class="product-badge sale">-20%</span>
              </div>
              <div class="product-info">
                <h3 class="product-name">Wireless NC Headphones</h3>
                <p class="product-brand">AudioMax Pro</p>
                <div class="product-rating" aria-label="Rating: 4.7 out of 5">
                  <span class="stars" style="--rating: 4.7">&#9733;&#9733;&#9733;&#9733;&#9734;</span>
                  <span class="review-count">(342)</span>
                </div>
                <div class="product-pricing">
                  <span class="price-current">$79.99</span>
                  <span class="price-original"><del>$99.99</del></span>
                </div>
              </div>
            </a>
            <button type="button" class="btn btn-add-cart" data-product-id="101" aria-label="Add Wireless NC Headphones to cart">
              Add to Cart
            </button>
          </article>

          <!-- Product Card 2 -->
          <article class="product-card" role="listitem" data-product-id="102" data-category="clothing">
            <a href="/products/merino-sweater" class="product-link">
              <div class="product-image-wrapper">
                <img
                  src="/images/products/sweater-400.webp"
                  srcset="/images/products/sweater-400.webp 400w, /images/products/sweater-800.webp 800w"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  alt="Merino wool crew neck sweater in navy"
                  width="400"
                  height="400"
                  loading="lazy"
                />
                <span class="product-badge new">New</span>
              </div>
              <div class="product-info">
                <h3 class="product-name">Merino Crew Sweater</h3>
                <p class="product-brand">NordKnit</p>
                <div class="product-rating" aria-label="Rating: 4.9 out of 5">
                  <span class="stars" style="--rating: 4.9">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                  <span class="review-count">(89)</span>
                </div>
                <div class="product-pricing">
                  <span class="price-current">$124.00</span>
                </div>
              </div>
            </a>
            <button type="button" class="btn btn-add-cart" data-product-id="102" aria-label="Add Merino Crew Sweater to cart">
              Add to Cart
            </button>
          </article>

          <!-- Product Card 3 -->
          <article class="product-card" role="listitem" data-product-id="103" data-category="electronics">
            <a href="/products/smart-watch" class="product-link">
              <div class="product-image-wrapper">
                <img
                  src="/images/products/watch-400.webp"
                  srcset="/images/products/watch-400.webp 400w, /images/products/watch-800.webp 800w"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  alt="Smart fitness watch with titanium case"
                  width="400"
                  height="400"
                  loading="lazy"
                />
              </div>
              <div class="product-info">
                <h3 class="product-name">Titan Fitness Watch</h3>
                <p class="product-brand">ChronoTech</p>
                <div class="product-rating" aria-label="Rating: 4.5 out of 5">
                  <span class="stars" style="--rating: 4.5">&#9733;&#9733;&#9733;&#9733;&#9734;</span>
                  <span class="review-count">(215)</span>
                </div>
                <div class="product-pricing">
                  <span class="price-current">$249.00</span>
                </div>
              </div>
            </a>
            <button type="button" class="btn btn-add-cart" data-product-id="103" aria-label="Add Titan Fitness Watch to cart">
              Add to Cart
            </button>
          </article>

          <!-- Product Card 4 -->
          <article class="product-card" role="listitem" data-product-id="104" data-category="accessories">
            <a href="/products/leather-backpack" class="product-link">
              <div class="product-image-wrapper">
                <img
                  src="/images/products/backpack-400.webp"
                  srcset="/images/products/backpack-400.webp 400w, /images/products/backpack-800.webp 800w"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  alt="Full-grain leather backpack in cognac"
                  width="400"
                  height="400"
                  loading="lazy"
                />
                <span class="product-badge sale">-15%</span>
              </div>
              <div class="product-info">
                <h3 class="product-name">Heritage Leather Backpack</h3>
                <p class="product-brand">CraftWorks</p>
                <div class="product-rating" aria-label="Rating: 4.8 out of 5">
                  <span class="stars" style="--rating: 4.8">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                  <span class="review-count">(167)</span>
                </div>
                <div class="product-pricing">
                  <span class="price-current">$169.15</span>
                  <span class="price-original"><del>$199.00</del></span>
                </div>
              </div>
            </a>
            <button type="button" class="btn btn-add-cart" data-product-id="104" aria-label="Add Heritage Leather Backpack to cart">
              Add to Cart
            </button>
          </article>
        </div>

        <div class="section-footer">
          <a href="/products" class="btn btn-outline">View All Products &rarr;</a>
        </div>
      </div>
    </section>

    <!-- Newsletter Section -->
    <section class="newsletter" aria-label="Newsletter signup">
      <div class="container newsletter-inner">
        <div class="newsletter-content">
          <h2 class="newsletter-title">Stay in the Loop</h2>
          <p class="newsletter-text">
            Get exclusive deals, new arrivals, and style tips delivered to your inbox.
            No spam &mdash; unsubscribe anytime.
          </p>
        </div>
        <form class="newsletter-form" action="/api/newsletter" method="POST" aria-label="Newsletter signup form">
          <div class="input-group">
            <label for="newsletter-email" class="sr-only">Email address</label>
            <input
              type="email"
              id="newsletter-email"
              name="email"
              placeholder="Enter your email"
              required
              autocomplete="email"
              pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$"
            />
            <button type="submit" class="btn btn-primary">Subscribe</button>
          </div>
          <p class="newsletter-disclaimer">
            By subscribing, you agree to our <a href="/privacy">Privacy Policy</a>
            and <a href="/terms">Terms of Service</a>.
          </p>
        </form>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features" aria-label="Why choose us">
      <div class="container features-grid">
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="var(--color-primary)" stroke-width="2" />
              <path d="M16 24l6 6 10-12" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <h3 class="feature-title">Quality Guarantee</h3>
          <p class="feature-text">Every product is inspected and tested. 30-day hassle-free returns on all orders.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="var(--color-primary)" stroke-width="2" />
              <path d="M14 28l5-12h10l5 12M17 28h14M20 28v4M28 28v4" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <h3 class="feature-title">Free Shipping</h3>
          <p class="feature-text">Free standard shipping on orders over $50. Express options available at checkout.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="var(--color-primary)" stroke-width="2" />
              <path d="M24 14v10l7 5" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <h3 class="feature-title">Fast Delivery</h3>
          <p class="feature-text">Most orders ship within 24 hours. Track your package in real-time from warehouse to door.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="var(--color-primary)" stroke-width="2" />
              <path d="M18 20c0-3.314 2.686-6 6-6s6 2.686 6 6c0 6-6 10-6 14-0-4-6-8-6-14z" stroke="var(--color-primary)" stroke-width="2" />
              <circle cx="24" cy="20" r="2" fill="var(--color-primary)" />
            </svg>
          </div>
          <h3 class="feature-title">Secure Checkout</h3>
          <p class="feature-text">Industry-standard encryption protects your data. We accept all major payment methods.</p>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="footer" role="contentinfo">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a href="/" class="footer-logo" aria-label="Neo Commerce home">Neo Commerce</a>
        <p class="footer-tagline">Modern shopping for the modern world.</p>
        <div class="social-links" aria-label="Social media">
          <a href="https://twitter.com/neocommerce" aria-label="Twitter" rel="noopener noreferrer" target="_blank">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M18.258 3.946a7.074 7.074 0 01-2.032.557 3.547 3.547 0 001.556-1.957 7.096 7.096 0 01-2.247.858 3.54 3.54 0 00-6.03 3.227A10.047 10.047 0 012.22 2.784a3.54 3.54 0 001.095 4.724 3.524 3.524 0 01-1.604-.443v.045a3.54 3.54 0 002.839 3.47 3.54 3.54 0 01-1.598.06 3.541 3.541 0 003.306 2.458 7.098 7.098 0 01-5.237 1.465 10.019 10.019 0 005.425 1.59c6.51 0 10.066-5.394 10.066-10.067 0-.153-.003-.306-.01-.458a7.192 7.192 0 001.762-1.682z" />
            </svg>
          </a>
          <a href="https://github.com/neocommerce" aria-label="GitHub" rel="noopener noreferrer" target="_blank">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.164 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.138 18.16 20 14.418 20 10c0-5.523-4.477-10-10-10z" />
            </svg>
          </a>
          <a href="https://instagram.com/neocommerce" aria-label="Instagram" rel="noopener noreferrer" target="_blank">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <rect x="1" y="1" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.5" fill="none" />
              <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.5" fill="none" />
              <circle cx="15" cy="5" r="1" fill="currentColor" />
            </svg>
          </a>
        </div>
      </div>

      <nav class="footer-nav" aria-label="Footer navigation">
        <div class="footer-nav-group">
          <h4 class="footer-nav-title">Shop</h4>
          <ul>
            <li><a href="/products/new-arrivals">New Arrivals</a></li>
            <li><a href="/products/best-sellers">Best Sellers</a></li>
            <li><a href="/products/sale">Sale</a></li>
            <li><a href="/gift-cards">Gift Cards</a></li>
          </ul>
        </div>
        <div class="footer-nav-group">
          <h4 class="footer-nav-title">Support</h4>
          <ul>
            <li><a href="/help">Help Center</a></li>
            <li><a href="/shipping">Shipping Info</a></li>
            <li><a href="/returns">Returns &amp; Exchanges</a></li>
            <li><a href="/contact">Contact Us</a></li>
          </ul>
        </div>
        <div class="footer-nav-group">
          <h4 class="footer-nav-title">Company</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/careers">Careers</a></li>
            <li><a href="/sustainability">Sustainability</a></li>
            <li><a href="/press">Press</a></li>
          </ul>
        </div>
        <div class="footer-nav-group">
          <h4 class="footer-nav-title">Legal</h4>
          <ul>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/cookies">Cookie Policy</a></li>
            <li><a href="/accessibility">Accessibility</a></li>
          </ul>
        </div>
      </nav>
    </div>

    <div class="footer-bottom container">
      <p>&copy; 2026 Neo Commerce Inc. All rights reserved.</p>
      <div class="payment-methods" aria-label="Accepted payment methods">
        <img src="/images/payments/visa.svg" alt="Visa" width="40" height="24" />
        <img src="/images/payments/mastercard.svg" alt="Mastercard" width="40" height="24" />
        <img src="/images/payments/amex.svg" alt="American Express" width="40" height="24" />
        <img src="/images/payments/paypal.svg" alt="PayPal" width="40" height="24" />
        <img src="/images/payments/apple-pay.svg" alt="Apple Pay" width="40" height="24" />
        <img src="/images/payments/google-pay.svg" alt="Google Pay" width="40" height="24" />
      </div>
    </div>
  </footer>

  <!-- Cart Drawer (hidden by default) -->
  <aside id="cart-drawer" class="drawer" role="dialog" aria-label="Shopping cart" aria-hidden="true">
    <div class="drawer-overlay" data-close-drawer></div>
    <div class="drawer-panel">
      <header class="drawer-header">
        <h2 class="drawer-title">Your Cart <span class="cart-item-count">(3 items)</span></h2>
        <button type="button" class="drawer-close" aria-label="Close cart" data-close-drawer>&times;</button>
      </header>
      <div class="drawer-body">
        <ul class="cart-items" role="list">
          <li class="cart-item" data-item-id="101">
            <img src="/images/products/headphones-80.webp" alt="" width="80" height="80" loading="lazy" />
            <div class="cart-item-details">
              <h3 class="cart-item-name">Wireless NC Headphones</h3>
              <p class="cart-item-price">$79.99</p>
              <div class="quantity-selector">
                <button type="button" aria-label="Decrease quantity" data-qty-decrease>&#8722;</button>
                <input type="number" value="1" min="1" max="10" aria-label="Quantity" />
                <button type="button" aria-label="Increase quantity" data-qty-increase>&#43;</button>
              </div>
            </div>
            <button type="button" class="cart-item-remove" aria-label="Remove item">&times;</button>
          </li>
        </ul>
      </div>
      <footer class="drawer-footer">
        <div class="cart-subtotal">
          <span>Subtotal</span>
          <span class="subtotal-amount">$373.14</span>
        </div>
        <p class="cart-shipping-note">Shipping &amp; taxes calculated at checkout</p>
        <a href="/checkout" class="btn btn-primary btn-block">Proceed to Checkout</a>
        <button type="button" class="btn btn-outline btn-block" data-close-drawer>Continue Shopping</button>
      </footer>
    </div>
  </aside>

  <!-- Toast notifications container -->
  <div id="toast-container" class="toast-container" role="status" aria-live="polite" aria-atomic="true"></div>

  <!-- Scripts -->
  <script type="module" src="/assets/js/app.js"></script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Neo Commerce",
    "url": "https://neocommerce.com",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://neocommerce.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  }
  </script>
</body>
</html>
`;
