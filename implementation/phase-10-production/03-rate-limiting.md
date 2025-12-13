# Rate Limiting

## Overview

Implement comprehensive rate limiting to prevent abuse, protect server resources, and ensure fair usage. Use token bucket algorithm with endpoint-specific limits and proper HTTP headers.

## PRD References

- **prd/scope.md**: Rate limiting requirements, API limits
- **prd/technical.md**: Performance and security considerations

## Skills

- **go-api-server**: Middleware implementation
- **compose-lock**: Specific rate limits for lock operations

## Rate Limiting Strategy

### Token Bucket Algorithm

The token bucket algorithm allows for burst traffic while maintaining average rate limits:

- Bucket has a maximum capacity (burst limit)
- Tokens refill at a constant rate
- Each request consumes one token
- Request denied if no tokens available

### Endpoint Categories

1. **General GET** - Read operations (60 req/min, burst 10)
2. **Mutations** - Write operations (30 req/min, burst 5)
3. **Turn Submission** - Post creation (10 req/min, burst 3)
4. **Scene/Campaign Creation** - Resource creation (5 req/min, burst 2)
5. **Image Upload** - File uploads (5 req/min, burst 2)
6. **Compose Lock** - Lock operations (12 req/min, burst 2, 5s between ops)
7. **Campaign Join** - Join requests (5 req/15min per IP)

## Database Schema

```sql
-- Rate limit tracking
CREATE TABLE rate_limit_buckets (
    key TEXT PRIMARY KEY, -- user_id:endpoint or ip:endpoint
    tokens DECIMAL(10, 2) NOT NULL,
    last_refill TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_buckets_last_refill ON rate_limit_buckets(last_refill);

-- Cleanup old entries
CREATE INDEX idx_rate_limit_buckets_created ON rate_limit_buckets(created_at);

-- Compose lock specific tracking (5 second minimum between operations)
CREATE TABLE compose_lock_rate_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    last_operation TIMESTAMPTZ NOT NULL,
    operation_count INT NOT NULL DEFAULT 1
);
```

## Rate Limit Middleware

### Core Implementation

```go
// middleware/rate_limit.go
package middleware

import (
    "context"
    "fmt"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

type RateLimitConfig struct {
    Rate       float64       // Tokens per second
    Burst      int           // Maximum tokens (bucket capacity)
    KeyFunc    func(*gin.Context) string
    MinInterval time.Duration // Minimum time between requests (optional)
}

type RateLimiter struct {
    db     *sqlc.Queries
    config RateLimitConfig
}

func NewRateLimiter(db *sqlc.Queries, config RateLimitConfig) *RateLimiter {
    return &RateLimiter{
        db:     db,
        config: config,
    }
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        key := rl.config.KeyFunc(c)

        allowed, retryAfter, err := rl.allow(c.Request.Context(), key)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "rate limit check failed"})
            c.Abort()
            return
        }

        // Set rate limit headers
        rl.setHeaders(c, key)

        if !allowed {
            c.Header("Retry-After", fmt.Sprintf("%d", int(retryAfter.Seconds())))
            c.JSON(http.StatusTooManyRequests, gin.H{
                "error":       "rate limit exceeded",
                "retry_after": int(retryAfter.Seconds()),
            })
            c.Abort()
            return
        }

        c.Next()
    }
}

func (rl *RateLimiter) allow(ctx context.Context, key string) (bool, time.Duration, error) {
    now := time.Now()

    // Get or create bucket
    bucket, err := rl.db.GetRateLimitBucket(ctx, key)
    if err != nil {
        // Create new bucket
        bucket = &models.RateLimitBucket{
            Key:        key,
            Tokens:     float64(rl.config.Burst),
            LastRefill: now,
        }

        _, err = rl.db.CreateRateLimitBucket(ctx, sqlc.CreateRateLimitBucketParams{
            Key:        key,
            Tokens:     bucket.Tokens,
            LastRefill: bucket.LastRefill,
        })
        if err != nil {
            return false, 0, fmt.Errorf("failed to create bucket: %w", err)
        }
    }

    // Calculate tokens to add based on time elapsed
    elapsed := now.Sub(bucket.LastRefill).Seconds()
    tokensToAdd := elapsed * rl.config.Rate

    // Refill bucket (capped at burst limit)
    newTokens := bucket.Tokens + tokensToAdd
    if newTokens > float64(rl.config.Burst) {
        newTokens = float64(rl.config.Burst)
    }

    // Check if we have at least 1 token
    if newTokens < 1.0 {
        // Calculate retry after
        tokensNeeded := 1.0 - newTokens
        retryAfter := time.Duration(tokensNeeded/rl.config.Rate) * time.Second

        return false, retryAfter, nil
    }

    // Consume 1 token
    newTokens -= 1.0

    // Update bucket
    _, err = rl.db.UpdateRateLimitBucket(ctx, sqlc.UpdateRateLimitBucketParams{
        Key:        key,
        Tokens:     newTokens,
        LastRefill: now,
    })
    if err != nil {
        return false, 0, fmt.Errorf("failed to update bucket: %w", err)
    }

    return true, 0, nil
}

func (rl *RateLimiter) setHeaders(c *gin.Context, key string) {
    bucket, _ := rl.db.GetRateLimitBucket(c.Request.Context(), key)
    if bucket == nil {
        return
    }

    // Calculate current tokens
    elapsed := time.Since(bucket.LastRefill).Seconds()
    tokensToAdd := elapsed * rl.config.Rate
    currentTokens := bucket.Tokens + tokensToAdd
    if currentTokens > float64(rl.config.Burst) {
        currentTokens = float64(rl.config.Burst)
    }

    c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", rl.config.Burst))
    c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", int(currentTokens)))
    c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", bucket.LastRefill.Add(time.Minute).Unix()))
}
```

### Key Functions

```go
// User-based key
func userKey(endpoint string) func(*gin.Context) string {
    return func(c *gin.Context) string {
        userID, exists := c.Get("user_id")
        if !exists {
            return "anonymous:" + endpoint
        }
        return fmt.Sprintf("%s:%s", userID.(uuid.UUID).String(), endpoint)
    }
}

// IP-based key
func ipKey(endpoint string) func(*gin.Context) string {
    return func(c *gin.Context) string {
        ip := c.ClientIP()
        return fmt.Sprintf("%s:%s", ip, endpoint)
    }
}

// Combined user+IP key
func userAndIPKey(endpoint string) func(*gin.Context) string {
    return func(c *gin.Context) string {
        userID, exists := c.Get("user_id")
        ip := c.ClientIP()

        if !exists {
            return fmt.Sprintf("anonymous:%s:%s", ip, endpoint)
        }

        return fmt.Sprintf("%s:%s:%s", userID.(uuid.UUID).String(), ip, endpoint)
    }
}
```

## Endpoint-Specific Rate Limits

### General GET Requests

```go
// router/router.go
func SetupRouter(db *sqlc.Queries) *gin.Engine {
    r := gin.Default()

    // General GET rate limiter
    getRL := middleware.NewRateLimiter(db, middleware.RateLimitConfig{
        Rate:    1.0,  // 60 per minute = 1 per second
        Burst:   10,
        KeyFunc: userKey("get"),
    })

    // Apply to all GET routes
    r.GET("/api/*", getRL.Middleware(), handleGet)

    // ... other routes
}
```

### Mutations (POST/PUT/DELETE)

```go
mutationRL := middleware.NewRateLimiter(db, middleware.RateLimitConfig{
    Rate:    0.5,  // 30 per minute = 0.5 per second
    Burst:   5,
    KeyFunc: userKey("mutation"),
})

r.POST("/api/campaigns/:id/posts", mutationRL.Middleware(), handleCreatePost)
r.PUT("/api/posts/:id", mutationRL.Middleware(), handleUpdatePost)
r.DELETE("/api/posts/:id", mutationRL.Middleware(), handleDeletePost)
```

### Turn Submission

```go
turnRL := middleware.NewRateLimiter(db, middleware.RateLimitConfig{
    Rate:    0.167, // 10 per minute ≈ 0.167 per second
    Burst:   3,
    KeyFunc: userKey("turn"),
})

r.POST("/api/campaigns/:campaign_id/scenes/:scene_id/posts",
    turnRL.Middleware(),
    handleSubmitTurn)
```

### Scene/Campaign Creation

```go
createRL := middleware.NewRateLimiter(db, middleware.RateLimitConfig{
    Rate:    0.083, // 5 per minute ≈ 0.083 per second
    Burst:   2,
    KeyFunc: userKey("create"),
})

r.POST("/api/campaigns", createRL.Middleware(), handleCreateCampaign)
r.POST("/api/campaigns/:id/scenes", createRL.Middleware(), handleCreateScene)
```

### Image Upload

```go
uploadRL := middleware.NewRateLimiter(db, middleware.RateLimitConfig{
    Rate:    0.083, // 5 per minute
    Burst:   2,
    KeyFunc: userKey("upload"),
})

r.POST("/api/upload/avatar", uploadRL.Middleware(), handleUploadAvatar)
r.POST("/api/upload/scene-header", uploadRL.Middleware(), handleUploadSceneHeader)
```

### Compose Lock (Special Case)

```go
// Compose lock has both rate limit AND minimum interval
composeLockRL := middleware.NewRateLimiter(db, middleware.RateLimitConfig{
    Rate:        0.2, // 12 per minute = 0.2 per second
    Burst:       2,
    KeyFunc:     userKey("compose_lock"),
    MinInterval: 5 * time.Second, // Minimum 5 seconds between operations
})

// Additional interval check middleware
func composeLockIntervalCheck(db *sqlc.Queries) gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := getUserID(c)

        lastOp, err := db.GetComposeLockLastOperation(c.Request.Context(), userID)
        if err == nil {
            elapsed := time.Since(lastOp)
            if elapsed < 5*time.Second {
                remaining := 5*time.Second - elapsed
                c.JSON(http.StatusTooManyRequests, gin.H{
                    "error":       "compose lock operations must be at least 5 seconds apart",
                    "retry_after": int(remaining.Seconds()),
                })
                c.Abort()
                return
            }
        }

        c.Next()

        // Update last operation timestamp
        db.UpdateComposeLockLastOperation(c.Request.Context(), sqlc.UpdateComposeLockLastOperationParams{
            UserID:        userID,
            LastOperation: time.Now(),
        })
    }
}

r.POST("/api/scenes/:id/compose-lock/acquire",
    composeLockRL.Middleware(),
    composeLockIntervalCheck(db),
    handleAcquireComposeLock)

r.DELETE("/api/scenes/:id/compose-lock/release",
    composeLockRL.Middleware(),
    composeLockIntervalCheck(db),
    handleReleaseComposeLock)
```

### Campaign Join (IP-based)

```go
// IP-based rate limit for join requests (prevent abuse)
joinRL := middleware.NewRateLimiter(db, middleware.RateLimitConfig{
    Rate:    0.0056, // 5 per 15 minutes ≈ 0.0056 per second
    Burst:   2,
    KeyFunc: ipKey("campaign_join"),
})

r.POST("/api/campaigns/:id/join", joinRL.Middleware(), handleJoinCampaign)
```

## SQL Queries

```sql
-- queries/rate_limit.sql
-- name: GetRateLimitBucket :one
SELECT * FROM rate_limit_buckets
WHERE key = $1;

-- name: CreateRateLimitBucket :one
INSERT INTO rate_limit_buckets (key, tokens, last_refill)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdateRateLimitBucket :one
UPDATE rate_limit_buckets
SET tokens = $2, last_refill = $3
WHERE key = $1
RETURNING *;

-- name: DeleteOldRateLimitBuckets :exec
DELETE FROM rate_limit_buckets
WHERE created_at < NOW() - INTERVAL '1 hour';

-- Compose lock rate limit queries
-- name: GetComposeLockLastOperation :one
SELECT last_operation FROM compose_lock_rate_limits
WHERE user_id = $1;

-- name: UpdateComposeLockLastOperation :exec
INSERT INTO compose_lock_rate_limits (user_id, last_operation, operation_count)
VALUES ($1, $2, 1)
ON CONFLICT (user_id)
DO UPDATE SET
    last_operation = $2,
    operation_count = compose_lock_rate_limits.operation_count + 1;
```

## Cleanup Job

### Stale Bucket Cleanup

```go
// cron/rate_limit_cleanup.go
func CleanupStaleRateLimitBuckets(ctx context.Context, db *sqlc.Queries) error {
    // Delete buckets older than 1 hour
    err := db.DeleteOldRateLimitBuckets(ctx)
    if err != nil {
        return fmt.Errorf("failed to cleanup rate limit buckets: %w", err)
    }

    return nil
}
```

Schedule this to run every hour:

```go
// main.go
func startCronJobs(db *sqlc.Queries) {
    c := cron.New()

    // Cleanup stale rate limit buckets every hour
    c.AddFunc("0 * * * *", func() {
        ctx := context.Background()
        if err := CleanupStaleRateLimitBuckets(ctx, db); err != nil {
            log.Printf("failed to cleanup rate limit buckets: %v", err)
        }
    })

    c.Start()
}
```

## Client-side Rate Limit Handling

### React Query Integration

```typescript
// lib/api.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on rate limit errors
        if (error.response?.status === 429) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry on rate limit errors
        if (error.response?.status === 429) {
          return false;
        }
        return failureCount < 3;
      },
      onError: (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          toast.error(`Rate limit exceeded. Try again in ${retryAfter} seconds.`);
        }
      },
    },
  },
});
```

### Rate Limit Display

```typescript
// hooks/useRateLimitInfo.ts
export function useRateLimitInfo() {
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    limit: number;
    remaining: number;
    reset: number;
  } | null>(null);

  useEffect(() => {
    // Intercept responses to extract rate limit headers
    const interceptor = axios.interceptors.response.use((response) => {
      const limit = response.headers['x-ratelimit-limit'];
      const remaining = response.headers['x-ratelimit-remaining'];
      const reset = response.headers['x-ratelimit-reset'];

      if (limit && remaining && reset) {
        setRateLimitInfo({
          limit: parseInt(limit),
          remaining: parseInt(remaining),
          reset: parseInt(reset),
        });
      }

      return response;
    });

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return rateLimitInfo;
}

// Component to display rate limit warning
export function RateLimitWarning() {
  const rateLimitInfo = useRateLimitInfo();

  if (!rateLimitInfo || rateLimitInfo.remaining > 5) {
    return null;
  }

  return (
    <Alert variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Rate Limit Warning</AlertTitle>
      <AlertDescription>
        You have {rateLimitInfo.remaining} requests remaining.
        Limit resets in {formatSecondsUntil(rateLimitInfo.reset)}.
      </AlertDescription>
    </Alert>
  );
}
```

### Compose Lock 5-second Enforcement

```typescript
// hooks/useComposeLock.ts
export function useComposeLock(sceneId: string) {
  const [lastOperation, setLastOperation] = useState<number | null>(null);
  const [canOperate, setCanOperate] = useState(true);

  useEffect(() => {
    if (lastOperation === null) {
      setCanOperate(true);
      return;
    }

    const elapsed = Date.now() - lastOperation;
    const remaining = 5000 - elapsed;

    if (remaining > 0) {
      setCanOperate(false);

      const timer = setTimeout(() => {
        setCanOperate(true);
      }, remaining);

      return () => clearTimeout(timer);
    } else {
      setCanOperate(true);
    }
  }, [lastOperation]);

  const acquireMutation = useMutation({
    mutationFn: () => acquireComposeLock(sceneId),
    onSuccess: () => {
      setLastOperation(Date.now());
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () => releaseComposeLock(sceneId),
    onSuccess: () => {
      setLastOperation(Date.Now());
    },
  });

  return {
    canOperate,
    acquire: acquireMutation.mutate,
    release: releaseMutation.mutate,
  };
}
```

## Edge Cases

### 1. Clock Skew

**Issue**: Server time differs from database time

**Solution**: Always use database `NOW()` for timestamps
```sql
last_refill TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### 2. Burst Exhaustion

**Issue**: User exhausts burst tokens quickly

**Solution**: Clear messaging about refill rate
```json
{
  "error": "rate limit exceeded",
  "retry_after": 12,
  "message": "Tokens refill at 1 per second. You'll have 1 token in 12 seconds."
}
```

### 3. Distributed System Clock Drift

**Issue**: Multiple servers with different clocks

**Solution**: Use single source of truth (database) for time
```go
// Always use database time for calculations
now := time.Now() // Server time
bucket.LastRefill  // Database time (may differ)

// Trust database time
elapsed := now.Sub(bucket.LastRefill).Seconds()
```

### 4. Anonymous User Rate Limits

**Issue**: Unauthenticated requests

**Solution**: IP-based rate limiting
```go
func userKey(endpoint string) func(*gin.Context) string {
    return func(c *gin.Context) string {
        userID, exists := c.Get("user_id")
        if !exists {
            return "anonymous:" + c.ClientIP() + ":" + endpoint
        }
        return fmt.Sprintf("%s:%s", userID.(uuid.UUID).String(), endpoint)
    }
}
```

### 5. Rate Limit Bypass Attempt

**Issue**: User creates multiple accounts

**Solution**: IP-based limits for sensitive operations (campaign join)
```go
joinRL := middleware.NewRateLimiter(db, middleware.RateLimitConfig{
    Rate:    0.0056, // 5 per 15 minutes
    Burst:   2,
    KeyFunc: ipKey("campaign_join"), // IP-based
})
```

### 6. Legitimate High-frequency Use

**Issue**: Admin tools need higher limits

**Solution**: Exemption for admin users
```go
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Exempt admins
        isAdmin, _ := c.Get("is_admin")
        if isAdmin.(bool) {
            c.Next()
            return
        }

        // Apply rate limit...
    }
}
```

## Testing Checklist

- [ ] General GET requests limited to 60/min
- [ ] Mutations limited to 30/min
- [ ] Turn submission limited to 10/min
- [ ] Scene/campaign creation limited to 5/min
- [ ] Image uploads limited to 5/min
- [ ] Compose lock limited to 12/min with 5s interval
- [ ] Campaign join limited to 5 per 15min (IP)
- [ ] Rate limit headers present in response
- [ ] 429 response when limit exceeded
- [ ] Retry-After header present on 429
- [ ] Token bucket refills correctly
- [ ] Burst capacity works
- [ ] Cleanup job removes stale buckets
- [ ] Client-side displays rate limit warnings
- [ ] Compose lock enforces 5s interval
- [ ] Anonymous users rate limited by IP

## Verification Steps

1. **Basic Rate Limit Test**:
   ```bash
   # Make 65 GET requests in 1 minute
   # Expect first 60 to succeed
   # Expect last 5 to return 429
   ```

2. **Burst Test**:
   ```bash
   # Make 15 requests instantly
   # Expect first 10 to succeed (burst)
   # Expect next 5 to fail
   # Wait 5 seconds (5 tokens refilled)
   # Make 5 requests
   # Expect all 5 to succeed
   ```

3. **Compose Lock Interval Test**:
   ```bash
   # Acquire compose lock
   # Immediately try to release
   # Expect 429 error
   # Wait 5 seconds
   # Release lock
   # Expect success
   ```

4. **Header Test**:
   ```bash
   curl -i GET /api/campaigns
   # Check for X-RateLimit-* headers
   # Verify values are correct
   ```

5. **IP-based Test**:
   ```bash
   # Join campaign 6 times from same IP
   # Expect first 5 to succeed
   # Expect 6th to fail with 429
   ```

## Performance Considerations

- Index on rate_limit_buckets.key for fast lookups
- Cleanup stale buckets hourly
- Cache bucket state in memory (optional, for very high traffic)
- Use Redis for distributed rate limiting (optional)
- Monitor rate limit hit rate
- Alert on excessive 429 responses (potential attack)

## Security Considerations

- Rate limits prevent brute force attacks
- IP-based limits prevent signup abuse
- Compose lock interval prevents spam
- Admin exemption requires strong auth
- Log excessive rate limit violations
- Monitor for distributed attacks (multiple IPs)
- Consider CAPTCHA for repeated violations
