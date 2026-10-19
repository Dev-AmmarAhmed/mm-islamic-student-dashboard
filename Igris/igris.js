// File Path: /Igris/igris.js

import { ref, query, orderByChild, startAfter, onChildAdded, onChildChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

export function syncWithIgrisCache(db, nodePath, cacheKey, timestampField, callback) {
    let cachedData = {};
    
    // 1. Pehle local storage se data load karein (Zero Bandwidth)
    try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) cachedData = JSON.parse(raw);
    } catch (e) {
        console.error("Igris Cache Error:", e);
    }

    // Turant UI ko data bhej dein taaki loading spinner na dikhe
    callback(cachedData);

    // 2. Pata lagayein aakhri record kab aaya tha
    let lastTimestamp = 0;
    const items = Object.values(cachedData);
    if (items.length > 0) {
        lastTimestamp = Math.max(...items.map(i => i[timestampField] || 0));
    }

    const dbRef = ref(db, nodePath);

    // 3. Sirf NAYE items mangwayein (Bandwidth saver)
    let liveQuery = lastTimestamp > 0 
        ? query(dbRef, orderByChild(timestampField), startAfter(lastTimestamp))
        : query(dbRef, orderByChild(timestampField));

    onChildAdded(liveQuery, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            cachedData[snapshot.key] = data;
            localStorage.setItem(cacheKey, JSON.stringify(cachedData));
            callback(cachedData); // UI Update karein
        }
    });

    // 4. Agar kisi student ke points update hon, toh sirf wahi update download karein
    onChildChanged(dbRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            cachedData[snapshot.key] = data;
            localStorage.setItem(cacheKey, JSON.stringify(cachedData));
            callback(cachedData); // UI Update karein
        }
    });
}
