import { prisma } from '@/lib/prisma'
import { STORY_TEMPLATES, type StoryTemplate, type StoryType } from './story-bank'

export type StoryStatus = 'ACTIVE' | 'RESOLVED' | 'ESCAPED' | 'PENDING'

export interface StoryContext {
  id: string
  storyType: StoryType
  description: string
  angle: string
  promptTemplate: string
  amount: number | null
  status: StoryStatus
  previousStoryDescription?: string
}

class StoryManager {
  
  /**
   * Récupère la story active pour un contact
   */
  async getActiveStory(contactId: string, agentId: string): Promise<StoryContext | null> {
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
    
    if (!story) return null
    
    return {
      id: story.id,
      storyType: story.storyType as StoryType,
      description: story.description,
      angle: story.angle,
      promptTemplate: story.promptTemplate,
      amount: story.amount,
      status: story.status as StoryStatus,
      previousStoryDescription: story.previousStory?.description
    }
  }
  
  /**
   * Vérifie si on peut créer une nouvelle story (cooldown 72h)
   */
  async canCreateNewStory(contactId: string, agentId: string): Promise<boolean> {
    const lastResolved = await prisma.story.findFirst({
      where: {
        contactId,
        agentId,
        status: 'RESOLVED',
        amount: { not: null } // Uniquement les stories avec argent
      },
      orderBy: { resolvedAt: 'desc' }
    })
    
    if (!lastResolved?.resolvedAt) return true
    
    const hoursSince = (Date.now() - lastResolved.resolvedAt.getTime()) / (1000 * 60 * 60)
    return hoursSince >= 72 // 3 jours minimum
  }
  
  /**
   * Crée une nouvelle story (suite logique ou nouvelle)
   */
  async createStory(
    contactId: string, 
    agentId: string,
    preferredType?: StoryType
  ): Promise<StoryContext> {
    
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
      // Chercher une conséquence logique
      const chainOptions = STORY_TEMPLATES[lastResolved.storyType as StoryType]
        .filter(t => 
          t.requiresPrevious === lastResolved.description &&
          !usedDescriptions.has(t.description)
        )
      
      if (chainOptions.length > 0) {
        template = chainOptions[0]
      } else {
        // Chaîne épuisée, changer de catégorie
        template = this.getRandomTemplateFromDifferentCategory(
          lastResolved.storyType as StoryType,
          usedDescriptions
        )
      }
    } else {
      // Nouvelle story ou préférence donnée
      const type = preferredType || 'FILLER'
      const available = STORY_TEMPLATES[type].filter(t => !usedDescriptions.has(t.description))
      template = available.length > 0 
        ? available[0] 
        : STORY_TEMPLATES.FILLER[0] // Fallback
    }
    
    // 5. Créer en DB
    const story = await prisma.story.create({
      data: {
        agentId,
        contactId,
        storyType: template.type,
        description: template.description,
        angle: template.angle,
        promptTemplate: template.prompt,
        amount: template.amount,
        status: 'ACTIVE',
        previousStoryId: lastResolved?.id
      }
    })
    
    return {
      id: story.id,
      storyType: story.storyType as StoryType,
      description: story.description,
      angle: story.angle,
      promptTemplate: story.promptTemplate,
      amount: story.amount,
      status: 'ACTIVE',
      previousStoryDescription: lastResolved?.description
    }
  }
  
  /**
   * Récupère une story filler (sans argent) pour attendre
   */
  async getFillerStory(contactId: string, agentId: string): Promise<StoryContext> {
    const usedStories = await prisma.story.findMany({
      where: { contactId, agentId },
      select: { description: true }
    })
    const usedDescriptions = new Set(usedStories.map(s => s.description))
    
    const available = STORY_TEMPLATES.FILLER.filter(t => !usedDescriptions.has(t.description))
    const template = available[0] || STORY_TEMPLATES.FILLER[0]
    
    // Créer la filler story
    const story = await prisma.story.create({
      data: {
        agentId,
        contactId,
        storyType: 'FILLER',
        description: template.description,
        angle: template.angle,
        promptTemplate: template.prompt,
        amount: null,
        status: 'ACTIVE'
      }
    })
    
    return {
      id: story.id,
      storyType: 'FILLER',
      description: story.description,
      angle: story.angle,
      promptTemplate: story.promptTemplate,
      amount: null,
      status: 'ACTIVE'
    }
  }
  
  /**
   * Marque une story comme résolue (paiement reçu)
   */
  async resolveStory(storyId: string): Promise<void> {
    await prisma.story.update({
      where: { id: storyId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date()
      }
    })
    
    console.log(`[StoryManager] Story ${storyId} marked as RESOLVED`)
  }
  
  /**
   * Marque une story comme échappée (il n'a pas payé, on abandonne)
   */
  async escapeStory(storyId: string): Promise<void> {
    await prisma.story.update({
      where: { id: storyId },
      data: {
        status: 'ESCAPED',
        resolvedAt: new Date()
      }
    })
    
    console.log(`[StoryManager] Story ${storyId} marked as ESCAPED`)
  }
  
  /**
   * Récupère l'historique des stories résolues (pour anti-répétition)
   */
  async getResolvedStories(contactId: string, agentId: string): Promise<string[]> {
    const stories = await prisma.story.findMany({
      where: {
        contactId,
        agentId,
        status: 'RESOLVED'
      },
      orderBy: { resolvedAt: 'desc' }
    })
    
    return stories.map(s => s.description)
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
    usedDescriptions: Set<string>
  ): StoryTemplate {
    const types: StoryType[] = ['FACTURE', 'SANTE', 'FAMILLE', 'ECOLE', 'TRANSPORT']
    const availableTypes = types.filter(t => t !== excludeType)
    
    for (const type of availableTypes) {
      const available = STORY_TEMPLATES[type].filter(t => 
        !usedDescriptions.has(t.description) && !t.requiresPrevious
      )
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
