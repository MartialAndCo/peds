
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportData {
    contact: {
        name: string | null
        phone_whatsapp: string | null
        status: string
        createdAt: Date
        notes?: string | null
        trustScore?: number | null
    }
    photos: { url: string | null, timestamp: Date }[]
    history: { timestamp: Date, sender: string, text: string, media: string | null }[]
}

// Utility to break long words (like JSON tokens)
function breakLongWords(str: string | null, chunkSize = 30): string {
    if (!str) return '';
    return str.replace(new RegExp(`(?![^\\n]{1,${chunkSize}}$)([^\\n]{1,${chunkSize}})(?!\\n)`, 'g'), '$1\u200B');
}

export async function generateDossier(data: ExportData) {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15

    // --- PRE-FETCH HISTORY MEDIA ---
    const historyWithMedia = await Promise.all(data.history.map(async (m) => {
        let mediaData = null
        if (m.media) {
            mediaData = await fetchImageAsBase64(m.media)
        }
        return { ...m, mediaData }
    }))

    // --- PAGE 1: HEADER & PROFILE ---
    doc.setFontSize(22)
    doc.text("DOSSIER DE CONTACT", margin, 20)

    doc.setFontSize(16)
    doc.text(data.contact.name || 'Unknown Contact', margin, 35)

    doc.setFontSize(10)
    doc.text(`Phone: ${data.contact.phone_whatsapp || 'N/A'}`, margin, 42)
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
        const coverPhotos = data.photos.slice(0, 9)

        for (let i = 0; i < coverPhotos.length; i++) {
            const photo = coverPhotos[i]
            try {
                if (!photo.url) continue
                const imgData = await fetchImageAsBase64(photo.url)

                if (imgData) {
                    doc.addImage(imgData, 'JPEG', xPos, yPos, photoSize, photoSize)
                    xPos += photoSize + gap
                    if ((i + 1) % 4 === 0) {
                        xPos = margin
                        yPos += photoSize + gap
                    }
                }
            } catch (e) {
                doc.setDrawColor(200)
                doc.rect(xPos, yPos, photoSize, photoSize)
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

    const tableData = historyWithMedia.map(m => [
        new Date(m.timestamp).toLocaleString(),
        m.sender.toUpperCase(),
        breakLongWords(m.text)
    ])

    autoTable(doc, {
        startY: 25,
        head: [['Date', 'Sender', 'Message']],
        body: tableData,
        columnStyles: {
            0: { cellWidth: 40 }, // Date
            1: { cellWidth: 25 }, // Sender
            2: { cellWidth: 'auto', overflow: 'linebreak' } // Message
        },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [40, 40, 40] },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
                const rowIndex = data.row.index
                const item = historyWithMedia[rowIndex]
                if (item && item.mediaData) {
                    // Force extra height for image (approx 50px)
                    // If text is long, it will auto-grow. We ensure MIN height.
                    data.cell.styles.minCellHeight = 50
                }
            }
        },
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 2) {
                const rowIndex = data.row.index
                const item = historyWithMedia[rowIndex]
                if (item && item.mediaData) {
                    try {
                        // Draw image below text OR at top if no text
                        // We'll draw it at (x + 2, y + textHeight + 2)
                        // Actually, autoTable vertically centers by default unless valign top.
                        // Default valign is 'top'.

                        const padding = 2
                        const imgWidth = 40
                        const imgHeight = 40

                        // Using data.cell.y ensures we are in the cell
                        // We place it at the bottom of the cell or just strictly at a fixed offset?
                        // Since we set minCellHeight=50, we have space.
                        // Let's create a small predictable offset.

                        // Issue: We don't know exactly how much space the text took.
                        // But since we want to show the image, maybe we just put it at a fixed top offset 
                        // and let text flow around it? No, text flows first.

                        // Simple approach: Put image at bottom of cell.
                        // data.cell.y is top of cell. data.cell.height includes all content.

                        const x = data.cell.x + padding
                        // Put image at y + 5 (overlap text?) or y + height - 42?
                        // Let's put it at y + 5 for now, it assumes text is short or we accept overlap.
                        // BETTER: Put it at y + cell.height - imgHeight - padding
                        // This ensures it's at the bottom.

                        const y = data.cell.y + data.cell.height - imgHeight - padding

                        doc.addImage(item.mediaData, 'JPEG', x, y, imgWidth, imgHeight)
                    } catch (e) {
                        // ignore draw error
                    }
                }
            }
        }
    })

    // Save
    doc.save(`Dossier_${(data.contact.name || 'Unknown').replace(/\s+/g, '_')}.pdf`)
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
    try {
        if (!url) return null
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
