# Lead Provider System

## Overview

The Lead Provider System allows external providers to add leads (WhatsApp or Discord contacts) directly through a dedicated PWA interface, replacing the previous WhatsApp-based "smart add" workflow.

## Architecture

### Database Schema

```prisma
enum Role {
  ADMIN
  COLLABORATOR
  PROVIDER  // NEW
}

enum LeadType {
  WHATSAPP
  DISCORD
}

enum LeadStatus {
  PENDING
  IMPORTED
  CONVERTED
  REJECTED
}

model Lead {
  id            String
  providerId    String   // Who added the lead
  agentId       String   // Target agent for the lead
  type          LeadType
  identifier    String   // Phone or Discord username
  age           Int?
  location      String?
  notes         String?
  context       String?
  source        String   // Where the lead was found
  status        LeadStatus
  pricePaid     Float    @default(4.0)  // $4 per lead
  contactId     String?  // Link to created Contact
}

model ProviderConfig {
  id          String
  providerId  String   @unique
  agentId     String   // All leads go to this agent
}
```

### API Routes

#### Provider Routes (Protected - PROVIDER only)
- `GET/POST /api/provider/leads` - List/create leads
- `GET /api/provider/stats` - Dashboard statistics
- `GET /api/provider/check-duplicate` - Check for existing leads

#### Admin Routes (Protected - ADMIN only)
- `GET/POST/PUT/DELETE /api/admin/providers` - Manage providers
- `GET /api/admin/provider-leads` - View all leads with filters

### Frontend

#### Provider PWA (`/provider/*`)
1. **Dashboard** (`/provider`) - Stats, earnings, quick add button
2. **Add Lead** (`/provider/add`) - Smart form with duplicate detection
3. **History** (`/provider/history`) - List of all added leads

Features:
- Bottom navigation (mobile PWA)
- Desktop sidebar navigation
- Real-time duplicate detection
- Type switching (WhatsApp/Discord)
- Form validation

#### Admin Interface
1. **Team Management** (`/admin/team`) - Tab "Providers" to create/manage providers
2. **Lead Tracking** (`/admin/provider-leads`) - View all leads with filters

## Business Logic

### Lead Creation Flow
1. Provider fills form (type, identifier, info, source, context)
2. System checks for duplicates
3. Creates Lead record
4. Creates Contact record automatically
5. Creates AgentContact binding
6. Creates Conversation (paused state)
7. Updates Lead status to IMPORTED

### Pricing
- Fixed price: **$4 per lead**
- Tracked in `Lead.pricePaid`
- Weekly tracking available via `Lead.paidWeek`

### Status Lifecycle
```
PENDING → IMPORTED → CONVERTED/REJECTED
```
- **PENDING**: Just created, not yet processed
- **IMPORTED**: Contact created in system
- **CONVERTED**: Became paying customer
- **REJECTED**: Invalid/bad lead

## Security

### Role-Based Access
- **PROVIDER**: Can only access `/provider/*` routes
- **COLLABORATOR**: Cannot access provider pages
- **ADMIN**: Full access, can create providers

### Middleware Protection
```typescript
// Redirects non-providers from /provider
if (!isProvider && isProviderPage) {
    return NextResponse.redirect(new URL("/admin", req.url))
}

// Redirects providers from admin/workspace
if (isProvider && (isAdminPage || isWorkspacePage)) {
    return NextResponse.redirect(new URL("/provider", req.url))
}
```

## Usage

### Creating a Provider (Admin)
1. Go to `/admin/team`
2. Switch to "Providers" tab
3. Click "Add Provider"
4. Fill email, password, and assign an agent
5. Provider can now log in at `/login`

### Adding a Lead (Provider)
1. Log in as provider
2. Go to "Add Lead" page
3. Select type (WhatsApp/Discord)
4. Enter identifier (phone/username)
5. Fill optional info (age, location, context)
6. Enter source (where found)
7. Submit - duplicate check runs automatically

### Viewing Leads (Admin)
1. Go to `/admin/provider-leads`
2. Filter by provider, status, date range
3. View lead details including context and notes
4. Track costs ($4 per lead)

## File Structure

```
app/
├── provider/
│   ├── layout.tsx          # Provider layout with bottom nav
│   ├── page.tsx            # Dashboard
│   ├── add/page.tsx        # Add lead form
│   └── history/page.tsx    # Lead history
├── admin/
│   ├── team/page.tsx       # Updated with Providers tab
│   └── provider-leads/page.tsx  # Lead tracking
└── api/
    ├── provider/
    │   ├── leads/route.ts
    │   ├── stats/route.ts
    │   └── check-duplicate/route.ts
    └── admin/
        ├── providers/route.ts
        └── provider-leads/route.ts

components/
└── dashboard/
    └── create-provider-dialog.tsx

prisma/
└── schema.prisma           # Updated with Lead, ProviderConfig
```

## Future Enhancements

- [ ] Bulk CSV import for providers
- [ ] Push notifications when lead converts
- [ ] Provider commission dashboard
- [ ] Lead quality scoring
- [ ] Automatic status sync from contact lifecycle
