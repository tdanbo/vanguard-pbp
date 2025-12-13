# Production Deployment

## Overview

This guide covers deploying the Vanguard PBP system to production on Railway with proper configuration, monitoring, and operational best practices.

## PRD References

- **prd/technical.md**: Production architecture, database, hosting
- **prd/scope.md**: System limits and performance requirements

## Deployment Platform

**Railway** - Chosen for:
- Automatic deployments from GitHub
- Built-in PostgreSQL (via Supabase)
- Environment variable management
- Automatic SSL certificates
- Docker support
- Simple pricing model
- Excellent developer experience

## Railway Configuration

### Project Setup

```yaml
# railway.json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "./vanguard-pbp-server",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Dockerfile

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o vanguard-pbp-server ./cmd/server

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/vanguard-pbp-server .

# Copy templates and static files
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/static ./static

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run
CMD ["./vanguard-pbp-server"]
```

### .dockerignore

```
.git
.github
node_modules
.env
.env.local
*.log
tmp/
*.md
.vscode
.idea
```

## Environment Variables

### Production Environment

```bash
# Server
PORT=8080
GIN_MODE=release
ENVIRONMENT=production

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=[ANON_KEY]
SUPABASE_SERVICE_KEY=[SERVICE_KEY]

# JWT
JWT_SECRET=[STRONG_RANDOM_SECRET]
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=720h

# CORS
CORS_ALLOWED_ORIGINS=https://vanguard-pbp.com,https://www.vanguard-pbp.com
CORS_ALLOW_CREDENTIALS=true

# Storage
STORAGE_BUCKET=vanguard-pbp-storage
MAX_UPLOAD_SIZE=5242880  # 5MB in bytes

# Email (optional - for notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=[SENDGRID_API_KEY]
SMTP_FROM=noreply@vanguard-pbp.com

# Monitoring (optional)
SENTRY_DSN=[SENTRY_DSN]
SENTRY_ENVIRONMENT=production

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Campaign Limits
MAX_CAMPAIGNS_PER_USER=5
MAX_PLAYERS_PER_CAMPAIGN=8
MAX_SCENES_PER_CAMPAIGN=50
MAX_STORAGE_PER_CAMPAIGN=524288000  # 500MB in bytes

# Feature Flags
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_DIGEST_EMAILS=true
```

### Railway Environment Setup

1. **Create Railway Project**:
   ```bash
   railway login
   railway init
   railway link
   ```

2. **Add Environment Variables**:
   ```bash
   # Via Railway CLI
   railway variables set JWT_SECRET=$(openssl rand -base64 32)
   railway variables set DATABASE_URL="postgresql://..."

   # Or via Railway dashboard (recommended for sensitive values)
   ```

3. **Connect Supabase**:
   - Create Supabase project
   - Copy connection string and API keys
   - Add to Railway environment variables

## Domain Configuration

### DNS Setup

```
# Add these DNS records to your domain provider:

A     @        76.76.21.21         # Railway IP (example)
CNAME www      vanguard-pbp.up.railway.app
```

### SSL/TLS

Railway provides automatic SSL certificates via Let's Encrypt:

1. Add custom domain in Railway dashboard
2. Railway provisions SSL certificate automatically
3. Certificate auto-renews before expiration

## Database Setup

### Supabase Configuration

1. **Create Project**:
   - Sign up at supabase.com
   - Create new project
   - Select region close to Railway deployment

2. **Run Migrations**:
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Login
   supabase login

   # Link project
   supabase link --project-ref [PROJECT_ID]

   # Run migrations
   supabase db push
   ```

3. **Enable Row Level Security**:
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
   ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
   ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
   ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
   -- ... etc for all tables
   ```

4. **Create RLS Policies**:
   See Phase 1 documentation for complete RLS policies

### Connection Pooling

```go
// main.go
import (
    "database/sql"
    _ "github.com/lib/pq"
)

func setupDatabase() (*sql.DB, error) {
    db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
    if err != nil {
        return nil, err
    }

    // Connection pool settings
    db.SetMaxOpenConns(25)                 // Maximum open connections
    db.SetMaxIdleConns(5)                  // Maximum idle connections
    db.SetConnMaxLifetime(5 * time.Minute) // Connection lifetime
    db.SetConnMaxIdleTime(1 * time.Minute) // Idle connection lifetime

    // Verify connection
    if err := db.Ping(); err != nil {
        return nil, err
    }

    return db, nil
}
```

## Health Checks

### Health Check Endpoint

```go
// handlers/health_handler.go
type HealthHandler struct {
    db *sql.DB
}

type HealthResponse struct {
    Status    string            `json:"status"`
    Version   string            `json:"version"`
    Timestamp time.Time         `json:"timestamp"`
    Checks    map[string]string `json:"checks"`
}

func (h *HealthHandler) HealthCheck(c *gin.Context) {
    checks := make(map[string]string)

    // Database check
    if err := h.db.Ping(); err != nil {
        checks["database"] = "unhealthy: " + err.Error()
        c.JSON(http.StatusServiceUnavailable, HealthResponse{
            Status:    "unhealthy",
            Version:   os.Getenv("APP_VERSION"),
            Timestamp: time.Now(),
            Checks:    checks,
        })
        return
    }
    checks["database"] = "healthy"

    // Add more checks as needed
    checks["storage"] = "healthy" // Check Supabase Storage connection

    c.JSON(http.StatusOK, HealthResponse{
        Status:    "healthy",
        Version:   os.Getenv("APP_VERSION"),
        Timestamp: time.Now(),
        Checks:    checks,
    })
}

// Liveness probe (simpler check)
func (h *HealthHandler) Liveness(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"status": "alive"})
}

// Readiness probe (full checks)
func (h *HealthHandler) Readiness(c *gin.Context) {
    // Same as HealthCheck but may include additional checks
    h.HealthCheck(c)
}
```

### Register Health Endpoints

```go
// router/router.go
func SetupRouter(db *sql.DB) *gin.Engine {
    r := gin.Default()

    healthHandler := handlers.NewHealthHandler(db)

    r.GET("/health", healthHandler.HealthCheck)
    r.GET("/health/live", healthHandler.Liveness)
    r.GET("/health/ready", healthHandler.Readiness)

    // ... other routes
}
```

## Monitoring and Logging

### Structured Logging

```go
// logger/logger.go
import (
    "github.com/sirupsen/logrus"
)

var Log *logrus.Logger

func Init() {
    Log = logrus.New()

    // Production settings
    if os.Getenv("ENVIRONMENT") == "production" {
        Log.SetFormatter(&logrus.JSONFormatter{})
        Log.SetLevel(logrus.InfoLevel)
    } else {
        Log.SetFormatter(&logrus.TextFormatter{
            FullTimestamp: true,
        })
        Log.SetLevel(logrus.DebugLevel)
    }

    Log.SetOutput(os.Stdout)
}

// Usage in handlers
func (h *Handler) SomeEndpoint(c *gin.Context) {
    logger.Log.WithFields(logrus.Fields{
        "user_id":     userID,
        "campaign_id": campaignID,
        "action":      "create_post",
    }).Info("Post created successfully")
}
```

### Request Logging Middleware

```go
// middleware/request_logger.go
func RequestLogger() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        path := c.Request.URL.Path
        raw := c.Request.URL.RawQuery

        // Process request
        c.Next()

        // Log after request
        latency := time.Since(start)
        statusCode := c.Writer.Status()
        clientIP := c.ClientIP()
        method := c.Request.Method

        if raw != "" {
            path = path + "?" + raw
        }

        logger.Log.WithFields(logrus.Fields{
            "status":     statusCode,
            "method":     method,
            "path":       path,
            "ip":         clientIP,
            "latency_ms": latency.Milliseconds(),
            "user_agent": c.Request.UserAgent(),
        }).Info("Request processed")
    }
}
```

### Error Tracking (Sentry)

```go
// main.go
import (
    "github.com/getsentry/sentry-go"
    sentrygin "github.com/getsentry/sentry-go/gin"
)

func initSentry() {
    if os.Getenv("SENTRY_DSN") != "" {
        err := sentry.Init(sentry.ClientOptions{
            Dsn:              os.Getenv("SENTRY_DSN"),
            Environment:      os.Getenv("SENTRY_ENVIRONMENT"),
            TracesSampleRate: 0.2, // 20% of transactions
            AttachStacktrace: true,
        })
        if err != nil {
            log.Fatalf("sentry.Init: %s", err)
        }
    }
}

func setupRouter() *gin.Engine {
    r := gin.Default()

    // Sentry middleware
    if os.Getenv("SENTRY_DSN") != "" {
        r.Use(sentrygin.New(sentrygin.Options{
            Repanic: true,
        }))
    }

    // ... routes
}
```

## Performance Optimization

### Gzip Compression

```go
// main.go
import "github.com/gin-contrib/gzip"

func setupRouter() *gin.Engine {
    r := gin.Default()

    // Enable gzip compression
    r.Use(gzip.Gzip(gzip.DefaultCompression))

    // ... routes
}
```

### CORS Configuration

```go
// middleware/cors.go
import "github.com/gin-contrib/cors"

func SetupCORS() gin.HandlerFunc {
    config := cors.Config{
        AllowOrigins:     strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ","),
        AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
        ExposeHeaders:    []string{"Content-Length", "X-RateLimit-Limit", "X-RateLimit-Remaining"},
        AllowCredentials: true,
        MaxAge:           12 * time.Hour,
    }

    return cors.New(config)
}
```

### Database Query Optimization

```go
// Use indexes for common queries
CREATE INDEX idx_posts_scene_created ON posts(scene_id, created_at DESC);
CREATE INDEX idx_posts_campaign_created ON posts(campaign_id, created_at DESC);
CREATE INDEX idx_characters_campaign ON characters(campaign_id);
CREATE INDEX idx_scenes_campaign ON scenes(campaign_id);

// Use prepared statements
stmt, err := db.Prepare("SELECT * FROM posts WHERE scene_id = $1 ORDER BY created_at DESC LIMIT $2")
defer stmt.Close()

// Use connection pooling (configured above)
```

### Caching (Optional - Redis)

```go
// cache/redis.go
import (
    "github.com/go-redis/redis/v8"
)

var RedisClient *redis.Client

func InitRedis() {
    RedisClient = redis.NewClient(&redis.Options{
        Addr:     os.Getenv("REDIS_URL"),
        Password: os.Getenv("REDIS_PASSWORD"),
        DB:       0,
    })
}

// Cache campaign data
func GetCampaign(ctx context.Context, id uuid.UUID) (*models.Campaign, error) {
    cacheKey := fmt.Sprintf("campaign:%s", id)

    // Try cache first
    cached, err := RedisClient.Get(ctx, cacheKey).Result()
    if err == nil {
        var campaign models.Campaign
        json.Unmarshal([]byte(cached), &campaign)
        return &campaign, nil
    }

    // Fetch from database
    campaign, err := db.GetCampaign(ctx, id)
    if err != nil {
        return nil, err
    }

    // Cache for 5 minutes
    data, _ := json.Marshal(campaign)
    RedisClient.Set(ctx, cacheKey, data, 5*time.Minute)

    return campaign, nil
}
```

## Backup Strategy

### Automated Backups

Supabase provides automatic daily backups. Additional strategies:

1. **Point-in-Time Recovery** (Supabase Pro):
   - Enable in Supabase dashboard
   - Allows restore to any point in last 7 days

2. **Manual Backups**:
   ```bash
   # Scheduled via cron or Railway job
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

   # Upload to S3 or Supabase Storage
   aws s3 cp backup-*.sql s3://vanguard-backups/
   ```

3. **Application-level Exports**:
   ```go
   // Export campaign to JSON
   func (h *CampaignHandler) ExportCampaign(c *gin.Context) {
       campaignID := c.Param("id")

       // Fetch complete campaign data
       export := h.service.ExportCampaign(ctx, campaignID)

       // Return as downloadable JSON
       c.Header("Content-Disposition", "attachment; filename=campaign-export.json")
       c.JSON(http.StatusOK, export)
   }
   ```

### Backup Retention

- Daily backups: Keep 30 days
- Weekly backups: Keep 12 weeks
- Monthly backups: Keep 12 months

## Deployment Checklist

### Pre-deployment

- [ ] All environment variables configured
- [ ] Database migrations tested
- [ ] RLS policies enabled and tested
- [ ] SSL certificate configured
- [ ] Domain DNS records updated
- [ ] Health check endpoint working
- [ ] Rate limiting configured
- [ ] Email service configured (if using)
- [ ] Sentry error tracking configured (if using)
- [ ] Backup strategy implemented

### Deployment

- [ ] Push to main branch (triggers Railway deploy)
- [ ] Monitor deployment logs
- [ ] Verify health check passes
- [ ] Test critical user flows
- [ ] Verify real-time subscriptions work
- [ ] Check database connection pooling
- [ ] Verify email delivery
- [ ] Test rate limiting
- [ ] Check error tracking

### Post-deployment

- [ ] Monitor application logs
- [ ] Monitor database performance
- [ ] Check error rates in Sentry
- [ ] Verify backups running
- [ ] Test disaster recovery procedure
- [ ] Monitor API response times
- [ ] Check rate limit hit rates
- [ ] Review user feedback

## Monitoring Dashboard

### Key Metrics to Monitor

1. **Application Metrics**:
   - Request rate (req/sec)
   - Error rate (4xx, 5xx)
   - Response time (p50, p95, p99)
   - Active users

2. **Database Metrics**:
   - Connection pool usage
   - Query performance
   - Slow queries
   - Database size

3. **Business Metrics**:
   - Active campaigns
   - Posts per day
   - User signups
   - Feature usage

### Alerting Rules

```yaml
# Example alerting configuration (Sentry, PagerDuty, etc.)
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5m
    severity: critical

  - name: Slow Response Time
    condition: p95_response_time > 1000ms
    duration: 5m
    severity: warning

  - name: Database Connection Pool Exhausted
    condition: db_connections > 90% max
    duration: 2m
    severity: critical

  - name: Health Check Failed
    condition: health_check_status != 200
    duration: 1m
    severity: critical
```

## Scaling Considerations

### Horizontal Scaling

Railway supports horizontal scaling:

```bash
# Scale to 2 instances
railway up --replicas 2
```

Considerations:
- Use Redis for shared session state
- Ensure database can handle increased connections
- Load balancer distributes traffic

### Vertical Scaling

Upgrade Railway plan for more resources:
- More CPU cores
- More RAM
- Better disk I/O

### Database Scaling

Supabase scaling options:
- Upgrade to larger instance
- Enable connection pooling (PgBouncer)
- Add read replicas
- Optimize queries and indexes

## Disaster Recovery

### Recovery Procedures

1. **Database Corruption**:
   ```bash
   # Restore from Supabase backup
   # Via Supabase dashboard or CLI
   supabase db reset
   ```

2. **Application Failure**:
   ```bash
   # Rollback to previous deployment
   railway rollback
   ```

3. **Data Loss**:
   ```bash
   # Restore from point-in-time backup
   # Via Supabase dashboard (Pro plan)
   ```

### Recovery Time Objectives (RTO)

- Critical outage: < 1 hour
- Data corruption: < 4 hours
- Complete disaster: < 24 hours

### Recovery Point Objectives (RPO)

- Maximum data loss: < 1 hour (with point-in-time recovery)
- Without PITR: < 24 hours (daily backups)

## Security Hardening

### Production Security Checklist

- [ ] JWT secrets are strong random values
- [ ] Database credentials rotated regularly
- [ ] API keys stored in environment variables (not code)
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] CORS restricted to production domains
- [ ] Rate limiting enabled
- [ ] RLS policies tested and enabled
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (content sanitization)
- [ ] CSRF protection enabled
- [ ] Security headers configured
- [ ] Dependency vulnerabilities scanned
- [ ] Secrets scanning enabled in GitHub
- [ ] Access logs monitored

### Security Headers

```go
// middleware/security.go
func SecurityHeaders() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("X-Content-Type-Options", "nosniff")
        c.Header("X-Frame-Options", "DENY")
        c.Header("X-XSS-Protection", "1; mode=block")
        c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        c.Header("Content-Security-Policy", "default-src 'self'")
        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

        c.Next()
    }
}
```

## Cost Optimization

### Railway Pricing

Monitor usage to optimize costs:

- **Free Tier**: $0 (limited resources)
- **Pro Plan**: $20/month + usage
- **Team Plan**: Custom pricing

### Cost Reduction Strategies

1. **Optimize Database**:
   - Remove unused indexes
   - Archive old data
   - Optimize queries to reduce CPU usage

2. **Optimize Storage**:
   - Compress images before upload
   - Implement storage limits per campaign
   - Clean up orphaned files

3. **Optimize Compute**:
   - Use connection pooling
   - Enable caching where appropriate
   - Optimize API response sizes

4. **Monitor Usage**:
   ```bash
   railway metrics
   ```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Check connection pool settings
   - Verify DATABASE_URL is correct
   - Check Supabase status

2. **Slow Response Times**:
   - Check database query performance
   - Review application logs
   - Monitor CPU/memory usage

3. **Real-time Not Working**:
   - Verify Supabase Real-time enabled
   - Check JWT authentication
   - Review RLS policies

4. **Email Not Sending**:
   - Verify SMTP credentials
   - Check email service status
   - Review email logs

### Debug Mode

Enable debug logging temporarily:

```bash
railway variables set GIN_MODE=debug
railway variables set LOG_LEVEL=debug
```

Remember to revert after debugging:

```bash
railway variables set GIN_MODE=release
railway variables set LOG_LEVEL=info
```

## Maintenance

### Regular Maintenance Tasks

**Daily**:
- Monitor error logs
- Check health check status
- Review rate limit violations

**Weekly**:
- Review database performance
- Check backup status
- Update dependencies if needed
- Review user feedback

**Monthly**:
- Rotate credentials
- Review and optimize queries
- Update documentation
- Security audit
- Cost review

**Quarterly**:
- Disaster recovery drill
- Performance review
- Capacity planning
- Security assessment
