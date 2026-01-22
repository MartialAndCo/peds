self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json()
        const options = {
            body: data.body,
            icon: '/icon.png', // Ensure you have an icon in public/
            badge: '/icon.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2',
                url: data.url || '/'
            },
            actions: [
                { action: 'explore', title: 'View Details' },
                { action: 'close', title: 'Close' }
            ]
        }
        event.waitUntil(self.registration.showNotification(data.title, options))
    }
})

self.addEventListener('notificationclick', function (event) {
    console.log('Notification click received.')
    event.notification.close()

    if (event.action === 'close') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            // Check if there's already a tab open with this URL
            const url = event.notification.data.url
            for (const client of clientList) {
                if (client.url === url && 'focus' in client) return client.focus()
            }
            if (clients.openWindow) return clients.openWindow(url)
        })
    )
})
