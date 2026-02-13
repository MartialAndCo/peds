import { prisma } from '@/lib/prisma'
import { STORY_TEMPLATES, type StoryTemplate, type StoryType } from './story-bank'

export type StoryStatus = 'ACTIVE' | 'RESOLVED' | 'ESCAPED' | 'PENDING'

export interface StoryContext {
  id: string
  storyType: StoryType
  description: string
  descriptionEn?: string
  angle: string
  angleEn?: string
  promptTemplate: string
  amount: number | null
  status: StoryStatus
  previousStoryDescription?: string
}

// Cache simple pour éviter les re-requêtes fréquentes
interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

class StoryManager {
  private activeStoryCache = new Map<string, CacheEntry<StoryContext | null>>()
  private resolvedStoriesCache = new Map<string, CacheEntry<string[]>>()
  private canCreateCache = new Map<string, CacheEntry<boolean>>()
  
  private getCacheKey(contactId: string, agentId: string): string {
    return `${agentId}:${contactId}`
  }
  
  private isValid<T>(entry: CacheEntry<T> | undefined): boolean {
    if (!entry) return false
    return Date.now() - entry.timestamp < CACHE_TTL
  }
  
  // Invalider le cache lors d'une mutation
  private invalidateCache(contactId: string, agentId: string): void {
    const key = this.getCacheKey(contactId, agentId)
    this.activeStoryCache.delete(key)
    this.resolvedStoriesCache.delete(key)
    this.canCreateCache.delete(key)
  }
  
  /**
   * Récupère la story active pour un contact (avec cache)
   */
  async getActiveStory(contactId: string, agentId: string): Promise<StoryContext | null> {
    const key = this.getCacheKey(contactId, agentId)
    const cached = this.activeStoryCache.get(key)
    
    if (this.isValid(cached)) {
      console.log(`[StoryManager] Cache hit for active story: ${key}`)
      return cached!.data
    }
    
    const story = await prisma.story.findFirst({
      where: {
        contactId,
        agentId,
        status: 'ACTIVE'
      },
      include: {
        previousStory: true
      }
    })
    
    const result = story ? {
      id: story.id,
      storyType: story.storyType as StoryType,
      description: story.description,
      angle: story.angle,
      promptTemplate: story.promptTemplate,
      amount: story.amount,
      status: story.status as StoryStatus,
      previousStoryDescription: story.previousStory?.description
    } : null
    
    this.activeStoryCache.set(key, { data: result, timestamp: Date.now() })
    return result
  }
  
  /**
   * Vérifie si on peut créer une nouvelle story (cooldown 72h) (avec cache)
   */
  async canCreateNewStory(contactId: string, agentId: string): Promise<boolean> {
    const key = this.getCacheKey(contactId, agentId)
    const cached = this.canCreateCache.get(key)
    
    if (this.isValid(cached)) {
      console.log(`[StoryManager] Cache hit for canCreate: ${key}`)
      return cached!.data
    }
    
    const lastResolved = await prisma.story.findFirst({
      where: {
        contactId,
        agentId,
        status: 'RESOLVED',
        amount: { not: null } // Uniquement les stories avec argent
      },
      orderBy: { resolvedAt: 'desc' }
    })
    
    if (!lastResolved?.resolvedAt) {
      this.canCreateCache.set(key, { data: true, timestamp: Date.now() })
      return true
    }
    
    const hoursSince = (Date.now() - lastResolved.resolvedAt.getTime()) / (1000 * 60 * 60)
    const result = hoursSince >= 72 // 3 jours minimum
    this.canCreateCache.set(key, { data: result, timestamp: Date.now() })
    return result
  }
  
  /**
   * Détermine si la locale est française
   */
  private isFrench(locale?: string): boolean {
    return !locale || locale.toLowerCase().startsWith('fr')
  }

  /**
   * Crée une nouvelle story (suite logique ou nouvelle)
   */
  async createStory(
    contactId: string, 
    agentId: string,
    preferredType?: StoryType,
    locale?: string
  ): Promise<StoryContext> {
    const isFrench = this.isFrench(locale)
    
    // 1. Vérifier s'il y a une story active
    const active = await this.getActiveStory(contactId, agentId)
    if (active) return active
    
    // 2. Récupérer la dernière story résolée pour la chaîne
    const lastResolved = await prisma.story.findFirst({
      where: {
        contactId,
        agentId,
        status: 'RESOLVED'
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // 3. Récupérer toutes les stories déjà utilisées
    const usedStories = await prisma.story.findMany({
      where: { contactId, agentId },
      select: { description: true }
    })
    const usedDescriptions = new Set(usedStories.map(s => s.description))
    
    // 4. Choisir le template
    let template: StoryTemplate
    
    if (lastResolved?.storyType && !preferredType) {
      // Chercher une conséquence logique (comparer avec FR ou EN)
      // La description stockée en DB peut être en FR ou EN selon la locale de l'agent
      const lastResolvedDesc = lastResolved.description
      
      const chainOptions = STORY_TEMPLATES[lastResolved.storyType as StoryType]
        .filter(t => {
          // Vérifier si la description résolue correspond au template (FR ou EN)
          const matchesResolved = t.description === lastResolvedDesc || t.descriptionEn === lastResolvedDesc
          // Vérifier que le template n'a pas déjà été utilisé (comparer avec les descriptions en FR ou EN)
          const desc = isFrench ? t.description : t.descriptionEn
          const reqPrev = isFrench ? t.requiresPrevious : t.requiresPreviousEn
          return matchesResolved && reqPrev && !usedDescriptions.has(desc)
        })
      
      if (chainOptions.length > 0) {
        template = chainOptions[0]
      } else {
        // Chaîne épuisée, changer de catégorie
        template = this.getRandomTemplateFromDifferentCategory(
          lastResolved.storyType as StoryType,
          usedDescriptions,
          isFrench
        )
      }
    } else {
      // Nouvelle story ou préférence donnée
      const type = preferredType || 'FILLER'
      const available = STORY_TEMPLATES[type].filter(t => {
        const desc = isFrench ? t.description : t.descriptionEn
        return !usedDescriptions.has(desc)
      })
      template = available.length > 0 
        ? available[0] 
        : STORY_TEMPLATES.FILLER[0] // Fallback
    }
    
    // 5. Sélectionner les champs selon la locale
    const description = isFrench ? template.description : template.descriptionEn
    const angle = isFrench ? template.angle : template.angleEn
    const promptTemplate = isFrench ? template.prompt : template.promptEn
    // La description de la story précédente est celle stockée en DB (dans sa langue originale)
    const previousStoryDescription = lastResolved?.description

    // 6. Créer en DB
    const story = await prisma.story.create({
      data: {
        agentId,
        contactId,
        storyType: template.type,
        description,
        angle,
        promptTemplate,
        amount: template.amount,
        status: 'ACTIVE',
        previousStoryId: lastResolved?.id
      }
    })
    
    // Invalider le cache car nouvelle story créée
    this.invalidateCache(contactId, agentId)
    
    return {
      id: story.id,
      storyType: story.storyType as StoryType,
      description: story.description,
      descriptionEn: isFrench ? undefined : template.descriptionEn,
      angle: story.angle,
      angleEn: isFrench ? undefined : template.angleEn,
      promptTemplate: story.promptTemplate,
      amount: story.amount,
      status: 'ACTIVE',
      previousStoryDescription
    }
  }
  
  /**
   * Récupère une story filler (sans argent) pour attendre
   */
  async getFillerStory(contactId: string, agentId: string, locale?: string): Promise<StoryContext> {
    const isFrench = this.isFrench(locale)
    
    const usedStories = await prisma.story.findMany({
      where: { contactId, agentId },
      select: { description: true }
    })
    const usedDescriptions = new Set(usedStories.map(s => s.description))
    
    const available = STORY_TEMPLATES.FILLER.filter(t => {
      const desc = isFrench ? t.description : t.descriptionEn
      return !usedDescriptions.has(desc)
    })
    const template = available[0] || STORY_TEMPLATES.FILLER[0]
    
    // Sélectionner les champs selon la locale
    const description = isFrench ? template.description : template.descriptionEn
    const angle = isFrench ? template.angle : template.angleEn
    const promptTemplate = isFrench ? template.prompt : template.promptEn
    
    // Créer la filler story
    const story = await prisma.story.create({
      data: {
        agentId,
        contactId,
        storyType: 'FILLER',
        description,
        angle,
        promptTemplate,
        amount: null,
        status: 'ACTIVE'
      }
    })
    
    // Invalider le cache car nouvelle story créée
    this.invalidateCache(contactId, agentId)
    
    return {
      id: story.id,
      storyType: 'FILLER',
      description: story.description,
      descriptionEn: isFrench ? undefined : template.descriptionEn,
      angle: story.angle,
      angleEn: isFrench ? undefined : template.angleEn,
      promptTemplate: story.promptTemplate,
      amount: null,
      status: 'ACTIVE'
    }
  }
  
  /**
   * Marque une story comme résolue (paiement reçu)
   */
  async resolveStory(storyId: string, contactId?: string, agentId?: string): Promise<void> {
    await prisma.story.update({
      where: { id: storyId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date()
      }
    })
    
    // Invalider le cache si on a les IDs
    if (contactId && agentId) {
      this.invalidateCache(contactId, agentId)
    }
    
    console.log(`[StoryManager] Story ${storyId} marked as RESOLVED`)
  }
  
  /**
   * Marque une story comme échappée (il n'a pas payé, on abandonne)
   */
  async escapeStory(storyId: string, contactId?: string, agentId?: string): Promise<void> {
    await prisma.story.update({
      where: { id: storyId },
      data: {
        status: 'ESCAPED',
        resolvedAt: new Date()
      }
    })
    
    // Invalider le cache si on a les IDs
    if (contactId && agentId) {
      this.invalidateCache(contactId, agentId)
    }
    
    console.log(`[StoryManager] Story ${storyId} marked as ESCAPED`)
  }
  
  /**
   * Récupère l'historique des stories résolues (pour anti-répétition) (avec cache)
   */
  async getResolvedStories(contactId: string, agentId: string): Promise<string[]> {
    const key = this.getCacheKey(contactId, agentId)
    const cached = this.resolvedStoriesCache.get(key)
    
    if (this.isValid(cached)) {
      console.log(`[StoryManager] Cache hit for resolved stories: ${key}`)
      return cached!.data
    }
    
    const stories = await prisma.story.findMany({
      where: {
        contactId,
        agentId,
        status: 'RESOLVED'
      },
      orderBy: { resolvedAt: 'desc' }
    })
    
    const result = stories.map(s => s.description)
    this.resolvedStoriesCache.set(key, { data: result, timestamp: Date.now() })
    return result
  }
  
  /**
   * Met à jour le lastMentionedAt
   */
  async updateLastMentioned(storyId: string): Promise<void> {
    await prisma.story.update({
      where: { id: storyId },
      data: { lastMentionedAt: new Date() }
    })
  }
  
  /**
   * Helper: trouve un template d'une catégorie différente
   */
  private getRandomTemplateFromDifferentCategory(
    excludeType: StoryType,
    usedDescriptions: Set<string>,
    isFrench: boolean = true
  ): StoryTemplate {
    const types: StoryType[] = ['FACTURE', 'SANTE', 'FAMILLE', 'ECOLE', 'TRANSPORT']
    const availableTypes = types.filter(t => t !== excludeType)
    
    for (const type of availableTypes) {
      const available = STORY_TEMPLATES[type].filter(t => {
        const desc = isFrench ? t.description : t.descriptionEn
        const reqPrev = isFrench ? t.requiresPrevious : t.requiresPreviousEn
        return !usedDescriptions.has(desc) && !reqPrev
      })
      if (available.length > 0) return available[0]
    }
    
    // Fallback
    return STORY_TEMPLATES.FILLER[0]
  }
  
  /**
   * Récupère le contexte complet pour le prompt
   */
  async getStoryContextForPrompt(
    contactId: string, 
    agentId: string
  ): Promise<{
    activeStory: StoryContext | null
    resolvedStories: string[]
    canAskForMoney: boolean
    suggestedAmount: number | null
  }> {
    
    const activeStory = await this.getActiveStory(contactId, agentId)
    const resolvedStories = await this.getResolvedStories(contactId, agentId)
    const canAsk = await this.canCreateNewStory(contactId, agentId)
    
    return {
      activeStory,
      resolvedStories,
      canAskForMoney: canAsk,
      suggestedAmount: activeStory?.amount || null
    }
  }
}

export const storyManager = new StoryManager()
