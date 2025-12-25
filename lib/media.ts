import { prisma } from '@/lib/prisma';
import { whatsapp } from '@/lib/whatsapp';

export const mediaService = {
    // 1. Detect if message is a media request
    async detectIntent(text: string) {
        // Fetch all media types
        const types = await prisma.mediaType.findMany();
        const lowerText = text.toLowerCase();

        // Find matching type based on keywords
        const match = types.find(t =>
            t.keywords.some(k => lowerText.includes(k.toLowerCase()))
        );

        return match || null;
    },

    // 2. Process a request from a user
    async processRequest(contactPhone: string, typeId: string) {
        console.log(`[Media] Processing request for ${typeId} from ${contactPhone}`);

        // A. Check if user already received ANY media of this type?
        // (The prompt says: "Check if user has NEVER received this media". 
        // Logic: Try to find a media NOT in sentTo.)

        // Get all medias of this type
        const allMedias = await prisma.media.findMany({
            where: { typeId }
        });

        // Filter: Media NOT sent to this user
        const availableMedias = allMedias.filter(m => !m.sentTo.includes(contactPhone));

        if (availableMedias.length > 0) {
            // Pick one (random or rotation)
            // Logic says "if < sent total ... send one they haven't seen"
            // Since we filtered by !sentTo, any of availableMedias is "one they haven't seen".
            const mediaToSend = availableMedias[0];
            return { action: 'SEND', media: mediaToSend };
        }

        // B. No media available for this user
        // Check if user has received ALL medias?
        // If allMedias.length > 0 and availableMedias.length == 0 => User saw everything.

        // Logic says: "If she received < total currently in bank ... send different one."
        // We already handled that above (availableMedias > 0).

        // "If she received ALL ... Pass to request workflow."
        // Also if bank is empty (allMedias.length == 0).

        // So we need to Request from Source.
        return { action: 'REQUEST_SOURCE' };
    },

    // 3. Request from Source
    async requestFromSource(contactPhone: string, typeId: string) {
        // Get Source Phone
        const settings = await prisma.setting.findUnique({ where: { key: 'source_phone_number' } });
        const sourcePhone = settings?.value;

        if (!sourcePhone) {
            console.error('[Media] No SOURCE_PHONE configured.');
            return false;
        }

        // Check if pending request exists to avoid spamming?
        // "Sauvegarder Demande en attente"
        const existing = await prisma.pendingRequest.findFirst({
            where: {
                typeId,
                requesterPhone: contactPhone,
                status: 'pending'
            }
        });

        if (!existing) {
            await prisma.pendingRequest.create({
                data: {
                    typeId,
                    requesterPhone: contactPhone,
                    status: 'pending'
                }
            });

            // Send WhatsApp to Source
            const msg = `📸 *New Media Request*\n\nUser ${contactPhone} wants: *${typeId}*\n\nReply with a photo/video to send it to them.`;
            await whatsapp.sendText(sourcePhone, msg);
            return true;
        }

        return true; // Already pending
    },

    // 4. Ingest Media from Source
    async ingestMedia(sourcePhone: string, mediaData: string, mimeType: string) {
        // Assuming mediaData is Base64 Data URL or similar? 
        // Actually for now let's assume we upload it or store the Data URL directly (not recommended for large files but OK for POC).
        // Or better: We utilize the fact that we just received it.

        // "Sauvegarder le média dans la banque avec le type correspondant"
        // Problem: How do we know the TYPE of the media?
        // 1. Source explicitly captions it?
        // 2. Or we infer from the LAST pending request sent to Source?

        // Let's look at pending requests.
        // If there are pending requests, we fill them.

        // Strategy: "Récupérer qui attendait (User X)".
        // If there are multiple types pending, it's ambiguous.
        // Simplification: Assume Source replies to the request.
        // We can fetch the most recent PendingRequest.

        const latestPending = await prisma.pendingRequest.findFirst({
            where: { status: 'pending' },
            orderBy: { createdAt: 'desc' }
        });

        if (!latestPending) {
            console.log('[Media] Source sent media but no pending requests found. Saving as "uncategorized"? or rejecting?');
            // Store as uncategorized or "misc"
            return null;
        }

        const typeId = latestPending.typeId;

        // Save to Bank
        // Note: Storing Base64 in DB is bad. Ideally upload to S3. 
        // For this task, I'll store it in DB (Media.url) if it fits, or assume we have an upload service.
        // Prisma String is Text (unlimited in Postgres). Base64 is fine for POC.

        const newMedia = await prisma.media.create({
            data: {
                typeId,
                url: mediaData, // Base64 Data URL
                sentTo: []
            }
        });

        // Fulfill Pending Request(s)
        // Logic: "Chercher: Y a-t-il une Demande en attente pour ce TYPE ?"
        // Yes, `latestPending` is one.
        // Are there others for the same type? 
        // "Envoyer le média à User X"
        // "Supprimer la demande en attente" (or mark fulfilled)

        // We fulfill ALL pending requests for this TYPE with this new media? 
        // Or just one?
        // Plan says: "Récupérer qui attendait (User X)... Envoyer... Supprimer".
        // Let's fulfill the one we found.

        const contactPhone = latestPending.requesterPhone;

        // Send to User
        if (mimeType.startsWith('image')) {
            await whatsapp.sendImage(contactPhone, mediaData); // mediaData is dataURL
        } else if (mimeType.startsWith('video')) {
            await whatsapp.sendVideo(contactPhone, mediaData);
        } else {
            await whatsapp.sendVoice(contactPhone, mediaData); // Fallback?
        }

        // Mark as sent
        await prisma.media.update({
            where: { id: newMedia.id },
            data: {
                sentTo: { push: contactPhone }
            }
        });

        // Close Pending Request
        await prisma.pendingRequest.update({
            where: { id: latestPending.id },
            data: { status: 'fulfilled' }
        });

        // Also log to Mem0? (Task says yes)

        return { sentTo: contactPhone, type: typeId };
    }
};
