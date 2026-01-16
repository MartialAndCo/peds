import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportData {
    contact: {
        name: string
        phone_whatsapp: string
        status: string
        createdAt: Date
        notes?: string
        trustScore?: number
    }
    photos: { url: string, timestamp: Date }[]
    history: { timestamp: Date, sender: string, text: string, media: string | null }[]
}

export async function generateDossier(data: ExportData) {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15

    // --- PAGE 1: HEADER & PROFILE ---
    doc.setFontSize(22)
    doc.text("DOSSIER DE CONTACT", margin, 20)

    doc.setFontSize(16)
    doc.text(data.contact.name, margin, 35)

    doc.setFontSize(10)
    doc.text(`Phone: ${data.contact.phone_whatsapp}`, margin, 42)
    doc.text(`Status: ${data.contact.status}`, margin, 47)
    doc.text(`Created: ${new Date(data.contact.createdAt).toLocaleDateString()}`, margin, 52)
    if (data.contact.notes) doc.text(`Notes: ${data.contact.notes}`, margin, 57)

    // --- PHOTOS SECTION ---
    let yPos = 70
    doc.setFontSize(14)
    doc.text("Media Gallery (Reçu)", margin, yPos)
    yPos += 10

    if (data.photos.length > 0) {
        const photoSize = 40
        const gap = 5
        let xPos = margin

        // Limit to first 9 photos (3x3) for cover page
        const coverPhotos = data.photos.slice(0, 9)

        for (let i = 0; i < coverPhotos.length; i++) {
            const photo = coverPhotos[i]
            try {
                // Fetch image data explicitly to avoid CORS issues if possible, or assume Base64/Public URL
                // If it's a URL, jsPDF addImage might fail if tainted.
                // Best practice: fetch blob, convert to base64.
                const imgData = await fetchImageAsBase64(photo.url)

                if (imgData) {
                    doc.addImage(imgData, 'JPEG', xPos, yPos, photoSize, photoSize)
                    xPos += photoSize + gap

                    if ((i + 1) % 4 === 0) { // Wrap after 4? No, layout fits 3-4 depending on margin. Page width ~210mm.
                        // 15 + 40 + 5 + 40 + 5 + 40 + 5 + 40 = 185. Fits 4 comfortably.
                        xPos = margin
                        yPos += photoSize + gap
                    }
                }
            } catch (e) {
                console.error("Failed to load image for PDF", e)
                doc.setDrawColor(200)
                doc.rect(xPos, yPos, photoSize, photoSize) // Placeholder
                doc.setFontSize(8)
                doc.text("Error", xPos + 5, yPos + 20)
                xPos += photoSize + gap
                if ((i + 1) % 4 === 0) { xPos = margin; yPos += photoSize + gap }
            }
        }
    } else {
        doc.setFontSize(10)
        doc.text("No shared photos.", margin, yPos + 5)
    }

    // --- PAGE 2+: HISTORY ---
    doc.addPage()
    doc.setFontSize(14)
    doc.text("Conversation History", margin, 20)

    const tableData = data.history.map(m => [
        new Date(m.timestamp).toLocaleString(),
        m.sender.toUpperCase(),
        m.media ? `[MEDIA: ${m.media}]` : m.text
    ])

    autoTable(doc, {
        startY: 25,
        head: [['Date', 'Sender', 'Message']],
        body: tableData,
        columnStyles: {
            0: { cellWidth: 40 }, // Date
            1: { cellWidth: 25 }, // Sender
            2: { cellWidth: 'auto' } // Message
        },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 40, 40] }
    })

    // Save
    doc.save(`Dossier_${data.contact.name.replace(/\s+/g, '_')}.pdf`)
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        if (url.startsWith('data:')) return url
        const response = await fetch(url)
        const blob = await response.blob()
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
        })
    } catch (e) {
        return null
    }
}
