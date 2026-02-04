# PedsAI - Agent Documentation

> **Project**: Peds (PedsAI) - AI-Powered WhatsApp Bot Management Platform
> **Last Updated**: 2026-02-04

---

## Project Overview

PedsAI is a sophisticated multi-agent AI platform designed to manage conversational AI personas on WhatsApp. The system enables operators to create and manage AI agents that engage in natural, context-aware conversations with contacts, progressing through defined relationship phases while maintaining consistent personas.

### Core Capabilities

- **Multi-Agent Management**: Create and manage multiple AI agents with distinct personas
- **Phase-Based Conversations**: Conversations progress through phases (CONNECTION → VULNERABILITY → CRISIS → MONEYPOT)
- **Signal-Based Trust System**: Discrete behavioral signals rather than numeric trust scores
- **Voice Message Support**: Transcription and voice synthesis integration
- **Payment Tracking**: Integrated payment claim handling with escalation tiers
- **AI Health Monitoring**: Supervisor AI system that monitors AI coherence and behavior
- **Discord Integration**: Cross-platform bot support
- **PWA Dashboard**: Progressive Web App for mobile management

---

## Technology Stack

### Core Framework
- **Next.js**: 16.1.1 (App Router)
- **React**: 19.2.3
- **TypeScript**: 5.x
- **Node.js**: 20+ (Docker containers)

### Database & ORM
- **Database**: PostgreSQL (via Prisma ORM 5.22.0)
- **Schema**: `prisma/schema.prisma` (675 lines, 30+ models)
- **Connection**: Configured via `DATABASE_URL` env var

### Authentication
- **NextAuth.js**: 4.24.13 with JWT strategy
- **Credentials Provider**: Email/password with bcrypt
- **Role-Based Access**: ADMIN and COLLABORATOR roles

### UI/Styling
- **Tailwind CSS**: v4 with PostCSS
- **Component Library**: Radix UI primitives
- **Icons**: Lucide React
- **Charts**: Recharts
- **Animations**: Framer Motion

### AI Providers
- **Venice AI**: Primary provider (`venice-uncensored`, `llama-3.3-70b`)
- **Anthropic**: Claude 3 Haiku fallback
- **OpenRouter**: Additional model access
- **Mem0**: Memory extraction and context

### External Services
- **WhatsApp**: Baileys library (WAHA-compatible API)
- **Voice**: ElevenLabs API for TTS
- **Storage**: Supabase (images, audio, documents)
- **Payments**: PayPal webhook integration
- **Discord**: Bot service for cross-platform

---

## Project Structure

```
├── app/                          # Next.js App Router
│   ├── (routes)/                 # Page routes
│   │   ├── admin/                # Admin dashboard pages
│   │   ├── workspace/[agentId]/  # Agent workspace
│   │   ├── api/                  # API routes (REST endpoints)
│   │   └── login/                # Auth pages
│   ├── actions/                  # Server Actions
│   └── layout.tsx                # Root layout
│
├── lib/                          # Core business logic
│   ├── handlers/                 # Message handlers
│   │   ├── chat.ts               # Main chat processing
│   │   ├── admin.ts              # Admin commands
│   │   └── media.ts              # Media handling
│   ├── services/                 # Business services
│   │   ├── supervisor/           # AI health monitoring
│   │   ├── payment-escalation.ts # Payment tier logic
│   │   ├── signal-analyzer.ts    # Trust signal detection
│   │   └── queue-service.ts      # Message queue
│   ├── prompts/                  # AI prompt templates
│   ├── swarm/                    # AI swarm orchestration
│   ├── director.ts               # Phase determination
│   ├── venice.ts                 # Venice AI client
│   ├── anthropic.ts              # Anthropic client
│   └── prisma.ts                 # Database client
│
├── components/                   # React components
│   ├── ui/                       # Base UI components
│   ├── pwa/                      # PWA-specific components
│   └── providers.tsx             # Context providers
│
├── services/                     # Docker services
│   ├── baileys/                  # WhatsApp server (Node.js)
│   ├── discord/                  # Discord bot
│   └── cron/                     # Cron job runner
│
├── prisma/
│   └── schema.prisma             # Database schema
│
├── hooks/                        # React hooks
├── types/                        # TypeScript definitions
└── scripts/                      # Utility scripts
```

---

## Build & Development

### Prerequisites
- Node.js 20+
- PostgreSQL database (or use Docker Compose)
- WhatsApp Business API credentials (via Baileys)

### Environment Variables

Create `.env` file based on `.env.example`:

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="random_string"
NEXTAUTH_URL="http://localhost:3000"

# WhatsApp (Baileys)
WAHA_ENDPOINT="http://localhost:3001"
WAHA_API_KEY="secret"
WAHA_SESSION="default"

# AI Providers
VENICE_API_KEY=""
ANTHROPIC_API_KEY=""
AI_PROVIDER="venice"

# Voice
ELEVENLABS_API_KEY=""

# Supabase
NEXT_PUBLIC_SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""

# Webhooks
WEBHOOK_SECRET="your_secret"
```

### Commands

```bash
# Development (starts Next.js dev server)
npm run dev

# Build (includes Prisma generation)
npm run build

# Production start
npm start

# Linting
npm run lint

# Database operations
npx prisma generate      # Generate client
npx prisma db push       # Push schema changes
npx prisma migrate dev   # Create migration
npx prisma studio        # Open Prisma Studio
```

### Docker Services

```bash
# Start all services (WhatsApp, Discord, Cron)
docker-compose up -d

# View logs
docker-compose logs -f whatsapp-server
```

---

## Code Style Guidelines

### TypeScript Conventions
- **Strict Mode**: Enabled in `tsconfig.json`
- **Path Aliases**: Use `@/` for imports (e.g., `@/lib/prisma`)
- **Types**: Always define return types for exported functions
- **Enums**: Use string enums for phase/states (not numeric)

### File Naming
- **Components**: PascalCase (e.g., `ConversationView.tsx`)
- **Utilities**: camelCase (e.g., `chat.ts`, `payment-escalation.ts`)
- **API Routes**: `route.ts` inside named folders
- **Server Actions**: `actions.ts` or named files in `app/actions/`

### React Patterns
- **Server Components**: Default for pages, use `'use client'` when needed
- **Data Fetching**: Use Server Actions for mutations, direct DB calls in Server Components
- **State Management**: React hooks (useState, useEffect), no global state library

### Database Patterns
- **Raw Queries**: Avoid, use Prisma Client
- **Relations**: Always include related data explicitly with `include`
- **Transactions**: Use `$transaction` for multi-step operations

---

## Key Architectural Concepts

### Phase System

Conversations progress through four phases based on detected behavioral signals:

```typescript
type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS' | 'MONEYPOT'
```

- **CONNECTION**: Initial rapport building
- **VULNERABILITY**: Emotional depth and trust
- **CRISIS**: Urgency/problem presentation
- **MONEYPOT**: Payment requests (with romantic escalation tiers)

### Signal-Based Trust

Instead of numeric trust scores, the system uses discrete signals:

```typescript
type TrustSignal = 'RESPONSIVE' | 'ATTACHED' | 'DEFENSIVE' | 'HESITANT' | ...
```

Signals are detected via `signalAnalyzer` and stored in `AgentContact.signals` (JSON array).

### Supervisor AI

4 specialized agents monitor AI health:
- **CoherenceAgent**: Detects system leaks, repetitions, hallucinations
- **ContextAgent**: Monitors context retention
- **PhaseAgent**: Validates phase transitions
- **ActionAgent**: Checks for unrequested images/actions

Alerts are created with severity levels (LOW → CRITICAL), with automatic conversation pausing on CRITICAL.

### Payment Escalation

Dynamic payment request amounts based on tier system:
- 6 tiers (0-5) with increasing amounts ($30-50 up to $280-500)
- Escalates on confirmed payment (+1 tier)
- De-escalates on 2 consecutive refusals (-1 tier)
- Template variables: `{{SUGGESTED_AMOUNT}}`, `{{CURRENT_TIER}}`, etc.

---

## Testing

### Test Files
Located in `tests/` and `scripts/`:
- `tests/repetition_test.ts`: Repetition detection tests
- `scripts/test-escalation-system.ts`: Payment escalation verification
- `scripts/verify-phase4-integration.ts`: Phase 4 integration tests

### Manual Testing
```bash
# Run escalation system test
npx tsx scripts/test-escalation-system.ts

# Verify Phase 4 integration
npx tsx scripts/verify-phase4-integration.ts

# View current Phase 4 prompt
npx tsx scripts/show-phase4-prompt.ts
```

### Webhook Testing
- WhatsApp webhooks: `/api/webhooks/whatsapp`
- Use Baileys server running locally or via Docker
- Check logs: `docker-compose logs -f whatsapp-server`

---

## Security Considerations

### Authentication
- JWT-based sessions with NextAuth
- Middleware enforces auth on protected routes (`/admin`, `/workspace`)
- Role-based access: COLLABORATORs redirected from `/admin`

### Webhook Security
- All webhooks validate `x-internal-secret` header
- WhatsApp webhooks use `WEBHOOK_SECRET` env var
- IP-based filtering recommended for production

### Content Security Policy
Strict CSP configured in `next.config.ts`:
- `default-src 'self'`
- `script-src` allows `'unsafe-eval'` for AI processing
- Media sources restricted to Supabase and known domains

### Database Security
- Use `SUPABASE_SERVICE_ROLE_KEY` only server-side
- Never expose `DATABASE_URL` to client
- Row-level security (RLS) recommended for Supabase

---

## Deployment

### AWS Amplify (Primary)

Configuration in `amplify.yml`:
```yaml
frontend:
  phases:
    preBuild:
      commands:
        - npm ci --legacy-peer-deps
    build:
      commands:
        - env | grep ... >> .env.production
        - npx prisma generate
        - npx prisma db push --accept-data-loss
        - npm run build
```

### Docker Compose (Services)

Three services defined in `docker-compose.yml`:
1. **whatsapp-server**: Baileys WhatsApp bridge (port 3001)
2. **discord-bot**: Discord integration (port 3002)
3. **cron**: Scheduled job runner

### Environment-Specific Notes

**Development**:
- SQLite supported via `file:./dev.db` (legacy)
- Local Baileys server on port 3001
- Hot reload enabled

**Production**:
- PostgreSQL required
- Prisma migrations applied during build
- Static generation for public pages

---

## Common Development Tasks

### Adding a New API Endpoint
1. Create folder in `app/api/<route>/route.ts`
2. Export `GET`, `POST`, etc. functions
3. Use `prisma` from `@/lib/prisma`
4. Return `NextResponse.json(data)`

### Adding a Database Model
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <description>`
3. Run `npx prisma generate`
4. Update related TypeScript types

### Creating a Server Action
1. Add file to `app/actions/` (or existing file)
2. Mark with `'use server'` at top
3. Use `revalidatePath()` to refresh UI
4. Call from Client Components

### Adding a Supervisor Agent
1. Create file in `lib/services/supervisor/<name>-agent.ts`
2. Implement agent logic extending base pattern
3. Register in `orchestrator.ts`
4. Add alert types to `types.ts`

---

## Troubleshooting

### WhatsApp Connection Issues
- Check Baileys server status: `docker-compose ps`
- Verify `WAHA_ENDPOINT` and `WAHA_API_KEY`
- Review logs: `docker-compose logs whatsapp-server`

### Database Connection Errors
- Verify `DATABASE_URL` format
- Ensure PostgreSQL is accessible
- Check SSL requirements for cloud DBs

### AI Response Issues
- Check AI provider API keys
- Verify prompt templates in AgentProfile
- Review Supervisor alerts for coherence issues

### Build Failures
- Run `npx prisma generate` before build
- Clear `.next` folder: `rm -rf .next`
- Check for TypeScript errors: `npx tsc --noEmit`

---

## Important Files Reference

| File | Purpose |
|------|---------|
| `lib/director.ts` | Phase determination logic |
| `lib/handlers/chat.ts` | Main message processing |
| `lib/venice.ts` | Venice AI integration |
| `lib/services/supervisor/orchestrator.ts` | AI health monitoring |
| `lib/services/payment-escalation.ts` | Payment tier system |
| `lib/services/signal-analyzer.ts` | Trust signal detection |
| `app/api/webhooks/whatsapp/route.ts` | WhatsApp webhook handler |
| `middleware.ts` | Auth middleware |
| `prisma/schema.prisma` | Database schema |

---

## Contact & Support

- **Documentation**: See `docs/` folder for additional guides
- **Supervisor AI**: See `SUPERVISOR-README.md`
- **Phase 4 Escalation**: See `QUICK-REFERENCE.md`
- **Testing**: Check `scripts/` for verification tools
