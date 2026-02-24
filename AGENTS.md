# PedsAI - Agent Documentation

> **Project**: Peds (PedsAI) - AI-Powered WhatsApp/Discord Bot Management Platform
> **Last Updated**: 2026-02-13

---

## Project Overview

PedsAI is a sophisticated multi-agent AI platform designed to manage conversational AI personas across WhatsApp and Discord. The system enables operators to create and manage AI agents that engage in natural, context-aware conversations with contacts, progressing through defined relationship phases while maintaining consistent personas.

### Core Capabilities

- **Multi-Agent Management**: Create and manage multiple AI agents with distinct personas, voice models, and payment configurations
- **Phase-Based Conversations**: Conversations progress through phases (CONNECTION → VULNERABILITY → CRISIS → MONEYPOT)
- **Signal-Based Trust System**: Discrete behavioral signals (RESPONSIVE, ATTACHED, DEFENSIVE, HESITANT, etc.) instead of numeric trust scores
- **AI Swarm Orchestration**: Multi-node AI processing pipeline (Intention → Persona/Timing/Phase/Style/Safety → Memory/Payment/Media/Voice → Response → Validation)
- **Voice Message Support**: Transcription (Qwen TTS) and voice synthesis (ElevenLabs) integration with admin validation workflow
- **Payment Tracking**: Integrated payment claim handling with escalation tiers and romantic escalation strategies
- **AI Health Monitoring**: Supervisor AI system with 4 specialized agents (CoherenceAgent, ContextAgent, PhaseAgent, ActionAgent) monitoring AI coherence
- **System Monitoring**: Real-time error tracking across all services with SSE live dashboard at `/admin/system`
- **Discord Integration**: Cross-platform bot support via Discord self-bot service
- **Lead Provider System**: Dedicated interface for external lead providers ($4/lead)
- **PWA Dashboard**: Progressive Web App for mobile management with push notifications
- **Story Narrative System**: Dynamic story generation (FACTURE, SANTE, FAMILLE, ECOLE, TRANSPORT, URGENCE, FILLER)

---

## Technology Stack

### Core Framework
- **Next.js**: 16.1.1 (App Router)
- **React**: 19.2.3
- **TypeScript**: 5.x (Strict mode enabled)
- **Node.js**: 20+ (Docker containers)

### Database & ORM
- **Database**: PostgreSQL (via Prisma ORM 5.22.0)
- **Schema**: `prisma/schema.prisma` (860+ lines, 40+ models)
- **Connection**: Configured via `DATABASE_URL` env var
- **Migrations**: Applied during build via `npx prisma migrate deploy`

### Authentication & Authorization
- **NextAuth.js**: 4.24.13 with JWT strategy
- **Credentials Provider**: Email/password with bcryptjs
- **Role-Based Access**: ADMIN, COLLABORATOR, and PROVIDER roles
- **Middleware Enforcement**: Route-level access control in `middleware.ts`

### UI/Styling
- **Tailwind CSS**: v4 with PostCSS
- **Component Library**: Radix UI primitives (shadcn/ui pattern)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Animations**: Framer Motion

### AI Providers
- **Venice AI**: Primary provider (`google-gemma-3-27b-it`, `google-gemma-3-27b-it`)
- **Anthropic**: Claude 3 Haiku fallback
- **OpenRouter**: Additional model access
- **RunPod**: Self-hosted fallback for Venice failures
- **Mem0**: Memory extraction and context

### External Services
- **WhatsApp**: Baileys library (`@whiskeysockets/baileys`) via Docker service on port 3001
- **Discord**: Self-bot service via `discord.js-selfbot-v13` on port 3002
- **Voice**: ElevenLabs API for TTS, Qwen for transcription
- **Storage**: Supabase (images, audio, documents)
- **Payments**: PayPal webhook integration
- **Cron**: Scheduled job runner (message queue, memory extraction, voice processing)

---

## Project Structure

```
├── app/                          # Next.js App Router
│   ├── admin/                    # Admin dashboard pages
│   ├── provider/                 # Lead provider interface
│   ├── workspace/[agentId]/      # Agent workspace (COLLABORATOR role)
│   ├── api/                      # API routes (REST endpoints)
│   ├── login/                    # Auth pages
│   ├── layout.tsx                # Root layout with providers
│   └── page.tsx                  # Landing page
│
├── lib/                          # Core business logic
│   ├── handlers/                 # Message handlers
│   │   ├── chat.ts               # Main chat processing (platform-agnostic)
│   │   ├── admin.ts              # Admin command handlers
│   │   └── media.ts              # Media (image/video) handling
│   ├── services/                 # Business services
│   │   ├── supervisor/           # AI health monitoring system
│   │   │   ├── orchestrator.ts   # Main supervisor coordinator
│   │   │   ├── coherence-agent.ts
│   │   │   ├── context-agent.ts
│   │   │   ├── phase-agent.ts
│   │   │   └── action-agent.ts
│   │   ├── payment-escalation.ts # Payment tier logic
│   │   ├── signal-analyzer.ts    # Trust signal detection
│   │   ├── queue-service.ts      # Message queue management
│   │   └── payment-claim-handler.ts
│   ├── swarm/                    # AI swarm orchestration
│   │   ├── index.ts              # Main swarm runner
│   │   ├── graph.ts              # Execution graph
│   │   ├── nodes/                # Individual swarm nodes
│   │   │   ├── intention-node.ts # Message intent analysis
│   │   │   ├── persona-node.ts   # Identity context
│   │   │   ├── phase-node.ts     # Phase-specific rules
│   │   │   ├── payment-node.ts   # Payment context
│   │   │   ├── memory-node.ts    # Memory retrieval
│   │   │   ├── media-node.ts     # Media request handling
│   │   │   ├── voice-node.ts     # Voice context
│   │   │   ├── safety-node.ts    # Safety checks
│   │   │   ├── response-node.ts  # AI response generation
│   │   │   └── validation-node.ts
│   │   └── types.ts
│   ├── monitoring/               # System monitoring
│   │   ├── log-aggregator.ts     # Multi-source log collection
│   │   ├── error-patterns.ts     # Error classification
│   │   └── system-logger.ts      # System log creation
│   ├── prompts/                  # AI prompt templates
│   ├── engine/                   # Story narrative system
│   │   ├── story-bank.ts
│   │   └── story-manager.ts
│   ├── venice.ts                 # Venice AI client with retry logic
│   ├── anthropic.ts              # Anthropic client
│   ├── openrouter.ts             # OpenRouter client
│   ├── runpod.ts                 # RunPod fallback client
│   ├── director.ts               # Phase determination (legacy stub)
│   ├── prisma.ts                 # Database client singleton
│   └── auth.ts                   # NextAuth configuration
│
├── components/                   # React components
│   ├── ui/                       # Base UI components (shadcn/ui)
│   ├── pwa/                      # PWA-specific components
│   └── providers.tsx             # Context providers
│
├── services/                     # Docker services
│   ├── baileys/                  # WhatsApp server (Node.js + Fastify)
│   ├── discord/                  # Discord bot (Node.js + Fastify)
│   └── cron/                     # Cron job runner (Alpine Linux)
│
├── prisma/
│   └── schema.prisma             # Database schema
│
├── hooks/                        # React hooks
├── types/                        # TypeScript definitions
├── scripts/                      # Utility scripts
└── tests/                        # Test files
```

---

## Build & Development

### Prerequisites
- Node.js 20+
- PostgreSQL database (or use Docker Compose for local dev)
- WhatsApp Business API credentials (via Baileys)

### Environment Variables

Create `.env` file based on `.env.example`:

```bash
# -----------------------------
# WAHA Configuration (WhatsApp)
# -----------------------------
WAHA_ENDPOINT="http://localhost:3001"
WAHA_API_KEY="secret"
WAHA_SESSION="default"

# -----------------------------
# AI Providers
# -----------------------------
VENICE_API_KEY=""
VENICE_MODEL="google-gemma-3-27b-it"
ANTHROPIC_API_KEY=""
ANTHROPIC_MODEL="claude-3-haiku-20240307"
AI_PROVIDER="venice"

# -----------------------------
# Voice Configuration (ElevenLabs)
# -----------------------------
ELEVENLABS_API_KEY=""
ELEVENLABS_VOICE_ID="21m00Tcm4TlvDq8ikWAM"
VOICE_RESPONSE_ENABLED="true"

# -----------------------------
# Database
# -----------------------------
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."  # For migrations

# -----------------------------
# Server / Auth (NextAuth)
# -----------------------------
NEXTAUTH_URL="http://localhost:3005"
NEXTAUTH_SECRET="change_me_to_random_string"

# -----------------------------
# Supabase Storage
# -----------------------------
NEXT_PUBLIC_SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""

# -----------------------------
# Webhooks & Services
# -----------------------------
WEBHOOK_SECRET="your_webhook_secret"
DISCORD_SERVICE_URL="http://localhost:3002"
AUTH_TOKEN="secret"  # For inter-service auth

# -----------------------------
# PWA Push Notifications
# -----------------------------
NEXT_PUBLIC_VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
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
npx prisma generate      # Generate client (runs automatically on postinstall)
npx prisma db push       # Push schema changes (dev only)
npx prisma migrate dev   # Create migration
npx prisma migrate deploy # Apply migrations (production)
npx prisma studio        # Open Prisma Studio
```

### Docker Services

```bash
# Start all services (WhatsApp, Discord, Cron)
docker-compose up -d

# View logs
docker-compose logs -f whatsapp-server
docker-compose logs -f discord-bot
docker-compose logs -f cron
```

**Services:**
- **whatsapp-server** (port 3001): Baileys WhatsApp bridge
- **discord-bot** (port 3002): Discord self-bot integration
- **cron** (no exposed port): Scheduled job runner with crontab

---

## Code Style Guidelines

### TypeScript Conventions
- **Strict Mode**: Enabled in `tsconfig.json`
- **Path Aliases**: Use `@/` for imports (configured in `tsconfig.json`)
- **Types**: Define return types for exported functions
- **Enums**: Use string enums for phase/states (not numeric)
- **Module System**: ES Modules (ESNext)

### File Naming
- **Components**: PascalCase (e.g., `ConversationView.tsx`)
- **Utilities**: camelCase (e.g., `chat.ts`, `payment-escalation.ts`)
- **API Routes**: `route.ts` inside named folders (Next.js App Router convention)
- **Server Actions**: `actions.ts` or named files in `app/actions/`

### React Patterns
- **Server Components**: Default for pages, use `'use client'` only when needed
- **Data Fetching**: Server Actions for mutations, direct DB calls in Server Components
- **State Management**: React hooks (useState, useEffect), no global state library
- **Route Groups**: Use `(group)` for layout grouping (though not currently used)

### Database Patterns
- **Raw Queries**: Avoid, use Prisma Client exclusively
- **Relations**: Always include related data explicitly with `include`
- **Transactions**: Use `$transaction` for multi-step operations
- **Connection**: Use singleton pattern from `lib/prisma.ts`

### AI/Swarm Patterns
- **Fallback Chain**: Venice → RunPod → Error with retry logic
- **Parallel Execution**: Fetch all required data in parallel using `Promise.all`
- **State Management**: Immutable state updates in swarm nodes
- **Error Handling**: Log to console AND use `logger` utility

---

## Testing

### Test Files
Located in `tests/` and `scripts/`:
- `tests/repetition_test.ts`: Repetition detection tests for Supervisor
- `scripts/test-escalation-system.ts`: Payment escalation verification
- `scripts/verify-phase4-integration.ts`: Phase 4 integration tests
- `test-nuance.ts`, `test-payment-context.ts`, `test-robustness.ts`: Various integration tests

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
- Discord webhooks: `/api/webhooks/discord`
- Use Baileys server running locally or via Docker
- Check logs: `docker-compose logs -f whatsapp-server`

---

## Key Architectural Concepts

### Phase System

Conversations progress through four phases based on detected behavioral signals:

```typescript
type AgentPhase = 'CONNECTION' | 'VULNERABILITY' | 'CRISIS' | 'MONEYPOT'
```

- **CONNECTION**: Initial rapport building, light conversation
- **VULNERABILITY**: Emotional depth and trust establishment
- **CRISIS**: Urgency/problem presentation, story activation
- **MONEYPOT**: Payment requests with romantic escalation tiers

### Signal-Based Trust

Instead of numeric trust scores, the system uses discrete signals:

```typescript
type TrustSignal = 'RESPONSIVE' | 'ATTACHED' | 'DEFENSIVE' | 'HESITANT' | 'ENGAGED' | 'WITHDRAWN' | ...
```

Signals are detected via `signalAnalyzer` and stored in `AgentContact.signals` (JSON array). The `SignalLog` model tracks all signal changes.

### Swarm Architecture

The AI response pipeline uses a directed graph of specialized nodes:

1. **intention-node**: Analyzes user message intent and needs
2. **Parallel nodes** (after intention): persona, timing, phase, style, safety
3. **Conditional nodes** (based on intention): memory, payment, media, voice
4. **response-node**: Generates final response using all contexts
5. **validation-node**: Validates response coherence

### Supervisor AI System

4 specialized agents monitor AI health:
- **CoherenceAgent**: Detects system leaks, repetitions, hallucinations
- **ContextAgent**: Monitors context retention across conversation
- **PhaseAgent**: Validates phase appropriateness
- **ActionAgent**: Checks for unrequested images/actions

Alerts are created with severity levels (LOW → CRITICAL), with automatic conversation pausing on CRITICAL.

### System Monitoring

Real-time error tracking across all services:
- **Multi-source logs**: WhatsApp (Baileys), Discord, Next.js, Cron
- **Error classification**: CRITICAL/ERROR/WARN/INFO with pattern detection (connection, API, database, memory, auth)
- **Live dashboard**: `/admin/system` with SSE real-time updates
- **Notifications**: PWA push notifications for CRITICAL errors
- **TTL cleanup**: Automatic deletion after 7 days via `expiresAt` field

**Key Components:**
- `lib/monitoring/log-aggregator.ts` - Fetches and parses logs from all sources
- `lib/monitoring/error-patterns.ts` - Detects error patterns
- `app/api/admin/monitor/stream/route.ts` - Server-Sent Events endpoint
- `app/admin/system/page.tsx` - Dashboard UI

### Payment Escalation

Dynamic payment request amounts based on tier system:
- 6 tiers (0-5) with increasing amounts ($30-50 up to $280-500)
- Escalates on confirmed payment (+1 tier)
- De-escalates on 2 consecutive refusals (-1 tier)
- Template variables: `{{SUGGESTED_AMOUNT}}`, `{{CURRENT_TIER}}`, `{{ESC_NEXT}}`

### Lead Provider System

External lead providers can add leads through a dedicated PWA interface:

**Flow:**
1. Provider logs in → sees dedicated provider interface (`/provider`)
2. Adds lead (WhatsApp or Discord) with context and source
3. System checks for duplicates via `/api/provider/check-duplicate`
4. Creates Contact + Conversation automatically
5. Lead assigned to provider's configured agent via `ProviderConfig`
6. Admin pays $4 per lead

**Models:**
```typescript
model Lead {
  id            String
  providerId    String
  agentId       String
  type          LeadType  // WHATSAPP | DISCORD
  identifier    String    // Phone or Discord username
  source        String    // Where found
  context       String?   // Conversation context
  status        LeadStatus // PENDING | IMPORTED | CONVERTED | REJECTED
  pricePaid     Float     @default(4.0)
}

model ProviderConfig {
  providerId    String    @unique
  agentId       String    // All leads go to this agent
}
```

---

## Security Considerations

### Authentication
- JWT-based sessions with NextAuth
- Middleware enforces auth on protected routes (`/admin`, `/workspace`, `/provider`)
- Role-based access: COLLABORATORs redirected from `/admin` to `/workspace`
- Providers restricted to `/provider` routes only

### Webhook Security
- All webhooks validate `x-internal-secret` header against `WEBHOOK_SECRET`
- WhatsApp webhooks use `WEBHOOK_SECRET` env var
- Discord webhooks use same secret mechanism

### Content Security Policy
Strict CSP configured in `next.config.ts`:
- `default-src 'self'`
- `script-src` allows `'unsafe-eval'` for AI processing
- `media-src` restricted to Supabase and known domains
- `connect-src` allows HTTPS and specific internal endpoints

### Database Security
- Use `SUPABASE_SERVICE_ROLE_KEY` only server-side
- Never expose `DATABASE_URL` to client
- Row-level security (RLS) recommended for Supabase (not currently enforced)

### API Security
- CORS not explicitly configured (defaults to same-origin)
- Rate limiting not implemented (rely on infrastructure/CDN)
- Input validation via Zod schemas (inferred from usage)

---

## Deployment

### AWS Amplify (Primary)

Configuration in `amplify.yml`:
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci --legacy-peer-deps
    build:
      commands:
        - env | grep ... >> .env.production
        - npx prisma migrate deploy
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
```

**Build Process:**
1. Install dependencies with legacy peer deps
2. Filter env vars to `.env.production`
3. Clear `.next` cache
4. Apply Prisma migrations
5. Build Next.js app

### Docker Compose (Services)

Three services defined in `docker-compose.yml`:
1. **whatsapp-server**: Baileys WhatsApp bridge (port 3001)
2. **discord-bot**: Discord integration (port 3002)
3. **cron**: Scheduled job runner (crontab-based)

### Environment-Specific Notes

**Development:**
- SQLite NOT supported (PostgreSQL required)
- Local Baileys server on port 3001
- Hot reload enabled (`npm run dev`)
- `ts-node-dev` for services

**Production:**
- PostgreSQL required
- Prisma migrations applied during build
- Docker services deployed separately
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

### Adding a Swarm Node
1. Create file in `lib/swarm/nodes/<name>-node.ts`
2. Implement node function returning `{ contexts: {...} }`
3. Register in `lib/swarm/index.ts` graph
4. Add to `IntentionResult` type if conditional

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
- Check session mapping in Agent settings

### Database Connection Errors
- Verify `DATABASE_URL` format (PostgreSQL)
- Ensure PostgreSQL is accessible
- Check SSL requirements for cloud DBs
- Verify migrations applied: `npx prisma migrate status`

### AI Response Issues
- Check AI provider API keys (Venice, Anthropic)
- Verify prompt templates in AgentProfile
- Review Supervisor alerts for coherence issues
- Check Venice credits/billing status

### Build Failures
- Run `npx prisma generate` before build
- Clear `.next` folder: `rm -rf .next`
- Check for TypeScript errors: `npx tsc --noEmit`
- Verify Node.js version 20+

### Docker Issues
- Ensure ports 3001, 3002 are free
- Check volume mounts for Baileys auth persistence
- Review service logs for startup errors

---

## Important Files Reference

| File | Purpose |
|------|---------|
| `lib/director.ts` | Phase determination logic (legacy stub) |
| `lib/handlers/chat.ts` | Main message processing (WhatsApp/Discord) |
| `lib/venice.ts` | Venice AI integration with retry/fallback |
| `lib/swarm/index.ts` | Swarm orchestration runner |
| `lib/services/supervisor/orchestrator.ts` | AI health monitoring |
| `lib/services/payment-escalation.ts` | Payment tier system |
| `lib/services/signal-analyzer.ts` | Trust signal detection |
| `lib/monitoring/log-aggregator.ts` | System log aggregation |
| `app/api/webhooks/whatsapp/route.ts` | WhatsApp webhook handler |
| `app/api/webhooks/discord/route.ts` | Discord webhook handler |
| `middleware.ts` | Auth middleware & role routing |
| `prisma/schema.prisma` | Database schema |

---

## Contact & Support

- **Documentation**: See `docs/` folder for additional guides
- **Supervisor AI**: See `SUPERVISOR-README.md`
- **Phase 4 Escalation**: See `QUICK-REFERENCE.md`
- **Architecture**: See `ARCHITECTURE_ULTIME_MAX_REVENUS.md`
- **Testing**: Check `scripts/` for verification tools
